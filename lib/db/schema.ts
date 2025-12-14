// Database schema types and definitions

export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "done"
  | "blocked"
  | "cancelled";

export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Week {
  id: string;
  userId: string;
  start_date: Date; // Monday
  end_date: Date; // Friday
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  userId: string;
  weekId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface Message {
  id: string;
  userId: string;
  content: string;
  role: "user" | "assistant";
  createdAt: Date;
}

export interface TaskEmbedding {
  id: string;
  taskId: string;
  embedding: number[]; // Vector embedding
  createdAt: Date;
}

// Jira integration types
export interface JiraCredentials {
  id: string;
  user_id: string;
  jira_cloud_id: string; // Jira cloud instance ID
  jira_site_url: string; // e.g., "yourcompany.atlassian.net"
  access_token: string; // Encrypted OAuth access token
  refresh_token: string; // Encrypted OAuth refresh token
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

// Jira task reference (maps our internal references to Jira issues)
export interface JiraTaskReference {
  id: string;
  user_id: string;
  jira_issue_key: string; // e.g., "PROJ-123"
  jira_issue_id: string; // Jira's internal issue ID
  title: string; // Cached title for quick display
  status: string; // Cached status
  created_at: Date;
  updated_at: Date;
}

export interface JiraPersonalUpdateDraft {
  id: string;
  user_id: string;
  project_key: string | null;
  tasks_json: any;
  update_json: any;
  created_at: Date;
}
