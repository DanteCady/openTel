#!/usr/bin/env node
import "dotenv/config";
import { program } from "commander";
import { mintToken } from "@opentel/auth";

const API_URL = process.env.API_URL || "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

async function api(method: string, path: string, body?: object, token?: string) {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (token) (opts.headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${path}`, opts);
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

program.name("opentel").description("OpenTel demo CLI");

program
  .command("admin-token")
  .description("Mint admin token for bootstrap")
  .action(() => {
    const token = mintToken(JWT_SECRET, { tenantId: "bootstrap", scopes: ["admin"] });
    console.log("Admin token (use for API):");
    console.log(token);
  });

program
  .command("create-tenant <name>")
  .option("--webhook-url <url>", "Webhook URL")
  .description("Create a tenant")
  .action(async (name: string, opts: { webhookUrl?: string }) => {
    const token = mintToken(JWT_SECRET, { tenantId: "bootstrap", scopes: ["admin"] });
    const tenant = await api("POST", "/v1/tenants", { name, webhookUrl: opts.webhookUrl }, token);
    console.log("Tenant:", tenant);
  });

program
  .command("set-webhook <tenantId> <webhookUrl>")
  .description("Set tenant webhook URL")
  .action(async (tenantId: string, webhookUrl: string) => {
    const token = mintToken(JWT_SECRET, { tenantId: "bootstrap", scopes: ["admin"] });
    await api("PATCH", `/v1/tenants/${tenantId}`, { webhookUrl }, token);
    console.log("Webhook set");
  });

program
  .command("create-endpoint <tenantId> <label>")
  .description("Create an endpoint")
  .action(async (tenantId: string, label: string) => {
    const token = mintToken(JWT_SECRET, { tenantId, scopes: ["admin"] });
    const endpoint = await api("POST", `/v1/tenants/${tenantId}/endpoints`, { label }, token);
    console.log("Endpoint:", endpoint);
  });

program
  .command("mint-token <tenantId> [endpointId]")
  .description("Mint JWT for tenant/endpoint")
  .action(async (tenantId: string, endpointId?: string) => {
    const token = mintToken(JWT_SECRET, { tenantId, scopes: ["admin"] });
    const res = await api("POST", "/v1/tokens", { tenantId, endpointId }, token);
    console.log("Token:", res.token);
  });

program
  .command("quickstart")
  .description("Print first call steps")
  .action(() => {
    console.log(`
OpenTel First Call

1. Start infra: docker-compose -f infra/docker-compose.yml up -d
2. Run migrations: pnpm db:migrate
3. Start services: pnpm dev
4. Create tenant: opentel create-tenant Acme
5. Create two endpoints: opentel create-endpoint <tenantId> Alice && opentel create-endpoint <tenantId> Bob
6. Mint tokens: opentel mint-token <tenantId> <aliceEndpointId> && opentel mint-token <tenantId> <bobEndpointId>
7. Open infra/dev.html in two tabs, use the tokens, register endpoint, dial
`);
  });

program.parse();
