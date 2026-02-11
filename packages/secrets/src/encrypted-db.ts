import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { Pool } from "pg";
import type { SecretsProvider } from "./provider.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const TAG_LENGTH = 16;

function deriveKey(encryptionKey: string, salt: Buffer): Buffer {
  return scryptSync(encryptionKey, salt, KEY_LENGTH);
}

function encrypt(plaintext: string, encryptionKey: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(encryptionKey, salt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, encrypted]).toString("base64");
}

function decrypt(ciphertext: string, encryptionKey: string): string {
  const buf = Buffer.from(ciphertext, "base64");
  const salt = buf.subarray(0, SALT_LENGTH);
  const iv = buf.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = buf.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const key = deriveKey(encryptionKey, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS opentel_secrets (
  tenant_id VARCHAR(36) NOT NULL,
  key VARCHAR(255) NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tenant_id, key)
);
`;

export interface EncryptedDbSecretsProviderOptions {
  databaseUrl: string;
  encryptionKey: string;
}

/**
 * Stores secrets in Postgres with AES-256-GCM encryption.
 * Requires SECRETS_ENCRYPTION_KEY (32+ bytes recommended).
 */
export function createEncryptedDbSecretsProvider(
  opts: EncryptedDbSecretsProviderOptions
): SecretsProvider {
  const pool = new Pool({ connectionString: opts.databaseUrl });
  const encryptionKey = opts.encryptionKey;
  if (!encryptionKey || encryptionKey.length < 16) {
    throw new Error("SECRETS_ENCRYPTION_KEY must be at least 16 characters");
  }

  let tableReady = false;
  async function ensureTable() {
    if (tableReady) return;
    await pool.query(CREATE_TABLE);
    tableReady = true;
  }

  return {
    async get(tenantId: string, key: string): Promise<string | null> {
      await ensureTable();
      const res = await pool.query(
        "SELECT value FROM opentel_secrets WHERE tenant_id = $1 AND key = $2",
        [tenantId, key]
      );
      const row = res.rows[0];
      if (!row?.value) return null;
      try {
        return decrypt(row.value, encryptionKey);
      } catch {
        return null;
      }
    },

    async set(tenantId: string, key: string, value: string): Promise<void> {
      await ensureTable();
      const encrypted = encrypt(value, encryptionKey);
      await pool.query(
        `INSERT INTO opentel_secrets (tenant_id, key, value) VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, key) DO UPDATE SET value = $3, created_at = NOW()`,
        [tenantId, key, encrypted]
      );
    },

    async delete(tenantId: string, key: string): Promise<void> {
      await ensureTable();
      await pool.query("DELETE FROM opentel_secrets WHERE tenant_id = $1 AND key = $2", [
        tenantId,
        key,
      ]);
    },
  };
}
