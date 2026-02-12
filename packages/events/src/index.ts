import { connect as natsConnect, type NatsConnection } from "nats";

const CALLS_SUBJECT = "opentel.calls";
const CHAT_SUBJECT = "opentel.chat";

let nc: NatsConnection | null = null;

export async function connect(url: string): Promise<NatsConnection> {
  nc = await natsConnect({ servers: url });
  return nc;
}

export function getConnection(): NatsConnection | null {
  return nc;
}

export async function publish(subject: string, payload: unknown): Promise<void> {
  if (!nc) throw new Error("NATS not connected");
  nc.publish(subject, new TextEncoder().encode(JSON.stringify(payload)));
}

export async function publishCallEvent(event: object): Promise<void> {
  await publish(CALLS_SUBJECT, event);
}

export async function publishChatEvent(event: object): Promise<void> {
  await publish(CHAT_SUBJECT, event);
}

export async function subscribe(
  subject: string,
  handler: (payload: unknown) => void | Promise<void>
): Promise<void> {
  if (!nc) throw new Error("NATS not connected");
  const sub = nc.subscribe(subject);
  (async () => {
    for await (const msg of sub) {
      try {
        const payload = JSON.parse(new TextDecoder().decode(msg.data));
        await handler(payload);
      } catch {
        // ignore parse errors
      }
    }
  })();
}

export async function close(): Promise<void> {
  if (nc) {
    await nc.close();
    nc = null;
  }
}

const WEBHOOK_MAX_ATTEMPTS = 3;
const WEBHOOK_INITIAL_BACKOFF_MS = 500;

function redactUrlForLog(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return "(invalid-url)";
  }
}

export async function deliverWebhook(
  webhookUrl: string,
  event: string,
  payload: object
): Promise<void> {
  const body = { event, payload, ts: new Date().toISOString() };
  const urlForLog = redactUrlForLog(webhookUrl);
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= WEBHOOK_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) return;
      lastError = new Error(`HTTP ${res.status} ${res.statusText}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    if (attempt < WEBHOOK_MAX_ATTEMPTS) {
      const backoffMs = WEBHOOK_INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  const errMsg = lastError?.message ?? "unknown";
  console.error(
    JSON.stringify({
      msg: "webhook delivery failed after retries",
      event,
      webhook: urlForLog,
      attempts: WEBHOOK_MAX_ATTEMPTS,
      lastError: errMsg,
    })
  );
}
