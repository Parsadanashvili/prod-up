import { streamText, stepCountIs } from "ai";
import { getChatModel } from "@/lib/ai/config";
import { createMessage, getMessagesByUserId } from "@/lib/db/queries";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createJiraTools } from "@/lib/ai/tools/jira-tools";
import {
  detectStandupFlow,
  getStandupSystemPrompt,
} from "@/lib/ai/agents/standup-agent";

export async function POST(request: NextRequest) {
  try {
    // Get userId from NextAuth session
    const user = await requireAuth();
    const userId = user.id;

    const body = await request.json();
    const { messages, model } = body as {
      messages: any[];
      model?: unknown;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response("messages array is required and must not be empty", {
        status: 400,
      });
    }

    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "user") {
      return new Response(
        "Invalid message format: last message must be from user",
        { status: 400 }
      );
    }

    // Extract text content from message parts
    // Handle both UIMessage format (with parts) and legacy format (with content)
    let messageText = "";
    if (lastMessage.parts && Array.isArray(lastMessage.parts)) {
      messageText =
        lastMessage.parts
          .filter((part: any) => part.type === "text")
          .map((part: any) => part.text)
          .join("") || "";
    } else if (lastMessage.content) {
      // Fallback for legacy format
      messageText =
        typeof lastMessage.content === "string" ? lastMessage.content : "";
    }

    if (!messageText.trim()) {
      return new Response("Message content is required", { status: 400 });
    }

    // Store user message
    await createMessage({
      userId,
      content: messageText,
      role: "user",
    });

    // Get conversation history from database
    const dbMessages = await getMessagesByUserId(userId, 20);
    const conversationHistory = dbMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Detect standup flow (Monday planning vs Friday review)
    const flow = detectStandupFlow();
    const systemPrompt = getStandupSystemPrompt(flow);

    // Convert UIMessages to model messages format
    const modelMessages = messages.map((msg: any) => {
      const content =
        msg.parts
          ?.filter((part: any) => part.type === "text")
          .map((part: any) => part.text)
          .join("") || "";
      return {
        role: msg.role,
        content,
      };
    });

    // Create Jira tools with userId context
    const jiraTools = createJiraTools(userId);
    const tools = {
      listJiraIssues: jiraTools.listJiraIssues,
      updateJiraIssueStatus: jiraTools.updateJiraIssueStatus,
      getJiraIssue: jiraTools.getJiraIssue,
      listJiraStatuses: jiraTools.listJiraStatuses,
      listJiraTransitions: jiraTools.listJiraTransitions,
      generateJiraWeeklySummary: jiraTools.generateJiraWeeklySummary,
      getJiraUserContext: jiraTools.getJiraUserContext,
      generatePersonalUpdate: jiraTools.generatePersonalUpdate,
      applyLatestPersonalUpdateToJira:
        jiraTools.applyLatestPersonalUpdateToJira,
    };

    // Generate AI response with tools
    // Use stopWhen to enable multi-step calls so AI generates text after tool execution
    const result = streamText({
      model: getChatModel(typeof model === "string" ? model : undefined),
      messages: modelMessages,
      system: systemPrompt,
      tools: tools,
      stopWhen: stepCountIs(5), // Allow up to 5 steps (tool calls + text generation)
      onFinish: async ({ text, toolCalls, toolResults }) => {
        // Store assistant message in database
        if (text) {
          await createMessage({
            userId,
            content: text,
            role: "assistant",
          });
        }
      },
    });

    // Return UI message stream response
    // Tool results will be included in message parts, and the client will render UI components
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Error in chat route:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
