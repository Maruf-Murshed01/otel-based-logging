# 🚀 Complete OTEL TypeScript Node.js Server Setup Guide

This document provides **step-by-step instructions to create a new TypeScript Node.js server with OpenTelemetry logging** from scratch. Follow each step exactly to replicate the working setup.

---

## 📋 Prerequisites

- Node.js 18+ installed
- npm installed
- Docker running with these services:
  - Loki (port 3100)
  - Grafana (port 3200)
  - Tempo (optional, port 4317)
  - Prometheus (optional, port 9090)

**Verify Docker services:**
```bash
curl http://localhost:3100/ready        # Should return: ready
curl http://localhost:3200              # Should return Grafana login
```

---

## 🛠️ Step 1: Create Project Directory

```bash
# Create new project directory
mkdir my-otel-server
cd my-otel-server

# Initialize Node.js project
npm init -y

# Create source directory
mkdir -p src/utils
```

---

## 📦 Step 2: Install Dependencies

```bash
npm install express

npm install \
  @opentelemetry/sdk-node \
  @opentelemetry/api \
  @opentelemetry/api-logs \
  @opentelemetry/sdk-logs \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/sdk-trace-node \
  @opentelemetry/sdk-metrics \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions \
  @opentelemetry/exporter-logs-otlp-http

npm install --save-dev \
  typescript \
  @types/express \
  @types/node \
  tsx
```

**Verify installation:**
```bash
npm list | grep opentelemetry
# Should show all OTEL packages installed
```

---

## ⚙️ Step 3: Create TypeScript Configuration

**Create file:** `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false
  },
  "include": ["./**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 📝 Step 4: Create OpenTelemetry Instrumentation

**Create file:** `src/instrumentation.ts`

```typescript
/**
 * OpenTelemetry Instrumentation Setup
 *
 * Initializes:
 * - NodeSDK for traces and metrics
 * - OTEL Logs API (global logger provider)
 * - Console exporters for traces/metrics
 * - Logs are sent to Loki via HTTP client in logger.ts
 *
 * Must be imported BEFORE application code loads
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';
import { logs } from '@opentelemetry/api-logs';

// Get Loki endpoint from environment or use default (localhost for host-based Node.js)
const lokiEndpoint = process.env.LOKI_ENDPOINT || 'http://localhost:3100/loki/api/v1/push';

console.log(`🔗 Loki endpoint configured: ${lokiEndpoint}`);

// Get the default logger provider (already set globally by SDK)
const loggerProvider = logs.getLoggerProvider();

// Initialize NodeSDK with traces and metrics (console exporters)
const sdk = new NodeSDK({
  traceExporter: new ConsoleSpanExporter(),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new ConsoleMetricExporter(),
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

console.log('✅ OpenTelemetry SDK initialized');
console.log(`📝 Logs configured to send to Loki at: ${lokiEndpoint}`);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down OpenTelemetry SDK...');
  await sdk.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down OpenTelemetry SDK...');
  await sdk.shutdown();
  process.exit(0);
});

export { sdk, loggerProvider, lokiEndpoint };
```

---

## 📚 Step 5: Create Logger Utility

**Create file:** `src/logger.ts`

```typescript
/**
 * Logger Utility with HTTP Push to Loki
 *
 * Provides 5 log levels with automatic trace correlation
 * Sends logs directly to Loki via Loki HTTP Push API
 * - DEBUG: Development details
 * - INFO: Normal operations
 * - WARN: Recoverable issues
 * - ERROR: Failures
 * - FATAL: Critical system errors
 */

import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { trace } from '@opentelemetry/api';
import { lokiEndpoint } from './instrumentation';

// Define severity levels
const LEVELS = {
  DEBUG: { number: SeverityNumber.DEBUG, text: 'DEBUG' },
  INFO: { number: SeverityNumber.INFO, text: 'INFO' },
  WARN: { number: SeverityNumber.WARN, text: 'WARN' },
  ERROR: { number: SeverityNumber.ERROR, text: 'ERROR' },
  FATAL: { number: SeverityNumber.FATAL, text: 'FATAL' },
};

