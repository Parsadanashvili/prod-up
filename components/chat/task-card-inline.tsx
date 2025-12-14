import { Badge } from "@/components/ui/badge";
import type { Task } from "@/lib/db/schema";

interface TaskCardInlineProps {
  task: Task;
}

const statusColors: Record<Task["status"], string> = {
  not_started: "bg-gray-500",
  in_progress: "bg-blue-500",
  done: "bg-green-500",
  blocked: "bg-red-500",
  cancelled: "bg-gray-400",
};

const statusLabels: Record<Task["status"], string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  done: "Done",
  blocked: "Blocked",
  cancelled: "Cancelled",
};

export function TaskCardInline({ task }: TaskCardInlineProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border border-border hover:bg-muted/80 transition-colors animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Badge
        className={`${statusColors[task.status]} shrink-0 text-xs px-2 py-0.5`}
      >
        {statusLabels[task.status]}
      </Badge>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{task.title}</div>
        {task.description && (
          <div className="text-xs text-muted-foreground truncate">
            {task.description}
          </div>
        )}
      </div>
    </div>
  );
}
