/**
 * Authentication Routes
 *
 * Handles user signup, login, and logout
 */

import { Hono } from 'hono';
import * as bcrypt from 'bcrypt';
import { generateToken, requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { signupSchema, loginSchema } from '../lib/validation.js';
import { errors, APIError } from '../middleware/errorHandler.js';

const auth = new Hono();

/**
 * POST /api/auth/signup
 * Register a new user
 */
auth.post('/signup', async (c) => {
  try {
    // Parse and validate request body
    const body = await c.req.json();
    const validated = signupSchema.parse(body);

    const supabase = supabaseAdmin;

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', validated.email)
      .single();

    if (existingUser) {
      return errors.conflict('Email already registered');
    }

    // Check if organization exists (or create one for first user)
    let organizationId = validated.organizationId;

    if (!organizationId) {
      // Create new organization for first user
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: validated.organizationName || `${validated.firstName}'s Accounting Firm`,
          plan: 'growth',
          status: 'active',
        })
        .select('id')
        .single();

      if (orgError || !newOrg) {
        return errors.internal('Failed to create organization', orgError);
      }

      organizationId = newOrg.id;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(validated.password, 12);

    // Create user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        organization_id: organizationId,
        email: validated.email,
        password_hash: passwordHash,
        role: validated.role || 'admin', // First user is admin
        first_name: validated.firstName,
        last_name: validated.lastName,
        email_verified: false,
      })
      .select('id, organization_id, email, role, first_name, last_name')
      .single();

    if (userError || !user) {
      return errors.internal('Failed to create user', userError);
    }

    // Generate JWT token
    const token = generateToken({
      sub: user.id,
      organization_id: user.organization_id,
      email: user.email,
      role: user.role,
    });

    return c.json({
      success: true,
      message: 'User created successfully',
      data: {
        user: {
          id: user.id,
          organizationId: user.organization_id,
          email: user.email,
          role: user.role,
          firstName: user.first_name,
          lastName: user.last_name,
        },
        token,
      },
    }, 201);
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (error instanceof Error && error.name === 'ZodError') {
      return errors.badRequest('Invalid input', error);
    }
    return errors.internal('Signup failed', error);
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
auth.post('/login', async (c) => {
  try {
    // Parse and validate request body
    const body = await c.req.json();
    const validated = loginSchema.parse(body);

    const supabase = supabaseAdmin;

    // Find user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, organization_id, email, password_hash, role, first_name, last_name')
      .eq('email', validated.email)
      .single();

    if (userError || !user) {
      return errors.unauthorized('Invalid email or password');
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(validated.password, user.password_hash);

    if (!passwordMatch) {
      return errors.unauthorized('Invalid email or password');
    }

    // Check organization status
    const { data: org } = await supabase
      .from('organizations')
      .select('status')
      .eq('id', user.organization_id)
      .single();

    if (org?.status !== 'active') {
      return errors.forbidden('Organization is suspended or cancelled');
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    // Generate JWT token
    const token = generateToken({
      sub: user.id,
      organization_id: user.organization_id,
      email: user.email,
      role: user.role,
    });

    return c.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          organizationId: user.organization_id,
          email: user.email,
          role: user.role,
          firstName: user.first_name,
          lastName: user.last_name,
        },
        token,
      },
    });
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (error instanceof Error && error.name === 'ZodError') {
      return errors.badRequest('Invalid input', error);
    }
    return errors.internal('Login failed', error);
  }
});

/**
 * POST /api/auth/logout
 * Logout user (client-side token removal)
 */
auth.post('/logout', async (c) => {
  // With JWT, logout is primarily client-side (remove token)
  // But we can add token blacklisting here if needed in the future
  return c.json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
auth.get('/me', requireAuth, async (c) => {
  try {
    const user = c.get('user');

    if (!user) {
      return errors.unauthorized('Not authenticated');
    }

    const supabase = supabaseAdmin;

    // Get full user details
    const { data: userData, error } = await supabase
      .from('users')
      .select('id, organization_id, email, role, first_name, last_name, email_verified, last_login_at, created_at')
      .eq('id', user.userId)
      .single();

    if (error || !userData) {
      return errors.notFound('User not found');
    }

    return c.json({
      success: true,
      data: {
        user: {
          id: userData.id,
          organizationId: userData.organization_id,
          email: userData.email,
          role: userData.role,
          firstName: userData.first_name,
          lastName: userData.last_name,
          emailVerified: userData.email_verified,
          lastLoginAt: userData.last_login_at,
          createdAt: userData.created_at,
        },
      },
    });
  } catch (error) {
    if (error instanceof APIError) throw error;
    return errors.internal('Failed to get user', error);
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
auth.put('/profile', requireAuth, async (c) => {
  try {
    const user = c.get('user');

    if (!user) {
      return errors.unauthorized('Not authenticated');
    }

    const body = await c.req.json();
    const { firstName, lastName, email } = body;

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return errors.badRequest('First name, last name, and email are required');
    }

    const supabase = supabaseAdmin;

    // Check if email is being changed and if it's already taken
    if (email !== user.email) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .neq('id', user.userId)
        .single();

      if (existingUser) {
        return errors.conflict('Email already in use by another user');
      }
    }

    // Update user
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        first_name: firstName,
        last_name: lastName,
        email: email,
      })
      .eq('id', user.userId)
      .select('id, organization_id, email, role, first_name, last_name')
      .single();

    if (error || !updatedUser) {
      return errors.internal('Failed to update profile', error);
    }

    return c.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: updatedUser.id,
          organizationId: updatedUser.organization_id,
          email: updatedUser.email,
          role: updatedUser.role,
          firstName: updatedUser.first_name,
          lastName: updatedUser.last_name,
        },
      },
    });
  } catch (error) {
    if (error instanceof APIError) throw error;
    return errors.internal('Failed to update profile', error);
  }
});

/**
 * PUT /api/auth/change-password
 * Change user password
 */
auth.put('/change-password', requireAuth, async (c) => {
  try {
    const user = c.get('user');

    if (!user) {
      return errors.unauthorized('Not authenticated');
    }

    const body = await c.req.json();
    const { currentPassword, newPassword } = body;

    // Validate required fields
    if (!currentPassword || !newPassword) {
      return errors.badRequest('Current password and new password are required');
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return errors.badRequest('New password must be at least 8 characters long');
    }

    const supabase = supabaseAdmin;

    // Get current user with password hash
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, password_hash')
      .eq('id', user.userId)
      .single();

    if (userError || !userData) {
      return errors.notFound('User not found');
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, userData.password_hash);

    if (!passwordMatch) {
      return errors.unauthorized('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: newPasswordHash })
      .eq('id', user.userId);

    if (updateError) {
      return errors.internal('Failed to update password', updateError);
    }

    return c.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    if (error instanceof APIError) throw error;
    return errors.internal('Failed to change password', error);
  }
});

export default auth;
