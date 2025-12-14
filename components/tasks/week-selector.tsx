"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Week } from "@/lib/db/schema";
import { format } from "date-fns";

interface WeekSelectorProps {
  selectedWeekId: string | null;
  onWeekChange: (weekId: string | null) => void;
  weeks: Week[];
}

export function WeekSelector({
  selectedWeekId,
  onWeekChange,
  weeks,
}: WeekSelectorProps) {
  return (
    <Select value={selectedWeekId} onValueChange={(v) => onWeekChange}>
      <SelectTrigger className="w-[250px]">
        <SelectValue
          render={(props, state) => {
            const selected = weeks.find((i) => i.id === state.value);

            if (selected) {
              const start = new Date(selected.start_date);
              const end = new Date(selected.end_date);
              const label = `${format(start, "MMM d")} - ${format(
                end,
                "MMM d, yyyy"
              )}`;
              return label;
            }
            return "Select week";
          }}
        />
      </SelectTrigger>
      <SelectContent>
        {weeks.map((week) => {
          const start = new Date(week.start_date);
          const end = new Date(week.end_date);
          const label = `${format(start, "MMM d")} - ${format(
            end,
            "MMM d, yyyy"
          )}`;
          return (
            <SelectItem key={week.id} value={week.id}>
              {label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
