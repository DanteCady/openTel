/**
 * Secrets provider interface for pluggable credential storage.
 * Self-hosters can implement this to use Vault, AWS Secrets Manager, etc.
 *
 * Key naming: `{channel}_{provider}_{key}` — e.g. `email_sendgrid_api_key`, `sms_twilio_auth_token`
 */
export interface SecretsProvider {
  get(tenantId: string, key: string): Promise<string | null>;
  set(tenantId: string, key: string, value: string): Promise<void>;
  delete(tenantId: string, key: string): Promise<void>;
}
