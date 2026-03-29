# Pino Logging Implementation Plan

## Overview

This plan outlines how to implement **structured logging using Pino** (third-party library) and send logs directly to **Loki** for storage and querying.

**Scope:** Server-side logging only (no Docker, no collector setup yet)  
**Framework:** Pino + pino-loki transport  
**Integration:** TypeScript Express server with automatic traceId injection  
**Destination:** Loki API at `http://localhost:3100/loki/api/v1/push`

---

## Why Pino?

| Aspect | Benefit |
|--------|---------|
| **Performance** | Extremely fast JSON logging (lowest overhead) |
| **Structure** | Built-in structured JSON output |
| **Ecosystem** | Rich transport ecosystem (Loki, HTTP, etc) |
| **TypeScript** | Excellent TypeScript support |
| **Loki Ready** | pino-loki transport available |
| **Industry Standard** | Widely adopted in production |

---

## Architecture

```
┌──────────────────────────────────┐
│  Express Server (server.ts)      │
│  - Requests come in              │
│  - Code runs                      │
│  - Pino logger called             │
└────────────────┬─────────────────┘
                 │
         ┌───────▼──────────┐
         │  Pino Logger     │
         │  - Structured    │
         │  - JSON output   │
         │  - TraceId       │
         └───────┬──────────┘
                 │
       ┌─────────┴─────────┐
       │                   │
    Console         pino-loki transport
    (dev)           (HTTP POST)
       │                   │
       │            ┌──────▼──────┐
       │            │ Loki API    │
       │            │ Port 3100   │
       │            └─────────────┘
       │
    ┌──▼──────────┐
    │ Development │
    │  (console)  │
    └─────────────┘
```

---

## Phase 1: Setup & Configuration

### Step 1.1: Install Pino Packages

**Packages to install:**
```
npm install pino pino-loki
npm install -D @types/pino
```

**Versions (use latest):**
- `pino` - Main logging library
- `pino-loki` - Loki transport for Pino
- `@types/pino` - TypeScript type definitions

### Step 1.2: Create Logger Configuration File

**File:** `src/config/logger.ts`

**Purpose:** Centralized Pino logger configuration

**Responsibilities:**
1. Import Pino and pino-loki transport
2. Configure log levels (debug, info, warn, error)
3. Configure Loki endpoint (from env or default)
4. Setup both console and Loki transports
5. Export configured logger instance
6. Configure for both development and production

**Configuration Details:**

```
- Log Level: 
  * Development: "debug" or "info"
  * Production: "info" or "warn"

- Transports:
  * Console (development): Pretty print
  * Loki (production): JSON to HTTP
  
- Log Format:
  * Base: JSON structured logs
  * Include: timestamp, level, message, context
  
- Loki Settings:
  * Endpoint: http://localhost:3100/loki/api/v1/push
  * Job name: add-server
  * Labels: environment, service name
  
- Timestamp:
  * ISO format for Loki compatibility
  
- Base Properties:
  * service: "add-server"
  * version: from package.json
  * environment: NODE_ENV
```

### Step 1.3: TraceId Middleware

**File:** `src/middleware/traceIdMiddleware.ts`

**Purpose:** Inject traceId into every request context

**Responsibilities:**
1. Get current OTEL span context
2. Extract traceId from span
3. Attach traceId to Express request object
4. Make traceId available to Pino logger in request context
5. Pass traceId to child loggers for correlation

**Details:**
```
- Get traceId from: trace.getActiveSpan()?.spanContext().traceId
- Fallback: generate UUID or use "unknown"
- Attach to: req.traceId (custom property)
- Use in: Every log entry throughout request lifecycle
```

---

## Phase 2: Logger Integration

### Step 2.1: Create Logger Utility

**File:** `src/utils/pino-logger.ts`

**Purpose:** Helper functions for logging with traceId

**Exports:**

1. **getRequestLogger(req)**
   - Takes Express request object
   - Returns logger instance with traceId in context
   - Usage: Inside route handlers

2. **logOperation(logger, operation, data)**
   - Logs structured operation data
   - Includes timing information
   - Standard format across app

3. **logError(logger, error, context)**
   - Formats error logging
   - Includes stack trace, error code, message
   - Standard error format

**Examples of usage:**
```
const logger = getRequestLogger(req);
logger.info({ operation: 'add', input: numbers }, 'Addition completed');
logger.error({ error: error.message }, 'Operation failed');
```

### Step 2.2: Update server.ts

**File:** `server.ts`

**Changes:**

