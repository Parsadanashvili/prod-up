"use client";

import { JiraTaskCard } from "@/components/tasks/jira-task-card";
import type { JiraTask } from "@/components/tasks/jira-task-card";

interface JiraTaskListInlineProps {
  tasks: JiraTask[];
  jiraSiteUrl?: string;
}

export function JiraTaskListInline({
  tasks,
  jiraSiteUrl,
}: JiraTaskListInlineProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        No Jira tasks found.
      </div>
    );
  }

  // Limit to max 10 tasks
  const displayTasks = tasks.slice(0, 10);
  const remainingCount = tasks.length - displayTasks.length;

  return (
    <div className="space-y-1.5 my-2">
      {displayTasks.map((task, index) => (
        <div
          key={task.key}
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{
            animationDelay: `${index * 50}ms`,
          }}
        >
          <JiraTaskCard task={task} jiraSiteUrl={jiraSiteUrl} />
        </div>
      ))}
      {remainingCount > 0 && (
        <div className="text-xs text-muted-foreground px-4 py-1">
          +{remainingCount} more task{remainingCount !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

