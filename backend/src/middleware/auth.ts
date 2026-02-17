/**
 * Authentication Middleware
 *
 * JWT-based authentication
 */

import { Context, Next } from 'hono';
import { createRequire } from 'module';
import type { SignOptions } from 'jsonwebtoken';
import { env } from '../config/environment.js';

const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken');
import { errors } from './errorHandler.js';

/**
 * JWT Payload interface
 */
export interface JWTPayload {
  sub: string; // user_id
  organization_id: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * User context (attached to request)
 */
export interface UserContext {
  userId: string;
  organizationId: string;
  email: string;
  role: string;
}

/**
 * Extend Hono context with user
 */
declare module 'hono' {
  interface ContextVariableMap {
    user: UserContext;
  }
}

/**
 * Extract token from Authorization header
 */
function extractToken(c: Context): string | null {
  const authHeader = c.req.header('Authorization');

  if (!authHeader) {
    return null;
  }

  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.substring(7);
}

/**
 * Verify JWT token
 */
function verifyToken(token: string): JWTPayload {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw new Error('Authentication failed');
  }
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user context to request
 */
export async function requireAuth(c: Context, next: Next) {
  const token = extractToken(c);

  if (!token) {
    return errors.unauthorized('No token provided');
  }

  try {
    const payload = verifyToken(token);

    // Attach user to context
    c.set('user', {
      userId: payload.sub,
      organizationId: payload.organization_id,
      email: payload.email,
      role: payload.role,
    });

    return await next();
  } catch (error) {
    return errors.unauthorized(error instanceof Error ? error.message : 'Authentication failed');
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');

    if (!user) {
      errors.unauthorized('Not authenticated');
    }

    if (!roles.includes(user.role)) {
      errors.forbidden(`Access denied. Required roles: ${roles.join(', ')}`);
    }

    await next();
  };
}

/**
 * Generate JWT token
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as SignOptions);
}

/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token: string | null): JWTPayload | null {
  if (!token) return null;
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}
