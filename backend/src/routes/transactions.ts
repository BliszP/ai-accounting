/**
 * Transaction Routes
 *
 * Handles transaction listing, review, and approval
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { transactionUpdateSchema, bulkApproveSchema } from '../lib/validation.js';
import { errors, APIError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { calculateVAT, roundAmount, addAmounts, subtractAmounts } from '../lib/calculations.js';

const transactions = new Hono();

// All routes require authentication
transactions.use('*', requireAuth);

/**
 * GET /api/transactions
 * Get all transactions for the authenticated user's organization
 */
transactions.get('/', async (c) => {
  try {
    const user = c.get('user');
    const clientId = c.req.query('clientId');
    const status = c.req.query('status');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    let query = supabaseAdmin
      .from('transactions')
      .select(`
        *,
        clients!inner(
          id,
          name,
          organization_id
        ),
        documents!inner(
          id,
          file_name
        )
      `)
      .eq('clients.organization_id', user.organizationId)
      .order('date', { ascending: false });

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to fetch transactions:', error);
      throw errors.internal('Failed to fetch transactions');
    }

    return c.json({ transactions: data || [] });
  } catch (error) {
    if (error instanceof APIError) throw error;
    logger.error('Error in GET /api/transactions:', error);
    throw error;
  }
});

/**
 * GET /api/transactions/:id
 * Get a specific transaction by ID
 */
transactions.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    const transactionId = c.req.param('id');

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select(`
        *,
        clients!inner(
          id,
          name,
          organization_id
        ),
        documents(
          id,
          file_name,
          storage_path
        )
      `)
      .eq('id', transactionId)
      .eq('clients.organization_id', user.organizationId)
      .single();

    if (error || !data) {
      logger.error('Transaction not found:', error);
      throw errors.notFound('Transaction not found');
    }

    return c.json({ transaction: data });
  } catch (error) {
    if (error instanceof APIError) throw error;
    logger.error('Error in GET /api/transactions/:id:', error);
    throw error;
  }
});

/**
 * PUT /api/transactions/:id
 * Update a transaction (for review/approval)
 */
transactions.put('/:id', async (c) => {
  try {
    const user = c.get('user');
    const transactionId = c.req.param('id');
    const body = await c.req.json();

    // Validate input
    const validated = transactionUpdateSchema.parse(body);

    // Check if transaction exists and belongs to organization
    const { data: existing } = await supabaseAdmin
      .from('transactions')
      .select(`
        id,
        clients!inner(
          organization_id
        )
      `)
      .eq('id', transactionId)
      .eq('clients.organization_id', user.organizationId)
      .single();

    if (!existing) {
      throw errors.notFound('Transaction not found');
    }

    // Update transaction
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (validated.status) {
      updateData.status = validated.status;
      if (validated.status === 'approved') {
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by = user.userId;
      }
    }

    // Update editable fields
    if (validated.merchant !== undefined) {
      updateData.merchant = validated.merchant;
    }

    if (validated.description !== undefined) {
      updateData.description = validated.description;
    }

    if (validated.amount !== undefined) {
      updateData.amount = roundAmount(validated.amount).toString();
    }

    if (validated.category !== undefined) {
      updateData.category = validated.category;
    }

    if (validated.matchedTransactionId !== undefined) {
      updateData.matched_transaction_id = validated.matchedTransactionId;
    }

    if (validated.reviewNotes !== undefined) {
      updateData.review_notes = validated.reviewNotes;
    }

    if (validated.vatAmount !== undefined) {
      updateData.vat_amount = validated.vatAmount ? roundAmount(validated.vatAmount).toString() : null;
    }

    if (validated.vatRate !== undefined) {
      updateData.vat_rate = validated.vatRate;
    }

    // If VAT rate is provided but VAT amount isn't, calculate it automatically
    if (validated.vatRate !== undefined && validated.vatRate !== null && validated.vatAmount === undefined && validated.amount !== undefined) {
      const calculatedVat = calculateVAT(validated.amount, validated.vatRate);
      updateData.vat_amount = calculatedVat.toString();
      logger.info(`Auto-calculated VAT: ${calculatedVat} for amount: ${validated.amount} at rate: ${validated.vatRate}`);
    }

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .update(updateData)
      .eq('id', transactionId)
      .select(`
        *,
        clients(
          id,
          name
        ),
        documents(
          id,
          file_name
        )
      `)
      .single();

    if (error) {
      logger.error('Failed to update transaction:', error);
      throw errors.internal('Failed to update transaction');
    }

    logger.info(`Transaction updated: ${transactionId}`);
    return c.json({ transaction: data });
  } catch (error) {
    if (error instanceof APIError) throw error;
    logger.error('Error in PUT /api/transactions/:id:', error);
    throw error;
  }
});

/**
 * POST /api/transactions/bulk-approve
 * Approve multiple transactions at once
 */
