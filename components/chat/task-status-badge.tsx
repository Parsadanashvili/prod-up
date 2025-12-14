import { Badge } from "@/components/ui/badge";
import type { TaskStatus } from "@/lib/db/schema";

interface TaskStatusBadgeProps {
  status: TaskStatus;
}

const statusColors: Record<TaskStatus, string> = {
  not_started: "bg-gray-500",
  in_progress: "bg-blue-500",
  done: "bg-green-500",
  blocked: "bg-red-500",
  cancelled: "bg-gray-400",
};

const statusLabels: Record<TaskStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  done: "Done",
  blocked: "Blocked",
  cancelled: "Cancelled",
};

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  return (
    <Badge className={statusColors[status]}>{statusLabels[status]}</Badge>
  );
}

