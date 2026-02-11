import type { Kysely } from "kysely";
import type { Database } from "./db.js";
import {
  createTenant,
  updateTenantWebhook,
  getTenant,
  createEndpoint,
  listEndpoints,
  createCall,
  updateCallState,
  getCall,
  listCalls,
  createChatThread,
  getChatThread,
  listChatThreads,
  createChatMessage,
  listChatMessages,
} from "./repositories.js";
import type {
  StorageAdapter,
  TenantRepository,
  EndpointRepository,
  CallRepository,
  ChatThreadRepository,
  ChatMessageRepository,
} from "./adapter.js";

function createTenantRepo(db: Kysely<Database>): TenantRepository {
  return {
    async create(name, webhookUrl) {
      return createTenant(db, name, webhookUrl);
    },
    async get(id) {
      const row = await getTenant(db, id);
      if (!row) return null;
      return {
        id: row.id,
        name: row.name,
        webhookUrl: row.webhook_url,
        createdAt: row.created_at,
      };
    },
    async updateWebhook(id, webhookUrl) {
      await updateTenantWebhook(db, id, webhookUrl);
    },
  };
}

function createEndpointRepo(db: Kysely<Database>): EndpointRepository {
  return {
    async create(tenantId, label, type = "webrtc") {
      return createEndpoint(db, tenantId, label, type);
    },
    async list(tenantId, limit = 50, offset = 0) {
      const rows = await listEndpoints(db, tenantId, limit, offset);
      return rows.map((r) => ({
        id: r.id,
        tenantId: r.tenant_id,
        label: r.label,
        type: r.type,
        createdAt: r.created_at,
      }));
    },
  };
}

function createCallRepo(db: Kysely<Database>): CallRepository {
  return {
    async create(tenantId, fromEndpointId, toEndpointId, metadata) {
      return createCall(db, tenantId, fromEndpointId, toEndpointId, metadata);
    },
    async get(id) {
      const row = await getCall(db, id);
      return row ?? null;
    },
    async updateState(id, state, answeredAt) {
      await updateCallState(db, id, state, answeredAt);
    },
    async list(tenantId, opts) {
      return listCalls(db, tenantId, opts);
    },
  };
}

function createChatThreadRepo(db: Kysely<Database>): ChatThreadRepository {
  return {
    async create(tenantId, opts) {
      const row = await createChatThread(db, tenantId, opts);
      return {
        id: row.id,
        tenantId: row.tenant_id,
        contactId: row.contact_id,
        state: row.state,
        metadata: row.metadata,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },
    async get(id) {
      const row = await getChatThread(db, id);
      if (!row) return null;
      return {
        id: row.id,
        tenantId: row.tenant_id,
        contactId: row.contact_id,
        state: row.state,
        metadata: row.metadata,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },
    async list(tenantId, opts) {
      const rows = await listChatThreads(db, tenantId, opts);
      return rows.map((r) => ({
        id: r.id,
        tenantId: r.tenant_id,
        contactId: r.contact_id,
        state: r.state,
        metadata: r.metadata,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    },
  };
}

function createChatMessageRepo(db: Kysely<Database>): ChatMessageRepository {
  return {
    async create(threadId, body, opts) {
      const row = await createChatMessage(db, threadId, body, opts);
      return {
        id: row.id,
        threadId: row.thread_id,
        fromEndpointId: row.from_endpoint_id,
        body: row.body,
        metadata: row.metadata,
        createdAt: row.created_at,
      };
    },
    async list(threadId, opts) {
      const rows = await listChatMessages(db, threadId, opts);
      return rows.map((r) => ({
        id: r.id,
        threadId: r.thread_id,
        fromEndpointId: r.from_endpoint_id,
        body: r.body,
        metadata: r.metadata,
        createdAt: r.created_at,
      }));
    },
  };
}

/**
 * Creates a Postgres-backed StorageAdapter.
 * Uses the existing Kysely-based repository implementation.
 */
export function createPostgresAdapter(db: Kysely<Database>): StorageAdapter {
  return {
    tenants: createTenantRepo(db),
    endpoints: createEndpointRepo(db),
    calls: createCallRepo(db),
    chatThreads: createChatThreadRepo(db),
    chatMessages: createChatMessageRepo(db),
  };
}
