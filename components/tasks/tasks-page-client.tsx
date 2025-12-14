"use client";

import { useState } from "react";
import { TaskList } from "./task-list";
import { JiraTaskList } from "./jira-task-list";
import { WeekSelector } from "./week-selector";
import { Week } from "@/lib/db/schema";

export function TasksPageClient({
  userId,
  weeks,
}: {
  userId: string;
  weeks: Week[];
}) {
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(() => {
    const currentWeek = weeks.find((w: Week) => {
      const start = new Date(w.start_date);
      const end = new Date(w.end_date);
      const now = new Date();
      return now >= start && now <= end;
    });

    if (currentWeek) {
      return currentWeek.id;
    } else if (weeks[0]) {
      return weeks[0].id;
    }

    return null;
  });

  const [activeTab, setActiveTab] = useState<"local" | "jira">("local");

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Tasks</h1>
        {activeTab === "local" && (
          <WeekSelector
            weeks={weeks}
            selectedWeekId={selectedWeekId}
            onWeekChange={(id) => setSelectedWeekId(id)}
          />
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab("local")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === "local"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Local Tasks
          </button>
          <button
            onClick={() => setActiveTab("jira")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === "jira"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Jira Tasks
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === "local" && (
          <TaskList userId={userId} weekId={selectedWeekId || undefined} />
        )}
        {activeTab === "jira" && <JiraTaskList userId={userId} />}
      </div>
    </div>
  );
}
