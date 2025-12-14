import { tool } from "ai";
import { z } from "zod";
import React from "react";
import type { TaskStatus } from "@/lib/db/schema";
import {
  createTask,
  getTasksByWeekId,
  updateTaskStatus,
  getTasksByUserId,
  getTaskById,
} from "@/lib/db/queries";
import { getOrCreateWeek } from "@/lib/db/queries";
import { generateWeeklySummary } from "../summary-generator";
import { TaskCardInline } from "@/components/chat/task-card-inline";
import { generateEmbedding, findSimilarTasks } from "../embeddings";
import { createTaskEmbedding } from "@/lib/db/queries";

// Helper to create tools with userId context
export function createTaskTools(userId: string) {
  // Task creation tool
  const createTaskTool = tool({
    description:
      "ONLY create a NEW task when the user explicitly mentions NEW work they plan to do. ALWAYS check if a similar task already exists first by using listTasks. Do NOT use this tool if the user is updating an existing task status (use updateTaskStatus instead).",
    inputSchema: z.object({
      title: z.string().describe("Short, clear task title"),
      description: z
        .string()
        .optional()
        .describe("Detailed description of the task"),
      status: z
        .enum(["not_started", "in_progress", "done", "blocked", "cancelled"])
        .default("not_started")
        .describe("Current status of the task"),
    }),
    execute: async ({ title, description, status }) => {
      // First check if a similar task already exists
      const allTasks = await getTasksByUserId(userId);
      const existingTask = allTasks.find(
        (t) =>
          t.title.toLowerCase().trim() === title.toLowerCase().trim() ||
          (title.toLowerCase().includes(t.title.toLowerCase()) &&
            t.title.length > 5) ||
          (t.title.toLowerCase().includes(title.toLowerCase()) &&
            title.length > 5)
      );

      if (existingTask) {
        return {
          success: false,
          message: `Task "${title}" already exists with ID ${existingTask.id}. Use updateTaskStatus instead to update it.`,
          existingTask: {
            id: existingTask.id,
            title: existingTask.title,
            status: existingTask.status,
          },
        };
      }

      const week = await getOrCreateWeek(userId);
      const task = await createTask({
        userId,
        weekId: week.id,
        title,
        description: description || null,
        status: status as TaskStatus,
      });

      // Generate and store embedding for semantic search
      // Combine title and description for better semantic matching
      const taskText = `${title} ${description || ""}`.trim();
      if (taskText.length > 0) {
        try {
          console.log(`Generating embedding for task: ${title}`);
          const embedding = await generateEmbedding(taskText);
          if (embedding.length > 0) {
            console.log(`Storing embedding for task ${task.id}`);
            await createTaskEmbedding(task.id, embedding);
            console.log(`Successfully stored embedding for task ${task.id}`);
          } else {
            console.warn(`Failed to generate embedding for task ${task.id}`);
          }
        } catch (error) {
          console.error("Error creating task embedding:", error);
          // Don't fail task creation if embedding fails
        }
      }

      // Return full task object so client can render UI component
      const createdUserTasks = await getTasksByUserId(userId);
      const fullTask = createdUserTasks.find((t) => t.id === task.id);

      return {
        success: true,
        task: fullTask || {
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
        },
        message: `Created task: ${title}`,
      };
    },
  });

  // Update task status tool
  const updateTaskStatusTool = tool({
    description:
      "Update the status of an EXISTING task. Use this when the user mentions completing, blocking, or changing status of a task they've already mentioned or created. ALWAYS use this instead of createTask when updating existing work. First use listTasks to find the task if unsure.",
    inputSchema: z.object({
      taskTitle: z
        .string()
        .describe(
          "Title or partial title of the task to update. Use keywords from the task title, or the full title if known."
        ),
      status: z
        .enum(["not_started", "in_progress", "done", "blocked", "cancelled"])
        .describe("New status for the task"),
    }),
    execute: async ({ taskTitle, status }) => {
      const userTasks = await getTasksByUserId(userId);

      // Try exact match first
      let matchingTask = userTasks.find(
        (t) => t.title.toLowerCase().trim() === taskTitle.toLowerCase().trim()
      );

      // Try partial match if exact match fails
      if (!matchingTask) {
        matchingTask = userTasks.find(
          (t) =>
            t.title.toLowerCase().includes(taskTitle.toLowerCase()) ||
            taskTitle.toLowerCase().includes(t.title.toLowerCase())
        );
      }

      // Try keyword matching (split by spaces and check if any keywords match)
      if (!matchingTask && taskTitle.split(" ").length > 1) {
        const keywords = taskTitle
          .toLowerCase()
          .split(" ")
          .filter((w) => w.length > 3); // Only meaningful words

        matchingTask = userTasks.find((t) => {
          const taskTitleLower = t.title.toLowerCase();
          return keywords.some(
            (keyword) =>
              taskTitleLower.includes(keyword) ||
              keyword.includes(taskTitleLower)
          );
        });
      }

      if (!matchingTask) {
        // Return available tasks to help the AI
        const recentTasks = userTasks
          .slice(0, 5)
          .map((t) => ({ id: t.id, title: t.title, status: t.status }));

        return {
          success: false,
          message: `Task "${taskTitle}" not found. Available recent tasks: ${recentTasks
            .map((t) => t.title)
            .join(", ")}`,
          availableTasks: recentTasks,
        };
      }

      const updated = await updateTaskStatus(
        matchingTask.id,
        status as TaskStatus
      );

      // Return full updated task object so client can render UI component
      const updatedUserTasks = await getTasksByUserId(userId);
      const fullTask = updatedUserTasks.find((t) => t.id === updated?.id);

      return {
        success: true,
        task: fullTask ||
          updated || {
            id: matchingTask.id,
            title: matchingTask.title,
            status: status as TaskStatus,
          },
        message: `Updated task "${matchingTask.title}" to ${status}`,
      };
    },
  });

  // List tasks tool
  const listTasksTool = tool({
    description:
      "List all tasks for the current week. Use this BEFORE creating or updating tasks to check if a task already exists. Always use this first when unsure if a task exists.",
    inputSchema: z.object({
      weekId: z
        .string()
        .optional()
        .describe("Optional week ID, defaults to current week"),
    }),
    execute: async ({ weekId }) => {
      let tasks;
      if (weekId) {
        tasks = await getTasksByWeekId(weekId);
      } else {
        const week = await getOrCreateWeek(userId);
        tasks = await getTasksByWeekId(week.id);
      }

      // Return full task objects so client can render UI components
      return {
        success: true,
        tasks: tasks, // Return full task objects
        count: tasks.length,
        message: `Found ${tasks.length} task(s) for this week`,
      };
    },
  });

  // Generate summary tool
  const generateSummaryTool = tool({
    description:
      "Generate a weekly summary comparing Monday plans vs Friday outcomes. Use this on Fridays or when the user asks for a summary.",
    inputSchema: z.object({
      weekId: z
        .string()
        .optional()
        .describe("Optional week ID, defaults to current week"),
    }),
    execute: async ({ weekId }) => {
      try {
        const week = await getOrCreateWeek(userId);
        const tasks = await getTasksByWeekId(week.id);

        // Parse start_date - it comes from DB as string or Date
        let weekStart: Date;
        if (week.start_date instanceof Date) {
          weekStart = week.start_date;
        } else if (typeof week.start_date === "string") {
          // Handle date string from database
          weekStart = new Date(week.start_date);
          // Validate the date
          if (isNaN(weekStart.getTime())) {
            // If invalid, use current week's Monday
            const today = new Date();
            const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
            const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            weekStart = new Date(today);
            weekStart.setDate(today.getDate() - daysToMonday);
            weekStart.setHours(0, 0, 0, 0);
          }
        } else {
          // Fallback to current week's Monday
          const today = new Date();
          const dayOfWeek = today.getDay();
          const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          weekStart = new Date(today);
          weekStart.setDate(today.getDate() - daysToMonday);
          weekStart.setHours(0, 0, 0, 0);
        }

        const summary = await generateWeeklySummary(weekStart, tasks);

        return {
          success: true,
          summary: summary.summary,
          plannedTasks: summary.plannedTasks.length,
          completedTasks: summary.completedTasks.length,
          blockedTasks: summary.blockedTasks.length,
          message: `Generated summary: ${summary.completedTasks.length} completed, ${summary.blockedTasks.length} blocked`,
        };
      } catch (error) {
        console.error("Error generating summary:", error);
        return {
          success: false,
          summary: "",
          plannedTasks: 0,
          completedTasks: 0,
          blockedTasks: 0,
          message: `Error generating summary: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        };
      }
    },
  });

  // Render task card tool - AI can use this to explicitly render a task card
  const renderTaskCardTool = tool({
    description:
      "Render a task card component to visually display a task. Use this when you want to show a task in a visual card format. You can render task cards after creating, updating, or when the user asks to see a specific task.",
    inputSchema: z.object({
      taskId: z.string().describe("The ID of the task to render"),
    }),
    execute: async ({ taskId }) => {
      const task = await getTaskById(taskId);
      if (!task) {
        return {
          success: false,
          message: `Task with ID ${taskId} not found`,
        };
      }

      return {
        success: true,
        task: {
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
        },
        message: `Rendering task card for: ${task.title}`,
      };
    },
  });

  return {
    createTask: createTaskTool,
    updateTaskStatus: updateTaskStatusTool,
    listTasks: listTasksTool,
    generateSummary: generateSummaryTool,
    renderTaskCard: renderTaskCardTool,
  };
}
