/**
 * AI Accounting Backend - Main Server
 *
 * Hono-based API server with authentication, rate limiting, and error handling
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { env, logConfig } from './config/environment.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import passwordResetRoutes from './routes/password-reset.js';
import clientRoutes from './routes/clients.js';
import documentRoutes from './routes/documents.js';
import transactionRoutes from './routes/transactions.js';
import accountsRoutes from './routes/accounts.js';
import journalEntriesRoutes from './routes/journal-entries.js';
import reportsRoutes from './routes/reports.js';
import bankReconciliationRoutes from './routes/bank-reconciliation.js';
import { startDocumentProcessor } from './workers/documentProcessor.js';

/**
 * Create Hono app
 */
const app = new Hono();

/**
 * Global middleware
 */

// CORS - allow configured origin plus both common Vite dev ports
const allowedOrigins = [
  env.CORS_ORIGIN,
  'http://localhost:5173',
  'http://localhost:5174',
];
app.use(
  '*',
  cors({
    origin: (origin) => (allowedOrigins.includes(origin) ? origin : allowedOrigins[0]),
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

// Request logging
app.use('*', honoLogger());

// Rate limiting (apply to all API routes except health checks)
app.use('/api/*', async (c, next) => {
  if (c.req.path.startsWith('/api/health')) {
    return await next();
  }
  return await apiLimiter(c, next);
});

/**
 * Routes
 */

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'AI Accounting API',
    version: '1.0.0',
    environment: env.NODE_ENV,
    status: 'running',
  });
});

// Health checks
app.route('/api/health', healthRoutes);

// Authentication
app.route('/api/auth', authRoutes);

// Password Reset
app.route('/api/auth', passwordResetRoutes);

// Clients
app.route('/api/clients', clientRoutes);

// Documents
app.route('/api/documents', documentRoutes);

// Transactions
app.route('/api/transactions', transactionRoutes);

// Chart of Accounts
app.route('/api/accounts', accountsRoutes);

// Journal Entries
app.route('/api/journal-entries', journalEntriesRoutes);

// Financial Reports
app.route('/api/reports', reportsRoutes);

// Bank Reconciliation
app.route('/api/bank-reconciliation', bankReconciliationRoutes);

// TODO: Add more routes here as they are implemented
// app.route('/api/exports', exportRoutes);

/**
 * Error handling
 */

// 404 handler
app.notFound(notFoundHandler);

// Global error handler
app.onError(errorHandler);

/**
 * Start server
 */
async function startServer() {
  try {
    // Log configuration
    logConfig();

    // Test database connection
    logger.info('Testing database connection...');
    const { testConnection } = await import('./lib/supabase.js');
    const dbConnected = await testConnection();

    if (!dbConnected) {
      logger.error('❌ Database connection failed');
      logger.warn('⚠️  Server will start but database operations will fail');
    } else {
      logger.info('✅ Database connection successful');
    }

    // Start server
    const port = env.PORT;
    logger.info(`🚀 Starting server on port ${port}...`);

    serve({
      fetch: app.fetch,
      port,
    });

    logger.info(`✅ Server running on http://localhost:${port}`);
    logger.info(`📚 API documentation: http://localhost:${port}/api/health`);
    logger.info(`🔥 Environment: ${env.NODE_ENV}`);

    // Start document processor
    logger.info('🤖 Starting AI document processor...');
    startDocumentProcessor(30000); // Poll every 30 seconds
    logger.info('✅ AI document processor started');
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server
startServer();

// Export app for testing
export default app;


