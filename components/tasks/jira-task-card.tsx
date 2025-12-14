"use client";

import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface JiraTask {
  key: string;
  id: string;
  title: string;
  description?: string;
  status: string;
  statusCategory: string;
  assignee?: {
    name: string;
    email: string;
  } | null;
  priority?: string;
  updated: string;
  sprint?: {
    id: string;
    name: string;
    state: string;
  } | null;
}

interface JiraTaskCardProps {
  task: JiraTask;
  jiraSiteUrl?: string;
}

const statusColors: Record<string, string> = {
  done: "bg-green-500",
  indeterminate: "bg-blue-500",
  new: "bg-gray-500",
};

export function JiraTaskCard({ task, jiraSiteUrl }: JiraTaskCardProps) {
  const statusColor = statusColors[task.statusCategory] || "bg-gray-500";

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors group animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Status Badge */}
      <Badge className={`${statusColor} shrink-0 text-xs px-2 py-0.5`}>
        {task.status}
      </Badge>

      {/* Issue Key */}
      <div className="font-mono text-sm text-muted-foreground shrink-0 min-w-[80px]">
        {task.key}
      </div>

      {/* Title and Description */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{task.title}</div>
        {task.description && (
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            {task.description}
          </div>
        )}
      </div>

      {/* Assignee */}
      {task.assignee && (
        <div className="text-xs text-muted-foreground shrink-0 hidden md:block">
          {task.assignee.name}
        </div>
      )}

      {/* Priority */}
      {task.priority && (
        <Badge variant="outline" className="text-xs shrink-0 hidden sm:block">
          {task.priority}
        </Badge>
      )}

      {/* Jira Link */}
      {jiraSiteUrl && (
        <a
          href={`https://${jiraSiteUrl}/browse/${task.key}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-foreground" />
        </a>
      )}
    </div>
  );
}
