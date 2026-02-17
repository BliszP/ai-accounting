/**
 * Chart of Accounts Routes
 *
 * Manages the chart of accounts for organizations
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { errors, APIError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { DEFAULT_CHART_OF_ACCOUNTS, isValidAccountCode } from '../lib/chartOfAccounts.js';

const accounts = new Hono();

// All routes require authentication
accounts.use('*', requireAuth);

/**
 * GET /api/accounts
 * Get all accounts for the organization
 */
accounts.get('/', async (c) => {
  try {
    const user = c.get('user');

    const { data, error } = await supabaseAdmin
      .from('chart_of_accounts')
      .select('*')
      .eq('organization_id', user.organizationId)
      .order('code', { ascending: true });

    if (error) {
      logger.error('Failed to fetch accounts:', error);
      throw errors.internal('Failed to fetch accounts');
    }

    return c.json({ accounts: data || [] });
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (error instanceof APIError) throw error;
    logger.error('Error in GET /api/accounts:', error);
    throw error;
  }
});

/**
 * POST /api/accounts/initialize
 * Initialize default chart of accounts for new organization
 */
accounts.post('/initialize', async (c) => {
  try {
    const user = c.get('user');

    // Check if accounts already exist
    const { data: existing } = await supabaseAdmin
      .from('chart_of_accounts')
      .select('id')
      .eq('organization_id', user.organizationId)
      .limit(1);

    if (existing && existing.length > 0) {
      return c.json({ message: 'Chart of accounts already initialized', count: 0 });
    }

    // Insert default accounts
    const accountsToInsert = DEFAULT_CHART_OF_ACCOUNTS.map(acc => ({
      organization_id: user.organizationId,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      subtype: acc.subtype,
      normal_balance: acc.normalBalance,
      is_active: true,
    }));

    const { data, error } = await supabaseAdmin
      .from('chart_of_accounts')
      .insert(accountsToInsert)
      .select();

    if (error) {
      logger.error('Failed to initialize accounts:', error);
      throw errors.internal('Failed to initialize chart of accounts');
    }

    logger.info(`Initialized ${data.length} accounts for organization ${user.organizationId}`);
    return c.json({ message: 'Chart of accounts initialized successfully', count: data.length });
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (error instanceof APIError) throw error;
    logger.error('Error in POST /api/accounts/initialize:', error);
    throw error;
  }
});

/**
 * POST /api/accounts
 * Create a new account
 */
accounts.post('/', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();

    const { code, name, type, subtype, normalBalance } = body;

    // Validate required fields
    if (!code || !name || !type || !normalBalance) {
      throw errors.badRequest('Code, name, type, and normal balance are required');
    }

    // Validate account code format
    if (!isValidAccountCode(code)) {
      throw errors.badRequest('Account code must be 4 digits');
    }

    // Check if code already exists
    const { data: existing } = await supabaseAdmin
      .from('chart_of_accounts')
      .select('id')
      .eq('organization_id', user.organizationId)
      .eq('code', code)
      .single();

    if (existing) {
      throw errors.conflict('Account code already exists');
    }

    // Insert account
    const { data, error } = await supabaseAdmin
      .from('chart_of_accounts')
      .insert({
        organization_id: user.organizationId,
        code,
        name,
        type,
        subtype: subtype || type,
        normal_balance: normalBalance,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create account:', error);
      throw errors.internal('Failed to create account');
    }

    logger.info(`Created account ${code} - ${name}`);
    return c.json({ account: data }, 201);
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (error instanceof APIError) throw error;
    logger.error('Error in POST /api/accounts:', error);
    throw error;
  }
});

/**
 * PUT /api/accounts/:id
 * Update an account
 */
accounts.put('/:id', async (c) => {
  try {
    const user = c.get('user');
    const accountId = c.req.param('id');
    const body = await c.req.json();

    // Check if account exists and belongs to organization
    const { data: existing } = await supabaseAdmin
      .from('chart_of_accounts')
      .select('id')
      .eq('id', accountId)
      .eq('organization_id', user.organizationId)
      .single();

    if (!existing) {
      throw errors.notFound('Account not found');
    }

    const updateData: any = {};

    if (body.name) updateData.name = body.name;
    if (body.subtype) updateData.subtype = body.subtype;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;

    const { data, error } = await supabaseAdmin
      .from('chart_of_accounts')
      .update(updateData)
      .eq('id', accountId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update account:', error);
      throw errors.internal('Failed to update account');
    }

    logger.info(`Updated account ${accountId}`);
    return c.json({ account: data });
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (error instanceof APIError) throw error;
    logger.error('Error in PUT /api/accounts/:id:', error);
    throw error;
  }
});

/**
 * GET /api/accounts/balances
 * Get account balances (for trial balance)
 */
accounts.get('/balances', async (c) => {
  try {
    const user = c.get('user');
    const asOfDate = c.req.query('asOfDate') || new Date().toISOString().split('T')[0];

    // Get all accounts
    const { data: accountsData, error: accountsError } = await supabaseAdmin
      .from('chart_of_accounts')
      .select('*')
      .eq('organization_id', user.organizationId)
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (accountsError) {
      throw errors.internal('Failed to fetch accounts');
    }

    // Get journal entries up to asOfDate
    const { data: entriesData, error: entriesError } = await supabaseAdmin
      .from('journal_entries')
      .select('account_id, debit_amount, credit_amount')
      .eq('organization_id', user.organizationId)
      .lte('date', asOfDate);

    if (entriesError) {
      throw errors.internal('Failed to fetch journal entries');
    }

    // Calculate balances
    const balances = accountsData?.map(account => {
      const entries = entriesData?.filter(e => e.account_id === account.id) || [];

      let balance = 0;
      entries.forEach(entry => {
        const debit = parseFloat(entry.debit_amount || '0');
        const credit = parseFloat(entry.credit_amount || '0');

        if (account.normal_balance === 'debit') {
          balance += debit - credit;
        } else {
          balance += credit - debit;
        }
      });

      return {
        ...account,
        balance: balance.toFixed(2),
        debit_balance: balance > 0 && account.normal_balance === 'debit' ? balance.toFixed(2) : '0.00',
        credit_balance: balance > 0 && account.normal_balance === 'credit' ? balance.toFixed(2) : '0.00',
      };
    }) || [];

    return c.json({ balances, asOfDate });
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (error instanceof APIError) throw error;
    logger.error('Error in GET /api/accounts/balances:', error);
    throw error;
  }
});

export default accounts;
