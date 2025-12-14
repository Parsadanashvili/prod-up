import { TaskCardInline } from "./task-card-inline";
import type { Task } from "@/lib/db/schema";

interface TaskListInlineProps {
  tasks: Task[];
}

export function TaskListInline({ tasks }: TaskListInlineProps) {
  // Limit to max 10 tasks
  const displayTasks = tasks.slice(0, 10);
  const remainingCount = tasks.length - displayTasks.length;

  if (tasks.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        No tasks found for this week.
      </div>
    );
  }

  return (
    <div className="space-y-1.5 my-2">
      {displayTasks.map((task, index) => (
        <div
          key={task.id}
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{
            animationDelay: `${index * 50}ms`,
          }}
        >
          <TaskCardInline task={task} />
        </div>
      ))}
      {remainingCount > 0 && (
        <div className="text-xs text-muted-foreground px-3 py-1">
          +{remainingCount} more task{remainingCount !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

