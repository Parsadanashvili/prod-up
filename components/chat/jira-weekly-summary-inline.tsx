"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { MessageResponse } from "@/components/ai-elements/message";
import type {
  JiraWeeklySummaryRaw,
  JiraWeeklySummaryUI,
} from "@/lib/ai/jira-summary-generator";
import { cn } from "@/lib/utils";

interface JiraWeeklySummaryInlineProps {
  ui: JiraWeeklySummaryUI;
  raw?: JiraWeeklySummaryRaw;
}

function toneClass(tone?: "neutral" | "success" | "warning" | "danger" | null) {
  switch (tone) {
    case "success":
      return "bg-green-500/5";
    case "warning":
      return "bg-orange-500/5";
    case "danger":
      return "bg-red-500/5";
    default:
      return "bg-muted/30";
  }
}

function segmentColor(color?: string | null) {
  switch (color) {
    case "green":
      return "bg-green-500";
    case "blue":
      return "bg-blue-500";
    case "red":
      return "bg-red-500";
    case "orange":
      return "bg-orange-500";
    case "purple":
      return "bg-purple-500";
    case "gray":
    default:
      return "bg-gray-400";
  }
}

export function JiraWeeklySummaryInline({
  ui,
  raw,
}: JiraWeeklySummaryInlineProps) {
  // Ensure we always show an "Anomalies" section, even if none were detected.
  const hasAnomaliesSection = ui.sections.some(
    (s) => s.title.toLowerCase().trim() === "anomalies"
  );
  const anomaliesBullets =
    raw?.anomalies && raw.anomalies.length > 0 ? raw.anomalies : null;
  const normalizedSections = hasAnomaliesSection
    ? ui.sections
    : [
        ...ui.sections,
        {
          title: "Anomalies",
          kind: anomaliesBullets ? ("bullets" as const) : ("text" as const),
          text: anomaliesBullets ? null : "No anomalies detected.",
          bullets: anomaliesBullets,
          tone: null,
        },
      ];

  return (
    <div className="space-y-4 my-2">
      {/* AI-driven stats UI */}
      <Card
        className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        style={{ animationDelay: "0ms" }}
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Weekly Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {ui.cards.map((c, idx) => (
              <div
                key={`${c.title}-${idx}`}
                className={cn(
                  "rounded-lg border border-border px-3 py-2 animate-in fade-in slide-in-from-bottom-2 duration-300",
                  toneClass(c.tone)
                )}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className="text-xl font-semibold tabular-nums">
                  {c.value}
                </div>
                <div className="text-xs text-muted-foreground">{c.title}</div>
                {c.subtitle && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {c.subtitle}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Bars */}
          {ui.bars?.map((bar, idx) => {
            if (bar.type === "progress") {
              return (
                <Progress
                  key={`progress-${idx}`}
                  value={bar.value}
                  className="gap-2"
                >
                  <ProgressLabel className="text-xs text-muted-foreground">
                    {bar.label}
                  </ProgressLabel>
                  <ProgressValue className="text-xs">
                    {(formattedValue) =>
                      bar.valueLabel ?? formattedValue ?? `${bar.value}%`
                    }
                  </ProgressValue>
                </Progress>
              );
            }

            // stacked
            const total =
              bar.segments.reduce((sum, s) => sum + (s.value ?? 0), 0) || 1;
            const pct = (n: number) => (n / total) * 100;

            return (
              <div key={`stacked-${idx}`} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    {bar.label}
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    Total: {total}
                  </div>
                </div>
                <div className="h-2 w-full rounded-full overflow-hidden bg-muted flex">
                  {bar.segments.map((s, si) => (
                    <div
                      key={`${s.label}-${si}`}
                      className={cn("h-full", segmentColor(s.color))}
                      style={{ width: `${pct(s.value)}%` }}
                      title={`${s.label}: ${s.value}`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {bar.segments.map((s, si) => (
                    <div
                      key={`${s.label}-legend-${si}`}
                      className="flex items-center gap-2"
                    >
                      <span
                        className={cn(
                          "h-2 w-2 rounded-sm",
                          segmentColor(s.color)
                        )}
                      />
                      {s.label}{" "}
                      <span className="tabular-nums">({s.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* AI-driven sections */}
      {normalizedSections.map((section, idx) => (
        <Card
          key={`${section.title}-${idx}`}
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ animationDelay: `${250 + idx * 25}ms` }}
        >
          <CardHeader>
            <CardTitle className="text-lg">{section.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {section.kind === "bullets" || section.bullets ? (
              <ul className="space-y-2">
                {(section.bullets ?? []).map((b, bi) => (
                  <li key={bi} className="text-sm flex items-start gap-2">
                    <span className="text-muted-foreground mt-0.5">•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <MessageResponse className="prose prose-sm max-w-none text-sm leading-relaxed">
                {section.text ?? ""}
              </MessageResponse>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
