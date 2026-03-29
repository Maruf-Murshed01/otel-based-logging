# 🚀 Node.js Observability Server - Team Onboarding Guide

Welcome to our TypeScript + OpenTelemetry project! This guide will get you up to speed in 10 minutes.

---

## 📋 Project Overview

**What is this?**
A production-ready TypeScript Express server demonstrating OpenTelemetry (OTEL) integration for complete observability: **logs**, **traces**, and **metrics**.

**What does it do?**
- Simple addition API: `GET /add?numbers=2,3,5,6` → Returns sum
- Health check: `GET /health` → Server status
- Automatically captures **structured logs** at 5 levels
- Sends logs to **Loki** for log aggregation
- Generates **traces** for request tracking
- Collects **metrics** for monitoring

**Tech Stack:**
- **Language:** TypeScript
- **Runtime:** Node.js
- **Framework:** Express.js
- **Observability:** OpenTelemetry (OTEL)
- **Log Storage:** Loki
- **Trace Storage:** Tempo
- **Metrics Storage:** Prometheus
- **Dashboard:** Grafana

---

## 🏃 Quick Start (5 mins)

### Prerequisites
- Node.js 18+ installed
- Docker running with Loki, Grafana, Tempo
- Port 4000 available

### 1. Install Dependencies
```bash
cd /Users/marufmurshed/Documents/AllSeedOS/nodejs_observability
npm install
```

### 2. Build TypeScript
```bash
npm run build
```

### 3. Start Server
```bash
node dist/server.js
```

**Expected Output:**
```
🔗 Loki endpoint configured: http://localhost:3100/otlp/v1/logs
✅ OpenTelemetry SDK initialized
✅ Server running on http://localhost:4000/add?numbers=2,3,5,6
```

### 4. Test It
```bash
curl "http://localhost:4000/add?numbers=2,3,5,6"
# Response: {"input":[2,3,5,6],"result":16,"count":4}
```

### 5. View Logs in Grafana
1. Open: `http://localhost:3200`
2. Go to: **Explore** → **Loki**
3. Query: `{job="add-server"}`
4. Click: **Run**

**You'll see:**
- ✅ Request received (DEBUG)
- ✅ Numbers parsed (DEBUG)
- ✅ Addition processed (INFO)
- ✅ Trace IDs & timestamps

---

## 📝 Understanding OTEL-Based Logging

### The Three Pillars of Observability

| Pillar | Purpose | Our Use |
|--------|---------|---------|
| **Logs** | What happened? | Request/response flow, errors |
| **Traces** | How did it flow? | End-to-end request path |
| **Metrics** | How much happened? | Performance, throughput |

### Our Implementation

```typescript
// 1. Logger initialization (src/logger.ts)
import * as logger from './src/logger';

// 2. Automatic OTEL initialization (src/instrumentation.ts)
import './src/instrumentation';  // MUST be first!

// 3. Using in code (server.ts)
app.get('/add', (req, res) => {
  logger.debug('Request received', { method: req.method });
  // ... business logic ...
  logger.info('Addition processed', { result: 16 });
});
```

### The 5 Log Levels

```typescript
logger.debug('Numbers parsed', { count: 4 });        // 🟢 Development details
logger.info('Request completed', { result: 16 });    // 🟡 Normal operations
logger.warn('High input count', { count: 100 });     // 🟠 Warnings
logger.error('Validation failed', { input: 'abc' }); // 🔴 Errors
logger.fatal('Server crash', { error: 'OOM' });      // 🟣 Critical
```

### Log Flow

```
Express Route Handler
  ↓ (automatic instrumentation creates trace)
  ↓
logger.info('message', {attributes})
  ↓
Console Output (immediate visibility)
  ↓
OTEL Logger (with severity & trace correlation)
  ↓
HTTP POST to Loki (/loki/api/v1/push)
  ↓
Loki Storage
  ↓
Grafana UI (query & visualize)
```

---

## 🔍 Key Files Explained

### `server.ts` - Main Application
```typescript
// Line 15: OTEL must init FIRST
import './src/instrumentation';

// Line 41+: Routes with logging
app.get('/add', (req, res) => {
  logger.debug('Request received');  // ← Logged to Loki
  logger.info('Addition processed'); // ← Logged to Loki
});
```

### `src/instrumentation.ts` - OTEL Setup
```typescript
// Initializes NodeSDK with:
// ✓ Trace collector (ConsoleSpanExporter for debugging)
// ✓ Metric reader (ConsoleMetricExporter for debugging)
// ✓ Auto-instrumentation for Express, HTTP, etc.
// ✓ Graceful shutdown handlers
```

### `src/logger.ts` - Logging Utility
```typescript
// Exports 5 functions: debug(), info(), warn(), error(), fatal()
// Each function:
// ✓ Creates structured log entry
// ✓ Adds trace ID from active span
// ✓ Sends to Loki via HTTP (non-blocking)
// ✓ Respects LOG_LEVEL env var for filtering
```

