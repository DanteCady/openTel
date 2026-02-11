# OpenTelemetry (Tracing)

OpenTel includes an **optional** tracing skeleton so you can enable OpenTelemetry and send spans to a collector or view them in the console.

## Enabling

Set in your environment (e.g. `.env`):

- **`OTEL_ENABLED=1`** (or `true`) – turns on the trace provider. If unset, tracing is off and the global provider stays a no-op.

Optional:

- **`OTEL_SERVICE_NAME`** – service name for the resource (default: `opentel`). The API and signaling apps call `initTracing("opentel-api")` and `initTracing("opentel-signaling")` so each has a distinct identity when you add resource attributes later.
- **`OTEL_EXPORTER_OTLP_ENDPOINT`** – if set, spans are exported via OTLP HTTP to this URL (e.g. `http://localhost:4318/v1/traces`). If unset, spans are printed to the console (ConsoleSpanExporter).

## Where it runs

- **API** and **Signaling** call `initTracing()` at startup (right after loading `.env`), before any other application code. That way the global trace provider is set before Fastify and other libraries load.

## Adding spans

The skeleton only sets the **global TracerProvider**. To create spans:

1. Use `trace.getTracer(name, version)` from `@opentelemetry/api` in your code, or
2. Add auto-instrumentation (e.g. `@opentelemetry/instrumentation-http`, `@opentelemetry/instrumentation-fastify`) and load it early so it uses the same provider.

Example manual span:

```ts
import { trace } from "@opentelemetry/api";
const tracer = trace.getTracer("opentel-api", "0.1.0");
const span = tracer.startSpan("createTenant");
// ... do work ...
span.end();
```

## Package

Tracing lives in **`packages/telemetry`**. It exports `initTracing(serviceName?: string)` and depends on `@opentelemetry/api`, `@opentelemetry/sdk-trace-node`, `@opentelemetry/sdk-trace-base`, and `@opentelemetry/exporter-trace-otlp-http`.
