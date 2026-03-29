# Complete Setup Guide: Node.js → Loki → Grafana

## ✅ Current Status

Your Node.js server is now **fully configured** to send logs to Loki!

- ✅ Server running on: `http://localhost:3000`
- ✅ Loki endpoint: `http://localhost:3100/otlp/v1/logs`
- ✅ Grafana access: `http://localhost:3200` (or your session port)

---

## 🚀 How to Start Everything

### 1. **Start Docker Services** (if not already running)
```bash
cd /path/to/your/docker/setup
docker-compose --profile observability up -d
```

Verify all services are running:
```bash
docker ps
```

You should see:
- ✅ grafana
- ✅ loki
- ✅ tempo
- ✅ prometheus
- ✅ alloy
- ✅ redpanda

### 2. **Start Your Node.js Server**
```bash
cd /Users/marufmurshed/Documents/AllSeedOS/nodejs_observability
npm start
```

**Output should show:**
```
🔗 Loki endpoint configured: http://localhost:3100/otlp/v1/logs
✅ OpenTelemetry SDK initialized
📝 Logs sending to Loki at: http://localhost:3100/otlp/v1/logs
✅ Server running on http://localhost:3000/add?numbers=2,3,5,6
```

---

## 📊 View Logs in Grafana

### Step 1: Open Grafana
```
http://localhost:3200
```
(or your session-specific port like `13200`, `23200`, etc.)

### Step 2: Verify Loki Data Source
1. Click **Connections** → **Data sources**
2. You should see **Loki** already configured at `http://loki:3100`
3. Click **Save & test** to verify connection

### Step 3: Query Your Logs
1. Go to **Explore** (left sidebar)
2. Select **Loki** as data source
3. In the query box, enter:
   ```
   {job="add-server"}
   ```
4. Click **Run** or press Shift+Enter

### Step 4: See Your Logs!
You'll see all logs from your server with:
- **Timestamp** - When it happened
- **Level** - DEBUG, INFO, WARN, ERROR, FATAL
- **TraceID** - Unique request identifier
- **Message** - What happened
- **Attributes** - Custom data

---

## 🔍 Example Queries

### See All Logs
```
{job="add-server"}
```

### See Only INFO Logs
```
{job="add-server"} | json | level = "INFO"
```

### See Only Errors
```
{job="add-server"} | json | level = "ERROR"
```

### See Logs from Specific Request
Get traceId from any log, then:
```
{job="add-server"} | json | trace_id = "abc123xyz"
```

### Search by Message
```
{job="add-server"} | grep "Addition"
```

---

## 🧪 Test It

### 1. Generate Test Logs
```bash
# Test 1: Successful addition
curl "http://localhost:3000/add?numbers=2,3,5,6"

# Test 2: Another operation
curl "http://localhost:3000/add?numbers=10,20,30"

# Test 3: Invalid input (generates error logs)
curl "http://localhost:3000/add?numbers=2,invalid,5"
```

### 2. Check Logs in Grafana
- Query: `{job="add-server"}`
- You should see logs from all three requests
- Click any log to see full details including traceId

---

## 📈 What You Get

### Logs Automatically Generated:
- **DEBUG** - Request received, numbers parsed
- **INFO** - Addition completed, request processed
- **WARN** - Non-integer values detected
- **ERROR** - Validation failed, invalid input
- **FATAL** - Server crashes (if they occur)

### Each Log Includes:
```json
{
  "timestamp": "2026-03-28T12:31:13.164Z",
  "level": "INFO",
  "traceId": "abc123xyz...",
  "spanId": "def456uvw...",
  "message": "Addition request processed",
  "result": 16,
  "input_count": 4
}
```

---

## 🔧 Troubleshooting

### If You Don't See Logs:

**1. Check Server is Running**
```bash
curl http://localhost:3000/health
# Should return: {"status":"healthy",...}
```

**2. Check Loki is Reachable**
```bash
curl http://localhost:3100/ready
# Should return: ready
```

**3. Check Log Output**
Look for these messages in server terminal:
```
🔗 Loki endpoint configured: http://localhost:3100/otlp/v1/logs
✅ OpenTelemetry SDK initialized
📝 Logs sending to Loki at: http://localhost:3100/otlp/v1/logs
```

**4. Verify Grafana Connection**
In Grafana → Data sources → Loki:
- Click "Save & test"
- Should say "Data source is working"

### If Loki Connection Fails:
Check Docker services are running:
```bash
docker ps | grep loki
# Should show loki container
```

---

## 📝 5 Log Levels Explained

| Level | Color | When | Example |
|-------|-------|------|---------|
| **DEBUG** 🟢 | Green | Dev info | "Numbers parsed: [2,3,5,6]" |
| **INFO** 🟡 | Yellow | Normal ops | "Addition completed: result=16" |
| **WARN** 🟠 | Orange | Warnings | "Non-integer detected" |
| **ERROR** 🔴 | Red | Failures | "Validation failed" |
| **FATAL** 🟣 | Purple | Critical | "Server crash" |

---

## 🎯 Next Steps

Once logs are flowing in Grafana:

1. **Create a Dashboard**
   - Go to Dashboards → Create new
   - Add a panel for your logs
   - Save and name it

2. **Setup Alerts**
   - Go to Alerting → Alert rules
   - Create rule: Alert when ERROR logs appear
   - Configure notification channel

3. **Correlate with Traces/Metrics**
   - Click a log with traceId
   - Jump to same traceId in Tempo (traces)
   - Jump to Prometheus metrics
   - See complete request context!

---

## ✅ Configuration Summary

| Component | Endpoint | Status |
|-----------|----------|--------|
| Node.js Server | http://localhost:3000 | ✅ Running |
| Loki (Logs) | http://localhost:3100 | ✅ Configured |
| Tempo (Traces) | http://localhost:4317 | ✅ Available |
| Prometheus (Metrics) | http://localhost:9090 | ✅ Available |
| Grafana (Dashboard) | http://localhost:3200 | ✅ Ready |

---

**You're all set!** Your observability stack is complete and ready. 🎉
