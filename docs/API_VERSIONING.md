# API and signaling versioning

This document describes how OpenTel handles API and signaling compatibility so companies can upgrade safely.

---

## Single API reference

The **OpenTel API** exposes an **OpenAPI (Swagger)** spec at **`/docs`** when the API server is running. Use it as the single reference for REST routes, request/response shapes, and supported operations. Routes include:

- Tenants, endpoints, tokens, calls, call history
- Queues and queue members
- Auth (register, login, OAuth start/callback for Gmail and Microsoft)
- Channels (email, SMS) and send endpoints
- Chat threads and messages

If you add or change routes, ensure they are registered with Fastify so they appear in `/docs`, and add descriptions or response schemas where helpful for consumers.

---

## Compatibility policy

- **Additive changes** – New optional fields, new endpoints, and new query/body parameters are considered backward-compatible. Clients that ignore unknown fields continue to work.
- **Breaking changes** – Removing or renaming fields, changing semantics of existing fields, or removing endpoints are breaking. We will:
  - Announce them in release notes or a dedicated compatibility notice.
  - Prefer deprecation first (e.g. keep old field for a release, document the new one, then remove the old one in a later release).
- **Signaling (WebSocket)** – Message types and payloads may evolve. Additive changes (new optional fields or message types) are backward-compatible. Breaking changes to existing message types will be announced and, where possible, deprecated before removal.
- **Versioning** – The API does not use a version prefix in the path (e.g. no `/v2/`). The existing `/v1/` prefix is retained. Future major breaking changes could introduce a new path prefix or a new API version header; that would be documented when introduced.

---

## Upgrading

- Run **migrations** after pulling new code: `pnpm db:migrate`. Migrations are idempotent.
- Check **release notes** or docs for new env vars, new routes, or deprecated behavior.
- **OpenAPI `/docs`** – Regenerate or refresh your client from the live `/docs` (or the published spec) when upgrading to pick up new or changed endpoints and schemas.
