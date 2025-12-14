import { NextRequest, NextResponse } from "next/server";
import { generateWeeklySummary } from "@/lib/ai/summary-generator";
import { getTasksByWeekId, getWeeksByUserId } from "@/lib/db/queries";
import { startOfWeek } from "date-fns";

// GET /api/summary - Generate weekly summary
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const weekId = searchParams.get("weekId");
    const date = searchParams.get("date"); // Optional: specific date to get week for

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    let targetWeekId = weekId;

    // If no weekId provided, get current week or week for specified date
    if (!targetWeekId) {
      const targetDate = date ? new Date(date) : new Date();
      const weekStart = startOfWeek(targetDate, { weekStartsOn: 1 });
      const weeks = await getWeeksByUserId(userId);
      const matchingWeek = weeks.find((w) => {
        const weekStartDate = new Date(w.start_date);
        return weekStartDate.getTime() === weekStart.getTime();
      });

      if (!matchingWeek) {
        return NextResponse.json({ error: "Week not found" }, { status: 404 });
      }

      targetWeekId = matchingWeek.id;
    }

    // Get tasks for the week
    const tasks = await getTasksByWeekId(targetWeekId);

    // Get week details
    const weeks = await getWeeksByUserId(userId);
    const week = weeks.find((w) => w.id === targetWeekId);

    if (!week) {
      return NextResponse.json({ error: "Week not found" }, { status: 404 });
    }

    const weekStart = new Date(week.start_date);
    const summary = await generateWeeklySummary(weekStart, tasks);

    return NextResponse.json({
      summary: summary.summary,
      plannedTasks: summary.plannedTasks,
      completedTasks: summary.completedTasks,
      blockedTasks: summary.blockedTasks,
      insights: summary.insights,
      week: {
        id: week.id,
        startDate: week.start_date,
        endDate: week.end_date,
      },
    });
  } catch (error) {
    console.error("Error generating summary:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}
