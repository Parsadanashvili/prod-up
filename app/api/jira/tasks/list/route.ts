import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getValidJiraCredentials } from "@/lib/jira/credentials";
import { JiraClient } from "@/lib/jira/client";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Get user's Jira credentials (automatically refreshes if expired)
    const credentials = await getValidJiraCredentials(user.id);
    if (!credentials) {
      return NextResponse.json(
        {
          error:
            "Jira account not connected. Please connect your Jira account first.",
        },
        { status: 401 }
      );
    }

    // Create Jira client
    const jiraClient = new JiraClient({
      jira_cloud_id: credentials.jira_cloud_id,
      access_token: credentials.access_token,
    });

    // Get user's assigned issues with sprint information
    // Include sprint field in the search
    const issues = await jiraClient.searchIssues(
      "assignee = currentUser() ORDER BY updated DESC",
      [
        "summary",
        "status",
        "assignee",
        "created",
        "updated",
        "priority",
        "customfield_10020", // Sprint field (common custom field ID for sprints)
      ],
      100 // Get more issues to group by sprint
    );

    // Format issues and extract sprint information
    const formattedIssues = issues.issues.map((issue: any) => {
      // Extract sprint from customfield_10020 (Sprint field)
      const sprintField = issue.fields.customfield_10020;
      let sprint: { id?: string; name?: string; state?: string } | null = null;

      if (sprintField && Array.isArray(sprintField) && sprintField.length > 0) {
        // Get the most recent sprint
        const latestSprint = sprintField[sprintField.length - 1];
        sprint = {
          id: latestSprint.id,
          name: latestSprint.name,
          state: latestSprint.state, // "active", "closed", "future"
        };
      } else if (sprintField && typeof sprintField === "object") {
        sprint = {
          id: sprintField.id,
          name: sprintField.name,
          state: sprintField.state,
        };
      }

      return {
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
        sprint: sprint,
      };
    });

    // Group issues by sprint
    const issuesBySprint: Record<
      string,
      {
        sprint: { id: string; name: string; state: string };
        issues: typeof formattedIssues;
      }
    > = {};

    const noSprintIssues: typeof formattedIssues = [];

    formattedIssues.forEach((issue) => {
      if (issue.sprint && issue.sprint.id) {
        const sprintKey = issue.sprint.id;
        if (!issuesBySprint[sprintKey]) {
          issuesBySprint[sprintKey] = {
            sprint: issue.sprint as { id: string; name: string; state: string },
            issues: [],
          };
        }
        issuesBySprint[sprintKey].issues.push(issue);
      } else {
        noSprintIssues.push(issue);
      }
    });

    // Sort sprints: active first, then future, then closed
    const sprintOrder: Record<string, number> = {
      active: 0,
      future: 1,
      closed: 2,
    };

    const sortedSprints = Object.values(issuesBySprint).sort((a, b) => {
      const aOrder = sprintOrder[a.sprint.state] ?? 99;
      const bOrder = sprintOrder[b.sprint.state] ?? 99;
      return aOrder - bOrder;
    });

    return NextResponse.json({
      sprints: sortedSprints,
      noSprint: noSprintIssues.length > 0 ? { issues: noSprintIssues } : null,
      total: issues.total,
      jiraSiteUrl: credentials.jira_site_url, // Include site URL for linking
    });
  } catch (error) {
    console.error("Error fetching Jira tasks:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch Jira tasks",
      },
      { status: 500 }
    );
  }
}
