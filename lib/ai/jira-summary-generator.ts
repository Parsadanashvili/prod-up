import { generateObject } from "ai";
import { getChatModel } from "./config";
import { z } from "zod";
import { JiraClient } from "@/lib/jira/client";
import type { JiraCredentials } from "@/lib/db/schema";
import {
  differenceInDays,
  endOfWeek,
  format,
  isWithinInterval,
  startOfWeek,
  subWeeks,
} from "date-fns";

export type JiraWeeklySummaryUI = {
  /** Cards rendered at the top (AI decides which ones matter). */
  cards: Array<{
    title: string;
    value: string;
    subtitle: string | null;
    tone: "neutral" | "success" | "warning" | "danger" | null;
  }>;
  /** Optional bar visualizations. */
  bars: Array<
    | {
        type: "progress";
        label: string;
        value: number; // 0..100
        valueLabel: string | null; // e.g. "67%"
      }
    | {
        type: "stacked";
        label: string;
        segments: Array<{
          label: string;
          value: number;
          color: "gray" | "blue" | "green" | "red" | "orange" | "purple" | null;
        }>;
      }
  >;
  /** Content sections (AI decides which sections to show). */
  sections: Array<{
    title: string;
    kind: "text" | "bullets" | null;
    text: string | null; // markdown
    bullets: string[] | null;
    tone: "neutral" | "success" | "warning" | "danger" | null;
  }>;
};

export type JiraWeeklySummaryRaw = {
  week: { start: string; end: string };
  projectKey: string | null;
  totalIssues: number;
  completionRate: number; // 0..100 based on done category
  countsByStatusCategory: Record<string, number>; // keys like new/indeterminate/done
  countsByStatusName: Array<{
    name: string;
    statusCategory: string;
    count: number;
  }>;
  staleIssuesOver2Days: Array<{
    statusName: string;
    count: number;
  }>;
  carryoverFromBeforeWeek: number; // created before weekStart and not done
  velocity: {
    completedThisWeek: number;
    completedPrevWeek?: number;
    trend: "up" | "down" | "stable" | "unknown";
  };
  overcommitment: {
    detected: boolean;
    planned: number;
    baselineAvgCompleted: number | null;
    thresholdMultiplier: number;
  };
  anomalies: string[]; // deterministic flags
};

export interface JiraWeeklySummary {
  raw: JiraWeeklySummaryRaw;
  ui: JiraWeeklySummaryUI;
  followUpQuestion: string;
}

interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  assignee?: {
    name: string;
    email: string;
  } | null;
  priority?: string;
  labels?: string[];
  updated: string;
  created: string;
}

function toIssue(issue: any): JiraIssue {
  return {
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status.name,
    statusCategory: issue.fields.status.statusCategory.key,
    assignee: issue.fields.assignee
      ? {
          name: issue.fields.assignee.displayName,
          email: issue.fields.assignee.emailAddress,
        }
      : null,
    priority: issue.fields.priority?.name,
    labels: Array.isArray(issue.fields.labels) ? issue.fields.labels : [],
    updated: issue.fields.updated,
    created: issue.fields.created,
  };
}

function isIssueInInterval(issue: JiraIssue, start: Date, end: Date): boolean {
  const createdDate = new Date(issue.created);
  const updatedDate = new Date(issue.updated);
  return (
    isWithinInterval(createdDate, { start, end }) ||
    isWithinInterval(updatedDate, { start, end })
  );
}

/**
 * Compute stats from Jira issues deterministically (no AI)
 */
