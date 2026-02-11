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

export async function deliverWebhook(
  webhookUrl: string,
  event: string,
  payload: object
): Promise<void> {
  const body = { event, payload, ts: new Date().toISOString() };
  fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {
    // fire-and-forget; log in caller if needed
  });
}
