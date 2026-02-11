import { z } from "zod";

// --- Domain ---
export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  webhookUrl: z.string().url().optional().nullable(),
  createdAt: z.string().datetime(),
});
export type Tenant = z.infer<typeof TenantSchema>;

export const EndpointSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  label: z.string(),
  type: z.literal("webrtc"),
  createdAt: z.string().datetime(),
});
export type Endpoint = z.infer<typeof EndpointSchema>;

export const CallStateSchema = z.enum(["CREATED", "RINGING", "ANSWERED", "ENDED"]);
export type CallState = z.infer<typeof CallStateSchema>;

export const CallSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  fromEndpointId: z.string().uuid(),
  toEndpointId: z.string().uuid(),
  state: CallStateSchema,
  metadata: z.record(z.string()).optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  answeredAt: z.string().datetime().optional().nullable(),
});
export type Call = z.infer<typeof CallSchema>;

// --- API DTOs ---
export const CreateTenantInputSchema = z.object({ name: z.string().min(1), webhookUrl: z.string().url().optional() });
export type CreateTenantInput = z.infer<typeof CreateTenantInputSchema>;

export const CreateEndpointInputSchema = z.object({ label: z.string().min(1) });
export type CreateEndpointInput = z.infer<typeof CreateEndpointInputSchema>;

export const MintTokenInputSchema = z.object({
  tenantId: z.string().uuid(),
  endpointId: z.string().uuid().optional(),
  scopes: z.array(z.string()).optional(),
});
export type MintTokenInput = z.infer<typeof MintTokenInputSchema>;

export const UpdateTenantInputSchema = z.object({ webhookUrl: z.string().url().optional().nullable() });
export type UpdateTenantInput = z.infer<typeof UpdateTenantInputSchema>;

// --- WS Messages ---
export const AuthMessageSchema = z.object({ type: z.literal("auth"), token: z.string() });
export const RegisterMessageSchema = z.object({ type: z.literal("register"), endpointId: z.string().uuid() });
const E164_REGEX = /^\+[1-9]\d{1,14}$/;
export function isE164(value: string): boolean {
  return E164_REGEX.test(value.trim());
}

export const DialMessageSchema = z
  .object({
    type: z.literal("dial"),
    toEndpointId: z.string().uuid().optional(),
    toPhoneNumber: z.string().optional(),
    metadata: z.record(z.string()).optional(),
  })
  .refine((data) => (data.toEndpointId != null) !== (data.toPhoneNumber != null && data.toPhoneNumber.trim() !== ""), {
    message: "Provide exactly one of toEndpointId (UUID) or toPhoneNumber (E.164)",
    path: [],
  });
export const AnswerMessageSchema = z.object({
  type: z.literal("answer"),
  callId: z.string().uuid(),
  sdp: z.string(),
});
export const HangupMessageSchema = z.object({ type: z.literal("hangup"), callId: z.string().uuid() });
export const OfferMessageSchema = z.object({
  type: z.literal("offer"),
  callId: z.string().uuid(),
  sdp: z.string(),
});
export const IceMessageSchema = z.object({
  type: z.literal("ice"),
  callId: z.string().uuid(),
  candidate: z.unknown(),
});
export const JoinThreadMessageSchema = z.object({
  type: z.literal("join_thread"),
  threadId: z.string().uuid(),
});
export const SendMessageSchema = z.object({
  type: z.literal("send_message"),
  threadId: z.string().uuid(),
  body: z.string().min(1).max(10000),
  metadata: z.record(z.string()).optional(),
});

// --- Events ---
export const CallCreatedEventSchema = z.object({
  event: z.literal("call.created"),
  callId: z.string().uuid(),
  tenantId: z.string().uuid(),
  fromEndpointId: z.string().uuid(),
  toEndpointId: z.string().uuid(),
  metadata: z.record(z.string()).optional(),
  ts: z.string().datetime(),
});
export type CallCreatedEvent = z.infer<typeof CallCreatedEventSchema>;

export const CallRingingEventSchema = z.object({
  event: z.literal("call.ringing"),
  callId: z.string().uuid(),
  ts: z.string().datetime(),
});
export type CallRingingEvent = z.infer<typeof CallRingingEventSchema>;

export const CallAnsweredEventSchema = z.object({
  event: z.literal("call.answered"),
  callId: z.string().uuid(),
  ts: z.string().datetime(),
});
export type CallAnsweredEvent = z.infer<typeof CallAnsweredEventSchema>;

export const CallEndedEventSchema = z.object({
  event: z.literal("call.ended"),
  callId: z.string().uuid(),
  reason: z.string(),
  duration: z.number().optional(),
  metadata: z.record(z.string()).optional(),
  ts: z.string().datetime(),
});
export type CallEndedEvent = z.infer<typeof CallEndedEventSchema>;

export const SignalingOfferEventSchema = z.object({
  event: z.literal("signaling.offer"),
  callId: z.string().uuid(),
  sdp: z.string(),
  ts: z.string().datetime(),
});
export const SignalingAnswerEventSchema = z.object({
  event: z.literal("signaling.answer"),
  callId: z.string().uuid(),
  sdp: z.string(),
  ts: z.string().datetime(),
});
export const SignalingIceEventSchema = z.object({
  event: z.literal("signaling.ice"),
  callId: z.string().uuid(),
  candidate: z.unknown(),
  ts: z.string().datetime(),
});

export const WebhookPayloadSchema = z.object({
  event: z.string(),
  payload: z.record(z.unknown()),
  ts: z.string().datetime(),
});
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

// --- Phase 2 PSTN config (env-based) ---
export const Phase2ConfigSchema = z.object({
  OPENTEL_GATEWAY_URL: z.string().optional(),
  OPENTEL_SIP_TRUNK_HOST: z.string().optional(),
  OPENTEL_SIP_TRUNK_PORT: z.string().optional(),
  OPENTEL_SIP_TRUNK_USER: z.string().optional(),
  OPENTEL_SIP_TRUNK_PASSWORD: z.string().optional(),
});
export type Phase2Config = z.infer<typeof Phase2ConfigSchema>;

/** Env var names for Phase 2; use when building .env snippets. */
export const PHASE2_ENV_KEYS = [
  "OPENTEL_GATEWAY_URL",
  "OPENTEL_SIP_TRUNK_HOST",
  "OPENTEL_SIP_TRUNK_PORT",
  "OPENTEL_SIP_TRUNK_USER",
  "OPENTEL_SIP_TRUNK_PASSWORD",
] as const;
