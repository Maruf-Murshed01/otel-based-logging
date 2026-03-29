/**
 * Logger — OTLP path via Grafana Alloy
 *
 * Emits structured log records through the OTEL Logs API.
 * The global LoggerProvider (set in instrumentation.ts) batches
 * and forwards them to Grafana Alloy via OTLP HTTP.
 *
 * Levels: DEBUG | INFO | WARN | ERROR | FATAL
 *
 * Signature:
 *   logger.info(message, attributes?, body?)
 *   - attributes: searchable fields in Loki (labels, code location, HTTP context)
 *   - body: structured content (error details, response sizes, task data)
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
  attributes: Record<string, unknown> = {},
  body: Record<string, unknown> = {}
): void {
  const { number, text } = LEVELS[level];

  // Only print to stdout if this level passes the filter
  if (number < LOG_LEVEL_FILTER) return;

  console.log(`[${new Date().toISOString()}] ${text} ${message}`, { ...attributes, ...body });

  // Trace correlation
  const spanCtx = trace.getActiveSpan()?.spanContext();

  otelLogger.emit({
    severityNumber: number,
    severityText: text,
    // body is a structured object: message + any body fields (errors, sizes, task data)
    body: Object.keys(body).length > 0 ? { message, ...body } : message,
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

export const debug = (msg: string, attrs?: Record<string, unknown>, body?: Record<string, unknown>) => emit('DEBUG', msg, attrs, body);
export const info  = (msg: string, attrs?: Record<string, unknown>, body?: Record<string, unknown>) => emit('INFO',  msg, attrs, body);
export const warn  = (msg: string, attrs?: Record<string, unknown>, body?: Record<string, unknown>) => emit('WARN',  msg, attrs, body);
export const error = (msg: string, attrs?: Record<string, unknown>, body?: Record<string, unknown>) => emit('ERROR', msg, attrs, body);
export const fatal = (msg: string, attrs?: Record<string, unknown>, body?: Record<string, unknown>) => emit('FATAL', msg, attrs, body);

export const logger = { debug, info, warn, error, fatal };
