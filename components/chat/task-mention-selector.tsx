"use client";

import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface JiraTask {
  key: string;
  id: string;
  title: string;
  status: string;
  statusCategory: string;
  assignee?: {
    name: string;
    email: string;
  } | null;
  priority?: string;
  updated: string;
}

interface TaskMentionSelectorProps {
  query: string;
  onSelect: (task: JiraTask) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export function TaskMentionSelector({
  query,
  onSelect,
  onClose,
  position,
}: TaskMentionSelectorProps) {
  const [tasks, setTasks] = useState<JiraTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const commandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset selected index when query changes
    setSelectedIndex(0);

    // Debounce the API call to avoid excessive requests while typing
    const debounceTimeout = setTimeout(() => {
      // Fetch tasks from API
      const fetchTasks = async () => {
        setLoading(true);
        try {
          const response = await fetch(
            `/api/jira/tasks?q=${encodeURIComponent(query)}&limit=10`
          );
          if (response.ok) {
            const data = await response.json();
            setTasks(data.issues || []);
            // Reset selected index after new results
            setSelectedIndex(0);
          }
        } catch (error) {
          console.error("Error fetching tasks:", error);
        } finally {
          setLoading(false);
        }
      };

      // Fetch even with empty query to show recent tasks
      fetchTasks();
    }, 300); // 300ms debounce delay

    // Cleanup function to cancel the timeout if query changes before delay completes
    return () => clearTimeout(debounceTimeout);
  }, [query]);

  useEffect(() => {
    // Handle keyboard navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, tasks.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (tasks[selectedIndex]) {
          onSelect(tasks[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tasks, selectedIndex, onSelect, onClose]);

  const getStatusColor = (statusCategory: string) => {
    switch (statusCategory) {
      case "done":
        return "bg-green-500";
      case "indeterminate":
        return "bg-blue-500";
      case "new":
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div
      ref={commandRef}
      className="fixed z-[100] w-96 rounded-lg border bg-popover shadow-lg overflow-hidden"
      style={{
        top: `${position.top || 0}px`,
        left: `${position.left || 0}px`,
        maxHeight: "300px",
        opacity: position.top === 0 && position.left === 0 ? 0 : 1,
        pointerEvents:
          position.top === 0 && position.left === 0 ? "none" : "auto",
        transition: "opacity 0.1s ease-in-out",
      }}
    >
      <div className="p-2 border-b bg-muted/50">
        <div className="text-xs font-medium text-muted-foreground px-2">
          {loading
            ? "Searching tasks..."
            : query
            ? `Searching "${query}"...`
            : "Recent tasks"}
        </div>
      </div>
      <ScrollArea className="max-h-[260px]">
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            Loading tasks...
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            No tasks found.
          </div>
        ) : (
          <div className="p-1">
            {tasks.map((task, index) => (
              <div
                key={task.key}
                onClick={() => onSelect(task)}
                className={cn(
                  "flex items-start gap-2 w-full p-2 rounded-md cursor-pointer transition-colors",
                  index === selectedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted"
                )}
              >
                <Badge
                  className={cn(
                    "shrink-0 text-xs",
                    getStatusColor(task.statusCategory)
                  )}
                >
                  {task.status}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{task.key}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {task.title}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
