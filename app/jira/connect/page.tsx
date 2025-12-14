import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { getJiraCredentialsByUserId } from "@/lib/jira/queries";
import { redirect } from "next/navigation";

export default async function JiraConnectPage({
  searchParams,
}: {
  searchParams?: { callback?: string };
}) {
  const user = await requireAuth();
  const credentials = await getJiraCredentialsByUserId(user.id);
  const callback = searchParams?.callback || "/chat";

  if (credentials) {
    redirect(callback);
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Connect Your Jira Account</CardTitle>
          <CardDescription>
            Connect your Jira account to manage tasks directly from the chat interface.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            By connecting your Jira account, you&apos;ll be able to:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>View and manage your assigned Jira issues</li>
            <li>Update issue statuses through natural language</li>
            <li>Search for issues using the @ mention feature</li>
            <li>Get AI-powered summaries of your work</li>
          </ul>
          <form action="/api/jira/connect" method="GET">
            <input type="hidden" name="callback" value={callback} />
            <Button type="submit" className="w-full">
              Connect Jira Account
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

