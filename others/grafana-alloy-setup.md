# Grafana Alloy Setup — OTLP → Alloy → Loki/Tempo/Prometheus

## Overview

**Production flow:**

```
Node.js app
  │  (OTLP HTTP on port 4311)
  ▼
Grafana Alloy  ──batch──►  Loki    (logs)
                       ──►  Tempo   (traces)
                       ──►  Prometheus (metrics)
```

The app **never** talks to Loki directly. Alloy is the single ingestion point.

---

## Alloy Config — What Each Block Does

### 1. `otelcol.receiver.otlp "local_flow"`
Listens for OTLP telemetry from your app.

| Protocol | Port |
|----------|------|
| gRPC | `4310` |
| HTTP | `4311` ← use this from Node.js |

All three signals (metrics, logs, traces) are forwarded to the batch processor.

---

### 2. `otelcol.processor.batch "local_flow"`
Buffers incoming telemetry and flushes in batches (better performance, fewer requests).

Routes each signal to its own exporter:

| Signal | Destination |
|--------|------------|
| Logs | `otelcol.exporter.loki "process_logs"` |
| Traces | `otelcol.exporter.otlp "local_tempo"` |
| Metrics | `otelcol.exporter.prometheus "local_prometheus"` |

---

### 3. Log Pipeline: `otelcol.exporter.loki` → `loki.process` → `loki.write`

**Step 1 — `otelcol.exporter.loki "process_logs"`**  
Converts OTLP log format to Loki format and forwards to the processing stage.

**Step 2 — `loki.process "process_telemetry_attributes"`**  
Extracts fields from the OTLP log body/attributes and turns them into **Loki labels**:

| Extracted field | Loki label |
|-----------------|-----------|
| `attributes."log.type"` | `log_type` |
| `resources."service.name"` | `service_name` |
| `resources."service.type"` | `service_type` |
| `severity` | `severity` |
| `traceid` | `trace_id` |
| `spanid` | `span_id` |

Also **drops** noisy auto-generated labels: `level`, `exporter`, `loki_export`, `job`.

**Step 3 — `loki.write "local_loki"`**  
Pushes to Loki at `http://loki:3100/loki/api/v1/push`.

---

### 4. Traces — `otelcol.exporter.otlp "local_tempo"`
Forwards traces via OTLP gRPC to Tempo at `http://tempo:4317` (TLS disabled for internal Docker network).

---

### 5. Metrics — `otelcol.exporter.prometheus` → `prometheus.remote_write`
Converts OTLP metrics to Prometheus format and remote-writes to `http://prometheus:9090/api/v1/write`.

---

## Node.js App Configuration

Your app must send **OTLP** to Alloy, **not** directly to Loki.

### Environment variables to set

```bash
# OTLP endpoint pointing at Alloy HTTP port
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4311

# Or per-signal (logs specifically)
OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://localhost:4311/v1/logs
```

> **Note:** If Node.js runs on the host and Alloy is in Docker, use `localhost` with the published port.  
> If both are in Docker, use the service name: `http://alloy:4311`.

### What `instrumentation.ts` must configure

```typescript
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { logs } from '@opentelemetry/api-logs';

const alloyEndpoint = process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
  || 'http://localhost:4311/v1/logs';

const loggerProvider = new LoggerProvider();

loggerProvider.addLogRecordProcessor(
  new BatchLogRecordProcessor(
    new OTLPLogExporter({ url: alloyEndpoint })
  )
);

logs.setGlobalLoggerProvider(loggerProvider);
```

### What `logger.ts` must do

- Call `logs.getLogger('service-name').emit(...)` — **no `fetch` to Loki**.
- Alloy receives the OTLP payload, processes it, and forwards to Loki.

---

## Querying in Grafana

After logs reach Loki via Alloy, query using the labels Alloy extracted:

```logql
# By service
{service_name="add-server"}

# By severity
{service_name="add-server", severity="INFO"}

# Search body
{service_name="add-server"} |= "Addition request"

# By trace ID (then jump to Tempo)
{service_name="add-server", trace_id="abc123"}
```

---

## Ports Reference (Docker)

| Service | Port | Purpose |
|---------|------|---------|
| Alloy gRPC | `4310` | OTLP gRPC ingestion |
| Alloy HTTP | `4311` | OTLP HTTP ingestion ← Node.js uses this |
| Loki | `3100` | Log storage (Alloy writes here) |
| Tempo | `4317` | Trace storage |
| Prometheus | `9090` | Metrics storage |
| Grafana | `3200` | Dashboard UI |

---

## Key Points

- **App → Alloy (OTLP):** not app → Loki directly.
- **Alloy handles batching, label extraction, routing** — app stays simple.
- **One OTLP endpoint** for all three signals (logs, traces, metrics).
- **Loki labels** come from Alloy's `loki.process` stage, not from the app.
