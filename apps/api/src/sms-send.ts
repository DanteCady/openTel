/**
 * SMS sending via Twilio.
 * Credentials fetched from SecretsProvider.
 */

export interface SendSmsParams {
  to: string;
  from: string;
  body: string;
}

export async function sendViaTwilio(
  accountSid: string,
  authToken: string,
  params: SendSmsParams
): Promise<{ messageId: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const form = new URLSearchParams();
  form.append("To", params.to);
  form.append("From", params.from);
  form.append("Body", params.body);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
    },
    body: form.toString(),
  });
  const json = (await res.json()) as { sid?: string; message?: string };
  if (!res.ok) {
    throw new Error(`Twilio error ${res.status}: ${json.message ?? JSON.stringify(json)}`);
  }
  return { messageId: json.sid ?? "unknown" };
}
