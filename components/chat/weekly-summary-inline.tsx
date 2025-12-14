import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageResponse } from "@/components/ai-elements/message";

interface WeeklySummaryInlineProps {
  summary: string;
  plannedTasks: number;
  completedTasks: number;
  blockedTasks: number;
}

export function WeeklySummaryInline({
  summary,
  plannedTasks,
  completedTasks,
  blockedTasks,
}: WeeklySummaryInlineProps) {
  return (
    <Card className="my-2 max-w-2xl">
      <CardHeader>
        <CardTitle>Weekly Summary</CardTitle>
        <div className="flex gap-2 mt-2">
          <Badge variant="outline">Planned: {plannedTasks}</Badge>
          <Badge variant="outline" className="bg-green-500/10">
            Completed: {completedTasks}
          </Badge>
          {blockedTasks > 0 && (
            <Badge variant="outline" className="bg-red-500/10">
              Blocked: {blockedTasks}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm max-w-none">
          <MessageResponse className="text-sm">{summary}</MessageResponse>
        </div>
      </CardContent>
    </Card>
  );
}

