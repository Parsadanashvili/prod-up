"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type JiraTransitionRow = {
  id: string;
  name: string;
  toStatus: string | null;
  toStatusCategory: string | null;
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

export function JiraTransitionListInline({
  issueKey,
  transitions,
}: {
  issueKey: string;
  transitions: JiraTransitionRow[];
}) {
  if (!transitions || transitions.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        No transitions found for {issueKey}.
      </div>
    );
  }

  const display = transitions.slice(0, 10);
  const remaining = transitions.length - display.length;

  return (
    <div className="space-y-2 my-2">
      <div className="text-xs text-muted-foreground px-1">
        Available transitions for <span className="font-mono">{issueKey}</span>
      </div>
      <div className="space-y-1.5">
        {display.map((t, idx) => (
          <div
            key={t.id}
            className="flex items-center gap-3 px-3 py-2 bg-muted rounded-lg border border-border animate-in fade-in slide-in-from-bottom-2 duration-300"
            style={{ animationDelay: `${idx * 40}ms` }}
          >
            <Badge
              className={cn(
                "shrink-0 text-xs px-2 py-0.5",
                categoryColor(t.toStatusCategory)
              )}
            >
              {t.toStatusCategory ?? "status"}
            </Badge>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {t.toStatus ?? t.name}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                Transition: {t.name}
              </div>
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
