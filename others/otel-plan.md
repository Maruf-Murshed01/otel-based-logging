# OpenTelemetry Implementation Plan for Node.js Add Server (TypeScript)

## Overview
This document outlines a step-by-step plan to integrate OpenTelemetry (OTEL) into our TypeScript-based Node.js addition server and send telemetry data (traces, metrics, and logs) to Grafana.

**Tech Stack Update:** Project has been migrated from JavaScript to TypeScript for better type safety and IDE support.

---

## Understanding OpenTelemetry Architecture

### Three Pillars of Observability
1. **Traces** - Track request flow through the application (distributed tracing)
2. **Metrics** - Collect quantitative measurements (CPU, memory, HTTP duration, custom metrics)
3. **Logs** - Text records of events (still under development for JS, but we'll use a workaround)

### Key Components
- **NodeSDK** - Core SDK that initializes OpenTelemetry
- **Auto-Instrumentations** - Automatically create spans for HTTP, Express, databases, etc.
- **Exporters** - Send telemetry data to backends (Console, Jaeger, Prometheus, OTLP, etc.)
- **Grafana** - Dashboard to visualize traces, metrics, and logs

---

## Implementation Plan

### Phase 1: Setup OTEL Infrastructure (Local Testing)
**Goal:** Install OTEL dependencies and export to console first

**Steps:**
1. Install required OTEL packages:
   - `@opentelemetry/sdk-node` - Core Node.js SDK
   - `@opentelemetry/api` - OTEL API
   - `@opentelemetry/auto-instrumentations-node` - Auto-instrument libraries
   - `@opentelemetry/sdk-trace-node` - Trace exporter (console)
   - `@opentelemetry/sdk-metrics` - Metrics exporter (console)

2. Create `instrumentation.ts` file:
   - Import OTEL SDK and exporters with TypeScript types
   - Initialize NodeSDK with full type annotations
   - Configure ConsoleSpanExporter for traces
   - Configure ConsoleMetricExporter for metrics
   - Enable auto-instrumentations for Express and HTTP
   - Start SDK before app code loads

3. Update `package.json`:
   - Add `--import ./instrumentation.ts` to start script (via tsx loader)
   - Use `tsx --import ./instrumentation.ts server.ts` to run TypeScript
   - This ensures OTEL initializes before app code loads

4. Test locally:
   - Start server with OTEL
   - Make requests to `/add?numbers=2,3,5,6`
   - Verify spans and metrics printed to console

---

### Phase 2: Setup Local Collector Stack (Docker)
**Goal:** Setup OTEL Collector + Grafana locally to receive telemetry

**Steps:**
1. Install Docker (if not already installed)

2. Create `docker-compose.yml`:
   - **OTEL Collector** - Receives data from app (port 4317 for gRPC)
   - **Prometheus** - Stores metrics from collector
   - **Loki** - Stores logs from collector
   - **Tempo** - Stores and queries traces (Grafana-native integration)
   - **Grafana** - Dashboard (port 3000) to query all data sources

3. Create `otel-collector-config.yaml`:
   - Configure receivers (OTLP/gRPC)
   - Configure exporters (Prometheus for metrics, Loki for logs, Tempo for traces)
   - Setup pipeline: receiver → processor → exporter

4. Start the stack:
   ```bash
   docker-compose up -d
   ```

---

### Phase 3: Update App to Send Data to Collector
**Goal:** Export telemetry from app to OTEL Collector instead of console

**Steps:**
1. Install additional OTEL packages:
   - `@opentelemetry/exporter-trace-otlp-grpc` - Send traces to collector
   - `@opentelemetry/exporter-metrics-otlp-grpc` - Send metrics to collector

2. Update `instrumentation.ts`:
   - Replace ConsoleSpanExporter with OTLPTraceExporter
   - Replace ConsoleMetricExporter with OTLPMetricExporter
   - Configure exporter endpoint: `http://localhost:4317` (OTEL Collector gRPC)
   - Maintain full TypeScript type safety

3. Update `server.ts`:
   - Import OTEL tracer and meter APIs with TypeScript types
   - Add custom spans for the addition operation with typed attributes
   - Add custom metrics (e.g., count of additions performed)
   - Create logger instance to send logs
   - Ensure proper TypeScript interfaces for span attributes

4. Test the flow:
   - Start OTEL Collector stack (Docker)
   - Start our app
   - Make requests to `/add`
   - Verify data appears in Grafana

---

### Phase 4: Configure Grafana Dashboards
**Goal:** Create visualizations in Grafana

**Steps:**
1. Access Grafana (http://localhost:3000)

2. Add Data Sources:
   - **Prometheus** - For metrics (http://prometheus:9090)
   - **Loki** - For logs (http://loki:3100)
   - **Tempo** - For traces (http://tempo:3100)

3. Create Dashboard:
   - **Metrics Panel**: HTTP request duration, request count, error rate
   - **Logs Panel**: Application logs from requests
   - **Traces Panel**: Trace visualization of `/add` requests

4. Add Alerts (optional):
   - Alert if error rate > 5%
   - Alert if average request duration > 100ms

---

### Phase 5: Add Custom Instrumentation
**Goal:** Add business logic monitoring

**Steps:**
1. Import OTEL APIs in `server.ts`:
   - `trace.getActiveSpan()` - Get current span (typed return)
   - `meter.createCounter()` - Create metrics with TypeScript support
   - Define interfaces for span attributes and metric values

2. Add custom spans:
   - Wrap the addition operation in a span
   - Add attributes with TypeScript validation (input numbers, result, count)
   - Use typed span context for type safety

3. Add custom metrics:
   - Counter: "add.operation.total" - Total additions performed
   - Gauge: "add.operation.numbers.sum" - Sum of all inputs
   - Histogram: "add.operation.duration" - Time taken per addition
   - All with proper TypeScript type annotations

4. Add contextual logs:
   - Log when addition starts/completes with structured data
   - Include trace ID for correlation
   - Use typed logger interface

---

### Phase 6: Advanced Features (Future)
**Optional enhancements:**

1. **Distributed Tracing**:
   - Track requests across microservices (if we add more services)
   - Propagate trace context through headers

2. **Custom Business Metrics**:
   - Monitor specific patterns
   - Alert on anomalies

3. **Log Aggregation**:
   - Use Winston or Pino for structured logging
   - Send logs directly to Loki

4. **Performance Monitoring**:
   - Memory usage trends
   - GC performance
   - Event loop latency

5. **Security & Compliance**:
   - Trace sensitive operations
   - Audit logs
   - PII masking in logs

---

## Technology Stack

| Component | Purpose | Technology |
|-----------|---------|-----------|
| Application | Add server | Node.js + Express + **TypeScript** |
| Language Support | Development & compilation | TypeScript 5.x + tsx runner |
| Instrumentation | Telemetry SDK | OpenTelemetry JS (TS-typed) |
| Type Definitions | Type safety | @types/express, @types/node |
| Collector | Receive & process telemetry | OTEL Collector |
| Metrics Store | Store metrics | Prometheus |
| Logs Store | Store logs | Loki |
| Traces Store | Store traces | **Tempo** (Grafana-native) |
| Dashboard | Visualize all data | Grafana |
| Container Orchestration | Local stack | Docker Compose |

---

## Data Flow Diagram

```
┌─────────────────────────────────────┐
│  TypeScript Node.js Add Server      │
│  - server.ts                        │
│  - instrumentation.ts               │
│  - tsconfig.json                    │
│  - Custom spans & metrics (typed)   │
└────────────────┬────────────────────┘
                 │
                 │ OTLP/gRPC (port 4317)
                 ▼
┌─────────────────────────────────────┐
│  OpenTelemetry Collector            │
│  - Receives traces, metrics, logs   │
│  - Processes & enriches data        │
└────┬────────────┬────────────┬──────┘
     │            │            │
     │ Traces     │ Metrics    │ Logs
     ▼            ▼            ▼
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │  Tempo   │  │Prometheus│  │   Loki   │
  │(Grafana) │  │(Grafana) │  │(Grafana) │
  └────┬─────┘  └────┬─────┘  └────┬─────┘
       │             │             │
       └─────────────┴─────────────┘
                 │
                 │ Native Query Integration
                 ▼
        ┌─────────────────────┐
        │     Grafana         │
        │ (Unified Dashboard) │
        │ - Traces from Tempo │
        │ - Metrics from Prom │
        │ - Logs from Loki    │
        │ - Correlation       │
        └─────────────────────┘
```

---

## Implementation Checklist

### Phase 1: Local Console Testing
- [ ] Install OTEL packages (with TypeScript support)
- [ ] Create `instrumentation.ts` with full type annotations
- [ ] Update `package.json` to use `tsx` for TypeScript execution
- [ ] Compile TypeScript and verify no type errors
- [ ] Verify console output of traces and metrics

### Phase 2: Local Docker Stack (with Tempo)
- [ ] Create docker-compose.yml (Tempo instead of Jaeger)
- [ ] Create otel-collector-config.yaml (Tempo exporter)
- [ ] Start Docker stack
- [ ] Access Grafana on http://localhost:3000
- [ ] Verify Tempo container is running and healthy

### Phase 3: App Integration
- [ ] Install OTLP exporters (with TypeScript types)
- [ ] Update `instrumentation.ts` to use OTLP with type safety
- [ ] Update `server.ts` with OTEL API calls (typed)
- [ ] Compile and verify TypeScript compilation
- [ ] Test data flowing to collector

### Phase 4: Grafana Setup
- [ ] Add data sources (Prometheus, Loki, Tempo)
- [ ] Create dashboard panels (metrics, logs, traces)
- [ ] Setup trace-to-logs correlation
- [ ] Configure alerts

### Phase 5: Custom Instrumentation
- [ ] Add custom spans in `server.ts` with typed attributes
- [ ] Add custom metrics with TypeScript validation
- [ ] Add contextual logging with structured types
- [ ] Verify TypeScript compilation with strict mode
- [ ] Test trace visibility in Grafana

### Phase 6: Documentation
- [ ] Document architecture
- [ ] Create setup guide for team
- [ ] Add troubleshooting guide

---

## Expected Outcomes

After implementing this plan, you will have:

✅ **Full observability** of your application  
✅ **Real-time traces** showing request flow  
✅ **Metrics dashboard** tracking performance  
✅ **Centralized logs** for debugging  
✅ **Alerts** for anomalies  
✅ **Scalable foundation** for future microservices  

---

## Why Tempo (Not Jaeger)?

**Tempo** was chosen over Jaeger for this project because:

### Architecture Benefits
- **Grafana-Native** - Deep integration with Grafana (our primary dashboard)
- **Simpler Stack** - One fewer service to manage
- **Resource Efficient** - Uses ~80% less storage than Jaeger through compression
- **Cost-Effective** - Ideal for development and small production workloads
- **Modern Choice** - Aligned with Grafana's observability direction

### Developer Experience
- **Unified Dashboard** - Query traces, metrics, and logs from single Grafana UI
- **Trace Correlation** - Jump between traces → logs → metrics seamlessly
- **Better UX** - Integrated directly into Grafana panels
- **Less Configuration** - Fewer exporter and storage backend options

### Production-Ready
- **Proven Stability** - Production-deployed by thousands of teams
- **Fast Growth** - Rapidly becoming the standard for trace storage
- **Active Development** - Regular updates and improvements
- **Community Support** - Growing ecosystem around Grafana stack

### For Your Use Case
You're building a **Grafana-centric observability platform** with:
- Prometheus (metrics)
- Loki (logs)
- Grafana (dashboard)

**→ Tempo completes the stack perfectly** with native integration.

---

## References

- [OpenTelemetry JS Getting Started](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/)
- [OpenTelemetry JS Examples](https://opentelemetry.io/docs/languages/js/examples/)
- [OpenTelemetry Exporter Docs](https://opentelemetry.io/docs/languages/js/exporters/)
- [Grafana Tempo Docs](https://grafana.com/docs/tempo/latest/)
- [Grafana Docs](https://grafana.com/docs/)
- [OTEL Collector Docs](https://opentelemetry.io/docs/collector/)

---

## TypeScript-Specific Benefits

With TypeScript integration, you gain:

✅ **Type-Safe OTEL APIs** - OTEL packages have excellent TypeScript definitions  
✅ **Compile-Time Error Detection** - Catch issues before runtime  
✅ **IntelliSense Support** - Better autocomplete for OTEL methods and attributes  
✅ **Refactoring Confidence** - Safe changes as project evolves  
✅ **Self-Documenting Code** - Types show intent clearly  
✅ **Strict Mode** - Production-ready code quality  

---

**Status:** ✏️ Plan Updated for TypeScript + Tempo (Ready for Phase 1 Implementation)  
**Last Updated:** March 28, 2026  
**Language:** TypeScript 5.x  
**Trace Backend:** Tempo (Grafana-native)
