import { generateObject } from "ai";
import { getChatModel } from "@/lib/ai/config";
import { taskExtractionSchema } from "@/lib/ai/schema/task-extraction-schema";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const userId = user.id;

    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "message is required and must be a string" },
        { status: 400 }
      );
    }

    const { object } = await generateObject({
      model: getChatModel(),
      schema: taskExtractionSchema,
      prompt: `Extract tasks from the following message. Identify any tasks, work items, or action items mentioned.
      
For each task, determine its status based on keywords:
- "done", "completed", "finished" → done
- "blocked", "stuck", "waiting" → blocked
- "working on", "in progress" → in_progress
- "cancelled", "won't do" → cancelled
- Otherwise → not_started

Message: "${message}"

Return only tasks that are clearly actionable items. Ignore general statements or questions.`,
    });

    return NextResponse.json({ tasks: object.tasks });
  } catch (error) {
    console.error("Error generating task objects:", error);
    return NextResponse.json(
      { error: "Failed to extract tasks" },
      { status: 500 }
    );
  }
}

