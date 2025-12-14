import { NextRequest, NextResponse } from "next/server";
import { exchangeJiraCode, getJiraCloudId } from "@/lib/jira/oauth";
import { createJiraCredentials } from "@/lib/jira/queries";

function getAbsoluteUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}${path}`;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle OAuth errors from Atlassian
    if (error) {
      console.error("Jira OAuth error:", error);
      return NextResponse.redirect(
        getAbsoluteUrl(`/chat?error=jira_oauth_${error}`)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        getAbsoluteUrl("/chat?error=missing_params")
      );
    }

    // Parse state: "state:userId:callbackUrl"
    const stateParts = state.split(":");
    if (stateParts.length < 2) {
      return NextResponse.redirect(getAbsoluteUrl("/chat?error=invalid_state"));
    }

    const userId = stateParts[1];
    const callbackUrl = stateParts.slice(2).join(":") || "/chat";

    if (!userId) {
      return NextResponse.redirect(getAbsoluteUrl("/chat?error=invalid_state"));
    }

    const clientId = process.env.JIRA_CLIENT_ID;
    const clientSecret = process.env.JIRA_CLIENT_SECRET;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUri = `${baseUrl}/api/jira/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        getAbsoluteUrl("/chat?error=oauth_not_configured")
      );
    }

    // Exchange code for tokens
    let tokens;
    try {
      tokens = await exchangeJiraCode(code, {
        clientId,
        clientSecret,
        redirectUri,
        scopes: [],
      });
    } catch (error) {
      console.error("Failed to exchange Jira code:", error);
      // Check if it's an invalid_grant error (code expired or already used)
      if (error instanceof Error && error.message.includes("invalid_grant")) {
        return NextResponse.redirect(
          getAbsoluteUrl("/chat?error=code_expired")
        );
      }
      throw error;
    }

    // Get Jira cloud ID and site URL from accessible resources
    const resourcesResponse = await fetch(
      "https://api.atlassian.com/oauth/token/accessible-resources",
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          Accept: "application/json",
        },
      }
    );

    if (!resourcesResponse.ok) {
      throw new Error("Failed to get accessible resources");
    }

    const resources = await resourcesResponse.json();
    const jiraResource = resources.find((r: any) =>
      r.scopes.includes("read:jira-work")
    );

    if (!jiraResource) {
      throw new Error("No Jira resource found in accessible resources");
    }

    const cloudId = jiraResource.id;
    const siteUrl = jiraResource.url?.replace("https://", "") || "";

    if (!siteUrl) {
      throw new Error("Could not determine Jira site URL");
    }

    // Store credentials
    await createJiraCredentials({
      user_id: userId,
      jira_cloud_id: cloudId,
      jira_site_url: siteUrl,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000),
    });

    const successUrl = callbackUrl.startsWith("http")
      ? `${callbackUrl}?success=jira_connected`
      : getAbsoluteUrl(`${callbackUrl}?success=jira_connected`);

    return NextResponse.redirect(successUrl);
  } catch (error) {
    console.error("Error in Jira OAuth callback:", error);
    return NextResponse.redirect(
      getAbsoluteUrl("/chat?error=jira_connection_failed")
    );
  }
}
