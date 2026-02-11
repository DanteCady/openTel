import type { SecretsProvider } from "./provider.js";
import { createEncryptedDbSecretsProvider } from "./encrypted-db.js";
import { createEnvSecretsProvider } from "./env.js";

export interface CreateSecretsProviderOptions {
  provider?: "encrypted_db" | "env";
  databaseUrl?: string;
  encryptionKey?: string;
}

/**
 * Creates a SecretsProvider based on configuration.
 * Uses SECRETS_PROVIDER env (default: encrypted_db).
 */
export function createSecretsProvider(opts: CreateSecretsProviderOptions = {}): SecretsProvider {
  const provider = (opts.provider ?? process.env.SECRETS_PROVIDER ?? "encrypted_db").toLowerCase();

  switch (provider) {
    case "env":
      return createEnvSecretsProvider();
    case "encrypted_db":
    default: {
      const databaseUrl = opts.databaseUrl ?? process.env.DATABASE_URL;
      const encryptionKey = opts.encryptionKey ?? process.env.SECRETS_ENCRYPTION_KEY;
      if (!databaseUrl || !encryptionKey) {
        throw new Error(
          "EncryptedDbSecretsProvider requires DATABASE_URL and SECRETS_ENCRYPTION_KEY"
        );
      }
      return createEncryptedDbSecretsProvider({ databaseUrl, encryptionKey });
    }
  }
}