// Get log level filter from environment (default to DEBUG to capture all logs)
const LOG_LEVEL_FILTER =
  SeverityNumber[process.env.LOG_LEVEL?.toUpperCase() as keyof typeof SeverityNumber] ??
  SeverityNumber.DEBUG;

/**
 * Send log record directly to Loki via Loki Push API
 * Uses Loki's simplified push API instead of OTLP
 *
 * @param level - Log level (DEBUG, INFO, WARN, ERROR, FATAL)
 * @param message - Log message
 * @param attributes - Additional attributes (object)
 */
function sendToLoki(
  level: keyof typeof LEVELS,
  message: string,
  attributes: Record<string, any> = {}
): void {
  try {
    // Get active span for trace correlation
    const activeSpan = trace.getActiveSpan();
    const spanCtx = activeSpan?.spanContext();

    const { text } = LEVELS[level];
    const timestamp = (Date.now() * 1_000_000).toString(); // nanoseconds as string

    // Build the log line with all attributes
    const attrParts: string[] = [];
    attrParts.push(`level=${text}`);
    attrParts.push(`msg="${message}"`);
    
    // Add all custom attributes
    Object.entries(attributes).forEach(([key, value]) => {
      const strValue = typeof value === 'string' ? value : JSON.stringify(value);
      attrParts.push(`${key}=${strValue}`);
    });

    // Add trace context
    if (spanCtx) {
      attrParts.push(`trace_id=${spanCtx.traceId}`);
      attrParts.push(`span_id=${spanCtx.spanId}`);
    }

    const logLine = attrParts.join(' ');

    // Prepare Loki Push API payload
    const payload = {
      streams: [
        {
          stream: {
            job: process.env.SERVICE_NAME || 'my-service',
            level: text.toLowerCase(),
            service: process.env.SERVICE_NAME || 'my-service',
          },
          values: [
            [timestamp, logLine],
          ],
        },
      ],
    };

    // Send to Loki via Loki Push API (not OTLP)
    fetch(lokiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
      .then((response) => {
        if (!response.ok) {
          console.error(`Loki push failed: ${response.status} ${response.statusText}`);
        }
      })
      .catch((err) => {
        console.error(`Failed to send log to Loki: ${err.message}`);
      });
  } catch (err) {
    console.error(`Logger error: ${err}`);
  }
}

/**
 * Emit a log record with automatic trace correlation
 * Also sends to Loki via HTTP (non-blocking)
 *
 * @param level - Log level (DEBUG, INFO, WARN, ERROR, FATAL)
 * @param message - Log message
 * @param attributes - Additional attributes (object)
 */
function emit(
  level: keyof typeof LEVELS,
  message: string,
  attributes: Record<string, any> = {}
): void {
  const { number, text } = LEVELS[level];

  // Console log for immediate visibility (ALWAYS log to see if function is called)
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${text} - ${message}`);
  if (Object.keys(attributes).length > 0) {
    console.log('    Attributes:', attributes);
  }

  // Filter by log level
  if (number < LOG_LEVEL_FILTER) {
    return;
  }

  // Get active span for trace correlation
  const activeSpan = trace.getActiveSpan();
  const spanCtx = activeSpan?.spanContext();

  // Emit via OTEL API (for local processing)
  const otelLogger = logs.getLogger(process.env.SERVICE_NAME || 'my-service', '1.0.0');
  otelLogger.emit({
    severityNumber: number,
    severityText: text,
    body: message,
    attributes: {
      ...attributes,
      'log.level': text,
      ...(spanCtx && {
        'trace.id': spanCtx.traceId,
        'span.id': spanCtx.spanId,
      }),
    },
  });

  // Send to Loki via HTTP (non-blocking, fire and forget)
  sendToLoki(level, message, attributes);
}

/**
 * DEBUG level - Detailed development information
 * Use for: variable values, parsing steps, condition checks
 */
export const debug = (message: string, attributes?: Record<string, any>): void => {
  emit('DEBUG', message, attributes);
};

/**
 * INFO level - Normal operation flow
 * Use for: request received, operation completed, successful milestones
 */
export const info = (message: string, attributes?: Record<string, any>): void => {
  emit('INFO', message, attributes);
};

/**
 * WARN level - Potential issues, recoverable problems
 * Use for: retry attempts, non-critical validation issues, warnings
 */
export const warn = (message: string, attributes?: Record<string, any>): void => {
  emit('WARN', message, attributes);
};

/**
 * ERROR level - Failures that stop the operation
 * Use for: validation failures, exceptions, operation aborted
 */
export const error = (message: string, attributes?: Record<string, any>): void => {
  emit('ERROR', message, attributes);
};

/**
 * FATAL level - Critical system errors, unrecoverable
 * Use for: system crashes, process shutdown, critical exceptions
 */
export const fatal = (message: string, attributes?: Record<string, any>): void => {
  emit('FATAL', message, attributes);
};

// Export logger object for easier import
export const logger = { debug, info, warn, error, fatal };
```

---

## 🎯 Step 6: Create Main Server (Example)

**Create file:** `server.ts`

```typescript
/**
 * TypeScript Node.js Server with OpenTelemetry Logging
 * Change this to match your actual business logic
 */

// IMPORTANT: Initialize OTEL before importing other modules
import './src/instrumentation';

import express, { Request, Response } from 'express';
import * as logger from './src/logger';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;

/**
 * Example: Add multiple numbers
 * Replace this with your actual business logic
 */
function addNumbers(numbers: number[]): number {
  return numbers.reduce((sum, num) => sum + num, 0);
}

/**
 * GET /add?numbers=2,3,5,6
 * Example endpoint - Replace with your own
 */
app.get('/add', (req: Request, res: Response) => {
  console.log('>>> /add route handler called');
  try {
    logger.debug('Request received', {
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
    });

    // Get and parse numbers from query
    const numbersStr = req.query.numbers as string;

    if (!numbersStr) {
      logger.warn('Missing numbers parameter', {
        query: req.query,
      });
      return res.status(400).json({
        error: 'Missing numbers parameter. Use: ?numbers=2,3,5,6',
      });
    }

    const numbers = numbersStr
      .split(',')
      .map((n) => parseFloat(n.trim()));

    logger.debug('Numbers parsed', {
      count: numbers.length,
      numbers: numbers,
    });

    // Validate numbers
    if (numbers.some((n) => isNaN(n))) {
      logger.error('Validation failed - invalid numbers', {
        input: numbersStr,
        invalid_count: numbers.filter((n) => isNaN(n)).length,
      });
      return res.status(400).json({
        error: 'Invalid numbers provided',
      });
    }

    // Calculate sum
    const result = addNumbers(numbers);

    logger.info('Addition request processed', {
      input_count: numbers.length,
      result: result,
    });

    res.json({ input: numbers, result, count: numbers.length });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('Request failed', {
      'error.message': errorMessage,
      'error.stack': errorStack,
      path: req.path,
      status: 500,
    });

    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  logger.debug('Health check requested');

  res.json({
    status: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Start server and listen on port
 */
app.listen(PORT, () => {
  logger.info('Server started', {
    'server.port': PORT,
    'server.address': `http://localhost:${PORT}`,
  });
  console.log(`\n✅ Server running on http://localhost:${PORT}/add?numbers=2,3,5,6`);
  console.log(`📊 Health check: http://localhost:${PORT}/health\n`);
});

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (err) => {
  logger.fatal('Uncaught exception', {
    'error.message': err.message,
    'error.stack': err.stack,
  });
  process.exit(1);
});

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.fatal('Unhandled rejection', {
    reason: String(reason),
    promise: String(promise),
  });
  process.exit(1);
});
```

---

## 📄 Step 7: Update package.json

**Modify the scripts section in `package.json`:**

```json
{
  "name": "my-otel-server",
  "version": "1.0.0",
  "description": "OpenTelemetry TypeScript Node.js Server with Real-Time Logging",
  "main": "dist/server.js",
  "scripts": {
    "start": "tsx server.ts",
    "dev": "tsx server.ts",
    "build": "tsc",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": ["opentelemetry", "logging", "loki", "typescript"],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@opentelemetry/api": "latest",
    "@opentelemetry/api-logs": "latest",
    "@opentelemetry/auto-instrumentations-node": "latest",
    "@opentelemetry/exporter-logs-otlp-http": "^0.214.0",
    "@opentelemetry/resources": "latest",
    "@opentelemetry/sdk-logs": "latest",
    "@opentelemetry/sdk-metrics": "latest",
    "@opentelemetry/sdk-node": "latest",
    "@opentelemetry/sdk-trace-node": "latest",
    "@opentelemetry/semantic-conventions": "latest",
    "express": "^5.2.1"
  },
  "devDependencies": {
    "@types/express": "^5.0.6",
    "@types/node": "^25.5.0",
    "tsx": "^4.21.0",
    "typescript": "^6.0.2"
  }
}
```

---

## 🔨 Step 8: Build Project

```bash
npm run build

