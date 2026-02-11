/**
 * Storage adapter interface for pluggable persistence.
 * Self-hosters can implement this to use MongoDB, Supabase, or custom backends.
 */

export interface Tenant {
  id: string;
  name: string;
  webhookUrl: string | null;
  createdAt: Date;
}

export interface Endpoint {
  id: string;
  tenantId: string;
  label: string;
  type: string;
  createdAt: Date;
}

export interface Call {
  id: string;
  tenant_id: string;
  from_endpoint_id: string | null;
  to_endpoint_id: string | null;
  from_phone_number: string | null;
  to_phone_number: string | null;
  state: string;
  metadata: Record<string, string> | null;
  created_at: Date;
  updated_at: Date;
  answered_at: Date | null;
}

export interface TenantRepository {
  create(name: string, webhookUrl?: string | null): Promise<Tenant>;
  get(id: string): Promise<Tenant | null>;
  updateWebhook(id: string, webhookUrl: string | null): Promise<void>;
}

export interface EndpointRepository {
  create(tenantId: string, label: string, type?: string): Promise<Endpoint>;
  list(tenantId: string, limit?: number, offset?: number): Promise<Endpoint[]>;
}

export interface CallRepository {
  create(
    tenantId: string,
    fromEndpointId: string | null,
    toEndpointId: string | null,
    metadata?: Record<string, string> | null,
    opts?: { toPhoneNumber?: string | null; fromPhoneNumber?: string | null }
  ): Promise<{ id: string; state: string }>;
  get(id: string): Promise<Call | null>;
  updateState(id: string, state: string, answeredAt?: Date | null): Promise<void>;
  list(
    tenantId: string,
    opts?: { state?: string; limit?: number; offset?: number }
  ): Promise<Call[]>;
}

export interface ChatThread {
  id: string;
  tenantId: string;
  contactId: string | null;
  state: string;
  metadata: Record<string, string> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  fromEndpointId: string | null;
  body: string;
  metadata: Record<string, string> | null;
  createdAt: Date;
}

export interface ChatThreadRepository {
  create(tenantId: string, opts?: { contactId?: string | null; metadata?: Record<string, string> | null }): Promise<ChatThread>;
  get(id: string): Promise<ChatThread | null>;
  list(tenantId: string, opts?: { contactId?: string; limit?: number; offset?: number }): Promise<ChatThread[]>;
}

export interface ChatMessageRepository {
  create(threadId: string, body: string, opts?: { fromEndpointId?: string | null; metadata?: Record<string, string> | null }): Promise<ChatMessage>;
  list(threadId: string, opts?: { limit?: number; offset?: number }): Promise<ChatMessage[]>;
}

export interface StorageAdapter {
  tenants: TenantRepository;
  endpoints: EndpointRepository;
  calls: CallRepository;
  chatThreads: ChatThreadRepository;
  chatMessages: ChatMessageRepository;
}
