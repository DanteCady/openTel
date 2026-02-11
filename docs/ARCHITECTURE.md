# OpenTel Architecture

This document describes the system components, data flow, and multi-tenancy model for OpenTel. For visual diagrams (media architecture, embedding flow, call state machine), see [DIAGRAMS.md](./DIAGRAMS.md).

## System Components

| Component | Purpose |
|-----------|---------|
| **API** | REST API for tenants, endpoints, tokens, calls, and call history. Used by app backends (CRM, contact center) to provision resources and mint tokens. |
| **Signaling** | WebSocket server that handles auth, endpoint registration, and call signaling (dial, answer, offer/answer SDP, ICE). Routes messages between endpoints and persists call state to the database. |
| **Storage** | Postgres (tenants, endpoints, calls) and Redis (presence). Accessed by both API and Signaling. |
| **Events** | NATS pub/sub for call and signaling events. Enables future subscribers (analytics, recording triggers) and keeps event catalog consistent. |
| **Config wizard** | Step-by-step UI for initial setup (database, Redis, NATS, JWT, TURN/STUN; SIP/SBC placeholder for Phase 2). |
| **Client SDK** | Browser SDK for embedding: connect, register, dial, answer, hangup, ICE. |
| **Server SDK** | Node.js SDK for app backends: create tenant/endpoints, mint tokens, list calls. |

## Data Flow

- **API → Storage**: All tenant, endpoint, and call-history operations read/write Postgres (and optionally Redis) via the storage package.
- **Signaling → Storage**: Call creation and state transitions (RINGING, ANSWERED, ENDED) are persisted. Presence (online/offline) is written to Redis on WS connect/disconnect.
- **Signaling → NATS**: Every call and signaling event is published to NATS (`opentel.calls`) for observability and future consumers.
- **Signaling → Webhooks**: When a tenant has a `webhookUrl`, the signaling server POSTs call events (call.created, call.ringing, call.answered, call.ended) to that URL. Used by CRM backends to log calls to contact records.
- **Signaling ↔ Clients**: Browsers connect over WebSocket, authenticate with JWT, register an endpoint ID, then exchange dial / incoming_call / answer / offer / ice messages via the same socket.

## Call State Machine

Call state is stored in Postgres and enforced in the signaling server using the core package state machine. Valid states and transitions:

- **CREATED** → (RING) → **RINGING**
- **RINGING** → (ANSWER) → **ANSWERED** or (HANGUP) → **ENDED**
- **ANSWERED** → (HANGUP) → **ENDED**
- **ENDED** is terminal (no further transitions)

See [DIAGRAMS.md](./DIAGRAMS.md) for the state machine diagram.

## Multi-Tenancy Model

- **Tenant**: The top-level organization (company, department, or sub-tenant). All endpoints and calls belong to a tenant. Tenants can optionally set a `webhookUrl` to receive call events.
- **Endpoint**: A phone-capable identity within a tenant (e.g. an agent or rep). Endpoints are referenced by UUID. JWT tokens are minted per tenant and optionally scoped to an endpoint.
- **Isolation**: The API and Signaling enforce tenant isolation. Tokens carry `tenantId`; all operations (list endpoints, list calls, get call, dial target) are scoped to that tenant. The signaling server verifies that the registered endpoint belongs to the token’s tenant before allowing dial/answer/hangup.

## Deployment Notes

- API and Signaling can run on the same host or separately. They share the same Postgres, Redis, and NATS URLs.
- Media (RTP) flows peer-to-peer or via a self-hosted TURN server (e.g. coturn); see [MEDIA_ARCHITECTURE.md](./MEDIA_ARCHITECTURE.md).
- For a single-deployment option, the config wizard can be built and served from the API at `/config` (optional; see plan).
