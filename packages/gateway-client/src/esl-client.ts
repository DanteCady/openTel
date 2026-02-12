import { FreeSwitchClient } from "esl";
import { getPhase2Config, isPhase2Enabled, parseGatewayUrl } from "./config.js";

const DEFAULT_GATEWAY_NAME = "trunk";

export interface OriginateOptions {
  /** Sofia gateway profile name (default: trunk). */
  gatewayName?: string;
  /** Optional timeout in ms (default 60000). */
  timeout?: number;
}

export interface OriginateResult {
  /** Channel UUID of the originated leg. */
  channelUuid: string;
}

function connectClient(client: FreeSwitchClient): Promise<unknown> {
  return new Promise((resolve, reject) => {
    client.once("connect", resolve);
    client.once("error", reject);
    client.connect();
  });
}

/**
 * Connect to FreeSWITCH ESL, run originate, return channel UUID.
 * Uses api() so we get the reply with the channel UUID.
 */
export async function originateToPstn(
  phoneNumber: string,
  options?: OriginateOptions
): Promise<OriginateResult> {
  const config = getPhase2Config();
  if (!isPhase2Enabled(config)) {
    throw new Error("Phase 2 gateway not configured: set OPENTEL_GATEWAY_URL");
  }
  const { host, port } = parseGatewayUrl(config.OPENTEL_GATEWAY_URL!);
  const password = "ClueCon"; // ESL auth; not SIP trunk password
  const gatewayName = options?.gatewayName ?? DEFAULT_GATEWAY_NAME;
  const timeoutMs = options?.timeout ?? 60_000;
  const timeoutSec = Math.floor(timeoutMs / 1000);

  const client = new FreeSwitchClient({
    host,
    port,
    password,
  });

  const call = await connectClient(client);
  const response = (call as { api: (cmd: string, t?: number) => Promise<{ body: Record<string, string>; uuid?: string }> }).api(
    `originate sofia/gateway/${gatewayName}/${phoneNumber.trim()} &echo`,
    timeoutSec
  );
  let result: OriginateResult;
  try {
    const res = await response;
    const uuid = res.uuid ?? res.body?.["Channel-Unique-ID"] ?? res.body?.variable_uuid;
    if (!uuid) {
      throw new Error("Originate did not return channel UUID");
    }
    result = { channelUuid: String(uuid) };
  } finally {
    try {
      (call as { exit: () => void }).exit?.();
    } catch {
      // ignore
    }
    await client.end();
  }
  return result;
}

/**
 * Hang up a channel by UUID.
 */
export async function hangupChannel(channelUuid: string): Promise<void> {
  const config = getPhase2Config();
  if (!isPhase2Enabled(config)) {
    throw new Error("Phase 2 gateway not configured: set OPENTEL_GATEWAY_URL");
  }
  const { host, port } = parseGatewayUrl(config.OPENTEL_GATEWAY_URL!);
  const client = new FreeSwitchClient({ host, port, password: "ClueCon" });
  const call = await connectClient(client);
  try {
    await (call as { api: (cmd: string) => Promise<unknown> }).api(`uuid_kill ${channelUuid}`);
  } finally {
    try {
      (call as { exit?: () => void }).exit?.();
    } catch {
      // ignore
    }
    await client.end();
  }
}
