/**
 * Rate Limiting Middleware
 *
 * Prevents API abuse by limiting request rates
 */

import { Context, Next } from 'hono';
import { env } from '../config/environment.js';

/**
 * In-memory store for rate limiting
 * In production, use Redis for distributed rate limiting
 */
const requestCounts = new Map<string, { count: number; resetAt: number }>();

/**
 * Clean up old entries every minute
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestCounts.entries()) {
    if (value.resetAt < now) {
      requestCounts.delete(key);
    }
  }
}, 60000);

/**
 * Rate limiting configuration
 */
interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (c: Context) => string;
}

/**
 * Create rate limit middleware
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later',
    keyGenerator = (c) => c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
  } = config;

  return async (c: Context, next: Next) => {
    const key = keyGenerator(c);
    const now = Date.now();

    let record = requestCounts.get(key);

    if (!record || record.resetAt < now) {
      // New window or expired window
      record = {
        count: 1,
        resetAt: now + windowMs,
      };
      requestCounts.set(key, record);
      return await next();
    }

    if (record.count >= max) {
      // Rate limit exceeded
      return c.json(
        {
          error: message,
          retryAfter: Math.ceil((record.resetAt - now) / 1000),
        },
        429
      );
    }

    // Increment count
    record.count++;
    return await next();
  };
}

/**
 * General API rate limiter (100 requests per 15 minutes)
 */
export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: 'Too many requests from this IP, please try again later',
});

/**
 * Strict auth rate limiter (100 login attempts per 15 minutes for development)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many login attempts, please try again later',
});

/**
 * Upload rate limiter (10 uploads per minute)
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many upload requests, please try again later',
});
