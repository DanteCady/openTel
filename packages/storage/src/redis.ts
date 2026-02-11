import Redis from "ioredis";

let redis: Redis | null = null;

export function getRedis(url: string): Redis {
  if (!redis) {
    redis = new Redis(url);
  }
  return redis;
}

const PRESENCE_PREFIX = "opentel:presence:";

export async function setPresence(endpointId: string, online: boolean): Promise<void> {
  const r = redis;
  if (!r) return;
  const key = `${PRESENCE_PREFIX}${endpointId}`;
  if (online) {
    await r.set(key, "1", "EX", 60);
  } else {
    await r.del(key);
  }
}

export async function getPresence(endpointId: string): Promise<boolean> {
  const r = redis;
  if (!r) return false;
  const v = await r.get(`${PRESENCE_PREFIX}${endpointId}`);
  return v === "1";
}

const AGENT_STATE_PREFIX = "opentel:agent_state:";
const AGENT_STATE_TTL = 86400; // 24h

export async function setAgentState(endpointId: string, state: string): Promise<void> {
  const r = redis;
  if (!r) return;
  await r.set(`${AGENT_STATE_PREFIX}${endpointId}`, state, "EX", AGENT_STATE_TTL);
}

export async function getAgentState(endpointId: string): Promise<string | null> {
  const r = redis;
  if (!r) return null;
  return r.get(`${AGENT_STATE_PREFIX}${endpointId}`);
}
