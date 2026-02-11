export interface OpenTelServerClientOptions {
  baseUrl: string;
  adminToken: string;
}

export class OpenTelServerClient {
  private baseUrl: string;
  private token: string;

  constructor(opts: OpenTelServerClientOptions) {
    this.baseUrl = opts.baseUrl;
    this.token = opts.adminToken;
  }

  private async fetch<T>(method: string, path: string, body?: object): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status}: ${text}`);
    return text ? (JSON.parse(text) as T) : (null as T);
  }

  async createTenant(name: string, webhookUrl?: string) {
    return this.fetch<{ id: string; name: string; webhookUrl: string | null; createdAt: string }>(
      "POST",
      "/v1/tenants",
      { name, webhookUrl }
    );
  }

  async updateTenantWebhook(tenantId: string, webhookUrl: string | null) {
    return this.fetch("PATCH", `/v1/tenants/${tenantId}`, { webhookUrl });
  }

  async createEndpoint(tenantId: string, label: string) {
    return this.fetch<{ id: string; tenantId: string; label: string; type: string; createdAt: string }>(
      "POST",
      `/v1/tenants/${tenantId}/endpoints`,
      { label }
    );
  }

  async listEndpoints(tenantId: string, limit?: number, offset?: number) {
    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));
    if (offset) params.set("offset", String(offset));
    const q = params.toString();
    return this.fetch<object[]>(`GET`, `/v1/tenants/${tenantId}/endpoints${q ? `?${q}` : ""}`);
  }

  async mintToken(tenantId: string, endpointId?: string, scopes?: string[]) {
    const res = await this.fetch<{ token: string }>("POST", "/v1/tokens", {
      tenantId,
      endpointId,
      scopes,
    });
    return res.token;
  }

  async listCalls(tenantId: string, opts?: { state?: string; limit?: number; offset?: number }) {
    const params = new URLSearchParams();
    if (opts?.state) params.set("state", opts.state);
    if (opts?.limit) params.set("limit", String(opts.limit));
    if (opts?.offset) params.set("offset", String(opts.offset));
    const q = params.toString();
    return this.fetch<object[]>(`GET`, `/v1/tenants/${tenantId}/calls${q ? `?${q}` : ""}`);
  }

  async getCall(callId: string) {
    return this.fetch<object>("GET", `/v1/calls/${callId}`);
  }
}
