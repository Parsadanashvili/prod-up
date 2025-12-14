"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type JiraStatusRow = {
  id: string;
  name: string;
  statusCategory: string | null;
  issueType?: string;
};

function categoryColor(category: string | null) {
  switch (category) {
    case "done":
      return "bg-green-500";
    case "indeterminate":
      return "bg-blue-500";
    case "new":
      return "bg-gray-500";
    default:
      return "bg-gray-500";
  }
}

export function JiraStatusListInline({
  statuses,
  title,
}: {
  statuses: JiraStatusRow[];
  title?: string;
}) {
  if (!statuses || statuses.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        No statuses found.
      </div>
    );
  }

  const display = statuses.slice(0, 10);
  const remaining = statuses.length - display.length;

  return (
    <div className="space-y-2 my-2">
      {title && (
        <div className="text-xs text-muted-foreground px-1">{title}</div>
      )}
      <div className="space-y-1.5">
        {display.map((s, idx) => (
          <div
            key={`${s.id}-${s.issueType ?? "global"}`}
            className="flex items-center gap-3 px-3 py-2 bg-muted rounded-lg border border-border animate-in fade-in slide-in-from-bottom-2 duration-300"
            style={{ animationDelay: `${idx * 40}ms` }}
          >
            <Badge
              className={cn(
                "shrink-0 text-xs px-2 py-0.5",
                categoryColor(s.statusCategory)
              )}
            >
              {s.statusCategory ?? "status"}
            </Badge>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{s.name}</div>
              {s.issueType && (
                <div className="text-xs text-muted-foreground truncate">
                  {s.issueType}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {remaining > 0 && (
        <div className="text-xs text-muted-foreground px-3">
          +{remaining} more
        </div>
      )}
    </div>
  );
}
