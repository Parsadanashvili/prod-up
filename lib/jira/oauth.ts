// Jira OAuth helper functions
// Jira uses OAuth 2.0 with authorization code flow

export interface JiraOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export function getJiraAuthUrl(config: JiraOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: config.scopes.join(" "),
    state: state,
  });

  return `https://auth.atlassian.com/authorize?${params.toString()}`;
}

export async function exchangeJiraCode(
  code: string,
  config: JiraOAuthConfig
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}> {
  const response = await fetch("https://auth.atlassian.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Failed to exchange Jira code: ${errorText}`;
    
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error_description) {
        errorMessage = `Jira OAuth error: ${errorJson.error} - ${errorJson.error_description}`;
      }
    } catch {
      // If not JSON, use the text as-is
    }
    
    throw new Error(errorMessage);
  }

  return response.json();
}

export async function refreshJiraToken(
  refreshToken: string,
  config: Pick<JiraOAuthConfig, "clientId" | "clientSecret">
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const response = await fetch("https://auth.atlassian.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Jira token: ${error}`);
  }

  return response.json();
}

export async function getJiraCloudId(accessToken: string): Promise<string> {
  const response = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get Jira cloud ID");
  }

  const resources = await response.json();
  // Get the first Jira resource
  const jiraResource = resources.find((r: any) => r.scopes.includes("read:jira-work"));
  if (!jiraResource) {
    throw new Error("No Jira resource found");
  }

  return jiraResource.id;
}

