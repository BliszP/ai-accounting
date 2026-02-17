/**
 * Environment Configuration
 *
 * Validates and exports all environment variables
 */

import { z } from 'zod';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

/**
 * Environment variables schema
 */
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),

  // Database
  DATABASE_URL: z.string().url('Invalid DATABASE_URL'),

  // Supabase
  SUPABASE_URL: z.string().url('Invalid SUPABASE_URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_KEY: z.string().min(1, 'SUPABASE_SERVICE_KEY is required'),

  // Anthropic Claude API
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
  CLAUDE_MODEL_HAIKU: z.string().default('claude-haiku-3-5-20241022'),
  CLAUDE_MODEL_SONNET: z.string().default('claude-sonnet-4-20250514'),

  // Redis (for BullMQ)
  REDIS_URL: z.string().url('Invalid REDIS_URL').default('redis://localhost:6379'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Email (SendGrid)
  SENDGRID_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().email().optional(),

  // Monitoring
  SENTRY_DSN: z.string().url().optional(),
  POSTHOG_KEY: z.string().optional(),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // File uploads
  MAX_FILE_SIZE: z.coerce.number().default(10 * 1024 * 1024), // 10MB
  MAX_FILES_PER_UPLOAD: z.coerce.number().default(10),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Cost optimization
  HAIKU_PERCENTAGE: z.coerce.number().min(0).max(100).default(80), // Use Haiku for 80% of documents
});

/**
 * Validate environment variables
 */
function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n');
      console.error('❌ Invalid environment variables:\n', missingVars);
      throw new Error('Environment validation failed');
    }
    throw error;
  }
}

/**
 * Validated environment variables
 */
export const env = validateEnv();

/**
 * Check if we're in production
 */
export const isProduction = env.NODE_ENV === 'production';

/**
 * Check if we're in development
 */
export const isDevelopment = env.NODE_ENV === 'development';

/**
 * Check if we're in test mode
 */
export const isTest = env.NODE_ENV === 'test';

/**
 * Log configuration on startup (hide sensitive values)
 */
export function logConfig() {
  console.log('🔧 Environment Configuration:');
  console.log('  NODE_ENV:', env.NODE_ENV);
  console.log('  PORT:', env.PORT);
  console.log('  SUPABASE_URL:', env.SUPABASE_URL);
  console.log('  REDIS_URL:', env.REDIS_URL);
  console.log('  CORS_ORIGIN:', env.CORS_ORIGIN);
  console.log('  JWT_EXPIRES_IN:', env.JWT_EXPIRES_IN);
  console.log('  MAX_FILE_SIZE:', `${env.MAX_FILE_SIZE / 1024 / 1024}MB`);
  console.log('  HAIKU_PERCENTAGE:', `${env.HAIKU_PERCENTAGE}%`);
  console.log('  Sentry:', env.SENTRY_DSN ? '✅ Enabled' : '❌ Disabled');
  console.log('  PostHog:', env.POSTHOG_KEY ? '✅ Enabled' : '❌ Disabled');
  console.log('  SendGrid:', env.SENDGRID_API_KEY ? '✅ Enabled' : '❌ Disabled');
}