function computeRawStats(args: {
  issues: JiraIssue[];
  weekStart: Date;
  weekEnd: Date;
  now: Date;
  previousWeekCompleted?: number;
  baselineAvgCompleted: number | null;
  thresholdMultiplier: number;
  projectKey: string | null;
}): JiraWeeklySummaryRaw {
  const {
    issues,
    weekStart,
    weekEnd,
    now,
    previousWeekCompleted,
    baselineAvgCompleted,
    projectKey,
  } = args;
  const thresholdMultiplier = args.thresholdMultiplier;
  const planned = issues.length;
  const completed = issues.filter(
    (issue) => issue.statusCategory === "done"
  ).length;

  const countsByStatusCategory: Record<string, number> = {};
  for (const issue of issues) {
    countsByStatusCategory[issue.statusCategory] =
      (countsByStatusCategory[issue.statusCategory] ?? 0) + 1;
  }

  const countsByStatusNameMap = new Map<
    string,
    { statusCategory: string; count: number }
  >();
  for (const issue of issues) {
    const key = issue.status;
    const prev = countsByStatusNameMap.get(key);
    countsByStatusNameMap.set(key, {
      statusCategory: issue.statusCategory,
      count: (prev?.count ?? 0) + 1,
    });
  }
  const countsByStatusName = Array.from(countsByStatusNameMap.entries())
    .map(([name, v]) => ({
      name,
      statusCategory: v.statusCategory,
      count: v.count,
    }))
    .sort((a, b) => b.count - a.count);

  // “Stale” heuristic (no changelog): updated >= 2 days ago
  const staleOver2dMap = new Map<string, number>();
  for (const issue of issues) {
    const updatedDate = new Date(issue.updated);
    if (differenceInDays(now, updatedDate) >= 2) {
      staleOver2dMap.set(
        issue.status,
        (staleOver2dMap.get(issue.status) ?? 0) + 1
      );
    }
  }
  const staleIssuesOver2Days = Array.from(staleOver2dMap.entries())
    .map(([statusName, count]) => ({ statusName, count }))
    .sort((a, b) => b.count - a.count);

  const carryoverFromBeforeWeek = issues.filter((issue) => {
    const createdDate = new Date(issue.created);
    return createdDate < weekStart && issue.statusCategory !== "done";
  }).length;

  const completionRate =
    planned > 0 ? Math.round((completed / planned) * 100) : 0;

  let velocityTrend: JiraWeeklySummaryRaw["velocity"]["trend"] = "unknown";
  if (typeof previousWeekCompleted === "number") {
    if (completed > previousWeekCompleted) velocityTrend = "up";
    else if (completed < previousWeekCompleted) velocityTrend = "down";
    else velocityTrend = "stable";
  }

  const overcommitmentDetected =
    baselineAvgCompleted !== null
      ? planned > baselineAvgCompleted * thresholdMultiplier
      : false;

  // Deterministic anomaly flags (hackathon-friendly heuristics)
  const anomalies: string[] = [];
  if (typeof previousWeekCompleted === "number") {
    const prev = previousWeekCompleted;
    if (prev >= 3 && completed <= prev - 2)
      anomalies.push("Completion dropped vs last week");
  }
  if (planned >= 3 && completed === 0) {
    anomalies.push("No issues completed this week");
  }
  if (planned >= 5 && completionRate <= 40) {
    anomalies.push("Low completion rate this week");
  }
  if (staleIssuesOver2Days.length > 0)
    anomalies.push("Some issues have not been updated in > 2 days");
  if (carryoverFromBeforeWeek >= 3)
    anomalies.push("High carryover from before this week");
  if (planned > 0 && carryoverFromBeforeWeek / planned >= 0.5) {
    anomalies.push(
      "Majority of in-scope issues are carryover from before this week"
    );
  }
  if (overcommitmentDetected)
    anomalies.push("Overcommitment detected vs recent baseline");

  return {
    week: { start: weekStart.toISOString(), end: weekEnd.toISOString() },
    projectKey,
    totalIssues: planned,
    completionRate,
    countsByStatusCategory,
    countsByStatusName,
    staleIssuesOver2Days,
    carryoverFromBeforeWeek,
    velocity: {
      completedThisWeek: completed,
      completedPrevWeek: previousWeekCompleted,
      trend: velocityTrend,
    },
    overcommitment: {
      detected: overcommitmentDetected,
      planned,
      baselineAvgCompleted,
      thresholdMultiplier,
    },
    anomalies,
  };
}

/**
 * Generate weekly summary from Jira issues
 */
