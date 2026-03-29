/**
 * Logger — OTLP path via Grafana Alloy
 *
 * Emits structured log records through the OTEL Logs API.
 * The global LoggerProvider (set in instrumentation.ts) batches
 * and forwards them to Grafana Alloy via OTLP HTTP.
 *
 * Levels: DEBUG | INFO | WARN | ERROR | FATAL
 */

import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { trace } from '@opentelemetry/api';

const LEVELS = {
  DEBUG: { number: SeverityNumber.DEBUG, text: 'DEBUG' },
  INFO:  { number: SeverityNumber.INFO,  text: 'INFO'  },
  WARN:  { number: SeverityNumber.WARN,  text: 'WARN'  },
  ERROR: { number: SeverityNumber.ERROR, text: 'ERROR' },
  FATAL: { number: SeverityNumber.FATAL, text: 'FATAL' },
};

// Minimum level to emit. Override with LOG_LEVEL env var (e.g. "warn")
const LOG_LEVEL_FILTER: number =
  SeverityNumber[process.env.LOG_LEVEL?.toUpperCase() as keyof typeof SeverityNumber] ??
  SeverityNumber.INFO;

const otelLogger = logs.getLogger('add-server', '1.0.0');

function emit(
  level: keyof typeof LEVELS,
  message: string,
  attributes: Record<string, unknown> = {}
): void {
  const { number, text } = LEVELS[level];

  // Always write to stdout (visible in terminal / container logs)
  console.log(`[${new Date().toISOString()}] ${text} ${message}`, attributes);

  if (number < LOG_LEVEL_FILTER) return;

  // Trace correlation
  const spanCtx = trace.getActiveSpan()?.spanContext();

  otelLogger.emit({
    severityNumber: number,
    severityText: text,
    body: message,
    attributes: {
      ...attributes,
      'service.name': process.env.SERVICE_NAME || 'add-server',
      'log.type': 'application-logs',
      ...(spanCtx && {
        'trace.id': spanCtx.traceId,
        'span.id': spanCtx.spanId,
      }),
    },
  });
}

export const debug = (msg: string, attrs?: Record<string, unknown>) => emit('DEBUG', msg, attrs);
export const info  = (msg: string, attrs?: Record<string, unknown>) => emit('INFO',  msg, attrs);
export const warn  = (msg: string, attrs?: Record<string, unknown>) => emit('WARN',  msg, attrs);
export const error = (msg: string, attrs?: Record<string, unknown>) => emit('ERROR', msg, attrs);
export const fatal = (msg: string, attrs?: Record<string, unknown>) => emit('FATAL', msg, attrs);

export const logger = { debug, info, warn, error, fatal };