transactions.post('/bulk-approve', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();

    // Validate input
    const validated = bulkApproveSchema.parse(body);

    const BATCH_SIZE = 100;
    const allIds = validated.transactionIds;

    // Verify all transactions belong to user's organization (in batches)
    let verifiedCount = 0;
    for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
      const batch = allIds.slice(i, i + BATCH_SIZE);
      const { data: txns, error: fetchError } = await supabaseAdmin
        .from('transactions')
        .select(`
          id,
          clients!inner(
            organization_id
          )
        `)
        .in('id', batch)
        .eq('clients.organization_id', user.organizationId);

      if (fetchError) {
        logger.error('Failed to fetch transactions:', fetchError);
        throw errors.internal('Failed to verify transactions');
      }

      verifiedCount += txns?.length || 0;
    }

    if (verifiedCount !== allIds.length) {
      throw errors.badRequest(`Some transactions not found or not accessible (verified ${verifiedCount} of ${allIds.length})`);
    }

    // Update all transactions (in batches)
    const updateData: any = {
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: user.userId,
      updated_at: new Date().toISOString(),
    };

    if (validated.category) {
      updateData.category = validated.category;
    }

    let totalApproved = 0;
    for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
      const batch = allIds.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabaseAdmin
        .from('transactions')
        .update(updateData)
        .in('id', batch)
        .select('id');

      if (error) {
        logger.error('Failed to approve transactions batch:', error);
        throw errors.internal('Failed to approve transactions');
      }

      totalApproved += data?.length || 0;
    }

    logger.info(`Bulk approved ${totalApproved} transactions`);
    return c.json({
      message: `Successfully approved ${totalApproved} transactions`,
      approved: totalApproved,
    });
  } catch (error) {
    if (error instanceof APIError) throw error;
    logger.error('Error in POST /api/transactions/bulk-approve:', error);
    throw error;
  }
});

/**
 * DELETE /api/transactions/:id
 * Delete a transaction (soft delete)
 */
transactions.delete('/:id', async (c) => {
  try {
    const user = c.get('user');
    const transactionId = c.req.param('id');

    // Check if transaction exists and belongs to organization
    const { data: existing } = await supabaseAdmin
      .from('transactions')
      .select(`
        id,
        clients!inner(
          organization_id
        )
      `)
      .eq('id', transactionId)
      .eq('clients.organization_id', user.organizationId)
      .single();

    if (!existing) {
      throw errors.notFound('Transaction not found');
    }

    // Delete transaction
    const { error } = await supabaseAdmin
      .from('transactions')
      .delete()
      .eq('id', transactionId);

    if (error) {
      logger.error('Failed to delete transaction:', error);
      throw errors.internal('Failed to delete transaction');
    }

    logger.info(`Transaction deleted: ${transactionId}`);
    return c.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    if (error instanceof APIError) throw error;
    logger.error('Error in DELETE /api/transactions/:id:', error);
    throw error;
  }
});

/**
 * GET /api/transactions/stats/overview
 * Get transaction statistics for the organization
 */
transactions.get('/stats/overview', async (c) => {
  try {
    const user = c.get('user');

    // Get transaction counts by status
    const { data: txns, error } = await supabaseAdmin
      .from('transactions')
      .select(`
        status,
        amount,
        type,
        clients!inner(organization_id)
      `)
      .eq('clients.organization_id', user.organizationId);

    if (error) {
      logger.error('Failed to fetch transaction stats:', error);
      throw errors.internal('Failed to fetch statistics');
    }

    // Use precise calculations for financial totals
    const incomeAmounts = txns
      ?.filter((t) => t.type === 'credit' || t.type === 'income' || t.type === 'sale')
      .map((t) => parseFloat(t.amount)) || [];

    const expenseAmounts = txns
      ?.filter((t) => t.type === 'debit' || t.type === 'expense' || t.type === 'purchase')
      .map((t) => parseFloat(t.amount)) || [];

    const totalIncome = incomeAmounts.length > 0 ? addAmounts(...incomeAmounts) : 0;
    const totalExpenses = expenseAmounts.length > 0 ? addAmounts(...expenseAmounts) : 0;
    const netProfit = subtractAmounts(totalIncome, totalExpenses);

    const stats = {
      total: txns?.length || 0,
      pending: txns?.filter((t) => t.status === 'pending').length || 0,
      approved: txns?.filter((t) => t.status === 'approved').length || 0,
      rejected: txns?.filter((t) => t.status === 'rejected').length || 0,
      flagged: txns?.filter((t) => t.status === 'flagged').length || 0,
      totalIncome: totalIncome.toFixed(2),
      totalExpenses: totalExpenses.toFixed(2),
      netProfit: netProfit.toFixed(2),
    };

    return c.json({ stats });
  } catch (error) {
    if (error instanceof APIError) throw error;
    logger.error('Error in GET /api/transactions/stats/overview:', error);
    throw error;
  }
});

/**
 * GET /api/transactions/pending-review
 * Get transactions pending review (for quick access)
 */
transactions.get('/pending-review', async (c) => {
  try {
    const user = c.get('user');

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select(`
        *,
        clients!inner(
          id,
          name,
          organization_id
        ),
        documents(
          id,
          file_name
        )
      `)
      .eq('clients.organization_id', user.organizationId)
      .eq('status', 'pending')
      .order('date', { ascending: false })
      .limit(50);

    if (error) {
      logger.error('Failed to fetch pending transactions:', error);
      throw errors.internal('Failed to fetch pending transactions');
    }

    return c.json({ transactions: data || [] });
  } catch (error) {
    if (error instanceof APIError) throw error;
    logger.error('Error in GET /api/transactions/pending-review:', error);
    throw error;
  }
});

export default transactions;
