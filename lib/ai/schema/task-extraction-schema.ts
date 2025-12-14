import { z } from "zod";
import type { TaskStatus } from "@/lib/db/schema";

// Schema for task extraction - used with object generation
export const taskExtractionSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string().describe("Short, clear task title"),
      description: z.string().nullable().describe("Detailed description of the task"),
      status: z
        .enum(["not_started", "in_progress", "done", "blocked", "cancelled"])
        .describe("Current status of the task"),
    })
  ),
});

export type TaskExtractionResult = z.infer<typeof taskExtractionSchema>;

