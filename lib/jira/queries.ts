// Database queries for Jira integration
import { db } from "@/lib/db/client";
import type { JiraCredentials, JiraTaskReference } from "@/lib/db/schema";

export async function createJiraCredentials(
  credentials: Omit<JiraCredentials, "id" | "created_at" | "updated_at">
) {
  // Handle expires_at - it might be a Date object or a string
  const expiresAt =
    credentials.expires_at instanceof Date
      ? credentials.expires_at.toISOString()
      : credentials.expires_at;

  const result = await db`
    INSERT INTO jira_credentials (
      user_id, jira_cloud_id, jira_site_url, access_token, refresh_token, expires_at
    )
    VALUES (
      ${credentials.user_id},
      ${credentials.jira_cloud_id},
      ${credentials.jira_site_url},
      ${credentials.access_token},
      ${credentials.refresh_token},
      ${expiresAt}
    )
    ON CONFLICT (user_id) DO UPDATE SET
      jira_cloud_id = EXCLUDED.jira_cloud_id,
      jira_site_url = EXCLUDED.jira_site_url,
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
    RETURNING *;
  `;

  // Parse expires_at back to Date if it's a string
  const row = result.rows[0];
  if (row && typeof row.expires_at === "string") {
    row.expires_at = new Date(row.expires_at);
  }

  return row as JiraCredentials;
}

export async function getJiraCredentialsByUserId(
  userId: string
): Promise<JiraCredentials | null> {
  const result = await db`
    SELECT * FROM jira_credentials WHERE user_id = ${userId} LIMIT 1;
  `;
  return (result.rows[0] as JiraCredentials) || null;
}

export async function createJiraTaskReference(
  reference: Omit<JiraTaskReference, "id" | "created_at" | "updated_at">
) {
  const result = await db`
    INSERT INTO jira_task_references (
      user_id, jira_issue_key, jira_issue_id, title, status
    )
    VALUES (
      ${reference.user_id},
      ${reference.jira_issue_key},
      ${reference.jira_issue_id},
      ${reference.title},
      ${reference.status}
    )
    ON CONFLICT (user_id, jira_issue_key) DO UPDATE SET
      jira_issue_id = EXCLUDED.jira_issue_id,
      title = EXCLUDED.title,
      status = EXCLUDED.status,
      updated_at = NOW()
    RETURNING *;
  `;
  return result.rows[0] as JiraTaskReference;
}

export async function getJiraTaskReference(
  userId: string,
  issueKey: string
): Promise<JiraTaskReference | null> {
  const result = await db`
    SELECT * FROM jira_task_references 
    WHERE user_id = ${userId} AND jira_issue_key = ${issueKey}
    LIMIT 1;
  `;
  return (result.rows[0] as JiraTaskReference) || null;
}

export async function getJiraTaskReferencesByUserId(
  userId: string
): Promise<JiraTaskReference[]> {
  const result = await db`
    SELECT * FROM jira_task_references 
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC;
  `;
  return result.rows as JiraTaskReference[];
}