# Verify compilation succeeded
ls -la dist/
# Should show: server.js, src/instrumentation.js, src/logger.js
```

---

## 🚀 Step 9: Start Server

```bash
# Start with default settings
node dist/server.js

# OR start with custom service name and port
SERVICE_NAME=my-awesome-service PORT=5000 node dist/server.js

# OR start with custom Loki endpoint
LOKI_ENDPOINT=http://custom-loki:3100/loki/api/v1/push node dist/server.js
```

**Expected Output:**
```
🔗 Loki endpoint configured: http://localhost:3100/loki/api/v1/push
✅ OpenTelemetry SDK initialized
📝 Logs configured to send to Loki at: http://localhost:3100/loki/api/v1/push
[2026-03-28T...] INFO - Server started
    Attributes: { 'server.port': 4000, 'server.address': 'http://localhost:4000' }

✅ Server running on http://localhost:4000/add?numbers=2,3,5,6
📊 Health check: http://localhost:4000/health
```

---

## 🧪 Step 10: Test Server

### Test API Endpoint
```bash
curl "http://localhost:4000/add?numbers=2,3,5,6"
# Response: {"input":[2,3,5,6],"result":16,"count":4}
```

### Test Health Endpoint
```bash
curl "http://localhost:4000/health"
# Response: {"status":"Server is running","timestamp":"2026-03-28T..."}
```

### Generate Multiple Logs
```bash
for i in {1..5}; do
  curl -s "http://localhost:4000/add?numbers=$((i)),$(($i+1)),$(($i+2))" > /dev/null
  sleep 1
