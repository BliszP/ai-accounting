/**
 * Password Reset Routes
 *
 * Handle password reset requests and token verification
 */

import { Hono } from 'hono';
import * as bcrypt from 'bcrypt';
import crypto from 'crypto';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../lib/logger';

const app = new Hono();

/**
 * Request password reset
 * POST /api/auth/forgot-password
 */
app.post('/forgot-password', async (c) => {
  try {
    const { email } = await c.req.json();

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    // Find user by email
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, first_name')
      .eq('email', email.toLowerCase())
      .single();

    // Don't reveal if user exists or not (security best practice)
    if (userError || !user) {
      logger.info(`Password reset requested for non-existent email: ${email}`);
      return c.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

    // Store reset token in users table
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        reset_token: resetTokenHash,
        reset_token_expires: expiresAt.toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      logger.error('Failed to store reset token:', updateError);
      return c.json({ error: 'Failed to process password reset request' }, 500);
    }

    // Create reset link
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5175'}/reset-password?token=${resetToken}`;

    // Log the reset link for development (remove in production)
    logger.info(`Password reset link for ${email}:\n${resetLink}`);

    // TODO: Send email with reset link
    // For now, we'll just log it. In production, integrate with SendGrid, Mailgun, etc.
    console.log('\n=================================');
    console.log('PASSWORD RESET LINK:');
    console.log(resetLink);
    console.log('=================================\n');

    return c.json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.',
      // In development, return the link
      ...(process.env.NODE_ENV === 'development' && { resetLink })
    });

  } catch (error: any) {
    logger.error('Error in forgot-password:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Verify reset token
 * POST /api/auth/verify-reset-token
 */
app.post('/verify-reset-token', async (c) => {
  try {
    const { token } = await c.req.json();

    if (!token) {
      return c.json({ error: 'Reset token is required' }, 400);
    }

    // Hash the token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with this token
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, reset_token_expires')
      .eq('reset_token', tokenHash)
      .single();

    if (error || !user) {
      return c.json({ error: 'Invalid or expired reset token' }, 400);
    }

    // Check if token has expired
    if (new Date() > new Date(user.reset_token_expires)) {
      return c.json({ error: 'Reset token has expired' }, 400);
    }

    return c.json({
      success: true,
      email: user.email
    });

  } catch (error: any) {
    logger.error('Error in verify-reset-token:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Reset password with token
 * POST /api/auth/reset-password
 */
app.post('/reset-password', async (c) => {
  try {
    const { token, password } = await c.req.json();

    if (!token || !password) {
      return c.json({ error: 'Token and password are required' }, 400);
    }

    // Validate password strength
    if (password.length < 8) {
      return c.json({ error: 'Password must be at least 8 characters long' }, 400);
    }

    // Hash the token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with this token
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, reset_token_expires')
      .eq('reset_token', tokenHash)
      .single();

    if (error || !user) {
      return c.json({ error: 'Invalid or expired reset token' }, 400);
    }

    // Check if token has expired
    if (new Date() > new Date(user.reset_token_expires)) {
      return c.json({ error: 'Reset token has expired' }, 400);
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update password and clear reset token
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        password_hash: passwordHash,
        reset_token: null,
        reset_token_expires: null,
      })
      .eq('id', user.id);

    if (updateError) {
      logger.error('Failed to update password:', updateError);
      return c.json({ error: 'Failed to reset password' }, 500);
    }

    logger.info(`Password reset successful for user: ${user.email}`);

    return c.json({
      success: true,
      message: 'Password has been reset successfully'
    });

  } catch (error: any) {
    logger.error('Error in reset-password:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;
