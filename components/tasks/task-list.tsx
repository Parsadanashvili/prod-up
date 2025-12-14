'use client';

import { useEffect, useState } from 'react';
import { TaskCard } from './task-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Task, Week } from '@/lib/db/schema';
import { format } from 'date-fns';

interface TaskListProps {
  userId: string;
  weekId?: string;
}

export function TaskList({ userId, weekId }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTasks() {
      try {
        const url = weekId
          ? `/api/tasks?userId=${userId}&weekId=${weekId}`
          : `/api/tasks?userId=${userId}`;
        const response = await fetch(url);
        const data = await response.json();
        setTasks(data.tasks || []);
      } catch (error) {
        console.error('Error fetching tasks:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTasks();
  }, [userId, weekId]);

  if (loading) {
    return <div className="text-center py-8">Loading tasks...</div>;
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No tasks found. Start chatting to create tasks!
        </CardContent>
      </Card>
    );
  }

  // Group tasks by status
  const tasksByStatus = {
    not_started: tasks.filter(t => t.status === 'not_started'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    done: tasks.filter(t => t.status === 'done'),
    blocked: tasks.filter(t => t.status === 'blocked'),
    cancelled: tasks.filter(t => t.status === 'cancelled'),
  };

  return (
    <div className="space-y-6">
      {tasksByStatus.in_progress.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">In Progress</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tasksByStatus.in_progress.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}
      {tasksByStatus.not_started.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Not Started</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tasksByStatus.not_started.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}
      {tasksByStatus.blocked.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Blocked</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tasksByStatus.blocked.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}
      {tasksByStatus.done.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Done</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tasksByStatus.done.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

