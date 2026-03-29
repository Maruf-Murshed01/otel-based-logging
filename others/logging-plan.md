# Manual Logging Implementation Plan

## Overview

This plan outlines how to implement **simple manual structured logging** in the TypeScript Node.js server with **five log levels**.

**Scope:** Server-side logging only  
**Approach:** Manual logging to console (no external services)  
**Log Levels:** DEBUG, INFO, WARN, ERROR, FATAL  
**Destination:** Console output + structured JSON format  

---

## Architecture

```
┌──────────────────────────────────┐
│  Express Server (server.ts)      │
│  - Requests come in              │
│  - Code runs                      │
│  - Manual logger called           │
└────────────────┬─────────────────┘
                 │
         ┌───────▼──────────┐
         │  Logger Instance │
         │  - Structured    │
         │  - 5 Levels      │
         │  - TraceId       │
         │  - JSON format   │
         └───────┬──────────┘
                 │
         ┌───────▼──────────┐
         │  Console Output  │
         │  (stdout/stderr) │
         └──────────────────┘
```

---

## Five Logging Levels

| Level | Severity | When to Use | Example |
|-------|----------|------------|---------|
| **debug** | 🟢 Lowest | Detailed development info, variable values | "Numbers parsed: [2,3,5,6]", "Query string received" |
| **info** | 🟡 Low | Normal operation flow, successful operations | "Addition started with 4 numbers", "Request processed" |
| **warn** | 🟠 Medium | Potential issues, recoverable problems | "Retry attempt 2/3", "Invalid input, using default" |
| **error** | 🔴 High | Errors and failures, exceptions | "Invalid input provided", "Validation failed" |
| **fatal** | 🟣 Critical | System crashes, unrecoverable errors | "Database connection lost", "Process shutting down" |

---

## Implementation Plan

### Phase 1: Create Logger Utility

**File:** `src/utils/logger.ts`

**Purpose:** Simple manual logger with 5 levels

**Responsibilities:**
1. Define log entry structure
2. Get traceId from OTEL span context
3. Format log message with timestamp and level
4. Print to console with appropriate formatting
5. Export logger functions

**Log Levels in Code:**
```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogEntry {
  traceId: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: any;
}
```

**Logger Functions:**
- `logger.debug(message, extras)`
- `logger.info(message, extras)`
- `logger.warn(message, extras)`
- `logger.error(message, extras)`
- `logger.fatal(message, extras)`

**Features:**
- Automatic traceId injection from OTEL context
- Timestamp in ISO format
- Structured JSON output
- Pretty console formatting
- No external dependencies

---

### Phase 2: Logger Integration

**File:** `server.ts`

**Changes:**

1. **Import logger:**
   ```typescript
   import { logger } from './src/utils/logger';
   ```

2. **Add logging to endpoints:**
   - GET /add
     * Debug: log request details
     * Debug: log parsing step
     * Info: log success
     * Error: log failure if occurs
   
   - GET /health
     * Debug: log health check

**Logging Pattern:**
```typescript
logger.debug('Numbers parsed successfully', {
  count: numbers.length,
  numbers: numbers
});

logger.info('Addition completed', {
  input_count: numbers.length,
  result: result
});

logger.error('Validation failed', {
  reason: 'Invalid numbers',
  input: req.query.numbers
});
```

---

### Phase 3: Five Log Levels in Practice

#### DEBUG Level
**Purpose:** Development details for troubleshooting

**When to use:**
- Variable values after parsing
- Condition check results
- Function flow entry/exit
- Detailed intermediate steps

**Example logs:**
```
[DEBUG] Request received with query string
[DEBUG] Numbers parsed: [2, 3, 5, 6]
[DEBUG] Validation passed all checks
[DEBUG] Calling addition function
```

#### INFO Level
**Purpose:** Normal operation milestones

**When to use:**
- Request received
- Operation started/completed
- Successful operations
- Milestone achievements

**Example logs:**
```
[INFO] Addition request received
[INFO] Addition completed successfully
[INFO] Request processed in 5ms
[INFO] Result: 16
```

#### WARN Level
**Purpose:** Recoverable issues, potential problems

**When to use:**
- Retry attempts
- Non-critical validation issues
- Performance warnings
- Fallback actions

**Example logs:**
```
[WARN] Retry attempt 2/3
[WARN] Input contains extra whitespace
[WARN] Operation taking longer than expected
[WARN] Falling back to default value
```

#### ERROR Level
**Purpose:** Failures that stop the operation

**When to use:**
- Validation failures
- Operation failures
- Exceptions caught
- Request aborted

**Example logs:**
```
[ERROR] Validation failed - cannot proceed
[ERROR] Invalid numbers provided
[ERROR] Division by zero encountered
[ERROR] Request aborted with status 400
```

#### FATAL Level
**Purpose:** Critical system errors only

**When to use:**
- System-level failures
- Unrecoverable errors
- Process shutdown
- Critical exceptions

**Example logs:**
```
[FATAL] Unexpected error in request handler
[FATAL] Server shutting down due to error
[FATAL] Critical exception occurred
```

---

## Log Output Format

### Console Output (Pretty)
```
[2026-03-28T10:30:00.000Z] [INFO] Addition request received
[2026-03-28T10:30:00.001Z] [DEBUG] Numbers parsed: [2,3,5,6]
[2026-03-28T10:30:00.005Z] [INFO] Addition completed - result: 16
```

