/**
 * Simple Addition Server with OpenTelemetry Logging
 *
 * Endpoints:
 * - GET /add?numbers=2,3,5,6  -> Returns sum of numbers
 * - GET /health              -> Health check
 *
 * Features:
 * - Automatic trace generation (OTEL)
 * - Structured logging with 5 levels (OTEL Logs)
 * - Automatic metric collection (OTEL)
 */

// IMPORTANT: Initialize OTEL before importing other modules
import './src/instrumentation';

import express, { Request, Response } from 'express';
import * as logger from './src/logger';
import * as appMetrics from './src/metrics';
import { getClientContext } from './src/context';
import { tracer } from './src/tracer';

const app = express();
const PORT = 4000;

/**
 * Add multiple numbers
 * @param numbers - Array of numbers to sum
 * @returns Sum of all numbers
 */
function addNumbers(numbers: number[]): number {
  return numbers.reduce((sum, num) => sum + num, 0);
}

/**
 * GET /add - Add numbers endpoint
 * Query: numbers=2,3,5,6 (comma-separated)
 * Response: {result: number}
 *
 * @example
 * GET http://localhost:3000/add?numbers=2,3,5,6
 * Response: {"result":16}
 */
app.get('/add', (req: Request, res: Response) => {
  const clientCtx = getClientContext(req);
  const startTime = Date.now();
  appMetrics.addRequestsInFlight.add(1);

  try {
    logger.debug('Request received', {
      ...clientCtx,
      'http.status_code': 200,
      'code.filepath': 'server.ts',
      'code.function': 'GET /add',
      'code.lineno': 99,
    }, {
      message: 'Incoming GET /add request',
      query: req.query,
    });

    // Get and parse numbers from query
    const numbersStr = req.query.numbers as string;

    if (!numbersStr) {
      appMetrics.addRequestsInFlight.add(-1);
      appMetrics.addInvalidRequestsTotal.add(1, { reason: 'missing_parameter' });
      appMetrics.addRequestsTotal.add(1, { status: 'invalid' });
      appMetrics.addRequestDurationMs.record(Date.now() - startTime, { status: 'invalid' });
      logger.warn('Missing numbers parameter', {
        ...clientCtx,
        'http.status_code': 400,
        'code.filepath': 'server.ts',
        'code.function': 'GET /add',
        'code.lineno': 112,
      }, {
        message: 'Missing numbers parameter. Use: ?numbers=2,3,5,6',
      });
      return res.status(400).json({
        error: 'Missing numbers parameter. Use: ?numbers=2,3,5,6',
      });
    }

    const numbers = numbersStr
      .split(',')
      .map((n) => parseFloat(n.trim()));

    logger.debug('Numbers parsed', {
      ...clientCtx,
      'http.status_code': 200,
      'code.filepath': 'server.ts',
      'code.function': 'GET /add',
      'code.lineno': 125,
    }, {
      message: 'Input parsed and ready for validation',
      count: numbers.length,
      numbers,
    });

    // Validate numbers
    if (numbers.some((n) => isNaN(n))) {
      appMetrics.addRequestsInFlight.add(-1);
      appMetrics.addInvalidRequestsTotal.add(1, { reason: 'invalid_numbers' });
      appMetrics.addRequestsTotal.add(1, { status: 'invalid' });
      appMetrics.addRequestDurationMs.record(Date.now() - startTime, { status: 'invalid' });
      logger.error('Validation failed - invalid numbers', {
        ...clientCtx,
        'http.status_code': 400,
        'code.filepath': 'server.ts',
        'code.function': 'GET /add',
        'code.lineno': 135,
      }, {
        message: 'One or more values in the numbers parameter are not valid numbers',
        input: numbersStr,
        invalid_count: numbers.filter((n) => isNaN(n)).length,
      });
      return res.status(400).json({
        error: 'Invalid numbers provided',
      });
    }

    // Calculate sum — wrapped in a custom child span visible in Tempo
    const result = tracer.startActiveSpan('add-numbers', (span) => {
      span.setAttribute('input.count', numbers.length);
      const value = addNumbers(numbers);
      span.setAttribute('output.result', value);
      span.end();
      return value;
    });

    const durationMs = Date.now() - startTime;
    appMetrics.addRequestsInFlight.add(-1);
    appMetrics.addRequestsTotal.add(1, { status: 'success' });
    appMetrics.addNumbersPerRequest.record(numbers.length);
    appMetrics.addResultValue.record(result);
    appMetrics.addRequestDurationMs.record(durationMs, { status: 'success' });
    logger.info('Addition request processed', {
      ...clientCtx,
      'http.status_code': 200,
      'code.filepath': 'server.ts',
      'code.function': 'GET /add',
      'code.lineno': 155,
    }, {
      message: 'Addition completed successfully',
      input_count: numbers.length,
      result,
      duration_ms: durationMs,
    });

    res.json({ input: numbers, result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    appMetrics.addRequestsInFlight.add(-1);
    appMetrics.addRequestsTotal.add(1, { status: 'error' });
    appMetrics.addRequestDurationMs.record(Date.now() - startTime, { status: 'error' });
    logger.error('Request failed', {
      ...clientCtx,
      'http.status_code': 500,
      'code.filepath': 'server.ts',
      'code.function': 'GET /add',
      'code.lineno': 172,
    }, {
      message: 'Unhandled exception while processing addition request',
      'error.message': errorMessage,
      'error.stack_trace': errorStack,
      'error.type': error instanceof Error ? error.constructor.name : 'UnknownError',
    });

    res.status(500).json({
      error: 'Internal server error',
    });
  }
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
