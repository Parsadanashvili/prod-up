import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

// Get API key from environment
const apiKey = process.env.OPENROUTER_API_KEY?.trim();

if (!apiKey) {
  console.error(
    "OPENROUTER_API_KEY is missing or empty. Please set it in your .env.local file."
  );
  throw new Error("OPENROUTER_API_KEY environment variable is required");
}

// Initialize OpenRouter provider
export const openrouter = createOpenRouter({
  apiKey: apiKey,
});

// Default model to use (can be overridden)
export const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

// Helper function to get the chat model instance
export function getChatModel(model?: string): LanguageModel {
  return openrouter.chat(model || DEFAULT_MODEL) as LanguageModel;
}
