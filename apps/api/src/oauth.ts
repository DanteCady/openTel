/**
 * OAuth URL builders and token exchange for Gmail and Microsoft 365.
 * Used for "Connect your inbox" email channel; state = tenantId.
 */

import { google } from "googleapis";
import { ConfidentialClientApplication } from "@azure/msal-node";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
];

const MICROSOFT_SCOPES = ["Mail.Send", "User.Read", "offline_access"];

export interface GmailOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface MicrosoftOAuthConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
}

/**
 * Build Google OAuth consent URL. Redirect user here to start Gmail connect.
 * state should be tenantId (validated on callback).
 */
export function getGmailAuthUrl(
  config: GmailOAuthConfig,
  tenantId: string,
  redirectUriSuccess?: string
): string {
  const oauth2 = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri
  );
  const state = redirectUriSuccess
    ? `${tenantId}:${redirectUriSuccess}`
    : tenantId;
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    state,
  });
}

/**
 * Exchange Google authorization code for tokens. Returns refresh_token to store.
 */
export async function exchangeGmailCode(
  config: GmailOAuthConfig,
  code: string
): Promise<{ refreshToken: string }> {
  const oauth2 = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri
  );
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("Google did not return a refresh_token (re-consent may be required)");
  }
  return { refreshToken: tokens.refresh_token };
}

/**
 * Parse state from Gmail callback: "tenantId" or "tenantId:successRedirectUri".
 */
export function parseGmailState(state: string): {
  tenantId: string;
  successRedirectUri?: string;
} {
  const colon = state.indexOf(":");
  if (colon === -1) return { tenantId: state };
  return {
    tenantId: state.slice(0, colon),
    successRedirectUri: state.slice(colon + 1) || undefined,
  };
}

/**
 * Build Microsoft OAuth consent URL. Redirect user here to start Microsoft 365 connect.
 */
export async function getMicrosoftAuthUrl(
  config: MicrosoftOAuthConfig,
  tenantId: string,
  redirectUriSuccess?: string
): Promise<string> {
  const msal = new ConfidentialClientApplication({
    auth: {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
    },
  });
  const state = redirectUriSuccess
    ? `${tenantId}:${redirectUriSuccess}`
    : tenantId;
  const url = await msal.getAuthCodeUrl({
    scopes: MICROSOFT_SCOPES,
    redirectUri: config.redirectUri,
    state,
  });
  if (!url) throw new Error("MSAL getAuthCodeUrl returned no URL");
  return url;
}

/**
 * Exchange Microsoft authorization code for tokens. Returns refresh_token to store.
 * Uses token endpoint directly so we reliably receive refresh_token.
 */
export async function exchangeMicrosoftCode(
  config: MicrosoftOAuthConfig,
  code: string
): Promise<{ refreshToken: string }> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });
  const url = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft token exchange failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { refresh_token?: string };
  if (!data.refresh_token) {
    throw new Error(
      "Microsoft did not return a refresh_token (include offline_access and re-consent)"
    );
  }
  return { refreshToken: data.refresh_token };
}

/**
 * Parse state from Microsoft callback: "tenantId" or "tenantId:successRedirectUri".
 */
export function parseMicrosoftState(state: string): {
  tenantId: string;
  successRedirectUri?: string;
} {
  const colon = state.indexOf(":");
  if (colon === -1) return { tenantId: state };
  return {
    tenantId: state.slice(0, colon),
    successRedirectUri: state.slice(colon + 1) || undefined,
  };
}
