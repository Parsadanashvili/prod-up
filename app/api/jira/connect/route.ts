import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getJiraAuthUrl } from "@/lib/jira/oauth";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    const callbackUrl = searchParams.get("callback") || "/chat";

    // Generate state for OAuth flow
    const state = crypto.randomBytes(32).toString("hex");

    // Store state in session/cookie (simplified - in production use proper session storage)
    // For now, we'll encode it in the redirect URL

    const clientId = process.env.JIRA_CLIENT_ID;
    const clientSecret = process.env.JIRA_CLIENT_SECRET;
    const redirectUri = `${
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    }/api/jira/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        {
          error:
            "Jira OAuth not configured. Please set JIRA_CLIENT_ID and JIRA_CLIENT_SECRET.",
        },
        { status: 500 }
      );
    }

    const authUrl = getJiraAuthUrl(
      {
        clientId,
        clientSecret,
        redirectUri,
        scopes: [
          "read:jira-user",
          "read:jira-work",
          "write:jira-work",
          "offline_access",
        ],
      },
      `${state}:${user.id}:${callbackUrl}` // Encode user ID and callback in state
    );

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Error initiating Jira OAuth:", error);
    return NextResponse.json(
      { error: "Failed to initiate Jira connection" },
      { status: 500 }
    );
  }
}