### Structured JSON (Programmatic)
```json
{
  "timestamp": "2026-03-28T10:30:00.000Z",
  "level": "info",
  "traceId": "abc123xyz",
  "message": "Addition request received",
  "method": "GET",
  "path": "/add",
  "ip": "127.0.0.1"
}
```

---

## Phase 4: Example Log Flows

### Successful Request: `/add?numbers=2,3,5,6`

```
[DEBUG] Request received with query string
  → method: "GET", path: "/add", query: {numbers: "2,3,5,6"}

[DEBUG] Numbers parsed and validated
  → count: 4, numbers: [2,3,5,6]

[INFO] Addition operation completed successfully
  → input_count: 4, result: 16, duration_ms: 5
```

### Failed Request: `/add?numbers=2,invalid,5`

```
[DEBUG] Request received with query string
  → query: {numbers: "2,invalid,5"}

[WARN] Non-numeric value detected during parsing
  → invalid_value: "invalid", position: 1

[ERROR] Validation failed - cannot proceed with addition
  → reason: "Invalid numbers found", status: 400
```

### Error During Processing

```
[DEBUG] Request received

[ERROR] Unexpected error during validation
  → error: "Cannot read property 'split' of undefined"

[FATAL] Request handler crashed
  → action: "Sent error response to client"
```

---

## Phase 5: TraceId Correlation

**What is TraceId:**
- Unique identifier for each request
- Generated by OTEL automatically
- Same traceId across all logs in a request
- Enables correlation of related logs

**How to use:**
```typescript
const span = trace.getActiveSpan();
const traceId = span?.spanContext().traceId || 'unknown';

// Use traceId in logs
logger.info('Operation completed', { traceId, result });
```

**Benefits:**
- Filter logs by request: all logs with traceId=xyz
- Track request lifecycle
- Correlate with OTEL traces (future)

---

## Phase 6: Environment-Specific Configuration

### Development Environment

**Settings:**
```
LOG_LEVEL=debug
NODE_ENV=development
Console: Pretty-printed, colorized
Output: stdout (visible immediately)
```

**Output style:**
```
[DEBUG] Numbers parsed: [2,3,5,6]
[INFO] Addition completed: result=16
```

### Production Environment

**Settings:**
```
LOG_LEVEL=info
NODE_ENV=production
Console: JSON format, compact
Output: stdout/stderr
```

**Output style:**
```json
{"timestamp":"2026-03-28T10:30:00Z","level":"info","message":"Addition completed"}
```

---

## File Structure (Target)

```
src/
├── server.ts                      (main app with logging)
├── instrumentation.ts             (OTEL setup)
└── utils/
    ├── math.ts                    (addition function)
    └── logger.ts                  (manual logger)

dist/                              (compiled output)
package.json
tsconfig.json
```

---

## Implementation Order

1. **Step 1:** Create `src/utils/logger.ts` with 5 log levels
2. **Step 2:** Implement logger functions (debug, info, warn, error, fatal)
3. **Step 3:** Update `server.ts` to import logger
4. **Step 4:** Add logging calls to GET /add endpoint
5. **Step 5:** Add logging to GET /health endpoint
6. **Step 6:** Test locally and verify console output

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **5 Log Levels** | Standard practice, fine-grained control |
| **No External Service** | Simple, learning-focused, no dependencies |
| **Console Output** | Immediate visibility, easy debugging |
| **Structured Format** | Machine-readable, future-ready for Loki |
| **TraceId in Every Log** | Request correlation capability |
| **No Logger Library** | Keep it simple, understand basics |

---

## Benefits of This Approach

✅ **Simple** - No external dependencies or services  
✅ **Educational** - Learn logging fundamentals  
✅ **Transparent** - See exactly what's being logged  
✅ **Immediate** - Console output visible in real-time  
✅ **Structured** - JSON format, machine-readable  
✅ **Type-Safe** - Full TypeScript support  
✅ **Traceable** - TraceId for request correlation  

---

## Testing Locally

### Test 1: Successful Operation
```bash
curl "http://localhost:3000/add?numbers=2,3,5,6"
```

**Expected logs:**
- DEBUG: Request received
- DEBUG: Numbers parsed
- INFO: Addition completed

### Test 2: Invalid Input
```bash
curl "http://localhost:3000/add?numbers=2,invalid,5"
```

**Expected logs:**
- DEBUG: Request received
- WARN: Non-numeric value detected
- ERROR: Validation failed

### Test 3: Health Check
```bash
curl "http://localhost:3000/health"
```

**Expected logs:**
- DEBUG: Health check called

---

## Console Output Example

```
✅ Server running on http://localhost:3000/add?numbers=2,3,5,6
📊 Health check: http://localhost:3000/health

[2026-03-28T10:30:00.000Z] [DEBUG] Request received
  traceId: abc123xyz
  method: GET
  path: /add
  query: { numbers: "2,3,5,6" }

[2026-03-28T10:30:00.001Z] [DEBUG] Parsing numbers
  input: "2,3,5,6"

[2026-03-28T10:30:00.002Z] [INFO] Addition completed
  result: 16
  duration_ms: 2
  traceId: abc123xyz
```

---

## Summary

This plan covers **simple manual logging**:
- 5 log levels (DEBUG, INFO, WARN, ERROR, FATAL)
- Manual logging to console
- Structured JSON format
- TraceId injection from OTEL
- No external services or dependencies
- Server-side only
- Type-safe TypeScript implementation

---

**Status:** ✏️ Ready for Implementation (Manual Logging Only)  
**Scope:** Server-Side Only  
**Dependencies:** None (uses Node.js built-in console)  
**Complexity:** Simple  
**Last Updated:** March 28, 2026
