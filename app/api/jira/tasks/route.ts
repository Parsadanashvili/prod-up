import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getValidJiraCredentials } from "@/lib/jira/credentials";
import { JiraClient } from "@/lib/jira/client";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit") || "20");

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

    // Create Jira client (using cloudId for OAuth 2.0 API calls)
    const jiraClient = new JiraClient({
      jira_cloud_id: credentials.jira_cloud_id,
      access_token: credentials.access_token,
    });

    // Search for issues
    let issues;
    if (query.trim()) {
      issues = await jiraClient.searchIssuesByText(query, limit);
    } else {
      // Get user's assigned issues if no query
      issues = await jiraClient.getMyIssues(limit);
    }

    // Format issues for frontend
    const formattedIssues = issues.issues.map((issue) => ({
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
    }));

    return NextResponse.json({
      issues: formattedIssues,
      total: issues.total,
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
