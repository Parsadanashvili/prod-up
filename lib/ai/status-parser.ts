import type { TaskStatus } from '../db/schema';

const STATUS_KEYWORDS: Record<TaskStatus, string[]> = {
  done: ['done', 'completed', 'finished', 'complete', 'accomplished', 'delivered'],
  blocked: ['blocked', 'stuck', 'waiting', 'blocked on', 'cannot proceed', 'stalled'],
  in_progress: ['working on', 'in progress', 'doing', 'actively', 'currently'],
  cancelled: ['cancelled', "won't do", 'not doing', 'skipping', 'dropping'],
  not_started: ['not started', 'todo', 'to do', 'planning', 'will do'],
};

export function parseStatusFromMessage(message: string): TaskStatus | null {
  const lowerMessage = message.toLowerCase();

  // Check in order of priority (done > blocked > in_progress > cancelled > not_started)
  for (const [status, keywords] of Object.entries(STATUS_KEYWORDS)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      return status as TaskStatus;
    }
  }

  return null;
}

export function extractStatusUpdates(message: string): Array<{ taskTitle: string; status: TaskStatus }> {
  const updates: Array<{ taskTitle: string; status: TaskStatus }> = [];
  const lowerMessage = message.toLowerCase();

  // Look for patterns like "task X is done" or "completed task Y"
  for (const [status, keywords] of Object.entries(STATUS_KEYWORDS)) {
    for (const keyword of keywords) {
      const regex = new RegExp(`(?:^|\\s)([^.!?]+?)\\s+(?:is\\s+)?${keyword.replace(/\s+/g, '\\s+')}`, 'gi');
      const matches = message.matchAll(regex);
      
      for (const match of matches) {
        const taskTitle = match[1]?.trim();
        if (taskTitle && taskTitle.length > 3) {
          updates.push({ taskTitle, status: status as TaskStatus });
        }
      }
    }
  }

  return updates;
}

