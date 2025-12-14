"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export type PersonalUpdateOutput = {
  draft: string;
  answers: {
    completed: string;
    notCompleted: string;
    blocked: string;
  };
  nudges: string[];
};

export function PersonalUpdateInline({
  update,
  onUseDraft,
}: {
  update: PersonalUpdateOutput;
  onUseDraft: (text: string) => void;
}) {
  return (
    <Card className="max-w-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Your weekly update (draft)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 text-sm">
          <div>
            <div className="font-medium">1) What did you complete?</div>
            <div className="text-muted-foreground whitespace-pre-wrap">
              {update.answers.completed}
            </div>
          </div>
          <div>
            <div className="font-medium">2) What didn’t you complete?</div>
            <div className="text-muted-foreground whitespace-pre-wrap">
              {update.answers.notCompleted}
            </div>
          </div>
          <div>
            <div className="font-medium">3) What blocked you?</div>
            <div className="text-muted-foreground whitespace-pre-wrap">
              {update.answers.blocked}
            </div>
          </div>
        </div>

        {update.nudges.length > 0 && (
          <div className="text-sm">
            <div className="font-medium mb-1">Private nudges</div>
            <ul className="space-y-1 text-muted-foreground">
              {update.nudges.map((n, idx) => (
                <li key={idx}>- {n}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            Approve or edit before sending:
          </div>
          <Textarea value={update.draft} readOnly className="min-h-[120px]" />
          <div className="flex gap-2">
            <Button type="button" onClick={() => onUseDraft(update.draft)}>
              Use this draft
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(update.draft);
                } catch {
                  // ignore
                }
              }}
            >
              Copy
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


