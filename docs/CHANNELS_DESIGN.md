# OpenTel Multi-Channel Design

This document describes the design for adding chat, email, and SMS channels to OpenTel, with pluggable storage and secrets so self-hosters can fully customize how data and credentials are stored. The same architecture supports both self-hosted deployments and a future OpenTel Cloud offering.

---

## Principles

1. **Pluggable storage** — Self-hosters can swap Postgres for MongoDB, Supabase, or even their own API via a `StorageAdapter` interface.
2. **Pluggable secrets** — Credentials (API keys, OAuth tokens) go through a `SecretsProvider`; self-hosters choose encrypted DB, Vault, AWS Secrets Manager, etc.
3. **Same codebase for cloud and self-host** — OpenTel Cloud uses managed defaults; self-hosters use their own adapters.
4. **Channel abstraction** — Voice, chat, email, sms each implement a common adapter; shared infrastructure (auth, tenants, events, webhooks) handles routing.

---

## 1. Pluggable Storage: StorageAdapter

All persistence goes through a `StorageAdapter` interface. Implementations can be swapped without changing business logic.

### Interface

```ts
// packages/storage/src/adapter.ts
export interface StorageAdapter {
  tenants: TenantRepository;
  endpoints: EndpointRepository;
  calls: CallRepository;
  // Future channels
  chatThreads: ChatThreadRepository;
  chatMessages: ChatMessageRepository;
  channelConfig: ChannelConfigRepository;
}
```

### Repository Interfaces

Each repository exposes CRUD operations. For example:

```ts
export interface TenantRepository {
  create(name: string, webhookUrl?: string | null): Promise<Tenant>;
  get(id: string): Promise<Tenant | null>;
  updateWebhook(id: string, webhookUrl: string | null): Promise<void>;
}

export interface ChatThreadRepository {
  create(tenantId: string, opts?: { contactId?: string; metadata?: Record<string, string> }): Promise<ChatThread>;
  get(id: string): Promise<ChatThread | null>;
  listByTenant(tenantId: string, opts?: { limit?: number; offset?: number; contactId?: string }): Promise<ChatThread[]>;
}
```

### Implementations

| Implementation | Use case |
|----------------|----------|
| `PostgresAdapter` | Default (current Kysely implementation). Self-host and cloud. |
| `MySQLAdapter` | Default for MySQL deployments. |
| Custom | Self-hosters implement the interface; wire MongoDB, Supabase, HTTP API, etc. |

### Configuration

```env
# Optional - defaults to postgres when DATABASE_URL is set
STORAGE_ADAPTER=postgres
# or: mysql, custom

# For custom: path to module that exports createStorageAdapter
# CUSTOM_STORAGE_MODULE=./my-storage-adapter.js
```

---

## 2. Pluggable Secrets: SecretsProvider

All credentials (API keys, OAuth refresh tokens, webhook secrets) go through a `SecretsProvider` so self-hosters control where secrets live.

### Interface

```ts
// packages/secrets/src/provider.ts
export interface SecretsProvider {
  get(tenantId: string, key: string): Promise<string | null>;
  set(tenantId: string, key: string, value: string): Promise<void>;
  delete(tenantId: string, key: string): Promise<void>;
}
```

**Key naming:** `{channel}_{provider}_{key}` — e.g. `email_sendgrid_api_key`, `sms_twilio_auth_token`, `email_gmail_refresh_token`.

### Implementations

| Implementation | Use case |
|----------------|----------|
| `EncryptedDbSecretsProvider` | Default. Secrets stored in DB, encrypted with key from env. |
| `VaultSecretsProvider` | HashiCorp Vault; path per tenant, e.g. `secret/opentel/tenant/{tenantId}`. |
| `AwsSecretsManagerProvider` | AWS Secrets Manager; secret per tenant. |
| `EnvSecretsProvider` | Dev only; reads from env vars. Single-tenant. |

### Configuration

```env
# Optional - defaults to encrypted_db
SECRETS_PROVIDER=encrypted_db
# or: vault, aws_secrets_manager, env

# Required for encrypted_db
SECRETS_ENCRYPTION_KEY=<32-byte-hex-key>

# For vault
VAULT_URL=https://vault.example.com
VAULT_TOKEN=...
# or: VAULT_ROLE_ID, VAULT_SECRET_ID for AppRole
```

---

## 3. Chat Channel

### Embedding Model

- **Hosted widget + headless SDK** — Companies can lazy-load a pre-built widget (like Intercom/Genesys) or build their own UI with the headless SDK.
- **Widget script:** `<script src="https://chat.opentel.io/widget.js" data-tenant-id="xxx" data-deployment-key="yyy"></script>`
- **Lazy load:** Widget loads only when user clicks the bubble or after a configurable delay.

