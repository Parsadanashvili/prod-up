"use client";

import { useEffect, useState } from "react";
import { JiraTaskCard } from "./jira-task-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface JiraIssue {
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

interface SprintGroup {
  sprint: {
    id: string;
    name: string;
    state: string;
  };
  issues: JiraIssue[];
}

interface JiraTaskListProps {
  userId: string;
}

export function JiraTaskList({ userId }: JiraTaskListProps) {
  const [sprints, setSprints] = useState<SprintGroup[]>([]);
  const [noSprintIssues, setNoSprintIssues] = useState<JiraIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jiraSiteUrl, setJiraSiteUrl] = useState<string | undefined>();

  useEffect(() => {
    async function fetchJiraTasks() {
      try {
        setLoading(true);
        const response = await fetch("/api/jira/tasks/list");

        if (response.status === 401) {
          setError("Jira account not connected");
          return;
        }

        if (!response.ok) {
          const data = await response.json();
          setError(data.error || "Failed to fetch Jira tasks");
          return;
        }

        const data = await response.json();
        setSprints(data.sprints || []);
        setNoSprintIssues(data.noSprint?.issues || []);
        setJiraSiteUrl(data.jiraSiteUrl);
      } catch (err) {
        console.error("Error fetching Jira tasks:", err);
        setError("Failed to load Jira tasks");
      } finally {
        setLoading(false);
      }
    }

    fetchJiraTasks();
  }, [userId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading Jira tasks...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground mb-4">{error}</p>
          <a
            href="/jira/connect"
            className="text-primary hover:underline text-sm"
          >
            Connect your Jira account
          </a>
        </CardContent>
      </Card>
    );
  }

  if (sprints.length === 0 && noSprintIssues.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No Jira tasks found. You don't have any assigned issues.
        </CardContent>
      </Card>
    );
  }

  const getSprintStateColor = (state: string) => {
    switch (state) {
      case "active":
        return "bg-blue-500";
      case "future":
        return "bg-gray-500";
      case "closed":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="space-y-6">
      {/* Sprint Groups */}
      {sprints.map((sprintGroup) => (
        <div key={sprintGroup.sprint.id}>
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-lg font-semibold">{sprintGroup.sprint.name}</h3>
            <Badge
              className={`${getSprintStateColor(
                sprintGroup.sprint.state
              )} text-xs`}
            >
              {sprintGroup.sprint.state}
            </Badge>
            <span className="text-sm text-muted-foreground">
              ({sprintGroup.issues.length} issue
              {sprintGroup.issues.length !== 1 ? "s" : ""})
            </span>
          </div>
          <div className="space-y-2">
            {sprintGroup.issues.map((issue) => (
              <JiraTaskCard
                key={issue.key}
                task={issue}
                jiraSiteUrl={jiraSiteUrl}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Issues without sprint */}
      {noSprintIssues.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-lg font-semibold">Backlog</h3>
            <span className="text-sm text-muted-foreground">
              ({noSprintIssues.length} issue
              {noSprintIssues.length !== 1 ? "s" : ""})
            </span>
          </div>
          <div className="space-y-2">
            {noSprintIssues.map((issue) => (
              <JiraTaskCard
                key={issue.key}
                task={issue}
                jiraSiteUrl={jiraSiteUrl}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
