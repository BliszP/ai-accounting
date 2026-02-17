/**
 * Error Handler Middleware
 *
 * Global error handling for the API
 */

import { Context } from 'hono';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';
import { isDevelopment } from '../config/environment.js';

/**
 * Custom API Error class
 */
export class APIError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Handle errors and return appropriate response
 */
export async function errorHandler(err: Error, c: Context) {
  // Log error
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
  });

  // Zod validation errors
  if (err instanceof ZodError) {
    return c.json(
      {
        error: 'Validation failed',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
      400
    );
  }

  // Custom API errors
  if (err instanceof APIError) {
    return c.json(
      {
        error: err.message,
        code: err.code,
        ...(err.details && { details: err.details }),
      },
      err.statusCode as 200
    );
  }

  // Database errors
  if (err.message.includes('duplicate key')) {
    return c.json(
      {
        error: 'A record with this value already exists',
      },
      409
    );
  }

  if (err.message.includes('foreign key')) {
    return c.json(
      {
        error: 'Referenced record not found',
      },
      404
    );
  }

  // Generic error
  return c.json(
    {
      error: isDevelopment ? err.message : 'An error occurred',
      ...(isDevelopment && { stack: err.stack }),
    },
    500
  );
}

/**
 * Not Found handler
 */
export function notFoundHandler(c: Context) {
  return c.json(
    {
      error: 'Not found',
      path: c.req.path,
    },
    404
  );
}

/**
 * Helper functions to throw common errors
 */
export const errors = {
  badRequest: (message: string, details?: any) => {
    throw new APIError(400, message, 'BAD_REQUEST', details);
  },

  unauthorized: (message = 'Unauthorized') => {
    throw new APIError(401, message, 'UNAUTHORIZED');
  },

  forbidden: (message = 'Forbidden') => {
    throw new APIError(403, message, 'FORBIDDEN');
  },

  notFound: (message = 'Resource not found') => {
    throw new APIError(404, message, 'NOT_FOUND');
  },

  conflict: (message: string) => {
    throw new APIError(409, message, 'CONFLICT');
  },

  tooManyRequests: (message = 'Too many requests') => {
    throw new APIError(429, message, 'TOO_MANY_REQUESTS');
  },

  internal: (message = 'Internal server error', details?: unknown) => {
    const detailStr = details instanceof Error ? details.message : (details ? String(details) : undefined);
    throw new APIError(500, message, 'INTERNAL_ERROR', detailStr);
  },
};
