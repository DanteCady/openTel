import { describe, it, expect } from "vitest";
import { app } from "./server.js";
import { mintToken } from "@opentel/auth";

const jwtSecret = process.env.JWT_SECRET || "dev-secret";

function adminToken(): string {
  return mintToken(jwtSecret, {
    tenantId: "00000000-0000-0000-0000-000000000000",
    scopes: ["admin"],
  });
}

describe("POST /v1/tenants", () => {
  it("returns 401 without Authorization", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants",
      payload: { name: "Test" },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error?.code).toBe("TOKEN_MISSING");
  });

  it("returns 403 with non-admin token", async () => {
    const tenantScopedToken = mintToken(jwtSecret, {
      tenantId: "11111111-1111-1111-1111-111111111111",
    });
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants",
      payload: { name: "Test" },
      headers: { authorization: `Bearer ${tenantScopedToken}` },
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error?.code).toBe("INSUFFICIENT_SCOPE");
  });

  it("returns 400 when name is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants",
      payload: {},
      headers: { authorization: `Bearer ${adminToken()}` },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error?.code).toBe("VALIDATION_ERROR");
  });

  it("creates tenant and returns 200 with id and name", async () => {
    const name = `Test Tenant ${Date.now()}`;
    const res = await app.inject({
      method: "POST",
      url: "/v1/tenants",
      payload: { name },
      headers: { authorization: `Bearer ${adminToken()}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("name", name);
    expect(body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });
});