done
```

---

## 📊 Step 11: View Logs in Grafana

1. **Open Grafana:**
   ```
   http://localhost:3200
   ```

2. **Navigate to Explore:**
   - Click compass icon on left sidebar
   - Or navigate to: Explore

3. **Select Loki:**
   - Click data source dropdown
   - Select: Loki

4. **Query Your Logs:**
   ```logql
   {job="my-service"}
   ```

5. **Adjust Time Range (Important!):**
   - Click "Last 5 minutes" button (top right)
   - Change to: "Last 1 hour" or "Last 24 hours"

6. **Click Run:**
   - Press Shift+Enter
   - Wait 1-2 seconds for logs to appear

### Sample Log Entries You'll See:
```
[2026-03-28T12:53:38.573Z] DEBUG - Request received
[2026-03-28T12:53:38.575Z] DEBUG - Numbers parsed
[2026-03-28T12:53:38.577Z] INFO - Addition request processed
```

---

## 📝 Useful Grafana Queries

```logql
# See all logs
{job="my-service"}

# See only INFO logs
{job="my-service"} | json | level = "INFO"

# See only ERROR logs
{job="my-service"} | json | level = "ERROR"

# Search by message
{job="my-service"} | grep "Request received"

# Filter by trace ID (see full request trace)
{job="my-service"} | json | trace_id = "abc123xyz"
```

---

## ⚙️ Environment Variables

```bash
# Service name (default: "my-service")
SERVICE_NAME=my-awesome-service

