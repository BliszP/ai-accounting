/**
 * Health Check Routes
 *
 * Endpoints to verify system health
 */

import { Hono } from 'hono';
import { testConnection } from '../lib/supabase.js';
import { env } from '../config/environment.js';

const health = new Hono();

/**
 * Basic health check
 * GET /api/health
 */
health.get('/', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    version: '1.0.0',
  });
});

/**
 * Database health check
 * GET /api/health/db
 */
health.get('/db', async (c) => {
  try {
    const isConnected = await testConnection();

    if (!isConnected) {
      return c.json(
        {
          status: 'error',
          service: 'database',
          message: 'Database connection failed',
        },
        503
      );
    }

    return c.json({
      status: 'ok',
      service: 'database',
      message: 'Database connection successful',
    });
  } catch (error) {
    return c.json(
      {
        status: 'error',
        service: 'database',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      503
    );
  }
});

/**
 * Detailed health check (all services)
 * GET /api/health/all
 */
health.get('/all', async (c) => {
  const checks = {
    database: false,
    timestamp: new Date().toISOString(),
  };

  // Check database
  try {
    checks.database = await testConnection();
  } catch {
    checks.database = false;
  }

  const allHealthy = checks.database;
  const status = allHealthy ? 'ok' : 'degraded';

  return c.json(
    {
      status,
      checks,
    },
    allHealthy ? 200 : 503
  );
});

export default health;
