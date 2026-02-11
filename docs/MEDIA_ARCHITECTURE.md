# Media Architecture

OpenTel uses **no commercial CPaaS** (no Twilio, Vonage, etc.). Media is handled by open-source and self-hosted components; for PSTN you bring your own SIP trunk.

---

## Phase 1: WebRTC app-to-app

- **Signaling**: OpenTel’s WebSocket server exchanges SDP and ICE candidates between endpoints.
- **Media**: WebRTC peer-to-peer when possible; otherwise via **TURN/STUN** (e.g. **coturn** in docker-compose).
- **Scope**: Browser-to-browser or app-to-app only. No phone numbers yet.

```
[Browser A] <--WS signaling--> [OpenTel] <--WS signaling--> [Browser B]
[Browser A] <-------- WebRTC media (P2P or via TURN) ------> [Browser B]
```

---

## Phase 2: PSTN (SIP)

- **Media gateway** (FreeSWITCH or Asterisk) bridges WebRTC and SIP.
- **OpenTel** talks to the gateway (e.g. ESL/AMI) to originate and receive calls.
- **SBC** + **SIP trunk** (your carrier) connect the gateway to the **PSTN**.

See [PHASE2_PSTN.md](PHASE2_PSTN.md) for architecture and roadmap.

---

## TURN/STUN (Phase 1)

- **coturn** is included in `infra/docker-compose.yml` (port 3478 UDP/TCP).
- Client SDK defaults to `stun:localhost:3478` (and optional `turn:...`) when using that setup.
- In production, point `iceServers` at your own TURN/STUN (e.g. `stun:turn.yourdomain.com`, `turn:turn.yourdomain.com` with credentials if needed).

---

## Summary

| Phase   | Signaling      | Media / PSTN                    |
|---------|----------------|----------------------------------|
| Phase 1 | OpenTel WebSocket | WebRTC + coturn (TURN/STUN)   |
| Phase 2 | OpenTel WebSocket | WebRTC + gateway → SIP → PSTN |

No third-party call dependencies; you own the media path and, in Phase 2, the SIP trunk.
