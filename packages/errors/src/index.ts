export const ERROR_CODES = {
  TOKEN_MISSING: 401,
  TOKEN_INVALID: 401,
  TOKEN_EXPIRED: 401,
  INSUFFICIENT_SCOPE: 403,
  TENANT_MISMATCH: 403,
  TENANT_NOT_FOUND: 404,
  ENDPOINT_NOT_FOUND: 404,
  CALL_NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  INVALID_UUID: 400,
  NAME_REQUIRED: 400,
  LABEL_REQUIRED: 400,
  TENANT_NAME_EXISTS: 409,
  ENDPOINT_LABEL_EXISTS: 409,
  RATE_LIMIT_EXCEEDED: 429,
  INTERNAL_ERROR: 500,
  DATABASE_ERROR: 503,
  NATS_ERROR: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export function toHttpStatus(code: ErrorCode): number {
  return ERROR_CODES[code] ?? 500;
}

export interface ApiErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    requestId?: string;
    timestamp: string;
    path?: string;
    method?: string;
    details?: Record<string, unknown>;
    docs?: string;
  };
}

export class OpenTelError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "OpenTelError";
  }

  toApiResponse(opts: {
    requestId?: string;
    path?: string;
    method?: string;
    docsBaseUrl?: string;
  }): ApiErrorResponse {
    const docs = opts.docsBaseUrl
      ? `${opts.docsBaseUrl}#${this.code}`
      : undefined;
    return {
      error: {
        code: this.code,
        message: this.message,
        requestId: opts.requestId,
        timestamp: new Date().toISOString(),
        path: opts.path,
        method: opts.method,
        details: this.details,
        docs,
      },
    };
  }
}
