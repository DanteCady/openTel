# OpenTel Error Codes

All API errors return a consistent JSON shape:

```json
{
  "error": {
    "code": "TENANT_NOT_FOUND",
    "message": "Tenant with id 'abc-123' does not exist",
    "requestId": "req-uuid",
    "timestamp": "2025-02-11T12:00:00.000Z",
    "path": "/v1/tenants/abc-123/endpoints",
    "method": "GET",
    "details": { "tenantId": "abc-123" }
  }
}
```

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `TOKEN_MISSING` | 401 | No Authorization header present |
| `TOKEN_INVALID` | 401 | Malformed or expired JWT |
| `TOKEN_EXPIRED` | 401 | JWT has expired |
| `INSUFFICIENT_SCOPE` | 403 | Token valid but missing required scope (e.g. admin) |
| `TENANT_MISMATCH` | 403 | Token tenantId does not match resource tenant |
| `TENANT_NOT_FOUND` | 404 | Tenant id does not exist |
| `ENDPOINT_NOT_FOUND` | 404 | Endpoint id does not exist |
| `CALL_NOT_FOUND` | 404 | Call id does not exist |
| `THREAD_NOT_FOUND` | 404 | Chat thread id does not exist |
| `CONFIG_ERROR` | 400 | Channel or secrets not configured |
| `VALIDATION_ERROR` | 400 | Request body/query failed schema validation |
| `INVALID_UUID` | 400 | Path param is not a valid UUID |
| `NAME_REQUIRED` | 400 | Tenant name missing or empty |
| `LABEL_REQUIRED` | 400 | Endpoint label missing or empty |
| `TENANT_NAME_EXISTS` | 409 | Tenant with that name already exists |
| `ENDPOINT_LABEL_EXISTS` | 409 | Endpoint with that label already exists for tenant |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unhandled server error |
| `DATABASE_ERROR` | 503 | Postgres/Redis connection or query failed |
| `NATS_ERROR` | 503 | NATS publish/subscribe failed |

## Validation Error Details

When `code` is `VALIDATION_ERROR`, `details.fields` contains field-level errors:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "fields": [
        { "path": ["name"], "message": "Required" },
        { "path": ["webhookUrl"], "message": "Invalid URL" }
      ]
    }
  }
}
```