export async function generateJiraWeeklySummary(
  credentials: JiraCredentials,
  weekStart: Date,
  weekEnd: Date,
  opts?: { projectKey?: string; scope?: "assigned" | "all" }
): Promise<JiraWeeklySummary> {
  const jiraClient = new JiraClient({
    jira_cloud_id: credentials.jira_cloud_id,
    access_token: credentials.access_token,
  });

  const projectKey = opts?.projectKey?.trim() ? opts.projectKey.trim() : null;
  const scope = opts?.scope ?? "assigned";

  // Pull project workflow statuses (if projectKey is provided) to help AI adapt.
  // This is *not* used for hardcoded buckets; it's context for labeling and UI.
  let projectWorkflowStatuses: Array<{
    issueType: string;
    name: string;
    statusCategory: string | null;
  }> | null = null;
  if (projectKey) {
    try {
      const projectStatuses = await jiraClient.getProjectStatuses(projectKey);
      const flattened: Array<{
        issueType: string;
        name: string;
        statusCategory: string | null;
      }> = [];
      for (const [issueType, statuses] of Object.entries(projectStatuses)) {
        for (const st of statuses as any[]) {
          flattened.push({
            issueType,
            name: st.name,
            statusCategory: st.statusCategory?.key ?? null,
          });
        }
      }
      projectWorkflowStatuses = flattened;
    } catch {
      projectWorkflowStatuses = null;
    }
  }

  // Fetch issues (minimal fields only)
  const searchResponse = await jiraClient.searchIssues(
    (() => {
      // Developer/personal view: assigned issues
      if (scope === "assigned") {
        return projectKey
          ? `assignee = currentUser() AND project = "${projectKey}" ORDER BY updated DESC`
          : "assignee = currentUser() ORDER BY updated DESC";
      }

      // Admin/team view: all issues in a project
      // Note: we intentionally require projectKey upstream; if missing, fall back to assigned scope.
      return projectKey
        ? `project = "${projectKey}" ORDER BY updated DESC`
        : "assignee = currentUser() ORDER BY updated DESC";
    })(),
    [
      "summary",
      "status",
      "assignee",
      "created",
      "updated",
      "priority",
      "labels",
    ],
    200
  );

  const allIssues: JiraIssue[] = searchResponse.issues.map(toIssue);

  // Issues relevant to this week (activity-based filter: created OR updated during interval)
  const weekIssues = allIssues.filter((issue) =>
    isIssueInInterval(issue, weekStart, weekEnd)
  );

  // Previous week (for trend)
  const prevWeekStart = startOfWeek(subWeeks(weekStart, 1), {
    weekStartsOn: 1,
  });
  const prevWeekEnd = endOfWeek(prevWeekStart, { weekStartsOn: 1 });
  const prevWeekIssues = allIssues.filter((issue) =>
    isIssueInInterval(issue, prevWeekStart, prevWeekEnd)
  );
  const prevWeekCompleted = prevWeekIssues.filter(
    (issue) => issue.statusCategory === "done"
  ).length;

  // Baseline avg completed over last N weeks (simple heuristic from available issues)
  const thresholdMultiplier = 1.2;
  const baselineWeeks = 4;
  const completedCounts: number[] = [];
  for (let i = 1; i <= baselineWeeks; i++) {
    const ws = startOfWeek(subWeeks(weekStart, i), { weekStartsOn: 1 });
    const we = endOfWeek(ws, { weekStartsOn: 1 });
    const wIssues = allIssues.filter((issue) =>
      isIssueInInterval(issue, ws, we)
    );
    const wDone = wIssues.filter(
      (issue) => issue.statusCategory === "done"
    ).length;
    if (wIssues.length > 0) completedCounts.push(wDone);
  }
  const baselineAvgCompleted =
    completedCounts.length > 0
      ? Math.round(
          completedCounts.reduce((a, b) => a + b, 0) / completedCounts.length
        )
      : null;

  // Compute raw stats (deterministic, workflow-agnostic)
  const raw = computeRawStats({
    issues: weekIssues,
    weekStart,
    weekEnd,
    now: new Date(),
    previousWeekCompleted:
      prevWeekIssues.length > 0 ? prevWeekCompleted : undefined,
    baselineAvgCompleted,
    thresholdMultiplier,
    projectKey,
  });

  // Prepare aggregated data for AI (not raw JSON)
  const completedIssues = weekIssues.filter(
    (issue) => issue.statusCategory === "done"
  );
  const topStatuses = raw.countsByStatusName.slice(0, 8);
  const staleTop = raw.staleIssuesOver2Days.slice(0, 6);

  const aiInput = `You are generating a UI-driven weekly report for a Jira project manager agent.
Your output will be rendered directly as UI. DO NOT invent numbers; use only the provided computed stats.

Week: ${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}
Project: ${projectKey ?? "All projects"} (scope: ${scope})

Computed stats (deterministic):
- Total issues in scope: ${raw.totalIssues}
- Completion rate (done/total): ${raw.completionRate}%
- Carryover from before this week (created before week start and not done): ${
    raw.carryoverFromBeforeWeek
  }
- Velocity trend: ${raw.velocity.trend}${
    typeof raw.velocity.completedPrevWeek === "number"
      ? ` (prev completed: ${raw.velocity.completedPrevWeek})`
      : ""
  } (this week completed: ${raw.velocity.completedThisWeek})
- Overcommitment detected: ${raw.overcommitment.detected} (planned=${
    raw.overcommitment.planned
  }, baselineAvgCompleted=${
    raw.overcommitment.baselineAvgCompleted
  }, threshold=${raw.overcommitment.thresholdMultiplier}x)
- Deterministic anomaly flags: ${
    raw.anomalies.length > 0 ? raw.anomalies.join(", ") : "None"
  }

Counts by Jira statusCategory:
${Object.entries(raw.countsByStatusCategory)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}

Top statuses by name (status -> count, category):
${topStatuses
  .map((s) => `- ${s.name}: ${s.count} (${s.statusCategory})`)
  .join("\n")}

Stale issues (> 2 days since updated), by status:
${
  staleTop.length > 0
    ? staleTop.map((s) => `- ${s.statusName}: ${s.count}`).join("\n")
    : "None"
}

Completed issues (titles only):
${completedIssues.map((i) => `- ${i.key}: ${i.summary}`).join("\n")}

Project workflow statuses (if available; grouped by issue type):
${
  projectWorkflowStatuses
    ? projectWorkflowStatuses
        .slice(0, 40)
        .map(
          (s) =>
            `- ${s.issueType}: ${s.name} (${s.statusCategory ?? "unknown"})`
        )
        .join("\n")
    : "Not available"
}

TASK:
1) Create a UI schema:
   - cards: 3-6 cards with title/value/subtitle/tone (tone is optional).
   - bars:
     - include a progress bar for completion rate.
     - include a stacked bar for statusCategory distribution using Jira's categories (do not invent categories).
   - sections:
     - include a \"Summary\" section (markdown, 2-4 sentences).
     - include an \"Insights\" bullets section (risks/patterns, 2-6 items).
     - include a \"Next Week Focus\" bullets section (2-6 items).
     - include an \"Anomalies\" bullets section if any anomalies exist.
2) Provide EXACTLY ONE followUpQuestion (one sentence ending with '?'). It should be smart and actionable.
`;

  try {
    const { object } = await generateObject({
      model: getChatModel(),
      schema: z.object({
        ui: z.object({
          cards: z
            .array(
              z.object({
                title: z.string(),
                value: z.string(),
                subtitle: z.string().nullable(),
                tone: z
                  .enum(["neutral", "success", "warning", "danger"])
                  .nullable(),
              })
            )
            .min(3)
            .max(6),
          bars: z.array(
            z.discriminatedUnion("type", [
              z.object({
                type: z.literal("progress"),
                label: z.string(),
                value: z.number().min(0).max(100),
                valueLabel: z.string().nullable(),
              }),
              z.object({
                type: z.literal("stacked"),
                label: z.string(),
                segments: z.array(
                  z.object({
                    label: z.string(),
                    value: z.number().min(0),
                    color: z
                      .enum([
                        "gray",
                        "blue",
                        "green",
                        "red",
                        "orange",
                        "purple",
                      ])
                      .nullable(),
                  })
                ),
              }),
            ])
          ),
          sections: z.array(
            z.object({
              title: z.string(),
              kind: z.enum(["text", "bullets"]).nullable(),
              text: z.string().nullable(),
              bullets: z.array(z.string()).nullable(),
              tone: z
                .enum(["neutral", "success", "warning", "danger"])
                .nullable(),
            })
          ),
        }),
        followUpQuestion: z
          .string()
          .describe(
            "Exactly one smart follow-up question (one sentence) that ends with a question mark"
          ),
      }),
      prompt: aiInput,
    });

    return {
      raw,
      ui: object.ui,
      followUpQuestion: object.followUpQuestion,
    };
  } catch (error) {
    console.error("Error generating Jira summary:", error);
    return {
      raw,
      ui: {
        cards: [
          {
            title: "Completion",
            value: `${raw.completionRate}%`,
            subtitle: "Done / total",
            tone: "neutral",
          },
          {
            title: "Total",
            value: String(raw.totalIssues),
            subtitle: null,
            tone: "neutral",
          },
          {
            title: "Carryover",
            value: String(raw.carryoverFromBeforeWeek),
            subtitle: null,
            tone: raw.carryoverFromBeforeWeek > 0 ? "warning" : "success",
          },
        ],
        bars: [
          {
            type: "progress",
            label: "Completion",
            value: raw.completionRate,
            valueLabel: `${raw.completionRate}%`,
          },
        ],
        sections: [
          {
            title: "Summary",
            kind: "text",
            text: "Unable to generate AI summary at this time.",
            bullets: null,
            tone: "warning",
          },
        ],
      },
      followUpQuestion:
        "Do you want me to focus this report on a specific Jira project?",
    };
  }
}
