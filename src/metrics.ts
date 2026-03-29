/**
 * Custom Application Metrics
 *
 * All business-level metrics for the add-server.
 * Transport: OTLP → Grafana Alloy → Prometheus
 *
 * Naming convention: {service}_{metric}_{unit}
 * Follows Prometheus naming standards.
 */

import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('add-server', '1.0.0');

// ─── Counters ────────────────────────────────────────────────────────────────

/** Total addition requests — labelled by status (success | error | invalid) */
export const addRequestsTotal = meter.createCounter('add_requests_total', {
  description: 'Total number of addition requests received',
});

/** Total requests that failed input validation */
export const addInvalidRequestsTotal = meter.createCounter('add_invalid_requests_total', {
  description: 'Total number of requests rejected due to invalid or missing input',
});

// ─── Histograms ───────────────────────────────────────────────────────────────

/** How many numbers were passed per request (e.g. ?numbers=1,2,3 → count=3) */
export const addNumbersPerRequest = meter.createHistogram('add_numbers_per_request', {
  description: 'Distribution of how many numbers are passed per addition request',
  advice: {
    // Buckets tuned for input count (1 number up to 100+)
    explicitBucketBoundaries: [1, 2, 3, 5, 10, 20, 50, 100],
  },
});

/** Distribution of the computed result values */
export const addResultValue = meter.createHistogram('add_result_value', {
  description: 'Distribution of the computed addition result values',
  advice: {
    // Buckets tuned for numeric results, not latency
    explicitBucketBoundaries: [0, 10, 50, 100, 500, 1000, 5000, 10000, 50000],
  },
});

/** End-to-end request processing time in milliseconds */
export const addRequestDurationMs = meter.createHistogram('add_request_duration_ms', {
  description: 'Duration of addition requests from receipt to response in milliseconds',
  advice: {
    // Buckets tuned for fast in-process computation (sub-ms to a few ms expected)
    explicitBucketBoundaries: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  },
});

// ─── UpDownCounter ────────────────────────────────────────────────────────────

/** Requests currently being processed (+1 on start, -1 on finish) */
export const addRequestsInFlight = meter.createUpDownCounter('add_requests_in_flight', {
  description: 'Number of addition requests currently being processed',
});