---

## 🛠️ Development Workflow

### Making Changes

```bash
# 1. Edit TypeScript files
# 2. Rebuild
npm run build

# 3. Restart server
node dist/server.js

# 4. Test API
curl "http://localhost:4000/add?numbers=1,2,3"

# 5. Check Grafana logs
# (Logs appear within 1-2 seconds)
```

### Adding New Logs

```typescript
// In any route handler:
logger.debug('Debug message', { 
  optional: 'attributes',
  can_be: 'any',
  data: { nested: 'objects' }
});

// Automatically includes:
// - Timestamp
// - Trace ID (links to request trace)
// - Span ID (links to request span)
// - Log level
```

### Environment Variables

```bash
# Change log level (default: DEBUG)
LOG_LEVEL=INFO node dist/server.js

# Use custom Loki endpoint
LOKI_ENDPOINT=http://custom-loki:3100/loki/api/v1/push node dist/server.js
```

---

## 🔗 Querying Logs in Grafana

### Basic Queries

```logql
# All logs from this service
{job="add-server"}

# Only INFO logs
{job="add-server"} | json | level = "INFO"

# Only errors
{job="add-server"} | json | level = "ERROR"

# Search by message
{job="add-server"} | grep "Addition"

# Filter by trace ID (correlate with Tempo traces)
{job="add-server"} | json | trace_id = "abc123xyz"
```

### Sample Log Entry

```json
{
  "timestamp": "2026-03-28T12:53:38.573Z",
  "level": "DEBUG",
  "msg": "Request received",
  "method": "GET",
  "path": "/add",
  "trace_id": "ddaaedeecc2e4bc57b9c3cd4993ed25d",
  "span_id": "f9530fa90da4a53e"
}
```

---

## 🚨 Troubleshooting

### Logs Not Appearing?

1. **Check server is running:**
   ```bash
   curl http://localhost:4000/health
   ```

2. **Verify Loki is reachable:**
   ```bash
   curl http://localhost:3100/ready
   ```

3. **Check Grafana time range:**
   - Click "Last 5 minutes" → Select "Last 1 hour"

4. **Verify log level:**
   - Set `LOG_LEVEL=DEBUG` to capture all logs

### Server Won't Start?

```bash
# Port might be in use
lsof -i :4000

# Or kill existing process
pkill -f "node.*dist/server"

# Rebuild and start
npm run build && node dist/server.js
```

---

## 📚 Project Structure

```
├── server.ts                 # Express app with routes
├── src/
│   ├── instrumentation.ts   # OTEL SDK initialization
│   └── logger.ts            # 5-level logging utility
├── dist/                    # Compiled JavaScript
├── package.json             # Dependencies & scripts
└── tsconfig.json            # TypeScript config
```

---

## ✅ Checklist for New Team Members

- [ ] Clone/navigate to project directory
- [ ] Run `npm install`
- [ ] Run `npm run build`
- [ ] Start server: `node dist/server.js`
- [ ] Test API: `curl http://localhost:4000/add?numbers=1,2,3`
- [ ] Open Grafana: `http://localhost:3200`
- [ ] Query logs: `{job="add-server"}`
- [ ] See logs appear in real-time
- [ ] Read `src/logger.ts` to understand logging patterns
- [ ] Read `server.ts` to see logging in action

---

## 🎯 Next Steps

1. **Modify Routes:** Add your own endpoints following the logging pattern
2. **Add Attributes:** Include relevant business data in log attributes
3. **Explore Traces:** Click log trace ID in Grafana to see request trace in Tempo
4. **View Metrics:** Access Prometheus metrics (metrics endpoint not exposed yet)
5. **Create Dashboard:** Build custom Grafana dashboard for your metrics

---

## 📞 Quick Reference

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Compile TS | `npm run build` |
| Run server | `node dist/server.js` |
| Test API | `curl http://localhost:4000/add?numbers=1,2,3` |
| View logs | `http://localhost:3200` → Explore → Loki → `{job="add-server"}` |
| Check health | `curl http://localhost:4000/health` |
| View code | Start with `server.ts` → then `src/logger.ts` |

---

## 🎓 Learning Resources

**Within Project:**
- `SETUP_COMPLETE.md` - Detailed setup guide
- `GRAFANA_SETUP.md` - Grafana configuration
- `QUICK_REFERENCE.txt` - Command reference

**External:**
- [OpenTelemetry Docs](https://opentelemetry.io/)
- [Loki Query Language](https://grafana.com/docs/loki/latest/query/)
- [Express Best Practices](https://expressjs.com/en/guide/best-practice-security.html)

---

**Welcome aboard! Happy logging! 🚀**
