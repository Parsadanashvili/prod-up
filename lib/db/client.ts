import { sql } from "@vercel/postgres";

// Database client wrapper
export const db = sql;

// Initialize database schema
export async function initializeDatabase() {
  try {
    // Enable pgvector extension
    await sql`CREATE EXTENSION IF NOT EXISTS vector;`;

    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        image TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // Create weeks table
    await sql`
      CREATE TABLE IF NOT EXISTS weeks (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, start_date)
      );
    `;

    // Create tasks table
    await sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        week_id TEXT REFERENCES weeks(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'done', 'blocked', 'cancelled')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      );
    `;

    // Create messages table
    await sql`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // Create task_embeddings table with pgvector
    await sql`
      CREATE TABLE IF NOT EXISTS task_embeddings (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
        embedding vector(1536),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // Create jira_credentials table
    await sql`
      CREATE TABLE IF NOT EXISTS jira_credentials (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        jira_cloud_id TEXT NOT NULL,
        jira_site_url TEXT NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // Create jira_task_references table
    await sql`
      CREATE TABLE IF NOT EXISTS jira_task_references (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        jira_issue_key TEXT NOT NULL,
        jira_issue_id TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, jira_issue_key)
      );
    `;

    // Store generated personal update drafts + Jira task snapshots (so they can be applied as comments)
    await sql`
      CREATE TABLE IF NOT EXISTS jira_personal_update_drafts (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_key TEXT,
        tasks_json JSONB NOT NULL,
        update_json JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_week_id ON tasks(week_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_weeks_user_id ON weeks(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_weeks_dates ON weeks(start_date, end_date);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_task_embeddings_task_id ON task_embeddings(task_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_jira_credentials_user_id ON jira_credentials(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_jira_task_refs_user_id ON jira_task_references(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_jira_task_refs_issue_key ON jira_task_references(jira_issue_key);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_jira_personal_update_drafts_user_id ON jira_personal_update_drafts(user_id);`;

    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
}
