/**
 * OpenTelemetry tracing skeleton for OpenTel.
 * Call initTracing() as early as possible (e.g. right after loading .env) in each app.
 *
 * Env:
 *   OTEL_ENABLED - set to "1" or "true" to enable tracing (default: off).
 *   OTEL_SERVICE_NAME - service name for the resource (default: "opentel" or pass to initTracing).
 *   OTEL_EXPORTER_OTLP_ENDPOINT - if set, export spans via OTLP HTTP; otherwise use console exporter.
 */

import { trace } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { BatchSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import type { SpanExporter } from "@opentelemetry/sdk-trace-base";

let initialized = false;

export function initTracing(_serviceName?: string): void {
  if (initialized) return;
  const enabled = process.env.OTEL_ENABLED === "1" || process.env.OTEL_ENABLED === "true";
  if (!enabled) return;

  const provider = new NodeTracerProvider();
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const exporter: SpanExporter = endpoint
    ? new OTLPTraceExporter({ url: endpoint })
    : new ConsoleSpanExporter();
  provider.addSpanProcessor(new BatchSpanProcessor(exporter));
  trace.setGlobalTracerProvider(provider);
  initialized = true;
}
