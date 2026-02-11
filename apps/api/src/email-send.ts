/**
 * Email sending via transactional providers and custom SMTP.
 * API keys and passwords are fetched from SecretsProvider.
 */

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
