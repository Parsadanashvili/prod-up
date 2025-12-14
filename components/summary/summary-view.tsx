"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { MessageResponse } from "@/components/ai-elements/message";

interface WeeklySummary {
  summary: string;
  plannedTasks: Array<{
    id: string;
    title: string;
    description: string | null;
  }>;
  completedTasks: Array<{
    id: string;
    title: string;
    description: string | null;
  }>;
  blockedTasks: Array<{
    id: string;
    title: string;
    description: string | null;
  }>;
  insights: string;
  week: {
    id: string;
    startDate: string;
    endDate: string;
  };
}

interface SummaryViewProps {
  userId: string;
  weekId?: string;
}

export function SummaryView({ userId, weekId }: SummaryViewProps) {
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);

  const week = summary?.week ?? null;

  useEffect(() => {
    async function fetchSummary() {
      try {
        const url = weekId
          ? `/api/summary?userId=${userId}&weekId=${weekId}`
          : `/api/summary?userId=${userId}`;
        const response = await fetch(url);
        const data = await response.json();
        setSummary(data);
      } catch (error) {
        console.error("Error fetching summary:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchSummary();
  }, [userId, weekId]);

  if (loading) {
    return <div className="text-center py-8">Generating summary...</div>;
  }

  if (!summary || !week) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No summary available for this week.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            Weekly Summary
            {week && (
              <span className="text-base font-normal text-muted-foreground ml-2">
                {format(new Date(week.startDate), "MMM d")} -{" "}
                {format(new Date(week.endDate), "MMM d, yyyy")}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <MessageResponse>{summary.summary}</MessageResponse>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Planned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.plannedTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No planned tasks
                </p>
              ) : (
                summary.plannedTasks.map((task) => (
                  <div key={task.id} className="text-sm">
                    <Badge variant="outline" className="mr-2">
                      Planned
                    </Badge>
                    {task.title}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.completedTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No completed tasks
                </p>
              ) : (
                summary.completedTasks.map((task) => (
                  <div key={task.id} className="text-sm">
                    <Badge variant="outline" className="mr-2 bg-green-500/10">
                      Done
                    </Badge>
                    {task.title}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Blocked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.blockedTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No blocked tasks
                </p>
              ) : (
                summary.blockedTasks.map((task) => (
                  <div key={task.id} className="text-sm">
                    <Badge variant="outline" className="mr-2 bg-red-500/10">
                      Blocked
                    </Badge>
                    {task.title}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
