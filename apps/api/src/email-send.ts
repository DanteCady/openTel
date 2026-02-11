/**
 * Email sending via transactional providers, OAuth (Gmail/Microsoft), and custom SMTP.
 * API keys, refresh tokens, and passwords are fetched from SecretsProvider.
 */

import { google } from "googleapis";
import nodemailer from "nodemailer";

export interface SendEmailParams {
  to: string;
  from: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  replyTo?: string;
}

export async function sendViaSendGrid(
  apiKey: string,
  params: SendEmailParams
): Promise<{ messageId: string }> {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: params.to }] }],
      from: { email: params.from },
      subject: params.subject,
      content: [
        ...(params.bodyText ? [{ type: "text/plain", value: params.bodyText }] : []),
        ...(params.bodyHtml ? [{ type: "text/html", value: params.bodyHtml }] : []),
      ].filter(Boolean),
      reply_to: params.replyTo ? { email: params.replyTo } : undefined,
    }),
  });
  const id = res.headers.get("x-message-id");
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SendGrid error ${res.status}: ${err}`);
  }
  return { messageId: id ?? "unknown" };
}

export async function sendViaMailgun(
  apiKey: string,
  domain: string,
  params: SendEmailParams
): Promise<{ messageId: string }> {
  const form = new FormData();
  form.append("to", params.to);
  form.append("from", params.from);
  form.append("subject", params.subject);
  if (params.bodyText) form.append("text", params.bodyText);
  if (params.bodyHtml) form.append("html", params.bodyHtml);
  if (params.replyTo) form.append("h:Reply-To", params.replyTo);

  const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
    },
    body: form,
  });
  const json = (await res.json()) as { id?: string };
  if (!res.ok) {
    throw new Error(`Mailgun error ${res.status}: ${JSON.stringify(json)}`);
  }
  return { messageId: json.id ?? "unknown" };
}

export interface SmtpTransportOptions {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password: string;
}

/**
 * Send via custom SMTP (Nodemailer). Works with any SMTP server:
 * self-hosted, Purelymail, Amazon SES SMTP, etc.
 */
export async function sendViaSmtp(
  options: SmtpTransportOptions,
  params: SendEmailParams
): Promise<{ messageId: string }> {
  const transporter = nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: options.secure,
    auth:
      options.user && options.password
        ? { user: options.user, pass: options.password }
        : undefined,
  });
  const info = await transporter.sendMail({
    from: params.from,
    to: params.to,
    subject: params.subject,
    text: params.bodyText,
    html: params.bodyHtml,
    replyTo: params.replyTo,
  });
  return { messageId: info.messageId ?? "unknown" };
}

/** Options for Gmail send (OAuth). redirectUri must match app registration. */
export interface SendViaGmailOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
}

/**
 * Send via Gmail API using OAuth refresh token.
 */
export async function sendViaGmail(
  options: SendViaGmailOptions,
  params: SendEmailParams
): Promise<{ messageId: string }> {
  const oauth2 = new google.auth.OAuth2(
    options.clientId,
    options.clientSecret,
    options.redirectUri
  );
  oauth2.setCredentials({ refresh_token: options.refreshToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2 });

  const lines: string[] = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    "MIME-Version: 1.0",
  ];
  if (params.replyTo) lines.push(`Reply-To: ${params.replyTo}`);
  if (params.bodyHtml) {
    lines.push("Content-Type: text/html; charset=UTF-8");
  } else {
    lines.push("Content-Type: text/plain; charset=UTF-8");
  }
  lines.push("");
  lines.push(params.bodyHtml ?? params.bodyText ?? "");

  const raw = Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
  const messageId = res.data.id ?? "unknown";
  return { messageId };
}

/** Options for Microsoft Graph send (OAuth). */
export interface SendViaMicrosoftOptions {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  refreshToken: string;
}

/**
 * Send via Microsoft Graph /me/sendMail using OAuth refresh token.
 */
export async function sendViaMicrosoft(
  options: SendViaMicrosoftOptions,
  params: SendEmailParams
): Promise<{ messageId: string }> {
  const body = new URLSearchParams({
    client_id: options.clientId,
    client_secret: options.clientSecret,
    refresh_token: options.refreshToken,
    grant_type: "refresh_token",
  });
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${options.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }
  );
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Microsoft token refresh failed: ${tokenRes.status} ${text}`);
  }
  const tokenData = (await tokenRes.json()) as { access_token: string };
  const accessToken = tokenData.access_token;

  const graphBody = {
    message: {
      subject: params.subject,
      body: {
        contentType: params.bodyHtml ? "HTML" : "Text",
        content: params.bodyHtml ?? params.bodyText ?? "",
      },
      toRecipients: [{ emailAddress: { address: params.to } }],
      from: undefined as { emailAddress: { address: string } } | undefined,
      replyTo: undefined as { emailAddress: { address: string } }[] | undefined,
    },
  };
  graphBody.message.from = { emailAddress: { address: params.from } };
  if (params.replyTo) {
    graphBody.message.replyTo = [{ emailAddress: { address: params.replyTo } }];
  }

  const sendRes = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(graphBody),
  });
  if (!sendRes.ok) {
    const text = await sendRes.text();
    throw new Error(`Microsoft Graph sendMail failed: ${sendRes.status} ${text}`);
  }
  return { messageId: `graph-${Date.now()}` };
}
