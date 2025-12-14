"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserIcon, BotIcon } from "@hugeicons/core-free-icons";
import { TaskCardInline } from "./task-card-inline";
import { TaskListInline } from "./task-list-inline";
import { WeeklySummaryInline } from "./weekly-summary-inline";
import { TaskMentionSelector, type JiraTask } from "./task-mention-selector";
import { JiraTaskListInline } from "./jira-task-list-inline";
import { JiraWeeklySummaryInline } from "./jira-weekly-summary-inline";
import { MessageResponse } from "@/components/ai-elements/message";
import { JiraStatusListInline } from "./jira-status-list-inline";
import { JiraTransitionListInline } from "./jira-transition-list-inline";
import { PersonalUpdateInline } from "./personal-update-inline";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSelect,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";

interface ChatInterfaceProps {
  userId: string;
}

export function ChatInterface({ userId }: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const models = [
    { name: "GPT-4o mini", value: "openai/gpt-4o-mini" },
    { name: "GPT-4o", value: "openai/gpt-4o" },
    { name: "Claude 3.5 Sonnet", value: "anthropic/claude-3.5-sonnet" },
  ];
  const [model, setModel] = useState(models[0]!.value);
  const [showMentionSelector, setShowMentionSelector] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { messages, sendMessage, status } = useChat();

  const isLoading = status === "streaming" || status === "submitted";

  const suggestedPrompts = [
    "Show me my Jira tasks",
    "Generate my weekly update",
    "Generate a weekly summary for this week",
    "What should I focus on?",
    "Update @ to Done (type @ and pick an issue)",
    "What are my top blockers this week?",
    "List available statuses for project PROJ",
  ];

  // Detect "@" mention
  useEffect(() => {
    const handleInputChange = (value: string, cursorPos: number) => {
      // Find "@" before cursor
      const textBeforeCursor = value.substring(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");

      if (lastAtIndex !== -1) {
        // Check if there's a space after @ (meaning mention ended)
        const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
        if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
          // Show mention selector immediately
          setMentionQuery(textAfterAt);

          // Calculate position synchronously first, then refine
          const calculatePosition = () => {
            if (textareaRef.current) {
              const textarea = textareaRef.current;
              const rect = textarea.getBoundingClientRect();

              if (rect.width === 0 || rect.height === 0) {
                // Retry if textarea not ready
                setTimeout(calculatePosition, 50);
                return;
              }

              // Position selector below the textarea
              const top = rect.bottom + window.scrollY + 5;
              const left = rect.left + window.scrollX + 10;

              console.log("top", top);
              console.log("left", left);

              setMentionPosition({
                top: Math.max(0, top),
                left: Math.max(0, left),
              });
            } else {
              // Retry if ref not ready
              setTimeout(calculatePosition, 50);
            }
          };

          // Set initial position immediately if possible
          if (textareaRef.current) {
            const textarea = textareaRef.current;
            const rect = textarea.getBoundingClientRect();
            console.log("rect", rect);
            if (rect.width > 0 && rect.height > 0) {
              setMentionPosition({
                top: rect.y + window.scrollY + 5,
                left: rect.x + window.scrollX,
              });
              // Show selector immediately after position is set
              setShowMentionSelector(true);
            } else {
              // If textarea not ready, calculate position and show
              calculatePosition();
            }
          } else {
            // If ref not ready, calculate position and show
            calculatePosition();
          }
        } else {
          setShowMentionSelector(false);
        }
      } else {
        setShowMentionSelector(false);
      }
    };

    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const cursorPos = textarea.selectionStart;
      handleInputChange(input, cursorPos);
    }
  }, [input]);

  const handleTaskSelect = (task: JiraTask) => {
    // Replace "@query" with "@PROJ-123"
    const textBeforeCursor = input.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const textAfterAt = input.substring(lastAtIndex + 1);
      const spaceIndex = textAfterAt.search(/[\s\n]/);
      const endIndex =
        spaceIndex === -1 ? input.length : lastAtIndex + 1 + spaceIndex;

      const newInput =
        input.substring(0, lastAtIndex + 1) +
        task.key +
        " " +
        input.substring(endIndex);

      setInput(newInput);
      setShowMentionSelector(false);
      setMentionQuery("");

      // Focus back on textarea
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = lastAtIndex + 1 + task.key.length + 1;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
  };

  const handleSubmit = (
    messageOrEvent: PromptInputMessage | React.FormEvent
  ) => {
    // PromptInput gives us { text, files }. For legacy form submits, fall back to current input.
    const message =
      "text" in (messageOrEvent as any)
        ? (messageOrEvent as PromptInputMessage)
        : { text: input, files: [] };

    const text = message.text ?? "";
    if (!text.trim() || isLoading) return;

    // Close mention selector if open (don't submit while it's active)
    if (showMentionSelector) {
      setShowMentionSelector(false);
      setMentionQuery("");
      setMentionPosition({ top: 0, left: 0 });
      return;
    }

    sendMessage(
      { role: "user", parts: [{ type: "text", text }] },
      { body: { model } }
    );
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      <Card className="flex-1 flex flex-col overflow-hidden ring-0 my-auto">
        <CardContent className="flex-1 overflow-y-auto space-y-4 shadow-none">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8 space-y-4">
              <div className="space-y-2">
                <p>Start chatting with your AI project manager.</p>
                <p className="text-xs">
                  Tip: Type &quot;@&quot; to search and mention Jira issues
                </p>
              </div>

              <div className="max-w-2xl mx-auto">
                <div className="text-xs font-medium text-foreground mb-2">
                  Suggested prompts
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="px-3 py-2 rounded-full border border-border bg-background text-foreground text-xs hover:bg-muted transition-colors"
                      onClick={() => {
                        setInput(prompt);
                        setShowMentionSelector(false);
                        setMentionQuery("");
                        setTimeout(() => textareaRef.current?.focus(), 0);
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "assistant" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <HugeiconsIcon
                    icon={BotIcon}
                    className="w-5 h-5 text-primary"
                  />
                </div>
              )}
              <div
                className={`max-w-[80%] ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground rounded-lg p-3"
                    : "space-y-2"
                }`}
              >
                {message.role === "user" ? (
                  <div className="whitespace-pre-wrap">
                    {message.parts
                      .filter((part) => part.type === "text")
                      .map((part: any) => part.text)
                      .join("")}
                  </div>
                ) : (
                  <>
                    {message.parts && message.parts.length > 0 ? (
                      (() => {
                        const indexedParts = message.parts.map(
                          (part: any, idx: number) => ({ part, idx })
                        );
                        const textParts = indexedParts.filter(
                          ({ part }) => part.type === "text"
                        );
                        const nonTextParts = indexedParts.filter(
                          ({ part }) => part.type !== "text"
                        );

                        // Goal: show assistant text first. Tool/UI parts can arrive before the final text
                        // (because tools execute before the model writes). We hold UI until text exists,
                        // or until the stream is finished.
                        const shouldRenderTools =
                          textParts.length > 0 || !isLoading;

                        const renderToolPart = (part: any, idx: number) => {
                          // Render UI components from tool results
                          // Check for tool-createTask
                          if (part.type === "tool-createTask") {
                            if (
                              part.state === "output-available" &&
                              part.output?.task
                            ) {
                              return (
                                <div
                                  key={part.toolCallId || idx}
                                  className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                                >
                                  <TaskCardInline task={part.output.task} />
                                </div>
                              );
                            }
                            return (
                              <div
                                key={part.toolCallId || idx}
                                className="bg-muted rounded-lg p-3 text-sm text-muted-foreground"
                              >
                                Creating task...
                              </div>
                            );
                          }
                          // Check for tool-updateTaskStatus
                          else if (part.type === "tool-updateTaskStatus") {
                            if (
                              part.state === "output-available" &&
                              part.output?.task
                            ) {
                              return (
                                <div
                                  key={part.toolCallId || idx}
                                  className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                                >
                                  <TaskCardInline task={part.output.task} />
                                </div>
                              );
                            }
                            return (
                              <div
                                key={part.toolCallId || idx}
                                className="bg-muted rounded-lg p-3 text-sm text-muted-foreground"
                              >
                                Updating task...
                              </div>
                            );
                          }
                          // Check for tool-listTasks
                          else if (part.type === "tool-listTasks") {
                            if (
                              part.state === "output-available" &&
                              part.output?.tasks
                            ) {
                              // Fetch full task objects to render
                              const tasks = part.output.tasks;
                              return (
                                <div
                                  key={part.toolCallId || idx}
                                  className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                                >
                                  <TaskListInline tasks={tasks} />
                                </div>
                              );
                            }
                            return (
                              <div
                                key={part.toolCallId || idx}
                                className="bg-muted rounded-lg p-3 text-sm text-muted-foreground"
                              >
                                Loading tasks...
                              </div>
                            );
                          }
                          // Check for tool-renderTaskCard
                          else if (part.type === "tool-renderTaskCard") {
                            if (
                              part.state === "output-available" &&
                              part.output?.task
                            ) {
                              return (
                                <div
                                  key={part.toolCallId || idx}
                                  className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                                >
                                  <TaskCardInline task={part.output.task} />
                                </div>
                              );
                            }
                            return (
                              <div
                                key={part.toolCallId || idx}
                                className="bg-muted rounded-lg p-3 text-sm text-muted-foreground"
                              >
                                Loading task...
                              </div>
                            );
                          }
                          // Check for tool-listJiraIssues
                          else if (part.type === "tool-listJiraIssues") {
                            if (
                              part.state === "output-available" &&
                              part.output?.issues
                            ) {
                              const issues = part.output.issues;
                              return (
                                <div
                                  key={part.toolCallId || idx}
                                  className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                                >
                                  <JiraTaskListInline
                                    tasks={issues}
                                    jiraSiteUrl={part.output.jiraSiteUrl}
                                  />
                                </div>
                              );
                            }
                            return (
                              <div
                                key={part.toolCallId || idx}
                                className="bg-muted rounded-lg p-3 text-sm text-muted-foreground"
                              >
                                Loading Jira tasks...
                              </div>
                            );
                          }
                          // Check for tool-listJiraStatuses
                          else if (part.type === "tool-listJiraStatuses") {
                            if (
                              part.state === "output-available" &&
                              part.output?.statuses
                            ) {
                              const title =
                                part.output.scope === "project"
                                  ? `Statuses for project ${part.output.projectKey}`
                                  : "All statuses in this Jira instance";
                              return (
                                <div
                                  key={part.toolCallId || idx}
                                  className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                                >
                                  <JiraStatusListInline
                                    title={title}
                                    statuses={part.output.statuses}
                                  />
                                </div>
                              );
                            }
                            return (
                              <div
                                key={part.toolCallId || idx}
                                className="bg-muted rounded-lg p-3 text-sm text-muted-foreground"
                              >
                                Loading statuses...
                              </div>
                            );
                          }
                          // Check for tool-listJiraTransitions
                          else if (part.type === "tool-listJiraTransitions") {
                            if (
                              part.state === "output-available" &&
                              part.output?.transitions &&
                              part.output?.issueKey
                            ) {
                              return (
                                <div
                                  key={part.toolCallId || idx}
                                  className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                                >
                                  <JiraTransitionListInline
                                    issueKey={part.output.issueKey}
                                    transitions={part.output.transitions}
                                  />
                                </div>
                              );
                            }
                            return (
                              <div
                                key={part.toolCallId || idx}
                                className="bg-muted rounded-lg p-3 text-sm text-muted-foreground"
                              >
                                Loading transitions...
                              </div>
                            );
                          }
                          // Check for tool-generatePersonalUpdate
                          else if (
                            part.type === "tool-generatePersonalUpdate"
                          ) {
                            if (
                              part.state === "output-available" &&
                              part.output?.update
                            ) {
                              return (
                                <div
                                  key={part.toolCallId || idx}
                                  className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                                >
                                  {part.output?.tasks && (
                                    <div className="mb-3">
                                      <div className="text-xs text-muted-foreground mb-2">
                                        Current tasks
                                      </div>
                                      <JiraTaskListInline
                                        tasks={part.output.tasks}
                                        jiraSiteUrl={part.output.jiraSiteUrl}
                                      />
                                    </div>
                                  )}
                                  <PersonalUpdateInline
                                    update={part.output.update}
                                    onUseDraft={(text) => {
                                      setInput(text);
                                      setShowMentionSelector(false);
                                      setMentionQuery("");
                                      setTimeout(
                                        () => textareaRef.current?.focus(),
                                        0
                                      );
                                    }}
                                  />
                                </div>
                              );
                            }
                            return (
                              <div
                                key={part.toolCallId || idx}
                                className="bg-muted rounded-lg p-3 text-sm text-muted-foreground"
                              >
                                Generating your update...
                              </div>
                            );
                          }
                          // Check for tool-generateSummary
                          else if (part.type === "tool-generateSummary") {
                            if (
                              part.state === "output-available" &&
                              part.output?.summary
                            ) {
                              return (
                                <div key={part.toolCallId || idx}>
                                  <WeeklySummaryInline
                                    summary={part.output.summary}
                                    plannedTasks={part.output.plannedTasks || 0}
                                    completedTasks={
                                      part.output.completedTasks || 0
                                    }
                                    blockedTasks={part.output.blockedTasks || 0}
                                  />
                                </div>
                              );
                            }
                            return (
                              <div
                                key={part.toolCallId || idx}
                                className="bg-muted rounded-lg p-3 text-sm text-muted-foreground"
                              >
                                Generating summary...
                              </div>
                            );
                          }
                          // Check for tool-generateJiraWeeklySummary
                          else if (
                            part.type === "tool-generateJiraWeeklySummary"
                          ) {
                            if (
                              part.state === "output-available" &&
                              part.output?.ui
                            ) {
                              return (
                                <div
                                  key={part.toolCallId || idx}
                                  className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                                >
                                  <JiraWeeklySummaryInline
                                    ui={part.output.ui}
                                    raw={part.output.raw}
                                  />
                                </div>
                              );
                            }
                            return (
                              <div
                                key={part.toolCallId || idx}
                                className="bg-muted rounded-lg p-3 text-sm text-muted-foreground"
                              >
                                Generating weekly summary...
                              </div>
                            );
                          }
                          return null;
                        };

                        return (
                          <>
                            {textParts.map(({ part, idx }) => (
                              <div
                                key={idx}
                                className="bg-muted rounded-lg p-3"
                              >
                                <MessageResponse className="prose prose-sm max-w-none">
                                  {part.text}
                                </MessageResponse>
                              </div>
                            ))}

                            {/* If tools arrive before text, avoid showing UI first */}
                            {textParts.length === 0 &&
                              nonTextParts.length > 0 &&
                              isLoading && (
                                <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground">
                                  Preparing response...
                                </div>
                              )}

                            {shouldRenderTools &&
                              nonTextParts.map(({ part, idx }) =>
                                renderToolPart(part, idx)
                              )}
                          </>
                        );
                      })()
                    ) : (
                      // No parts available
                      <div className="bg-muted rounded-lg p-3 text-muted-foreground text-sm">
                        No content available
                      </div>
                    )}
                  </>
                )}
              </div>
              {message.role === "user" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <HugeiconsIcon
                    icon={UserIcon}
                    className="w-5 h-5 text-primary"
                  />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <HugeiconsIcon
                  icon={BotIcon}
                  className="w-5 h-5 text-primary"
                />
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce delay-75" />
                  <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce delay-150" />
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <div className="p-4 relative">
          <PromptInput
            onSubmit={(message) => handleSubmit(message)}
            className="mt-4"
            maxFiles={0}
          >
            <PromptInputBody>
              <PromptInputTextarea
                ref={textareaRef}
                onChange={(e) => {
                  setInput(e.target.value);
                  setCursorPosition(e.target.selectionStart);
                }}
                onKeyDown={(e) => {
                  if (
                    showMentionSelector &&
                    (e.key === "Escape" ||
                      e.key === "ArrowDown" ||
                      e.key === "ArrowUp" ||
                      (e.key === "Enter" && !e.shiftKey))
                  ) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                onSelect={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  setCursorPosition(target.selectionStart);
                }}
                value={input}
                placeholder='Type your message... Use "@" to mention tasks'
              />

              {showMentionSelector && (
                <TaskMentionSelector
                  query={mentionQuery}
                  onSelect={handleTaskSelect}
                  onClose={() => {
                    setShowMentionSelector(false);
                    setMentionQuery("");
                    setMentionPosition({ top: 0, left: 0 });
                  }}
                  position={mentionPosition}
                />
              )}
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputSelect
                  onValueChange={(value: unknown) => setModel(String(value))}
                  value={model}
                >
                  <PromptInputSelectTrigger>
                    <PromptInputSelectValue />
                  </PromptInputSelectTrigger>
                  <PromptInputSelectContent>
                    {models.map((m) => (
                      <PromptInputSelectItem key={m.value} value={m.value}>
                        {m.name}
                      </PromptInputSelectItem>
                    ))}
                  </PromptInputSelectContent>
                </PromptInputSelect>
              </PromptInputTools>
              <PromptInputSubmit disabled={isLoading} status={status} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </Card>
    </div>
  );
}
