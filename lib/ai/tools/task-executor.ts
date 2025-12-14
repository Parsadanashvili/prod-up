import { createStreamableUI } from "@ai-sdk/rsc";
import React from "react";
import { TaskCardInline } from "@/components/chat/task-card-inline";
import { TaskListInline } from "@/components/chat/task-list-inline";
import type { Task } from "@/lib/db/schema";

// Execute task creation and return UI component
export async function executeCreateTaskWithUI(
  taskData: { title: string; description?: string; status: string },
  userId: string,
  createTaskFn: (data: any) => Promise<Task>
): Promise<{ task: Task; ui: React.ReactNode }> {
  const task = await createTaskFn({
    userId,
    title: taskData.title,
    description: taskData.description || null,
    status: taskData.status,
  });

  const ui = <TaskCardInline task={task} />;

  return { task, ui };
}

// Execute task status update and return UI component
export async function executeUpdateTaskStatusWithUI(
  task: Task,
  newStatus: Task["status"],
  updateTaskFn: (id: string, status: Task["status"]) => Promise<Task | undefined>
): Promise<{ task: Task | undefined; ui: React.ReactNode }> {
  const updated = await updateTaskFn(task.id, newStatus);

  if (!updated) {
    throw new Error("Failed to update task");
  }

  const ui = <TaskCardInline task={updated} />;

  return { task: updated, ui };
}

// Execute list tasks and return UI component
export async function executeListTasksWithUI(
  tasks: Task[]
): Promise<{ tasks: Task[]; ui: React.ReactNode }> {
  const ui = <TaskListInline tasks={tasks} />;

  return { tasks, ui };
}

