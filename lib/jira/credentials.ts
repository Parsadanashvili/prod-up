// Helper functions for managing Jira credentials with automatic token refresh
import { getJiraCredentialsByUserId, createJiraCredentials } from "./queries";
import { refreshJiraToken } from "./oauth";
import type { JiraCredentials } from "@/lib/db/schema";

/**
 * Get valid Jira credentials for a user, refreshing the token if expired
 */
export async function getValidJiraCredentials(
  userId: string
): Promise<JiraCredentials | null> {
  const credentials = await getJiraCredentialsByUserId(userId);
  
  if (!credentials) {
    return null;
  }

  // Check if token is expired (with 5 minute buffer for safety)
  // Handle both Date objects and string dates from database
  const expiresAt = credentials.expires_at instanceof Date
    ? credentials.expires_at
    : new Date(credentials.expires_at);
  const now = new Date();
  const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
  
  // If token expires within 5 minutes, refresh it
  if (expiresAt.getTime() - now.getTime() < bufferTime) {
    try {
      const clientId = process.env.JIRA_CLIENT_ID;
      const clientSecret = process.env.JIRA_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        console.error("Jira OAuth credentials not configured");
        return credentials; // Return existing credentials even if we can't refresh
      }

      // Refresh the token
      const refreshed = await refreshJiraToken(credentials.refresh_token, {
        clientId,
        clientSecret,
      });

      // Update credentials in database
      const updatedCredentials = await createJiraCredentials({
        user_id: credentials.user_id,
        jira_cloud_id: credentials.jira_cloud_id,
        jira_site_url: credentials.jira_site_url,
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        expires_at: new Date(Date.now() + refreshed.expires_in * 1000),
      });

      console.log("Jira access token refreshed successfully");
      return updatedCredentials;
    } catch (error) {
      console.error("Failed to refresh Jira token:", error);
      // If refresh fails, return existing credentials
      // The API call will fail and we can handle it there
      return credentials;
    }
  }

  return credentials;
}