1. **Import logger:**
   ```
   import { logger } from './src/config/logger';
   import { getRequestLogger } from './src/utils/pino-logger';
   import traceIdMiddleware from './src/middleware/traceIdMiddleware';
   ```

2. **Add middleware:**
   ```
   app.use(traceIdMiddleware);
   ```

3. **Logging in endpoints:**
   - GET /add
     * Log request received (debug)
     * Log validation result (debug)
     * Log calculation step (info)
     * Log error if occurs (error)
     * Log success (info)
   
   - GET /health
     * Log health check call (debug)

**Log Entry Examples:**

```json
{
  "level": "info",
  "time": "2026-03-28T10:30:00.000Z",
  "pid": 12345,
  "hostname": "macbook",
  "traceId": "abc123xyz",
  "service": "add-server",
  "message": "Addition request received",
  "input": [2, 3, 5, 6],
  "ip": "127.0.0.1"
}
```

---

## Phase 3: Loki Integration

### Step 3.1: Pino-Loki Transport Configuration

**Details:**

1. **Transport Setup:**
   - Use `pino.transport()` for streaming
   - Use pino-loki target
   - Configure HTTP endpoint

2. **Loki Endpoint:**
   - Default: `http://localhost:3100/loki/api/v1/push`
   - Configurable via: `LOKI_ENDPOINT` env var

3. **Log Labels (Stream):**
   ```
   {
     job: "add-server",
     service: "add-server",
     env: "development",
     level: "info"
   }
   ```

4. **Log Format:**
   - JSON stringified for Loki
   - Includes: timestamp, level, traceId, message, data

5. **Batch Settings:**
   - Batch size: 10-20 logs
   - Timeout: 5 seconds
   - Retry: 3 attempts

6. **Error Handling:**
   - If Loki unreachable: fallback to console
   - Don't crash server on log failures
   - Warn in development, silent in production

### Step 3.2: Environment Configuration

**Environment Variables:**

```
LOKI_ENDPOINT=http://localhost:3100              # Loki API endpoint
LOG_LEVEL=info                                    # Minimum log level
NODE_ENV=development                              # Environment
SERVICE_NAME=add-server                           # Service identifier
```

**Configuration Priority:**
1. Environment variables (override all)
2. Config file defaults
3. Hardcoded fallbacks

### Step 3.3: Log Levels & Usage

**Four Log Levels:**

| Level | When to Use | Example |
|-------|------------|---------|
| **debug** | Dev-only details | "Numbers parsed", "Validation passed" |
| **info** | Normal operations | "Addition completed", "Request received" |
| **warn** | Recoverable issues | "Invalid input", "Retry attempt" |
| **error** | Failures | "Addition failed", "Unexpected error" |

**Usage in endpoints:**

```
GET /add?numbers=2,3,5,6

1. logger.debug('Add request received', {query, ip})
2. logger.debug('Numbers parsed', {count, numbers})
3. logger.info('Addition completed', {result, duration})

If error:
4. logger.error('Validation failed', {input, reason})
```

---

## Phase 4: Correlation & Tracing

### Step 4.1: TraceId in Every Log

**How it works:**

1. **On request:**
   - traceIdMiddleware runs first
   - Gets traceId from OTEL span context
   - Stores in `req.traceId`

2. **In handlers:**
   - `getRequestLogger(req)` adds traceId to child logger
   - Every log entry includes traceId field
   - Same traceId across entire request lifecycle

3. **In Loki:**
   - Query by traceId: `{traceId="abc123xyz"}`
   - See all logs for that request
   - Correlate with OTEL traces

### Step 4.2: Structured Logging Pattern

**Pattern to follow:**

```
logger.info(
  {
    operation: 'addition',
    input_count: 4,
    input: [2, 3, 5, 6],
    result: 16,
    duration_ms: 5
  },
  'Addition completed'  // message
);
```

**What Loki receives:**

```json
{
  "timestamp": "2026-03-28T...",
  "level": "info",
  "traceId": "abc123xyz",
  "operation": "addition",
  "input_count": 4,
  "result": 16,
  "message": "Addition completed"
}
```

---

## Phase 5: Testing & Validation

### Step 5.1: Local Testing (No Docker)

**Prerequisites:**
- Pino installed
- pino-loki transport installed
- server.ts updated with logging

**Test 1: Console Output**
```
Run: npm start (or npm run dev)
Expected: See formatted logs in console
Check: Logs are readable, include timestamp, level, message
```

**Test 2: Server Startup**
```
Check: No errors during logger initialization
Check: Logger config loads from env vars
Check: Service name appears in logs
```

