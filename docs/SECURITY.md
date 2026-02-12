# OpenTel Security

This document covers admin tokens, securing the inbound-call endpoint, and production security practices.

---

## Admin / bootstrap token

OpenTel uses **JWT** for API authentication. Tokens are minted with the API key `POST /v1/tokens` (admin-only) or via CCaaS login. For **provisioning** (creating tenants, endpoints, setting webhook URLs), you use a token with the **admin** scope.

### How it works

- **Admin token:** Mint a token with `scopes: ["admin"]` using the same `JWT_SECRET` as the API. Send it as `Authorization: Bearer <token>` on requests. Admin can create tenants, create endpoints, update webhook URLs, and mint tenant- or endpoint-scoped tokens.
- **Tenant/endpoint tokens:** For day-to-day use (e.g. embedding in your app), mint tokens with `tenantId` and optionally `endpointId` and no admin scope. These can only act within that tenant/endpoint.

### Rotation and least privilege

- **Rotation:** Tokens are signed with `JWT_SECRET`. To rotate:
  1. Generate a new strong `JWT_SECRET` (e.g. 32+ random bytes).
  2. Deploy the API with the new secret.
  3. Mint a new admin token with the new secret; use it for provisioning.
  4. Old tokens (signed with the previous secret) become invalid immediately.
- **Least privilege:** Use the admin token only for provisioning and token minting. Use tenant- or endpoint-scoped tokens for normal app traffic. Do not share the admin token with frontends or untrusted environments. Optionally, use a separate “bootstrap” secret only in your deploy pipeline to mint a short-lived admin token, then use that token only from a secure backend.

### Where admin is required

The API requires `scopes: ["admin"]` for routes that create or manage tenants and for minting tokens. See the API source (e.g. `isAdmin` and route guards in [apps/api/src/server.ts](../apps/api/src/server.ts)).

---

## Securing the inbound-call endpoint

The Signaling server exposes `POST /inbound-call` so your PSTN gateway (e.g. FreeSWITCH) can notify OpenTel of incoming calls. By default this route is **unauthenticated**. For production, lock it down using one or both of the following.

### Shared secret

- Set **`OPENTEL_INBOUND_SECRET`** in the environment of the Signaling server.
- The gateway (or adapter) must send one of:
  - **Header:** `X-Inbound-Secret: <secret>`
  - **Header:** `Authorization: Bearer <secret>`
- If the secret is set and the request does not match, the server responds with **401 Unauthorized**.

### IP allowlist

- Set **`OPENTEL_INBOUND_ALLOWED_IPS`** to a comma-separated list of allowed client IPs (e.g. your gateway or SBC IP).
- The server uses the request’s remote IP, or the first value in `X-Forwarded-For` if present (e.g. behind a reverse proxy).
- If the client IP is not in the list, the server responds with **403 Forbidden**.

You can use the secret alone, the allowlist alone, or both. See [PHASE2_PSTN.md](PHASE2_PSTN.md) and [.env.example](../.env.example) for variable names.

---

## Production checklist

- Use a strong **JWT_SECRET** (long random value) and store it in a secrets manager; rotate periodically.
- Secure **`/inbound-call`** with `OPENTEL_INBOUND_SECRET` and/or `OPENTEL_INBOUND_ALLOWED_IPS`.
- Use **HTTPS** for the API and Signaling in production; do not expose them on the public internet without TLS.
- Restrict **webhook URLs** and tenant data to trusted backends; use tenant-scoped tokens in your app.
- **Rate limiting:** Optional API rate limiting is available. Set `RATE_LIMIT_ENABLED=1` (and optionally `RATE_LIMIT_MAX`, `RATE_LIMIT_TIME_WINDOW_MS`). Limits are applied per tenant (when the request has a valid JWT with `tenantId`) or per IP. See [DEPLOYMENT.md](DEPLOYMENT.md).
- **Audit:** Optional audit logging for tenant/endpoint/call changes and token minting is a future option for compliance-minded customers; not implemented in the current release.
