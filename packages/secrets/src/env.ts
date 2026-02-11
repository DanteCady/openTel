import type { SecretsProvider } from "./provider.js";

/**
 * Reads secrets from environment variables.
 * Key format: OPENTEL_SECRET_{tenantId}_{key} (sanitized for env: replace - with _)
 * Or OPENTEL_SECRET_{key} for single-tenant (tenantId ignored).
 *
 * Dev/single-tenant only. Not suitable for multi-tenant production.
 */
export function createEnvSecretsProvider(): SecretsProvider {
  return {
    async get(tenantId: string, key: string): Promise<string | null> {
      const sanitizedTenant = tenantId.replace(/-/g, "_");
      const sanitizedKey = key.replace(/-/g, "_").toUpperCase();
      const withTenant = `OPENTEL_SECRET_${sanitizedTenant}_${sanitizedKey}`;
      const withoutTenant = `OPENTEL_SECRET_${sanitizedKey}`;
      const value = process.env[withTenant] ?? process.env[withoutTenant];
      return value ?? null;
    },

    async set(): Promise<void> {
      throw new Error("EnvSecretsProvider does not support set()");
    },

    async delete(): Promise<void> {
      throw new Error("EnvSecretsProvider does not support delete()");
    },
  };
}
