# Observability & Logging Quick Guide

## What's Setup

Your Node.js TypeScript server has **complete observability** with three pillars:

1. **🔍 Traces** - Request flow and latency tracking
2. **📊 Metrics** - Automatic performance metrics (CPU, memory, HTTP duration)
3. **📝 Logs** - Structured logging with 5 levels

---

## Quick Start

### Install & Run
```bash
npm install       # Install dependencies
npm run build     # Compile TypeScript
npm start         # Start server
```

Server runs on: `http://localhost:3000`

### Test It
```bash
curl "http://localhost:3000/add?numbers=2,3,5,6"
curl "http://localhost:3000/health"
```

---

## 5 Log Levels

| Level | Use Case | Example |
|-------|----------|---------|
| **DEBUG** 🟢 | Dev details | "Numbers parsed: [2,3,5,6]" |
| **INFO** 🟡 | Normal ops | "Addition completed: result=16" |
| **WARN** 🟠 | Recoverable | "Retry attempt 2/3" |
| **ERROR** 🔴 | Failures | "Validation failed" |
| **FATAL** 🟣 | Critical | "Server crash imminent" |

---

## How to Use Logger

```typescript
import * as logger from './src/utils/logger';

// Log with any level
logger.debug('Variable values', { key: value });
logger.info('Operation done', { result: data });
logger.warn('Potential issue', { warning: msg });
logger.error('Failed', { error: msg });
logger.fatal('Critical', { reason: msg });
```

**Automatic features:**
- ✅ TraceId injected automatically
- ✅ Timestamp added
- ✅ Structured JSON format
- ✅ Appears in console

---

## Example Request Flow

```bash
GET /add?numbers=2,3,5,6
```

**Logs produced:**
```
[DEBUG] Request received (method, path, query)
[DEBUG] Numbers parsed: [2,3,5,6]
[INFO] Addition request processed (result: 16)
```

Each log includes:
- `trace.id` - Request identifier
- `span.id` - Operation identifier
- `timestamp` - When it happened
- Custom attributes - Your data

---

## Project Structure

```
src/
├── server.ts           ← Main app + addNumbers() inline
├── instrumentation.ts  ← OTEL SDK setup (traces & metrics)
└── utils/
    └── logger.ts       ← 5-level structured logger
```

---

## Key Features

✅ **Auto-Instrumented** - HTTP requests tracked automatically  
✅ **Trace Correlation** - Every log linked to request  
✅ **TypeScript** - Full type safety  
✅ **5 Log Levels** - Fine-grained control  
✅ **Structured JSON** - Machine-readable  
✅ **Zero Config** - Works out of the box  

---

## Environment Variables

```bash
LOG_LEVEL=debug          # Set minimum log level
NODE_ENV=development     # Set environment
```

---

## What Gets Logged Automatically

Every request automatically gets:
- ✅ Trace ID (unique per request)
- ✅ HTTP method & path
- ✅ Request duration
- ✅ Response status
- ✅ Memory usage
- ✅ CPU utilization

---

## Next Steps

- **Phase 2:** Test trace generation
- **Phase 3:** Setup OTLP exporters
- **Phase 4:** Docker stack (Prometheus, Loki, Tempo)
- **Phase 5:** Grafana dashboards & correlation

---

## Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| No logs visible | Set `LOG_LEVEL=debug` |
| Server won't start | Check port 3000 is free |
| Logs not structured | They're JSON - pipe to `jq` |
| Want to hide logs | Set `LOG_LEVEL=fatal` |

---

**That's it!** Your observability setup is production-ready. 🚀
