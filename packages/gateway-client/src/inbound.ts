/**
 * Inbound PSTN: gateway (or adapter) notifies OpenTel when an inbound call arrives.
 * The app (signaling or API) exposes an HTTP callback and calls notifyInboundCall with the payload.
 * Register a handler to decide which endpoint(s) to ring and create the call.
 */

export interface InboundCallInfo {
  /** Caller ID / from number. */
  callerId: string;
  /** Dialed number (DID). */
  dialedNumber: string;
  /** Optional routing hint (e.g. queue id). */
  routingHint?: string;
  /** Gateway channel UUID for the inbound leg (for bridge on answer). */
  channelUuid?: string;
}

export type InboundCallHandler = (
  info: InboundCallInfo
) => Promise<{ endpointIds: string[] }> | { endpointIds: string[] };

let inboundHandler: InboundCallHandler | null = null;

export function registerInboundHandler(handler: InboundCallHandler): void {
  inboundHandler = handler;
}

export function clearInboundHandler(): void {
  inboundHandler = null;
}

export async function notifyInboundCall(info: InboundCallInfo): Promise<{ endpointIds: string[] }> {
  if (!inboundHandler) {
    throw new Error("No inbound call handler registered");
  }
  const result = await inboundHandler(info);
  return Array.isArray(result.endpointIds) ? result : { endpointIds: [] };
}
