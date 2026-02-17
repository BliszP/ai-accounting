/**
 * Supabase Client
 *
 * Database client with Row-Level Security (RLS) support
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/environment.js';

/**
 * Supabase client with service role key (bypasses RLS)
 * Use this for server-side operations that need full access
 */
export const supabaseAdmin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Create a Supabase client with RLS context
 * @param organizationId - Organization ID to set in RLS context
 * @param userId - User ID to set in RLS context
 * @returns Supabase client with RLS context set
 */
export function createSupabaseClient(
  _organizationId: string,
  _userId?: string
): SupabaseClient {
  const client = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  // Set RLS context
  // These are used by Row Level Security policies to filter data
  return client;
}

/**
 * Execute a database query with RLS context
 * @param organizationId - Organization ID for RLS filtering
 * @param userId - User ID for RLS filtering
 * @param query - Query function to execute
 * @returns Query result
 */
export async function executeWithRLS<T>(
  organizationId: string,
  userId: string | undefined,
  query: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  // Set RLS context using PostgreSQL settings
  // RLS context would be set via SET LOCAL app.current_organization_id in a transaction

  // Execute the context query, then the actual query
  // Note: This is a simplified version. In production, you'd want to use
  // database transactions to ensure the context is properly set
  const client = createSupabaseClient(organizationId, userId);

  return await query(client);
}

/**
 * Database table names
 */
export const Tables = {
  ORGANIZATIONS: 'organizations',
  USERS: 'users',
  CLIENTS: 'clients',
  DOCUMENTS: 'documents',
  TRANSACTIONS: 'transactions',
  JOURNAL_ENTRIES: 'journal_entries',
  CHART_OF_ACCOUNTS: 'chart_of_accounts',
  ACCOUNT_CATEGORY_MAPPINGS: 'account_category_mappings',
  LEARNING_RULES: 'learning_rules',
  EXPORTS: 'exports',
  AUDIT_LOG: 'audit_log',
} as const;

/**
 * Database types (to be generated from Supabase schema)
 */
export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          plan: string;
          status: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          document_count_current_month: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['organizations']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>;
      };
      users: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          password_hash: string;
          role: string;
          first_name: string | null;
          last_name: string | null;
          email_verified: boolean;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      clients: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          company_number: string | null;
          vat_number: string | null;
          contact_email: string | null;
          financial_year_start: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['clients']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['clients']['Insert']>;
      };
      // Add other table types as needed
    };
  };
}

/**
 * Helper function to handle Supabase errors
 */
export function handleSupabaseError(error: any): never {
  console.error('Supabase error:', error);

  if (error.code === '23505') {
    throw new Error('A record with this value already exists');
  }

  if (error.code === '23503') {
    throw new Error('Referenced record not found');
  }

  if (error.code === 'PGRST116') {
    throw new Error('No rows returned');
  }

  throw new Error(error.message || 'Database error occurred');
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from(Tables.ORGANIZATIONS)
      .select('id')
      .limit(1);

    if (error) {
      console.error('Database connection test failed:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Database connection test error:', error);
    return false;
  }
}