### Identity

- **Both anonymous and logged-in** — Support both use cases.
- **Anonymous:** First message creates a guest session; ephemeral ID or cookie. Optional upgrade to logged-in when user authenticates.
- **Logged-in:** Company passes `userId`/`contactId` via config; we trust it. Token minted by company backend.

### Chat Model

- **Agent ↔ customer (support)** — Primary use case. Customer on website; agent in CRM/contact center.
- **Optional:** Agent ↔ agent (internal) — both sides are endpoints.

### Routing

- **Simple queue first** — All chats go to one inbox or queue.
- **Extensible:** Skills-based or round-robin routing can be added later as a pluggable module.

### Thread Creation

- **Both directions** — Customer-initiated (first message creates thread) and agent-initiated (agent starts from CRM).

### Deployment Key

- Tenant-scoped config identifier (e.g. `d_xxxx`).
- Validated server-side; not a secret.
- Domain allowlist per deployment key (configurable by self-hoster).

### Storage

- Chat threads and messages use `StorageAdapter`; self-hosters choose their backend.

---

## 4. Email Channel

### Provider Order

1. **Transactional first** — SendGrid, Mailgun, Postmark, Amazon SES. API key per tenant. Simple outbound + inbound webhook.
2. **OAuth mailboxes later** — Gmail, Microsoft 365. "Connect your inbox" flow; OAuth tokens stored via `SecretsProvider`.

### Provider Config

Store in `channel_config` (via `StorageAdapter`):

- `tenant_id`
- `channel`: `email` | `sms`
- `provider`: `sendgrid` | `mailgun` | `gmail` | `microsoft`
- `config`: Non-sensitive (provider type, domain, inbound webhook URL). Sensitive values go to `SecretsProvider` under keys like `email_sendgrid_api_key`.

### Secrets

- All API keys and OAuth tokens via `SecretsProvider`.
- Self-hosters choose Vault, encrypted DB, or AWS Secrets Manager.

### OAuth (Gmail, Microsoft 365)

- **Default:** OpenTel app registration (one Google/Microsoft app; easier for tenants).
- **Optional:** Tenant brings their own app (client_id + secret from their tenant).
- **Flow:** Redirect to provider → consent → callback → exchange code for refresh_token → store via `SecretsProvider`.

### Inbound

- Provider webhooks (SendGrid inbound parse, Mailgun inbound). POST to configured URL; validate with webhook secret from `SecretsProvider`.

---

## 5. SMS Channel

- **Providers:** Twilio, Vonage, etc. API key or auth token per tenant.
- **Secrets:** Via `SecretsProvider`.
- **Inbound:** Provider webhook URL. Same pattern as email inbound.

---

## 6. Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `STORAGE_ADAPTER` | `postgres` | `postgres`, `mysql`, `custom` |
| `SECRETS_PROVIDER` | `encrypted_db` | `encrypted_db`, `vault`, `aws_secrets_manager`, `env` |
| `SECRETS_ENCRYPTION_KEY` | — | Required for `encrypted_db` |
| `VAULT_URL` | — | For `vault` provider |
| `VAULT_TOKEN` | — | For `vault` provider |
| `CUSTOM_STORAGE_MODULE` | — | Path to custom module (for `custom` adapter) |

### Package Layout

```
packages/
  storage/
    src/
      adapter.ts           # Interface
      postgres-adapter.ts  # Default
      mysql-adapter.ts
      index.ts             # Factory
  secrets/
    src/
      provider.ts          # Interface
      encrypted-db.ts      # Default
      vault.ts
      aws-secrets.ts
```

---

## 7. Cloud vs Self-Host

| Aspect | Self-host | OpenTel Cloud |
|--------|-----------|---------------|
| Storage | Configurable adapter | Managed Postgres |
| Secrets | Configurable provider | Managed (Vault or managed secrets) |
| Chat widget | Same bundle or self-hosted | Hosted on OpenTel CDN |
| Email/SMS | Their providers and keys | Optional managed providers |

Same codebase; different config and defaults.

---

## 8. Migration Path

1. **Phase 1:** Introduce `StorageAdapter`; wrap current Postgres/MySQL behind it. No behavior change.
2. **Phase 2:** Add `SecretsProvider` for future channel config.
3. **Phase 3:** Add chat; all new tables use adapter.
4. **Phase 4:** Add email (transactional); secrets via provider.
5. **Phase 5:** Add SMS; same pattern.
6. **Phase 6:** Add OAuth email (Gmail, M365) if needed.

---

## 9. Related Documents

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Current system components
- [DIAGRAMS.md](./DIAGRAMS.md) — Visual diagrams
- [EMBEDDING_GUIDE.md](./EMBEDDING_GUIDE.md) — Voice embedding (will be extended for chat)