**Test 3: Request Logging**
```
Request: curl "http://localhost:3000/add?numbers=2,3,5,6"
Check: Logger called for request
Check: Logger called for validation
Check: Logger called for result
Check: All logs have traceId
```

**Test 4: Error Logging**
```
Request: curl "http://localhost:3000/add?numbers=2,invalid"
Check: Error log appears
Check: Error message is clear
Check: Stack trace included (if enabled)
```

### Step 5.2: Loki Integration Testing

**When Loki is available:**

1. **Send logs:**
   - Logs automatically sent via pino-loki transport
   - No changes needed to code

2. **Query in Loki:**
   ```
   {job="add-server"}              # All logs
   {job="add-server", level="error"} # Errors only
   {traceId="abc123xyz"}           # One request
   ```

3. **Verify:**
   - Check Loki UI (when ready)
   - Confirm logs are arriving
   - Check timestamp accuracy
   - Verify traceId present

---

## Phase 6: Environment-Specific Configuration

### Step 6.1: Development Environment

**Settings:**
```
LOG_LEVEL=debug
LOKI_ENDPOINT=http://localhost:3100
NODE_ENV=development
Enable: Console pretty-print
Enable: All debug logs
Disable: Loki batching (log immediately)
```

**Output:** Pretty formatted, readable, detailed

### Step 6.2: Production Environment

**Settings:**
```
LOG_LEVEL=info
LOKI_ENDPOINT=https://loki.production.com
NODE_ENV=production
Disable: Console pretty-print
Disable: Debug logs
Enable: Batching (10-20 logs per batch)
Enable: Retry with backoff
```

**Output:** Efficient JSON to Loki, minimal console output

---

## File Structure (Target)

```
src/
├── server.ts                          (main app with Pino)
├── instrumentation.ts                 (OTEL setup)
├── config/
│   └── logger.ts                      (Pino configuration)
├── middleware/
│   └── traceIdMiddleware.ts           (traceId injection)
└── utils/
    ├── math.ts
    ├── pino-logger.ts                 (logging utilities)
    └── errorHandler.ts (future)

dist/                                  (compiled output)
package.json                           (with Pino deps)
.env                                   (environment vars)
tsconfig.json
```

---

## Dependencies to Install

```
npm install pino pino-loki
npm install -D @types/pino

Optional (future):
npm install dotenv                     # .env file support
npm install pino-pretty                # pretty printing
```

---

## Implementation Order

1. **Step 1:** Create `src/config/logger.ts` (Pino setup)
2. **Step 2:** Create `src/middleware/traceIdMiddleware.ts` (TraceId injection)
3. **Step 3:** Create `src/utils/pino-logger.ts` (Logging utilities)
4. **Step 4:** Update `server.ts` (integrate Pino)
5. **Step 5:** Update `package.json` (add Pino deps)
6. **Step 6:** Test locally (console output)
7. **Step 7:** Test with Loki (when available)

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Pino over Winston** | Performance, structure, Loki support |
| **pino-loki transport** | Native Loki integration, no intermediary |
| **TraceId middleware** | Every request has traceId for correlation |
| **Structured logging** | Queryable in Loki, machine-readable |
| **No Docker yet** | Focus on server-side first |
| **Console + Loki** | Works with/without Loki, dev-friendly |
| **Separate config file** | Reusable, testable, maintainable |

---

## Benefits of This Approach

✅ **Performance** - Pino is extremely fast  
✅ **Type-Safe** - Full TypeScript support  
✅ **Structured** - JSON logs, queryable  
✅ **Correlated** - TraceId links logs to traces  
✅ **Flexible** - Works with/without Loki  
✅ **Standard** - Industry best practice  
✅ **Simple** - No Docker needed yet  
✅ **Testable** - Each component separately  

---

## Migration Path (Future)

When ready to move forward:

1. **Phase 7:** Add Docker Compose with Loki
2. **Phase 8:** Configure pino-loki transport
3. **Phase 9:** Test full log pipeline
4. **Phase 10:** Add log retention policies
5. **Phase 11:** Setup alerting on errors

But for now: **Server-side Pino only!**

---

## Summary

This plan covers **server-side logging with Pino** only:
- Pino setup and configuration
- TraceId injection middleware
- Logging utility functions
- Integration into Express handlers
- Loki transport configuration
- Environment-specific setups
- Testing strategy

**Everything needed for structured logging, ready to integrate with Loki when it's time.**

---

**Status:** ✏️ Plan Ready (No Implementation Yet)  
**Scope:** Server-Side Only  
**Next Step:** When ready, execute Phase 1 (Pino setup)  
**Last Updated:** March 28, 2026
