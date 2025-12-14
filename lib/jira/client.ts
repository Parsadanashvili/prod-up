// Jira API client for fetching and managing tasks
import type { JiraCredentials } from "@/lib/db/schema";

export interface JiraIssue {
  id: string;
  key: string; // e.g., "PROJ-123"
  fields: {
    summary: string;
    description?: string;
    status: {
      name: string;
      statusCategory: {
        key: string; // "new", "indeterminate", "done"
      };
    };
    assignee?: {
      accountId: string;
      displayName: string;
      emailAddress: string;
    };
    created: string;
    updated: string;
    priority?: {
      name: string;
    };
    labels?: string[];
  };
}

export interface JiraStatus {
  id: string;
  name: string;
  statusCategory?: {
    key: string;
    name?: string;
  };
}

export interface JiraProjectStatusesResponse {
  // Grouped by issue type
  [issueTypeName: string]: Array<{
    id: string;
    name: string;
    statusCategory?: {
      key: string;
      name?: string;
    };
  }>;
}

export type JiraTransition = {
  id: string;
  name: string;
  to?: {
    id?: string;
    name?: string;
    statusCategory?: { key: string };
  };
};

export interface JiraSearchResponse {
  issues: JiraIssue[];
  total: number;
  startAt: number;
  maxResults: number;
}

export type JiraMyself = {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  active?: boolean;
  timeZone?: string;
  locale?: string;
  groups?: {
    items?: Array<{ name: string }>;
  };
  applicationRoles?: {
    items?: Array<{ key: string; name: string }>;
  };
};

export type JiraMyPermissionsResponse = {
  permissions: Record<
    string,
    {
      id: string;
      key: string;
      name: string;
      type: string;
      description?: string;
      havePermission: boolean;
    }
  >;
};

export class JiraClient {
  private cloudId: string;
  private accessToken: string;

  constructor(
    credentials: Pick<JiraCredentials, "jira_cloud_id" | "access_token">
  ) {
    this.cloudId = credentials.jira_cloud_id;
    this.accessToken = credentials.access_token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // For OAuth 2.0 (3LO) apps, use api.atlassian.com/ex/jira/<cloudId>
    // See: https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/
    const url = `https://api.atlassian.com/ex/jira/${this.cloudId}/rest/api/3${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jira API error: ${response.status} - ${error}`);
    }

    // Some Jira endpoints (e.g., POST transitions) can return 204 No Content.
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    // Empty body is valid for some endpoints even with 200/201.
    if (!text) {
      return undefined as unknown as T;
    }

    // Prefer JSON when available; otherwise return raw text.
    if (contentType.includes("application/json")) {
      return JSON.parse(text) as T;
    }

    return text as unknown as T;
  }

  /**
   * Search for Jira issues
   */
  async searchIssues(
    jql: string,
    fields: string[] = [
      "summary",
      "status",
      "assignee",
      "created",
      "updated",
      "priority",
    ],
    maxResults: number = 50
  ): Promise<JiraSearchResponse> {
    const params = new URLSearchParams({
      jql,
      fields: fields.join(","),
      maxResults: maxResults.toString(),
    });

    // Use /search/jql endpoint (the old /search endpoint was removed)
    // See: https://developer.atlassian.com/changelog/#CHANGE-2046
    return this.request<JiraSearchResponse>(`/search/jql?${params.toString()}`);
  }

  /**
   * Get a specific issue by key
   */
  async getIssue(issueKey: string): Promise<JiraIssue> {
    return this.request<JiraIssue>(`/issue/${encodeURIComponent(issueKey)}`);
  }

  /**
   * Update issue status
   */
  async updateIssueStatus(issueKey: string, statusId: string): Promise<void> {
    await this.request(`/issue/${encodeURIComponent(issueKey)}/transitions`, {
      method: "POST",
      body: JSON.stringify({
        transition: {
          id: statusId,
        },
      }),
    });
  }

  /**
   * Add a comment to an issue (ADF body)
   */
  async addComment(issueKey: string, text: string): Promise<void> {
    const adf = JiraClient.textToAdf(text);
    await this.request(`/issue/${encodeURIComponent(issueKey)}/comment`, {
      method: "POST",
      body: JSON.stringify({
        body: adf,
      }),
    });
  }

  /**
   * Minimal conversion of plain text to Atlassian Document Format (ADF)
   * Supports newlines as separate paragraphs.
   */
  static textToAdf(text: string) {
    const lines = String(text ?? "").split(/\r?\n/);
    const paragraphs = lines.map((line) => ({
      type: "paragraph",
      content: line
        ? [{ type: "text", text: line }]
        : [{ type: "text", text: " " }],
    }));
    return {
      type: "doc",
      version: 1,
      content: paragraphs,
    };
  }

  /**
   * Get available transitions for an issue
   */
  async getTransitions(issueKey: string): Promise<JiraTransition[]> {
    const response = await this.request<{
      transitions: JiraTransition[];
    }>(`/issue/${encodeURIComponent(issueKey)}/transitions`);
    return response.transitions;
  }

  /**
   * Get all statuses in the Jira instance
   * Note: statuses are global, but which ones apply depends on project workflows.
   */
  async getAllStatuses(): Promise<JiraStatus[]> {
    // Jira Cloud REST v3: GET /rest/api/3/status
    return this.request<JiraStatus[]>(`/status`);
  }

  /**
   * Get statuses used by a specific project (grouped by issue type)
   */
  async getProjectStatuses(
    projectIdOrKey: string
  ): Promise<JiraProjectStatusesResponse> {
    return this.request<JiraProjectStatusesResponse>(
      `/project/${encodeURIComponent(projectIdOrKey)}/statuses`
    );
  }

  /**
   * Get current Jira user profile
   */
  async getMyself(): Promise<JiraMyself> {
    return this.request<JiraMyself>(`/myself`);
  }

  /**
   * Get current user's permissions (optionally scoped to a project)
   */
  async getMyPermissions(
    projectKey?: string,
    permissions: string[] = ["ADMINISTER", "ADMINISTER_PROJECTS"]
  ): Promise<JiraMyPermissionsResponse> {
    const params = new URLSearchParams();
    if (projectKey) params.set("projectKey", projectKey);
    // Jira Cloud now requires specifying which permissions to check.
    // Use a minimal set we care about.
    params.set("permissions", permissions.join(","));
    const qs = params.toString();
    return this.request<JiraMyPermissionsResponse>(
      `/mypermissions${qs ? `?${qs}` : ""}`
    );
  }

  /**
   * Search issues assigned to current user
   */
  async getMyIssues(maxResults: number = 50): Promise<JiraSearchResponse> {
    return this.searchIssues(
      "assignee = currentUser() ORDER BY updated DESC",
      undefined,
      maxResults
    );
  }

  /**
   * Search issues by text query
   */
  async searchIssuesByText(
    query: string,
    maxResults: number = 20
  ): Promise<JiraSearchResponse> {
    // Search in summary and description
    const jql = `key ~ "${query}" OR text ~ "${query}" OR summary ~ "${query}" ORDER BY updated DESC`;
    return this.searchIssues(jql, undefined, maxResults);
  }
}