# Server port (default: 4000)
PORT=5000

# Loki endpoint (default: http://localhost:3100/loki/api/v1/push)
LOKI_ENDPOINT=http://custom-loki:3100/loki/api/v1/push

# Log level (default: DEBUG)
LOG_LEVEL=INFO

# Example: Run with all custom settings
SERVICE_NAME=custom-api PORT=6000 LOG_LEVEL=INFO node dist/server.js
```

---

## 🐛 Troubleshooting

### Problem: Logs Not Appearing in Grafana

**Solution 1: Check Server is Running**
```bash
curl http://localhost:4000/health
# Should return: {"status":"Server is running"...}
```

**Solution 2: Verify Loki is Reachable**
```bash
curl http://localhost:3100/ready
# Should return: ready
```

**Solution 3: Check Time Range in Grafana**
- Click "Last 5 minutes" → Select "Last 1 hour"

**Solution 4: Check Logs in Console Output**
```
[2026-03-28T12:53:38.573Z] DEBUG - Request received
```
If you see this, logs ARE being generated.

**Solution 5: Verify Grafana Loki Datasource**
1. Settings → Data sources → Loki
2. Click "Save & test"
3. Should show: "Data source is working"

### Problem: Server Won't Start

**Check Port in Use:**
```bash
lsof -i :4000

# Kill existing process
pkill -f "node.*dist/server"

# Try again
node dist/server.js
```

**Check TypeScript Errors:**
```bash
npm run build
# Read error messages and fix them
```

---

## 📦 Project Structure

```
my-otel-server/
├── server.ts                 # Main Express application
├── src/
│   ├── instrumentation.ts   # OTEL SDK setup
│   └── logger.ts            # Logging utility (5 levels)
├── dist/                    # Compiled JavaScript
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
└── node_modules/            # Installed packages
```

---

## ✅ Verification Checklist

After completing all steps, verify:

- [ ] `npm install` completed without errors
- [ ] `npm run build` produces files in `dist/`
- [ ] `node dist/server.js` starts without errors
- [ ] `curl http://localhost:4000/health` returns JSON
- [ ] Console shows log lines like: `[timestamp] LEVEL - message`
- [ ] Grafana opens at `http://localhost:3200`
- [ ] Loki datasource shows "working"
- [ ] Query `{job="my-service"}` returns log entries
- [ ] Time range includes recent logs

---

## 🎯 Next Steps

1. **Replace Business Logic:**
   - Remove the `addNumbers` example
   - Add your own routes and endpoints

2. **Add More Logging:**
   - Add `logger.debug()`, `logger.info()` calls throughout
   - Include relevant business data in attributes

3. **Customize Service Name:**
   - Set `SERVICE_NAME=my-service-name` when starting
   - Or modify `.env` file (create it)

4. **Explore Grafana:**
   - Write different LogQL queries
   - Create dashboards
   - Set up alerts

5. **View Full Request Traces:**
   - Click trace ID in log to see request flow
   - View in Tempo if configured

---

## 📞 Quick Commands Reference

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start server (default port 4000)
node dist/server.js

# Start with custom service name
SERVICE_NAME=my-api node dist/server.js

# Start with custom port
PORT=5000 node dist/server.js

# Test API
curl "http://localhost:4000/add?numbers=1,2,3"

# View server logs in real-time
tail -f /path/to/server.log

# Kill server
pkill -f "node.*dist/server"
```

---

**Congratulations! You now have a production-ready OpenTelemetry-instrumented Node.js TypeScript server with real-time logging to Loki! 🎉**

All logs will appear in Grafana within 1-2 seconds, with automatic trace correlation and complete request context.
