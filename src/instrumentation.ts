/**
 * OpenTelemetry Instrumentation Setup
 *
 * Initializes NodeSDK with:
 * - Traces  → ConsoleSpanExporter
 * - Metrics → ConsoleMetricExporter
 * - Logs    → OTLPLogExporter → Grafana Alloy (port 4311) → Loki
 *
 * Must be imported BEFORE application code loads.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { hostname } from 'os';

// Alloy OTLP HTTP endpoint — logs go here, Alloy routes them to Loki
const alloyEndpoint =
  process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT || 'http://localhost:4311/v1/logs';

const serviceName = process.env.SERVICE_NAME || 'add-server';

console.log(`🔗 OTLP logs endpoint (Alloy): ${alloyEndpoint}`);
console.log(`🏷️  Service name: ${serviceName}`);

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]:   serviceName,
    'service.version':     process.env.SERVICE_VERSION    || '1.0.0',
    'service.environment': process.env.NODE_ENV           || 'development',
    'service.type':        'nodejs',
    'service.deployment':  process.env.SERVICE_DEPLOYMENT || 'local',
    'service.instance.id': `${serviceName}-instance-${hostname()}`,
  }),
  traceExporter: new ConsoleSpanExporter(),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new ConsoleMetricExporter(),
  }),
  logRecordProcessors: [
    new BatchLogRecordProcessor(new OTLPLogExporter({ url: alloyEndpoint })),
  ],
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
console.log('✅ OpenTelemetry SDK initialized — logs → Alloy → Loki');

async function shutdown() {
  await sdk.shutdown();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { sdk };
