import type { Phase2Config } from "@opentel/schemas";

export function getPhase2Config(): Phase2Config {
  return {
    OPENTEL_GATEWAY_URL: process.env.OPENTEL_GATEWAY_URL,
    OPENTEL_SIP_TRUNK_HOST: process.env.OPENTEL_SIP_TRUNK_HOST,
    OPENTEL_SIP_TRUNK_PORT: process.env.OPENTEL_SIP_TRUNK_PORT,
    OPENTEL_SIP_TRUNK_USER: process.env.OPENTEL_SIP_TRUNK_USER,
    OPENTEL_SIP_TRUNK_PASSWORD: process.env.OPENTEL_SIP_TRUNK_PASSWORD,
  };
}

export function isPhase2Enabled(config?: Phase2Config): boolean {
  const c = config ?? getPhase2Config();
  return Boolean(c.OPENTEL_GATEWAY_URL?.trim());
}

/** Parse OPENTEL_GATEWAY_URL into host and port (ESL default 8021). */
export function parseGatewayUrl(url: string): { host: string; port: number } {
  const trimmed = url.trim();
  let host = "127.0.0.1";
  let port = 8021;
  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `tcp://${trimmed}`);
    host = parsed.hostname || host;
    port = parsed.port ? parseInt(parsed.port, 10) : 8021;
    if (Number.isNaN(port) || port <= 0) port = 8021;
  } catch {
    const match = trimmed.match(/^([^:]+)(?::(\d+))?$/);
    if (match) {
      host = match[1];
      if (match[2]) {
        const p = parseInt(match[2], 10);
        if (!Number.isNaN(p) && p > 0) port = p;
      }
    }
  }
  return { host, port };
}
