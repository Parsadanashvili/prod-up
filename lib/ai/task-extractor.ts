import { generateObject } from 'ai';
import { getChatModel } from './config';
import { z } from 'zod';
import type { TaskStatus } from '../db/schema';

const TaskSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string().describe('Short, clear task title'),
      description: z.string().nullable().describe('Detailed description of the task'),
      status: z.enum(['not_started', 'in_progress', 'done', 'blocked', 'cancelled']).describe('Current status of the task'),
    })
  ),
});

export interface ExtractedTask {
  title: string;
  description: string | null;
  status: TaskStatus;
}

export async function extractTasksFromMessage(message: string): Promise<ExtractedTask[]> {
  try {
    const { object } = await generateObject({
      model: getChatModel(),
      schema: TaskSchema,
      prompt: `Extract tasks from the following message. Identify any tasks, work items, or action items mentioned. 
      For each task, determine its status based on keywords:
      - "done", "completed", "finished" → done
      - "blocked", "stuck", "waiting" → blocked
      - "working on", "in progress" → in_progress
      - "cancelled", "won't do" → cancelled
      - Otherwise → not_started
      
      Message: "${message}"
      
      Return only tasks that are clearly actionable items. Ignore general statements or questions.`,
    });

    return object.tasks;
  } catch (error) {
    console.error('Error extracting tasks:', error);
    return [];
  }
}

