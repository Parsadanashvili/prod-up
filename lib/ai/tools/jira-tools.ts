import { tool, generateObject } from "ai";
import { z } from "zod";
import { getValidJiraCredentials } from "@/lib/jira/credentials";
import {
  JiraClient,
  type JiraTransition,
  type JiraStatus,
} from "@/lib/jira/client";
import { getChatModel } from "@/lib/ai/config";
import { createJiraTaskReference } from "@/lib/jira/queries";
import { generateJiraWeeklySummary } from "../jira-summary-generator";
import { startOfWeek, endOfWeek } from "date-fns";
import {
  createJiraPersonalUpdateDraft,
  getLatestJiraPersonalUpdateDraft,
} from "@/lib/db/queries";

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function sanitizeIssueKey(input: string) {
  const raw = String(input ?? "").trim();
  // common patterns from chat: "@PROJ-123", "PROJ-123.", "(PROJ-123)"
  const cleaned = raw
    .replace(/^@+/, "")
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/[^A-Za-z0-9-]+$/g, "")
    .toUpperCase();

  const match = cleaned.match(/[A-Z][A-Z0-9]+-\d+/);
  return match?.[0] ?? null;
}

function pickBestTransition(transitions: JiraTransition[], desired: string) {
  const desiredNorm = normalize(desired);
  // Prefer matching the target status name ("to.name") over transition name
  const scored = transitions
    .map((t) => {
      const toName = t.to?.name ?? "";
      const transitionName = t.name ?? "";
      const candidates = [normalize(toName), normalize(transitionName)].filter(
        Boolean
      );
      const exact = candidates.some((c) => c === desiredNorm);
      const contains = candidates.some(
        (c) => c.includes(desiredNorm) || desiredNorm.includes(c)
      );
      const score = exact ? 3 : contains ? 2 : 0;
      return { t, score, toName };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.score ? scored[0].t : null;
}

// Helper to create Jira tools with userId context
export function createJiraTools(userId: string) {
  // Get Jira user context (roles + key permissions)
  const getJiraUserContextTool = tool({
    description:
      "Get the current Jira user's roles and permissions. Use this to tailor behavior for developers vs admins (without any ranking/scoring).",
    inputSchema: z.object({
      projectKey: z
        .string()
        .optional()
        .describe("Optional project key to scope permission checks"),
    }),
    execute: async ({ projectKey }) => {
      const credentials = await getValidJiraCredentials(userId);
      if (!credentials) {
        return {
          success: false,
          message:
            "Jira account not connected. Please connect your Jira account first.",
        };
      }

      try {
        const jiraClient = new JiraClient({
          jira_cloud_id: credentials.jira_cloud_id,
          access_token: credentials.access_token,
        });

        const me = await jiraClient.getMyself();
        const perms = await jiraClient.getMyPermissions(projectKey, [
          "ADMINISTER",
          "ADMINISTER_PROJECTS",
        ]);

        const groups = (me.groups?.items ?? []).map((g) => g.name);
        const appRoles = (me.applicationRoles?.items ?? []).map((r) => r.key);

        const canAdministerProjects =
          perms.permissions?.ADMINISTER_PROJECTS?.havePermission ?? false;
        const canAdministerJira =
          perms.permissions?.ADMINISTER?.havePermission ?? false;

        // Heuristic: treat as "admin" if Jira says they can administer projects or Jira.
        const role =
          canAdministerJira || canAdministerProjects ? "admin" : "developer";

        console.log("perms", perms);
        console.log("role");

        return {
          success: true,
          role,
          user: {
            accountId: me.accountId,
            displayName: me.displayName,
            emailAddress: me.emailAddress ?? null,
          },
          groups,
          applicationRoles: appRoles,
          permissions: {
            canAdministerJira,
            canAdministerProjects,
          },
        };
      } catch (error) {
        // If scopes are missing, Jira returns 401 "scope does not match".
        const message =
          error instanceof Error
            ? error.message
            : "Failed to fetch Jira user context";
        if (message.includes("scope does not match")) {
          return {
            success: false,
            needsReconnect: true,
            message:
              "Your Jira connection is missing required scopes (read:jira-user). Please reconnect Jira from /jira/connect.",
          };
        }
        console.error("Error fetching Jira user context:", error);
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch Jira user context",
        };
      }
    },
  });

  // Auto-generated personal update (developer-focused)
  const generatePersonalUpdateTool = tool({
    description:
      "Generate a developer's personal weekly update (draft) from Jira: completed work, unfinished work, blockers, and private nudges. This should be supportive and private (no ranking/scoring).",
    inputSchema: z.object({
      projectKey: z
        .string()
        .optional()
        .describe(
          "Optional Jira project key to scope the update (e.g., 'PROJ')"
        ),
    }),
    execute: async ({ projectKey }) => {
      const credentials = await getValidJiraCredentials(userId);
      if (!credentials) {
        return {
          success: false,
          message:
            "Jira account not connected. Please connect your Jira account first.",
        };
      }

      try {
        const jiraClient = new JiraClient({
          jira_cloud_id: credentials.jira_cloud_id,
          access_token: credentials.access_token,
        });

        const jqlBase = `assignee = currentUser() ORDER BY updated DESC`;
        const jql = projectKey
          ? `assignee = currentUser() AND project = "${projectKey}" ORDER BY updated DESC`
          : jqlBase;

        const resp = await jiraClient.searchIssues(
          jql,
          [
            "summary",
            "status",
            "assignee",
            "created",
            "updated",
            "priority",
            "labels",
          ],
          100
        );

        const issues = resp.issues.map((issue) => ({
          key: issue.key,
          title: issue.fields.summary,
          status: issue.fields.status.name,
          statusCategory: issue.fields.status.statusCategory.key,
          updated: issue.fields.updated,
          created: issue.fields.created,
          assignee: issue.fields.assignee
            ? {
                name: issue.fields.assignee.displayName,
                email: issue.fields.assignee.emailAddress,
              }
            : null,
          priority: issue.fields.priority?.name,
          description: issue.fields.description,
        }));

        const done = issues
          .filter((i) => i.statusCategory === "done")
          .slice(0, 10);
        const notDone = issues
          .filter((i) => i.statusCategory !== "done")
          .slice(0, 10);
        const stale = issues
          .filter((i) => {
            const d = new Date(i.updated);
            return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24) >= 3;
          })
          .slice(0, 5);

        // Let AI write the draft using only these extracted fields.
        const { object } = await generateObject({
          model: getChatModel(),
          schema: z.object({
            answers: z.object({
              completed: z.string(),
              notCompleted: z.string(),
              blocked: z.string(),
            }),
            draft: z.string(),
            nudges: z.array(z.string()),
          }),
          prompt: `You are writing a private, supportive weekly update draft for a software developer.
Rules:
- No ranking, no scoring, no judgement.
- Keep it concise.
- If blockers are unknown, say what needs clarification (don't invent causes).
- Use the 3 questions exactly.

Data (Jira):
Completed (done category):
${done.map((i) => `- ${i.key}: ${i.title}`).join("\n") || "None"}

Not completed (not done categories):
${
  notDone.map((i) => `- ${i.key}: ${i.title} (${i.status})`).join("\n") ||
  "None"
}

Stale (not updated for ~3+ days):
${stale.map((i) => `- ${i.key}: ${i.title} (${i.status})`).join("\n") || "None"}

Return:
- answers.completed / answers.notCompleted / answers.blocked (plain text)
- draft: a single combined update message the dev can send
- nudges: 0-3 private nudges (e.g., stale, carryover), phrased gently`,
        });

        // Store draft + task snapshot so it can be applied to Jira later
        try {
          await createJiraPersonalUpdateDraft({
            userId,
            projectKey: projectKey ?? null,
            tasks: issues,
            update: object,
          });
        } catch (e) {
          console.warn("Failed to store personal update draft:", e);
        }

        return {
          success: true,
          update: object,
          tasks: issues,
          jiraSiteUrl: credentials.jira_site_url,
        };
      } catch (error) {
        console.error("Error generating personal update:", error);
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Failed to generate personal update",
        };
      }
    },
  });

  // Apply latest personal update to Jira issues by posting per-issue comments
  const applyLatestPersonalUpdateToJiraTool = tool({
    description:
      "Apply the latest generated personal weekly update to Jira by adding per-issue comments. This maps completion/blockers/notes to each issue and posts comments (no overwriting, no scoring).",
    inputSchema: z.object({
      draftText: z
        .string()
        .optional()
        .describe(
          "Optional updated draft text (if the user edited the draft). If omitted, uses the latest stored draft."
        ),
    }),
    execute: async ({ draftText }) => {
      const credentials = await getValidJiraCredentials(userId);
      if (!credentials) {
        return {
          success: false,
          message:
            "Jira account not connected. Please connect your Jira account first.",
        };
      }

      const latest = await getLatestJiraPersonalUpdateDraft(userId);
      if (!latest) {
        return {
          success: false,
          message:
            "No weekly update draft found. Generate your weekly update first.",
        };
      }

      const tasks = latest.tasks_json;
      const update = latest.update_json;
      const effectiveDraft =
        draftText && draftText.trim() ? draftText : update?.draft;

      if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        return {
          success: false,
          message:
            "No tasks found in the latest draft context. Generate your weekly update again.",
        };
      }

      if (!effectiveDraft || typeof effectiveDraft !== "string") {
        return {
          success: false,
          message:
            "No draft text available to apply. Generate your weekly update again.",
        };
      }

      try {
        const jiraClient = new JiraClient({
          jira_cloud_id: credentials.jira_cloud_id,
          access_token: credentials.access_token,
        });

        // Ask AI to map the update into per-issue comments (only for tasks in the snapshot)
        const { object } = await generateObject({
          model: getChatModel(),
          schema: z.object({
            comments: z.array(
              z.object({
                issueKey: z.string(),
                comment: z.string(),
              })
            ),
          }),
          prompt: `You are applying a developer's private weekly update to Jira issues as comments.
Rules:
- Only use issue keys from the provided task list.
- Do NOT invent work that isn't in the draft.
- Comments should be short (1-5 lines) and helpful (status + reason/next step).
- No judgement, no scoring.

Task list (issueKey, title, status, statusCategory):
${tasks
  .slice(0, 25)
  .map((t: any) => `- ${t.key}: ${t.title} (${t.status}) [${t.statusCategory}]`)
  .join("\n")}

Weekly update draft:
${effectiveDraft}

Create comments for the most relevant issues (max 10). If uncertain, skip the issue rather than guessing.
Return JSON with: comments: [{ issueKey, comment }]`,
        });

        const applied: Array<{
          issueKey: string;
          ok: boolean;
          error?: string;
        }> = [];

        for (const c of object.comments.slice(0, 10)) {
          const key = sanitizeIssueKey(c.issueKey) ?? c.issueKey;
          try {
            await jiraClient.addComment(key, c.comment);
            applied.push({ issueKey: key, ok: true });
          } catch (e) {
            applied.push({
              issueKey: key,
              ok: false,
              error: e instanceof Error ? e.message : "Failed to add comment",
            });
          }
        }

        return {
          success: true,
          applied,
          message: `Applied comments to ${
            applied.filter((a) => a.ok).length
          } issue(s).`,
        };
      } catch (error) {
        console.error("Error applying update to Jira:", error);
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Failed to apply update to Jira",
        };
      }
    },
  });

  // List Jira issues tool
  const listJiraIssuesTool = tool({
    description:
      "List Jira issues assigned to the user or search for issues. Use this to see what tasks the user is working on.",
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe("Optional search query to filter issues by text"),
      maxResults: z
        .number()
        .optional()
        .default(20)
        .describe("Maximum number of issues to return"),
    }),
    execute: async ({ query, maxResults }) => {
      // Get valid credentials (automatically refreshes if expired)
      const credentials = await getValidJiraCredentials(userId);
      if (!credentials) {
        return {
          success: false,
          message:
            "Jira account not connected. Please connect your Jira account first.",
          issues: [],
        };
      }

      try {
        const jiraClient = new JiraClient({
          jira_cloud_id: credentials.jira_cloud_id,
          access_token: credentials.access_token,
        });

        let searchResponse;
        if (query && query.trim()) {
          searchResponse = await jiraClient.searchIssuesByText(
            query,
            maxResults
          );
        } else {
          searchResponse = await jiraClient.getMyIssues(maxResults);
        }

        // Cache task references
        for (const issue of searchResponse.issues) {
          await createJiraTaskReference({
            user_id: userId,
            jira_issue_key: issue.key,
            jira_issue_id: issue.id,
            title: issue.fields.summary,
            status: issue.fields.status.name,
          });
        }

        return {
          success: true,
          issues: searchResponse.issues.map((issue) => ({
            key: issue.key,
            id: issue.id,
            title: issue.fields.summary,
            description: issue.fields.description,
            status: issue.fields.status.name,
            statusCategory: issue.fields.status.statusCategory.key,
            assignee: issue.fields.assignee
              ? {
                  name: issue.fields.assignee.displayName,
                  email: issue.fields.assignee.emailAddress,
                }
              : null,
            priority: issue.fields.priority?.name,
            updated: issue.fields.updated,
          })),
          total: searchResponse.total,
          jiraSiteUrl: credentials.jira_site_url,
          message: `Found ${searchResponse.total} issue(s)`,
        };
      } catch (error) {
        console.error("Error listing Jira issues:", error);
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch Jira issues",
          issues: [],
        };
      }
    },
  });

  // Update Jira issue status tool
  const updateJiraIssueStatusTool = tool({
    description:
      "Update the status of a Jira issue by name, using the issue's available transitions. Do NOT assume statuses like 'Blocked' exist. If the desired status isn't available, return available transitions so the user can pick.",
    inputSchema: z.object({
      issueKey: z.string().describe("Jira issue key (e.g., 'PROJ-123')"),
      status: z
        .string()
        .describe("Desired status name (e.g., 'Done', 'In Progress')"),
    }),
    execute: async ({ issueKey, status }) => {
      const sanitizedIssueKey = sanitizeIssueKey(issueKey);
      if (!sanitizedIssueKey) {
        return {
          success: false,
          message:
            "Invalid issue key. Please mention a Jira issue like PROJ-123 (you can type @ to pick one).",
        };
      }
      // Get valid credentials (automatically refreshes if expired)
      const credentials = await getValidJiraCredentials(userId);
      if (!credentials) {
        return {
          success: false,
          message:
            "Jira account not connected. Please connect your Jira account first.",
        };
      }

      try {
        const jiraClient = new JiraClient({
          jira_cloud_id: credentials.jira_cloud_id,
          access_token: credentials.access_token,
        });

        // Get available transitions
        const transitions = await jiraClient.getTransitions(sanitizedIssueKey);
        const best = pickBestTransition(transitions, status);
        if (!best?.id) {
          return {
            success: false,
            message: `Status "${status}" is not available for ${sanitizedIssueKey} in its current workflow.`,
            requestedStatus: status,
            availableTransitions: transitions.map((t) => ({
              id: t.id,
              name: t.name,
              toStatus: t.to?.name ?? null,
              toStatusCategory: t.to?.statusCategory?.key ?? null,
            })),
          };
        }

        await jiraClient.updateIssueStatus(sanitizedIssueKey, best.id);

        // Get updated issue
        const updatedIssue = await jiraClient.getIssue(sanitizedIssueKey);

        // Update cached reference
        await createJiraTaskReference({
          user_id: userId,
          jira_issue_key: updatedIssue.key,
          jira_issue_id: updatedIssue.id,
          title: updatedIssue.fields.summary,
          status: updatedIssue.fields.status.name,
        });

        return {
          success: true,
          issue: {
            key: updatedIssue.key,
            id: updatedIssue.id,
            title: updatedIssue.fields.summary,
            status: updatedIssue.fields.status.name,
            statusCategory: updatedIssue.fields.status.statusCategory.key,
          },
          message: `Updated ${sanitizedIssueKey} to ${updatedIssue.fields.status.name}`,
        };
      } catch (error) {
        console.error("Error updating Jira issue:", error);
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Failed to update Jira issue",
        };
      }
    },
  });

  // List all Jira statuses (instance-wide) and/or per project
  const listJiraStatusesTool = tool({
    description:
      "List Jira statuses available in the Jira instance, or statuses used by a specific project. Use this to adapt to different workflows (e.g., if 'Blocked' doesn't exist).",
    inputSchema: z.object({
      projectKey: z
        .string()
        .optional()
        .describe(
          "Optional Jira project key (e.g., 'PROJ') to list statuses used in that project"
        ),
    }),
    execute: async ({ projectKey }) => {
      const credentials = await getValidJiraCredentials(userId);
      if (!credentials) {
        return {
          success: false,
          message:
            "Jira account not connected. Please connect your Jira account first.",
        };
      }

      try {
        const jiraClient = new JiraClient({
          jira_cloud_id: credentials.jira_cloud_id,
          access_token: credentials.access_token,
        });

        if (projectKey) {
          const projectStatuses = await jiraClient.getProjectStatuses(
            projectKey
          );
          // Flatten for simpler UI
          const flattened: Array<{
            issueType: string;
            id: string;
            name: string;
            statusCategory: string | null;
          }> = [];

          for (const [issueType, statuses] of Object.entries(projectStatuses)) {
            for (const st of statuses as any[]) {
              flattened.push({
                issueType,
                id: st.id,
                name: st.name,
                statusCategory: st.statusCategory?.key ?? null,
              });
            }
          }

          return {
            success: true,
            scope: "project",
            projectKey,
            statuses: flattened,
            message: `Loaded statuses for project ${projectKey}`,
          };
        }

        const statuses = await jiraClient.getAllStatuses();
        return {
          success: true,
          scope: "instance",
          statuses: (statuses as JiraStatus[]).map((s) => ({
            id: s.id,
            name: s.name,
            statusCategory: s.statusCategory?.key ?? null,
          })),
          message: `Loaded ${statuses.length} status(es)`,
        };
      } catch (error) {
        console.error("Error listing Jira statuses:", error);
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Failed to list Jira statuses",
        };
      }
    },
  });

  // List available transitions for an issue (what statuses it can move to right now)
  const listJiraTransitionsTool = tool({
    description:
      "List available transitions for a Jira issue. Use this before updating status if the workflow is unknown.",
    inputSchema: z.object({
      issueKey: z.string().describe("Jira issue key (e.g., 'PROJ-123')"),
    }),
    execute: async ({ issueKey }) => {
      const sanitizedIssueKey = sanitizeIssueKey(issueKey);
      if (!sanitizedIssueKey) {
        return {
          success: false,
          message:
            "Invalid issue key. Please mention a Jira issue like PROJ-123 (you can type @ to pick one).",
        };
      }
      const credentials = await getValidJiraCredentials(userId);
      if (!credentials) {
        return {
          success: false,
          message:
            "Jira account not connected. Please connect your Jira account first.",
        };
      }

      try {
        const jiraClient = new JiraClient({
          jira_cloud_id: credentials.jira_cloud_id,
          access_token: credentials.access_token,
        });

        const transitions = await jiraClient.getTransitions(sanitizedIssueKey);
        return {
          success: true,
          issueKey: sanitizedIssueKey,
          transitions: transitions.map((t) => ({
            id: t.id,
            name: t.name,
            toStatus: t.to?.name ?? null,
            toStatusCategory: t.to?.statusCategory?.key ?? null,
          })),
          message: `Loaded ${transitions.length} transition(s) for ${sanitizedIssueKey}`,
        };
      } catch (error) {
        // 404 is common if issue key is wrong or user lacks permission; avoid noisy stack traces.
        console.warn("Error listing Jira transitions:", error);
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Failed to list Jira transitions",
        };
      }
    },
  });

  // Get Jira issue details tool
  const getJiraIssueTool = tool({
    description:
      "Get detailed information about a specific Jira issue. Use this when the user asks about a specific task or mentions an issue key.",
    inputSchema: z.object({
      issueKey: z.string().describe("Jira issue key (e.g., 'PROJ-123')"),
    }),
    execute: async ({ issueKey }) => {
      const sanitizedIssueKey = sanitizeIssueKey(issueKey);
      if (!sanitizedIssueKey) {
        return {
          success: false,
          message:
            "Invalid issue key. Please mention a Jira issue like PROJ-123 (you can type @ to pick one).",
        };
      }
      // Get valid credentials (automatically refreshes if expired)
      const credentials = await getValidJiraCredentials(userId);
      if (!credentials) {
        return {
          success: false,
          message:
            "Jira account not connected. Please connect your Jira account first.",
        };
      }

      try {
        const jiraClient = new JiraClient({
          jira_cloud_id: credentials.jira_cloud_id,
          access_token: credentials.access_token,
        });

        const issue = await jiraClient.getIssue(sanitizedIssueKey);

        // Update cached reference
        await createJiraTaskReference({
          user_id: userId,
          jira_issue_key: issue.key,
          jira_issue_id: issue.id,
          title: issue.fields.summary,
          status: issue.fields.status.name,
        });

        return {
          success: true,
          issue: {
            key: issue.key,
            id: issue.id,
            title: issue.fields.summary,
            description: issue.fields.description,
            status: issue.fields.status.name,
            statusCategory: issue.fields.status.statusCategory.key,
            assignee: issue.fields.assignee
              ? {
                  name: issue.fields.assignee.displayName,
                  email: issue.fields.assignee.emailAddress,
                }
              : null,
            priority: issue.fields.priority?.name,
            created: issue.fields.created,
            updated: issue.fields.updated,
          },
        };
      } catch (error) {
        console.error("Error getting Jira issue:", error);
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "Failed to get Jira issue",
        };
      }
    },
  });

  // Generate weekly summary tool
  const generateJiraWeeklySummaryTool = tool({
    description:
      "Generate a weekly summary from Jira issues. This computes deterministic raw stats and returns an AI-generated UI schema (cards/bars/sections) + one follow-up question. The UI will render the schema, so the assistant should NOT repeat UI contents in text—only provide a short intro and ask exactly the single followUpQuestion.",
    inputSchema: z.object({
      weekStart: z
        .string()
        .optional()
        .describe(
          "Optional week start date (ISO string). Defaults to current week's Monday."
        ),
      projectKey: z
        .string()
        .optional()
        .describe(
          "Optional Jira project key to scope the report (e.g., 'PROJ')"
        ),
    }),
    execute: async ({ weekStart, projectKey }) => {
      const credentials = await getValidJiraCredentials(userId);
      if (!credentials) {
        return {
          success: false,
          message:
            "Jira account not connected. Please connect your Jira account first.",
        };
      }

      try {
        const weekStartDate = weekStart
          ? new Date(weekStart)
          : startOfWeek(new Date(), { weekStartsOn: 1 });
        const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 1 });

        // Determine scope based on Jira permissions:
        // - admins: team summary (all issues) but require projectKey
        // - developers: personal summary (assigned issues)
        const jiraClient = new JiraClient({
          jira_cloud_id: credentials.jira_cloud_id,
          access_token: credentials.access_token,
        });
        const perms = await jiraClient.getMyPermissions(projectKey, [
          "ADMINISTER",
          "ADMINISTER_PROJECTS",
        ]);
        const canAdministerProjects =
          perms.permissions?.ADMINISTER_PROJECTS?.havePermission ?? false;
        const canAdministerJira =
          perms.permissions?.ADMINISTER?.havePermission ?? false;
        const isAdmin = canAdministerJira || canAdministerProjects;

        if (isAdmin && !projectKey) {
          return {
            success: false,
            message:
              "To generate an administrator (team) weekly summary, please specify a Jira project key (e.g., PROJ).",
          };
        }

        const summary = await generateJiraWeeklySummary(
          credentials,
          weekStartDate,
          weekEndDate,
          { projectKey, scope: isAdmin ? "all" : "assigned" }
        );

        return {
          success: true,
          raw: summary.raw,
          ui: summary.ui,
          followUpQuestion: summary.followUpQuestion,
          jiraSiteUrl: credentials.jira_site_url,
          scope: isAdmin ? "all" : "assigned",
        };
      } catch (error) {
        console.error("Error generating Jira weekly summary:", error);
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Failed to generate weekly summary",
        };
      }
    },
  });

  return {
    listJiraIssues: listJiraIssuesTool,
    updateJiraIssueStatus: updateJiraIssueStatusTool,
    getJiraIssue: getJiraIssueTool,
    listJiraStatuses: listJiraStatusesTool,
    listJiraTransitions: listJiraTransitionsTool,
    generateJiraWeeklySummary: generateJiraWeeklySummaryTool,
    getJiraUserContext: getJiraUserContextTool,
    generatePersonalUpdate: generatePersonalUpdateTool,
    applyLatestPersonalUpdateToJira: applyLatestPersonalUpdateToJiraTool,
  };
}
