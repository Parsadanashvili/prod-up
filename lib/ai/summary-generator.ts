import { generateText } from 'ai';
import { getChatModel } from './config';
import type { Task } from '../db/schema';
import { format, startOfWeek, endOfWeek } from 'date-fns';

export interface WeeklySummary {
  summary: string;
  plannedTasks: Task[];
  completedTasks: Task[];
  blockedTasks: Task[];
  insights: string;
}

export async function generateWeeklySummary(
  weekStart: Date,
  tasks: Task[]
): Promise<WeeklySummary> {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const friday = new Date(weekEnd);
  friday.setDate(friday.getDate() - 2); // Sunday - 2 = Friday

  // Separate tasks by status
  const plannedTasks = tasks.filter(t => 
    t.status === 'not_started' || t.status === 'in_progress'
  );
  const completedTasks = tasks.filter(t => t.status === 'done');
  const blockedTasks = tasks.filter(t => t.status === 'blocked');

  // Helper function to safely parse dates
  const parseDate = (date: Date | string | null | undefined): Date | null => {
    if (!date) return null;
    if (date instanceof Date) {
      return isNaN(date.getTime()) ? null : date;
    }
    if (typeof date === 'string') {
      const parsed = new Date(date);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  };

  // Get Monday tasks (tasks created on Monday)
  const mondayTasks = tasks.filter(t => {
    const taskDate = parseDate(t.createdAt);
    if (!taskDate) return false;
    return format(taskDate, 'EEEE') === 'Monday' && 
           taskDate >= startOfWeek(weekStart, { weekStartsOn: 1 });
  });

  // Get Friday completed tasks
  const fridayCompletedTasks = completedTasks.filter(t => {
    const completedDate = parseDate(t.completedAt);
    return completedDate && format(completedDate, 'EEEE') === 'Friday';
  });

  const tasksContext = `
Monday Planned Tasks:
${mondayTasks.map(t => `- ${t.title}${t.description ? `: ${t.description}` : ''}`).join('\n')}

Friday Completed Tasks:
${fridayCompletedTasks.map(t => `- ${t.title}${t.description ? `: ${t.description}` : ''}`).join('\n')}

All Tasks This Week:
${tasks.map(t => `- [${t.status}] ${t.title}${t.description ? `: ${t.description}` : ''}`).join('\n')}
  `.trim();

  try {
    const { text } = await generateText({
      model: getChatModel(),
      prompt: `You are an AI project manager generating a weekly standup summary.

Week: ${format(weekStart, 'MMMM d')} - ${format(friday, 'MMMM d, yyyy')}

${tasksContext}

Generate a comprehensive weekly summary that:
1. Compares what was planned on Monday vs what was accomplished by Friday
2. Highlights key achievements
3. Identifies blockers and challenges
4. Provides insights and recommendations for next week

Format the summary in a clear, professional manner suitable for a team standup.`,
    });

    return {
      summary: text,
      plannedTasks,
      completedTasks,
      blockedTasks,
      insights: '', // Could be extracted separately if needed
    };
  } catch (error) {
    console.error('Error generating summary:', error);
    return {
      summary: 'Unable to generate summary at this time.',
      plannedTasks,
      completedTasks,
      blockedTasks,
      insights: '',
    };
  }
}

