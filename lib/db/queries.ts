import { db } from "./client";
import type { Task, Week, Message, TaskStatus, User } from "./schema";
import { startOfWeek, endOfWeek, format } from "date-fns";

// User queries
export async function createUser(user: Omit<User, "createdAt" | "updatedAt">) {
  const result = await db`
    INSERT INTO users (id, email, name, image)
    VALUES (${user.id}, ${user.email}, ${user.name}, ${user.image})
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      image = EXCLUDED.image,
      updated_at = NOW()
    RETURNING *;
  `;
  return result.rows[0] as User;
}

export async function getUserById(id: string) {
  const result = await db`SELECT * FROM users WHERE id = ${id};`;
  return result.rows[0] as User | undefined;
}

export async function getUserByEmail(email: string) {
  const result = await db`SELECT * FROM users WHERE email = ${email};`;
  return result.rows[0] as User | undefined;
}

// Week queries
export async function getOrCreateWeek(
  userId: string,
  date: Date = new Date()
): Promise<Week> {
  const startDate = startOfWeek(date, { weekStartsOn: 1 }); // Monday
  const endDate = endOfWeek(date, { weekStartsOn: 1 }); // Sunday, but we'll use Friday

  // Adjust endDate to Friday
  const friday = new Date(endDate);
  friday.setDate(friday.getDate() - 2); // Sunday - 2 days = Friday

  const startDateStr = format(startDate, "yyyy-MM-dd");
  const endDateStr = format(friday, "yyyy-MM-dd");

  const existing = await db`
    SELECT * FROM weeks 
    WHERE user_id = ${userId} AND start_date = ${startDateStr}
    LIMIT 1;
  `;

  if (existing.rows[0]) {
    return existing.rows[0] as Week;
  }

  const result = await db`
    INSERT INTO weeks (user_id, start_date, end_date)
    VALUES (${userId}, ${startDateStr}, ${endDateStr})
    RETURNING *;
  `;

  return result.rows[0] as Week;
}

export async function getWeekById(id: string) {
  const result = await db`SELECT * FROM weeks WHERE id = ${id};`;
  return result.rows[0] as Week | undefined;
}

export async function getWeeksByUserId(userId: string) {
  const result = await db`
    SELECT * FROM weeks 
    WHERE user_id = ${userId} 
    ORDER BY start_date DESC;
  `;
  return result.rows as Week[];
}

// Task queries
export async function createTask(
  task: Omit<Task, "id" | "createdAt" | "updatedAt" | "completedAt">
) {
  const result = await db`
    INSERT INTO tasks (user_id, week_id, title, description, status)
    VALUES (${task.userId}, ${task.weekId}, ${task.title}, ${task.description}, ${task.status})
    RETURNING *;
  `;
  return result.rows[0] as Task;
}

export async function getTaskById(id: string) {
  const result = await db`SELECT * FROM tasks WHERE id = ${id};`;
  return result.rows[0] as Task | undefined;
}

export async function getTasksByUserId(userId: string) {
  const result = await db`
    SELECT * FROM tasks 
    WHERE user_id = ${userId} 
    ORDER BY created_at DESC;
  `;
  return result.rows as Task[];
}

export async function getTasksByWeekId(weekId: string) {
  const result = await db`
    SELECT * FROM tasks 
    WHERE week_id = ${weekId} 
    ORDER BY created_at DESC;
  `;
  return result.rows as Task[];
}

export async function updateTaskStatus(id: string, status: TaskStatus) {
  const completedAt = status === "done" ? new Date().toISOString() : null;
  const result = await db`
    UPDATE tasks 
    SET status = ${status}, 
        completed_at = ${completedAt},
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING *;
  `;
  return result.rows[0] as Task | undefined;
}

export async function updateTask(
  id: string,
  updates: Partial<Pick<Task, "title" | "description" | "status" | "weekId">>
) {
  const completedAt =
    updates.status === "done"
      ? new Date().toISOString()
      : updates.status
      ? null
      : undefined;

  if (completedAt !== undefined) {
    const result = await db`
      UPDATE tasks 
      SET 
        title = COALESCE(${updates.title ?? null}, title),
        description = COALESCE(${updates.description ?? null}, description),
        status = COALESCE(${updates.status ?? null}, status),
        week_id = COALESCE(${updates.weekId ?? null}, week_id),
        completed_at = ${completedAt},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *;
    `;
    return result.rows[0] as Task | undefined;
  } else {
    const result = await db`
      UPDATE tasks 
      SET 
        title = COALESCE(${updates.title ?? null}, title),
        description = COALESCE(${updates.description ?? null}, description),
        status = COALESCE(${updates.status ?? null}, status),
        week_id = COALESCE(${updates.weekId ?? null}, week_id),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *;
    `;
    return result.rows[0] as Task | undefined;
  }
}

export async function deleteTask(id: string) {
  await db`DELETE FROM tasks WHERE id = ${id};`;
}

// Message queries
export async function createMessage(
  message: Omit<Message, "id" | "createdAt">
) {
  const result = await db`
    INSERT INTO messages (user_id, content, role)
    VALUES (${message.userId}, ${message.content}, ${message.role})
    RETURNING *;
  `;
  return result.rows[0] as Message;
}

export async function getMessagesByUserId(userId: string, limit: number = 50) {
  const result = await db`
    SELECT * FROM messages 
    WHERE user_id = ${userId} 
    ORDER BY created_at DESC 
    LIMIT ${limit};
  `;
  return result.rows.reverse() as Message[]; // Reverse to get chronological order
}

// Jira personal update drafts (generated drafts + task snapshot)
export async function createJiraPersonalUpdateDraft(args: {
  userId: string;
  projectKey: string | null;
  tasks: any;
  update: any;
}) {
  const result = await db`
    INSERT INTO jira_personal_update_drafts (user_id, project_key, tasks_json, update_json)
    VALUES (${args.userId}, ${args.projectKey}, ${JSON.stringify(
    args.tasks
  )}::jsonb, ${JSON.stringify(args.update)}::jsonb)
    RETURNING *;
  `;
  return result.rows[0];
}

export async function getLatestJiraPersonalUpdateDraft(userId: string) {
  const result = await db`
    SELECT *
    FROM jira_personal_update_drafts
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 1;
  `;
  return result.rows[0] as any | undefined;
}

// Embedding queries
export async function createTaskEmbedding(taskId: string, embedding: number[]) {
  // For Vercel Postgres with pgvector, we need to format the vector as a PostgreSQL array string
  // Format: '[1.0,2.0,3.0]' which pgvector can parse and cast to vector type
  const vectorString = `[${embedding.join(",")}]`;

  // Execute raw SQL query with proper parameterization
  // We cast the string to vector type in PostgreSQL
  const result = await db.query(
    `INSERT INTO task_embeddings (task_id, embedding)
     VALUES ($1, $2::vector)
     ON CONFLICT (task_id) DO UPDATE SET
       embedding = EXCLUDED.embedding,
       created_at = NOW()
     RETURNING *;`,
    [taskId, vectorString]
  );

  return result.rows[0];
}

export async function getTaskEmbedding(taskId: string) {
  const result =
    await db`SELECT * FROM task_embeddings WHERE task_id = ${taskId} LIMIT 1;`;
  return result.rows[0];
}
