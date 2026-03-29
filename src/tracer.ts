/**
 * Tracer — Custom Span Helper
 *
 * Use this when you want to wrap a specific function in its own
 * child span to see it separately in Tempo, alongside the automatic
 * HTTP span that Express already generates.
 *
 * The auto-instrumentation in instrumentation.ts handles all HTTP
 * request tracing automatically — you only need this file when you
 * want to trace a specific piece of business logic.
 *
 * Usage:
 *   import { tracer } from './src/tracer';
 *
 *   const result = await tracer.startActiveSpan('my-operation', (span) => {
 *     span.setAttribute('key', 'value');
 *     const value = doSomething();
 *     span.end();
 *     return value;
 *   });
 */

import { trace } from '@opentelemetry/api';

export const tracer = trace.getTracer('add-server', '1.0.0');
