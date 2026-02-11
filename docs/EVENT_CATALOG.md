# Event Catalog

OpenTel emits call and signaling events to **NATS** and, when configured, to tenant **webhooks**. WebSocket clients also receive real-time messages (incoming_call, call_created, answer, offer, ice) as part of the signaling protocol.

## NATS Subject

All call-related events are published to:

- **Subject**: `opentel.calls`

Payloads are JSON. Each event includes an `event` (or equivalent) field and a `ts` (ISO 8601) timestamp.

## Call Lifecycle Events

### call.created

Emitted when a dial is accepted and a call record is created.

| Field | Type | Description |
|-------|------|-------------|
| `event` | string | `"call.created"` |
| `callId` | UUID | Call id |
| `tenantId` | UUID | Tenant id |
| `fromEndpointId` | UUID | Caller endpoint |
| `toEndpointId` | UUID | Callee endpoint |
| `metadata` | object (optional) | Key-value map (e.g. contactId for CRM) |
| `ts` | string (datetime) | ISO 8601 |

---

### call.ringing

Emitted when the call is in RINGING state (callee has been notified).

| Field | Type | Description |
|-------|------|-------------|
| `event` | string | `"call.ringing"` |
| `callId` | UUID | Call id |
| `ts` | string (datetime) | ISO 8601 |

---

### call.answered

Emitted when the callee answers (state transitions to ANSWERED).

| Field | Type | Description |
|-------|------|-------------|
| `event` | string | `"call.answered"` |
| `callId` | UUID | Call id |
| `ts` | string (datetime) | ISO 8601 |

---

### call.ended

Emitted when the call ends (hangup or no-answer). Includes duration when the call was answered.

| Field | Type | Description |
|-------|------|-------------|
| `event` | string | `"call.ended"` |
| `callId` | UUID | Call id |
| `reason` | string | e.g. `"hangup"`, `"no-answer"` |
| `duration` | number (optional) | Seconds from answer to end |
| `metadata` | object (optional) | Same as call.created |
| `ts` | string (datetime) | ISO 8601 |

## Signaling Events (NATS)

These are published for observability and debugging. They mirror the SDP/ICE exchange between endpoints.

### signaling.offer

| Field | Type | Description |
|-------|------|-------------|
| `event` | string | `"signaling.offer"` |
| `callId` | UUID | Call id |
| `sdp` | string | SDP string |
| `ts` | string (datetime) | ISO 8601 |

### signaling.answer

| Field | Type | Description |
|-------|------|-------------|
| `event` | string | `"signaling.answer"` |
| `callId` | UUID | Call id |
| `sdp` | string | SDP string |
| `ts` | string (datetime) | ISO 8601 |

### signaling.ice

| Field | Type | Description |
|-------|------|-------------|
| `event` | string | `"signaling.ice"` |
| `callId` | UUID | Call id |
| `candidate` | object | RTCIceCandidateInit (candidate, sdpMid, sdpMLineIndex) |
| `ts` | string (datetime) | ISO 8601 |

## Webhook Delivery

When a tenant has a `webhookUrl` set (via API `PATCH /v1/tenants/:tenantId`), the signaling server POSTs call events to that URL. Payload shape:

```json
{
  "event": "call.created",
  "payload": { "callId": "...", "tenantId": "...", "fromEndpointId": "...", "toEndpointId": "...", "metadata": {}, "ts": "..." },
  "ts": "2025-02-11T12:00:00.000Z"
}
```

Events delivered to webhooks:

- `call.created`
- `call.ringing`
- `call.answered`
- `call.ended` (includes `duration` and `reason` in payload when applicable)

Delivery is fire-and-forget (non-blocking). Failed deliveries are logged; no retries in the MVP.

## WebSocket Message Types (Client ↔ Signaling)

These are not NATS events but the real-time protocol between the browser and the signaling server.

| Type | Direction | Description |
|------|-----------|-------------|
| `auth` | Client → Server | `{ type: "auth", token }` |
| `auth_ok` | Server → Client | Auth succeeded |
| `register` | Client → Server | `{ type: "register", endpointId }` |
| `registered` | Server → Client | Endpoint registered |
| `dial` | Client → Server | `{ type: "dial", toEndpointId, metadata? }` |
| `incoming_call` | Server → Client | `{ type: "incoming_call", callId, fromEndpointId, metadata?, ts }` |
| `call_created` | Server → Client | `{ type: "call_created", callId, state }` |
| `answer` | Client → Server | `{ type: "answer", callId, sdp }` |
| `offer` | Client → Server / Server → Client | `{ type: "offer", callId, sdp }` |
| `ice` | Client → Server / Server → Client | `{ type: "ice", callId, candidate }` |
| `hangup` | Client → Server | `{ type: "hangup", callId }` |
| `error` | Server → Client | `{ type: "error", message }` |

Schema definitions live in `@opentel/schemas` (Zod); see package exports for exact shapes.
