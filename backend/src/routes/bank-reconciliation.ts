/**
 * Bank Reconciliation Routes
 *
 * Reconcile bank statements with accounting records
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { errors, APIError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { addAmounts, subtractAmounts } from '../lib/calculations.js';
import { z } from 'zod';

const bankReconciliation = new Hono();

// All routes require authentication
bankReconciliation.use('*', requireAuth);

/**
 * GET /api/bank-reconciliation/accounts
 * Get bank accounts for reconciliation
 */
bankReconciliation.get('/accounts', async (c) => {
  try {
    const user = c.get('user');

    // Get all bank accounts (assets with subtype containing "Bank")
    const { data: accounts, error } = await supabaseAdmin
      .from('chart_of_accounts')
      .select('*')
      .eq('organization_id', user.organizationId)
      .eq('type', 'asset')
      .ilike('subtype', '%bank%')
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (error) {
      throw errors.internal('Failed to fetch bank accounts');
    }

    return c.json({ accounts: accounts || [] });
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (error instanceof APIError) throw error;
    logger.error('Error in GET /api/bank-reconciliation/accounts:', error);
    throw error;
  }
});

/**
 * GET /api/bank-reconciliation/unreconciled
 * Get unreconciled transactions for a bank account
 */
bankReconciliation.get('/unreconciled', async (c) => {
  try {
    const user = c.get('user');
    const accountId = c.req.query('accountId');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    if (!accountId) {
      throw errors.badRequest('Account ID is required');
    }

    // Get journal entries for this account that aren't reconciled
    let query = supabaseAdmin
      .from('journal_entries')
      .select('*')
      .eq('organization_id', user.organizationId)
      .eq('account_id', accountId)
      .or('is_reconciled.is.null,is_reconciled.eq.false')
      .order('date', { ascending: true });

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data: entries, error } = await query;

    if (error) {
      throw errors.internal('Failed to fetch unreconciled entries');
    }

    return c.json({ entries: entries || [] });
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (error instanceof APIError) throw error;
    logger.error('Error in GET /api/bank-reconciliation/unreconciled:', error);
    throw error;
  }
});

/**
 * POST /api/bank-reconciliation/mark-reconciled
 * Mark journal entries as reconciled
 */
bankReconciliation.post('/mark-reconciled', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();

    const schema = z.object({
      entryIds: z.array(z.string().uuid()).min(1),
      reconciledDate: z.string().datetime(),
      statementBalance: z.number(),
    });

    const validated = schema.parse(body);

    // Verify all entries belong to user's organization
    const { data: entries, error: fetchError } = await supabaseAdmin
      .from('journal_entries')
      .select('id, organization_id')
      .in('id', validated.entryIds)
      .eq('organization_id', user.organizationId);

    if (fetchError) {
      throw errors.internal('Failed to fetch entries');
    }

    if (!entries || entries.length !== validated.entryIds.length) {
      throw errors.badRequest('Some entries not found or not accessible');
    }

    // Mark entries as reconciled
    const { error: updateError } = await supabaseAdmin
      .from('journal_entries')
      .update({
        is_reconciled: true,
        reconciled_date: validated.reconciledDate,
        updated_at: new Date().toISOString(),
      })
      .in('id', validated.entryIds);

    if (updateError) {
      throw errors.internal('Failed to mark entries as reconciled');
    }

    logger.info(`Marked ${validated.entryIds.length} entries as reconciled`);
    return c.json({
      message: `Successfully reconciled ${validated.entryIds.length} entries`,
      reconciled_count: validated.entryIds.length,
    });
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (error instanceof APIError) throw error;
    logger.error('Error in POST /api/bank-reconciliation/mark-reconciled:', error);
    throw error;
  }
});

/**
 * GET /api/bank-reconciliation/summary
 * Get reconciliation summary for an account
 */
bankReconciliation.get('/summary', async (c) => {
  try {
    const user = c.get('user');
    const accountId = c.req.query('accountId');
    const asOfDate = c.req.query('asOfDate') || new Date().toISOString().split('T')[0];

    if (!accountId) {
      throw errors.badRequest('Account ID is required');
    }

    // Get all entries for this account up to the date
    const { data: entries, error } = await supabaseAdmin
      .from('journal_entries')
      .select('debit_amount, credit_amount, is_reconciled')
      .eq('organization_id', user.organizationId)
      .eq('account_id', accountId)
      .lte('date', asOfDate);

    if (error) {
      throw errors.internal('Failed to fetch entries');
    }

    const allEntries = entries || [];
    const reconciledEntries = allEntries.filter((e) => e.is_reconciled);
    const unreconciledEntries = allEntries.filter((e) => !e.is_reconciled);

    // Calculate balances
    const calculateBalance = (entries: any[]) => {
      const debits = entries
        .map((e) => parseFloat(e.debit_amount || '0'))
        .filter((amt) => amt > 0);
      const credits = entries
        .map((e) => parseFloat(e.credit_amount || '0'))
        .filter((amt) => amt > 0);

      const totalDebits = debits.length > 0 ? addAmounts(...debits) : 0;
      const totalCredits = credits.length > 0 ? addAmounts(...credits) : 0;

      return subtractAmounts(totalDebits, totalCredits);
    };

    const bookBalance = calculateBalance(allEntries);
    const reconciledBalance = calculateBalance(reconciledEntries);
    const unreconciledBalance = calculateBalance(unreconciledEntries);

    return c.json({
      summary: {
        book_balance: bookBalance.toFixed(2),
        reconciled_balance: reconciledBalance.toFixed(2),
        unreconciled_balance: unreconciledBalance.toFixed(2),
        total_entries: allEntries.length,
        reconciled_count: reconciledEntries.length,
        unreconciled_count: unreconciledEntries.length,
      },
    });
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (error instanceof APIError) throw error;
    logger.error('Error in GET /api/bank-reconciliation/summary:', error);
    throw error;
  }
});

export default bankReconciliation;
