# OpenTel Diagrams

This document contains the main architecture and flow diagrams. See [ARCHITECTURE.md](./ARCHITECTURE.md) for narrative and [PHASE2_PSTN.md](./PHASE2_PSTN.md) for PSTN/FreeSWITCH setup.

---

## 0. System Overview

OpenTel core: API (REST), Signaling (WebSocket), Storage (Postgres + Redis), Events (NATS + webhooks). For real phone numbers you add FreeSWITCH and your SBC/trunk; OpenTel controls the gateway via ESL.

```mermaid
flowchart TB
    subgraph apps [Your App]
        Backend[Backend]
        Frontend[Frontend / Agents]
    end

    subgraph opentel [OpenTel]
        API[API\nREST]
        Signaling[Signaling\nWebSocket]
        Storage[(Postgres\n+ Redis)]
        Events[NATS + Webhooks]
        API <--> Storage
        Signaling <--> Storage
        Signaling --> Events
    end

    subgraph pstn [PSTN - Optional]
        FS[FreeSWITCH\nESL]
        SBC[SBC + Trunk]
        FS <--> SBC
    end

    Backend <--> API
    Frontend <--> Signaling
    Signaling <-->|ESL| FS
```

---

## 1. Media Architecture: How Calls Work

**WebRTC-only:** app-to-app calls use OpenTel Signaling for SDP/ICE; media goes P2P or via TURN (e.g. coturn). **PSTN:** real phone calls use a media gateway (FreeSWITCH) and your SBC/trunk. OpenTel controls the gateway via ESL; it does not replace your SBC or carrier.

```mermaid
flowchart TB
    subgraph phase1 [WebRTC App-to-App]
        BrowserA[Browser/App A]
        BrowserB[Browser/App B]
        OpenTelSig[OpenTel Signaling]
        TURN[Self-hosted TURN - coturn]
        BrowserA <-->|"SDP/ICE via WS"| OpenTelSig
        BrowserB <-->|"SDP/ICE via WS"| OpenTelSig
        BrowserA <-->|"RTP media"| TURN
        BrowserB <-->|"RTP media"| TURN
        BrowserA <-.->|"P2P when possible"| BrowserB
    end

    subgraph phase2 [PSTN - You run FreeSWITCH + SBC/trunk]
        App[Browser/App]
        OpenTelCtrl[OpenTel Signaling]
        Gateway[FreeSWITCH\nESL]
        SBC[Your SBC]
        SIPTrunk[Your SIP Trunk]
        PSTN[Phone Network]
        App <-->|WebRTC| Gateway
        OpenTelCtrl <-->|"ESL (originate, hangup)"| Gateway
        Gateway <-->|SIP| SBC
        SBC <-->|SIP| SIPTrunk
        SIPTrunk <--> PSTN
    end
```

---

## 2. Embedding Model: CRM / App Integration Flow

Typical flow when an app (e.g. CRM) embeds OpenTel: backend provisions tenant and endpoints, mints tokens; frontend connects to signaling and places calls; webhooks deliver call lifecycle to the backend.

```mermaid
sequenceDiagram
    participant CRM_Frontend
    participant CRM_Backend
    participant OpenTel_API
    participant OpenTel_Signaling
    participant OpenTel_Webhook

    CRM_Backend->>OpenTel_API: POST /tenants, /endpoints
    CRM_Backend->>OpenTel_API: PATCH /tenants (webhookUrl)
    CRM_Backend->>OpenTel_API: POST /tokens
    CRM_Backend->>CRM_Frontend: Return token
    CRM_Frontend->>OpenTel_Signaling: WS connect + auth + register
    CRM_Frontend->>OpenTel_Signaling: dial(endpointId, metadata)
    OpenTel_Signaling->>OpenTel_API: Create call (metadata)
    OpenTel_Signaling->>CRM_Backend: Webhook call.created
    OpenTel_Signaling->>CRM_Backend: Webhook call.ended (duration, metadata)
    CRM_Backend->>CRM_Backend: Log call to contact record
```

---

## 3. Call State Machine

Call state is stored in Postgres and enforced by the signaling server. Transitions are driven by RING (dial), ANSWER (callee answers), and HANGUP (either party hangs up).

```mermaid
stateDiagram-v2
    [*] --> CREATED
    CREATED --> RINGING : RING (dial)
    RINGING --> ANSWERED : ANSWER
    RINGING --> ENDED : HANGUP
    ANSWERED --> ENDED : HANGUP
    ENDED --> [*]
```

| State    | Allowed transitions |
|----------|----------------------|
| CREATED  | → RINGING (RING)     |
| RINGING  | → ANSWERED (ANSWER), → ENDED (HANGUP) |
| ANSWERED | → ENDED (HANGUP)     |
| ENDED    | (terminal)           |

Implemented in `packages/core` (e.g. `transitionCallState`).

---

## 4. Full Stack: Your App, OpenTel, FreeSWITCH, SBC

How your product (CRM, contact center, support tool), **OpenTel**, **FreeSWITCH**, and your **SBC/trunk** fit together. You run OpenTel and your app; you also run FreeSWITCH and bring your own SBC and SIP trunk for PSTN.

```mermaid
flowchart LR
    subgraph your [Your Product]
        Backend[App Backend]
        Frontend[Agents in browser]
        Backend <-->|token, config| Frontend
    end

    subgraph opentel [OpenTel]
        API[REST API]
        Signaling[Signaling WS]
        Storage[(Postgres + Redis)]
        API <--> Storage
        Signaling <--> Storage
    end

    subgraph gateway [Media Gateway - You Run]
        FreeSWITCH[FreeSWITCH\nESL]
    end

    subgraph carrier [You Provide]
        SBC[SBC]
        Trunk[SIP Trunk]
        PSTN[PSTN]
        SBC <-->|SIP| Trunk
        Trunk <--> PSTN
    end

    Backend -->|REST: tenants, endpoints, tokens| API
    Backend <--|Webhooks| Signaling
    Frontend <-->|WS: dial, answer, SDP/ICE| Signaling
    Frontend <-->|WebRTC| FreeSWITCH
    Signaling <-->|ESL: originate, hangup, inbound-call| FreeSWITCH
    FreeSWITCH <-->|SIP| SBC
```

**Responsibilities**

| Party | Provides |
|-------|----------|
| **Your product** | App backend (provisioning, webhook handler) and frontend (agent UI, client SDK for connect/dial/answer). |
| **OpenTel** | REST API, WebSocket signaling, call state, events, webhooks. Controls FreeSWITCH via ESL; does not run media. |
| **FreeSWITCH** | Media gateway: bridges WebRTC (browser) and SIP. You run it; OpenTel’s gateway-client talks to it over ESL. |
| **SBC + trunk** | Your SBC and SIP trunk (from your carrier). FreeSWITCH registers or sends SIP to your SBC; OpenTel does not talk to the SBC directly. |

**Flows**

- **WebRTC-only:** Frontend ↔ OpenTel Signaling (SDP/ICE); media P2P or via TURN (coturn). No FreeSWITCH or SBC.
- **Outbound PSTN:** User dials a number → Signaling calls gateway-client `originateToPstn()` → FreeSWITCH originates to SBC/trunk → PSTN.
- **Inbound PSTN:** Call hits trunk → SBC → FreeSWITCH; FreeSWITCH (or script) POSTs to OpenTel `POST /inbound-call` → OpenTel creates call and rings endpoint; on answer, FreeSWITCH bridges SIP leg to WebRTC. See [PHASE2_PSTN.md](PHASE2_PSTN.md).
