/**
 * Journal Entries Routes
 *
 * Handles double-entry bookkeeping journal entries
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { errors, APIError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { validateBalance, roundAmount, addAmounts } from '../lib/calculations.js';

const journalEntries = new Hono();

// All routes require authentication
journalEntries.use('*', requireAuth);

/**
 * GET /api/journal-entries
 * Get all journal entries for the organization
 */
journalEntries.get('/', async (c) => {
  try {
    const user = c.get('user');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    // Get journal entries with their lines, client, and related transactions
    let query = supabaseAdmin
      .from('journal_entries')
      .select(`
        id,
        entry_number,
        date,
        description,
        reference,
        status,
        created_at,
        clients (
          id,
          name
        ),
        journal_entry_lines (
          id,
          account_id,
          description,
          debit,
          credit,
          chart_of_accounts (
            code,
            name
          )
        )
      `)
      .eq('organization_id', user.organizationId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to fetch journal entries:', error);
      throw errors.internal('Failed to fetch journal entries');
    }

    // Get related transactions for each entry (for audit trail) - batched
    const entryIds = (data || []).map((e: any) => e.id);
    const BATCH_SIZE = 100;
    const allRelatedTransactions: any[] = [];

    for (let i = 0; i < entryIds.length; i += BATCH_SIZE) {
      const batch = entryIds.slice(i, i + BATCH_SIZE);
      const { data: batchTxns } = await supabaseAdmin
        .from('transactions')
        .select(`
          id,
          journal_entry_id,
          date,
          merchant,
          description,
          amount,
          type,
          category,
          clients (
            id,
            name
          )
        `)
        .in('journal_entry_id', batch);

      if (batchTxns) {
        allRelatedTransactions.push(...batchTxns);
      }
    }

    const relatedTransactions = allRelatedTransactions;

    // Group transactions by journal entry ID
    const transactionsByEntry = new Map<string, any[]>();
    (relatedTransactions || []).forEach((txn: any) => {
      if (!transactionsByEntry.has(txn.journal_entry_id)) {
        transactionsByEntry.set(txn.journal_entry_id, []);
      }
      transactionsByEntry.get(txn.journal_entry_id)!.push(txn);
    });

    // Transform the data to match frontend expectations
    const entries = (data || []).map((entry: any) => {
      const lines = entry.journal_entry_lines || [];
      const totalDebits = lines.reduce((sum: number, line: any) => sum + parseFloat(line.debit || 0), 0);
      const totalCredits = lines.reduce((sum: number, line: any) => sum + parseFloat(line.credit || 0), 0);
      const transactions = transactionsByEntry.get(entry.id) || [];

      return {
        entry_id: entry.id,
        date: entry.date,
        description: entry.description,
        reference: entry.reference,
        status: entry.status,
        created_at: entry.created_at,
        client: entry.clients ? {
          id: entry.clients.id,
          name: entry.clients.name,
        } : null,
        total_debits: totalDebits.toFixed(2),
        total_credits: totalCredits.toFixed(2),
        transaction_count: transactions.length,
        transactions: transactions.map((txn: any) => ({
          id: txn.id,
          date: txn.date,
          merchant: txn.merchant,
          description: txn.description,
          amount: txn.amount,
          type: txn.type,
          category: txn.category,
          client: txn.clients ? {
            id: txn.clients.id,
            name: txn.clients.name,
          } : null,
        })),
        lines: lines.map((line: any) => ({
          id: line.id,
          account_id: line.account_id,
          description: line.description,
          debit_amount: line.debit,
          credit_amount: line.credit,
          account: {
            code: line.chart_of_accounts.code,
            name: line.chart_of_accounts.name,
          },
        })),
      };
    });

    return c.json({ entries });
  } catch (error) {
    if (error instanceof APIError) throw error;
    logger.error('Error in GET /api/journal-entries:', error);
    throw error;
  }
});

/**
 * POST /api/journal-entries
 * Create a new journal entry (with multiple lines)
 */
journalEntries.post('/', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();

    const { date, description, reference, lines } = body;

    // Validate required fields
    if (!date || !description || !lines || lines.length < 2) {
      throw errors.badRequest('Date, description, and at least 2 lines are required');
    }

    // Validate that entry balances (debits = credits)
    const isBalanced = validateBalance(
      lines.map((line: any) => ({
        debit: line.debit_amount || null,
        credit: line.credit_amount || null,
      }))
    );

    if (!isBalanced) {
      throw errors.badRequest('Journal entry does not balance. Debits must equal credits.');
    }

    // First, create the journal entry header
    const { data: entryData, error: entryError } = await supabaseAdmin
      .from('journal_entries')
      .insert({
        organization_id: user.organizationId,
        date,
        description,
        reference: reference || null,
        status: 'posted',
        created_by: user.userId,
        posted_at: new Date().toISOString(),
        posted_by: user.userId,
      })
      .select()
      .single();

    if (entryError || !entryData) {
      logger.error('Failed to create journal entry:', entryError);
      throw errors.internal('Failed to create journal entry');
    }

    // Then create the journal entry lines
    const linesToInsert = lines.map((line: any) => ({
      journal_entry_id: entryData.id,
      account_id: line.account_id,
      description: line.description || null,
      debit: line.debit_amount ? roundAmount(line.debit_amount) : 0,
      credit: line.credit_amount ? roundAmount(line.credit_amount) : 0,
    }));

    const { data: linesData, error: linesError } = await supabaseAdmin
      .from('journal_entry_lines')
      .insert(linesToInsert)
      .select(`
        *,
        chart_of_accounts (
          code,
          name
        )
      `);

    if (linesError) {
      // Rollback: delete the entry header if lines failed
      await supabaseAdmin
        .from('journal_entries')
        .delete()
        .eq('id', entryData.id);

      logger.error('Failed to create journal entry lines:', linesError);
      throw errors.internal('Failed to create journal entry lines');
    }

    logger.info(`Created journal entry ${entryData.id} with ${lines.length} lines`);

    return c.json({
      message: 'Journal entry created successfully',
      entry: {
        id: entryData.id,
        date: entryData.date,
        description: entryData.description,
        reference: entryData.reference,
        lines: linesData,
      },
    }, 201);
  } catch (error) {
    if (error instanceof APIError) throw error;
    logger.error('Error in POST /api/journal-entries:', error);
    throw error;
  }
});

/**
 * GET /api/journal-entries/:entryId
 * Get a specific journal entry by ID
 */
journalEntries.get('/:entryId', async (c) => {
  try {
    const user = c.get('user');
    const entryId = c.req.param('entryId');

    const { data, error } = await supabaseAdmin
      .from('journal_entries')
      .select(`
        id,
        entry_number,
        date,
        description,
        reference,
        status,
        created_at,
        journal_entry_lines (
          id,
          account_id,
          description,
          debit,
          credit,
          chart_of_accounts (
            code,
            name
          )
        )
      `)
      .eq('organization_id', user.organizationId)
      .eq('id', entryId)
      .single();

    if (error || !data) {
      logger.error('Journal entry not found:', error);
      throw errors.notFound('Journal entry not found');
    }

    const entry = {
      entry_id: data.id,
      date: data.date,
      description: data.description,
      reference: data.reference,
      status: data.status,
      created_at: data.created_at,
      lines: (data.journal_entry_lines || []).map((line: any) => ({
        id: line.id,
        account_id: line.account_id,
        description: line.description,
        debit_amount: line.debit,
        credit_amount: line.credit,
        account: {
          code: line.chart_of_accounts.code,
          name: line.chart_of_accounts.name,
        },
      })),
    };

    return c.json({ entry });
  } catch (error) {
    if (error instanceof APIError) throw error;
    logger.error('Error in GET /api/journal-entries/:entryId:', error);
    throw error;
  }
});

/**
 * DELETE /api/journal-entries/:entryId
 * Delete a journal entry (CASCADE will delete all lines)
 */
journalEntries.delete('/:entryId', async (c) => {
  try {
    const user = c.get('user');
    const entryId = c.req.param('entryId');

    // Check if entry exists and belongs to organization
    const { data: existing } = await supabaseAdmin
      .from('journal_entries')
      .select('id')
      .eq('organization_id', user.organizationId)
      .eq('id', entryId)
      .single();

    if (!existing) {
      throw errors.notFound('Journal entry not found');
    }

    // Delete the entry (CASCADE will delete all lines automatically)
    const { error } = await supabaseAdmin
      .from('journal_entries')
      .delete()
      .eq('id', entryId);

    if (error) {
      logger.error('Failed to delete journal entry:', error);
      throw errors.internal('Failed to delete journal entry');
    }

    logger.info(`Deleted journal entry ${entryId}`);
    return c.json({ message: 'Journal entry deleted successfully' });
  } catch (error) {
    if (error instanceof APIError) throw error;
    logger.error('Error in DELETE /api/journal-entries/:entryId:', error);
    throw error;
  }
});

/**
 * POST /api/journal-entries/from-transactions/grouped
 * Create journal entries from multiple transactions, grouped by category
 */
journalEntries.post('/from-transactions/grouped', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { transactionIds } = body;

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      throw errors.badRequest('Transaction IDs are required');
    }

    logger.info(`Posting ${transactionIds.length} transactions grouped by category`);

    // Get all transactions (batched to avoid URL length limits)
    const BATCH_SIZE = 100;
    const allTransactions: any[] = [];

    for (let i = 0; i < transactionIds.length; i += BATCH_SIZE) {
      const batch = transactionIds.slice(i, i + BATCH_SIZE);
      const { data: batchTxns, error: txnError } = await supabaseAdmin
        .from('transactions')
        .select(`
          *,
          clients!inner(
            organization_id
          )
        `)
        .in('id', batch)
        .eq('clients.organization_id', user.organizationId);

      if (txnError) {
        logger.error('Failed to fetch transactions batch:', txnError);
        throw errors.internal('Failed to fetch transactions');
      }

      if (batchTxns) {
        allTransactions.push(...batchTxns);
      }
    }

    const transactions = allTransactions;

    // Filter out already posted transactions
    const unpostedTransactions = transactions.filter(txn => !txn.journal_entry_id);

    if (unpostedTransactions.length === 0) {
      throw errors.badRequest('All selected transactions are already posted');
    }

    // Group transactions by category and type
    const grouped = new Map<string, typeof unpostedTransactions>();

    for (const txn of unpostedTransactions) {
      const key = `${txn.category || 'Other'}-${txn.type}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(txn);
    }

    logger.info(`Grouped into ${grouped.size} categories`);

    // Get bank account
    const { data: bankAccount, error: bankError } = await supabaseAdmin
      .from('chart_of_accounts')
      .select('id')
      .eq('organization_id', user.organizationId)
      .eq('code', '1000')
      .single();

    if (bankError || !bankAccount) {
      throw errors.internal('Bank account (1000) not found');
    }

    const createdEntries = [];

    // Create one journal entry per category/type group
    for (const [groupKey, groupTransactions] of grouped.entries()) {
      const [category, type] = groupKey.split('-');

      // Get category mapping
      let { data: mapping, error: mappingError } = await supabaseAdmin
        .from('account_category_mappings')
        .select('account_id')
        .eq('organization_id', user.organizationId)
        .eq('category', category)
        .eq('transaction_type', type)
        .order('priority', { ascending: true })
        .limit(1)
        .single();

      // Fallback to "Other" category if no specific mapping found
      if (mappingError || !mapping) {
        logger.warn(`No account mapping found for category: ${category}, using fallback "Other" category`);

        const { data: fallbackMapping, error: fallbackError } = await supabaseAdmin
          .from('account_category_mappings')
          .select('account_id')
          .eq('organization_id', user.organizationId)
          .eq('category', 'Other')
          .eq('transaction_type', type)
          .order('priority', { ascending: true })
          .limit(1)
          .single();

        if (fallbackError || !fallbackMapping) {
          logger.error(`No fallback "Other" mapping found for type: ${type}, skipping`);
          continue;
        }

        mapping = fallbackMapping;
      }

      // Calculate total amount for this group
      const totalAmount = groupTransactions.reduce((sum, txn) => {
        return addAmounts(sum, parseFloat(txn.amount));
      }, 0);

      // Get date range for description
      const dates = groupTransactions.map(txn => new Date(txn.date).getTime());
      const earliestDate = new Date(Math.min(...dates)).toISOString().split('T')[0];
      const latestDate = new Date(Math.max(...dates)).toISOString().split('T')[0];
      const dateRange = earliestDate === latestDate ? earliestDate : `${earliestDate} to ${latestDate}`;

      // Get unique client IDs
      const uniqueClientIds = [...new Set(groupTransactions.map(txn => txn.client_id))];
      const clientId = uniqueClientIds[0]; // Use first client
      const isMultiClient = uniqueClientIds.length > 1;

      // Create journal entry header
      const { data: entry, error: entryError } = await supabaseAdmin
        .from('journal_entries')
        .insert({
          organization_id: user.organizationId,
          client_id: clientId,
          date: latestDate, // Use latest date
          description: `${category} - ${groupTransactions.length} transaction(s) (${dateRange})${isMultiClient ? ' [Multiple Clients]' : ''}`,
          reference: `BULK-${Date.now()}`,
          status: 'posted',
          created_by: user.userId,
          posted_at: new Date().toISOString(),
          posted_by: user.userId,
        })
        .select()
        .single();

      if (entryError || !entry) {
        logger.error('Failed to create journal entry:', entryError);
        continue;
      }

      // Create journal entry lines
      const lines = [];

      if (type === 'debit') {
        // Expense: Debit expense account, Credit bank account
        lines.push({
          journal_entry_id: entry.id,
          account_id: mapping.account_id,
          description: `${category} (${groupTransactions.length} transactions)`,
          debit: roundAmount(totalAmount),
          credit: 0,
        });
        lines.push({
          journal_entry_id: entry.id,
          account_id: bankAccount.id,
          description: 'Bank payment',
          debit: 0,
          credit: roundAmount(totalAmount),
        });
      } else {
        // Income: Debit bank account, Credit income account
        lines.push({
          journal_entry_id: entry.id,
          account_id: bankAccount.id,
          description: 'Bank receipt',
          debit: roundAmount(totalAmount),
          credit: 0,
        });
        lines.push({
          journal_entry_id: entry.id,
          account_id: mapping.account_id,
          description: `${category} (${groupTransactions.length} transactions)`,
          debit: 0,
          credit: roundAmount(totalAmount),
        });
      }

      const { error: linesError } = await supabaseAdmin
        .from('journal_entry_lines')
        .insert(lines)
        .select();

      if (linesError) {
        // Rollback: delete entry if lines failed
        await supabaseAdmin
          .from('journal_entries')
          .delete()
          .eq('id', entry.id);
        logger.error('Failed to create journal entry lines:', linesError);
        continue;
      }

      // Update all transactions in this group (batched)
      const txnIds = groupTransactions.map(txn => txn.id);
      for (let i = 0; i < txnIds.length; i += BATCH_SIZE) {
        const txnBatch = txnIds.slice(i, i + BATCH_SIZE);
        const { error: updateError } = await supabaseAdmin
          .from('transactions')
          .update({
            journal_entry_id: entry.id,
            status: 'posted',
          })
          .in('id', txnBatch);

        if (updateError) {
          logger.warn('Failed to link transactions batch to journal entry:', updateError);
        }
      }

      createdEntries.push({
        id: entry.id,
        category,
        transactionCount: groupTransactions.length,
        totalAmount,
      });

      logger.info(`Created journal entry ${entry.id} for ${groupTransactions.length} ${category} transactions`);
    }

    return c.json({
      message: `Created ${createdEntries.length} journal entries from ${unpostedTransactions.length} transactions`,
      entries: createdEntries,
    }, 201);
  } catch (error) {
    if (error instanceof APIError) throw error;
    logger.error('Error in POST /api/journal-entries/from-transactions/grouped:', error);
    throw error;
  }
});

/**
 * POST /api/journal-entries/from-transaction/:transactionId
 * Create journal entry from a transaction (auto-posting)
 */
journalEntries.post('/from-transaction/:transactionId', async (c) => {
  try {
    const user = c.get('user');
    const transactionId = c.req.param('transactionId');

    // Get transaction
    const { data: txn, error: txnError } = await supabaseAdmin
      .from('transactions')
      .select(`
        *,
        clients!inner(
          organization_id
        )
      `)
      .eq('id', transactionId)
      .eq('clients.organization_id', user.organizationId)
      .single();

    if (txnError || !txn) {
      throw errors.notFound('Transaction not found');
    }

    // Check if transaction is already posted
    if (txn.journal_entry_id) {
      throw errors.badRequest('Transaction is already posted to the ledger');
    }

    // Get category mapping for this transaction
    let { data: mapping, error: mappingError } = await supabaseAdmin
      .from('account_category_mappings')
      .select('account_id')
      .eq('organization_id', user.organizationId)
      .eq('category', txn.category || 'Other')
      .eq('transaction_type', txn.type)
      .order('priority', { ascending: true })
      .limit(1)
      .single();

    // Fallback to "Other" category if no specific mapping found
    if (mappingError || !mapping) {
      logger.warn(`No account mapping found for category: ${txn.category || 'Other'}, using fallback "Other" category`);

      const { data: fallbackMapping, error: fallbackError } = await supabaseAdmin
        .from('account_category_mappings')
        .select('account_id')
        .eq('organization_id', user.organizationId)
        .eq('category', 'Other')
        .eq('transaction_type', txn.type)
        .order('priority', { ascending: true })
        .limit(1)
        .single();

      if (fallbackError || !fallbackMapping) {
        throw errors.badRequest(`No account mapping found for category: ${txn.category || 'Other'} and no fallback "Other" mapping available`);
      }

      mapping = fallbackMapping;
    }

    // Get bank account (default contra account)
    const { data: bankAccounts, error: bankError } = await supabaseAdmin
      .from('chart_of_accounts')
      .select('id')
      .eq('organization_id', user.organizationId)
      .eq('code', '1000')
      .single();

    if (bankError || !bankAccounts) {
      throw errors.internal('Bank account (1000) not found');
    }

    const amount = parseFloat(txn.amount);
    const expenseAccountId = mapping.account_id;
    const bankAccountId = bankAccounts.id;

    // Create journal entry header
    const { data: entry, error: entryError } = await supabaseAdmin
      .from('journal_entries')
      .insert({
        organization_id: user.organizationId,
        client_id: txn.client_id,
        date: txn.date,
        description: `${txn.merchant} - ${txn.description || ''}`.trim(),
        reference: `TXN-${transactionId.substring(0, 8)}`,
        status: 'posted',
        created_by: user.userId,
        posted_at: new Date().toISOString(),
        posted_by: user.userId,
      })
      .select()
      .single();

    if (entryError || !entry) {
      logger.error('Failed to create journal entry:', entryError);
      throw errors.internal('Failed to create journal entry');
    }

    // Create journal entry lines
    const lines = [];

    if (txn.type === 'debit') {
      // Expense: Debit expense account, Credit bank account
      lines.push({
        journal_entry_id: entry.id,
        account_id: expenseAccountId,
        description: txn.description,
        debit: roundAmount(amount),
        credit: 0,
      });
      lines.push({
        journal_entry_id: entry.id,
        account_id: bankAccountId,
        description: 'Bank payment',
        debit: 0,
        credit: roundAmount(amount),
      });
    } else {
      // Income: Debit bank account, Credit income account
      lines.push({
        journal_entry_id: entry.id,
        account_id: bankAccountId,
        description: 'Bank receipt',
        debit: roundAmount(amount),
        credit: 0,
      });
      lines.push({
        journal_entry_id: entry.id,
        account_id: expenseAccountId,
        description: txn.description,
        debit: 0,
        credit: roundAmount(amount),
      });
    }

    const { data: linesData, error: linesError } = await supabaseAdmin
      .from('journal_entry_lines')
      .insert(lines)
      .select(`
        *,
        chart_of_accounts (
          code,
          name
        )
      `);

    if (linesError) {
      // Rollback: delete entry if lines failed
      await supabaseAdmin
        .from('journal_entries')
        .delete()
        .eq('id', entry.id);

      logger.error('Failed to create journal entry lines:', linesError);
      throw errors.internal('Failed to create journal entry lines');
    }

    // Update transaction with journal_entry_id
    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({
        journal_entry_id: entry.id,
        status: 'posted',
      })
      .eq('id', transactionId);

    if (updateError) {
      logger.warn('Failed to link transaction to journal entry:', updateError);
    }

    logger.info(`Created journal entry ${entry.id} for transaction ${transactionId}`);

    return c.json({
      message: 'Transaction posted to ledger successfully',
      entry: {
        id: entry.id,
        date: entry.date,
        description: entry.description,
        reference: entry.reference,
        lines: linesData,
      },
    }, 201);
  } catch (error) {
    if (error instanceof APIError) throw error;
    logger.error('Error in POST /api/journal-entries/from-transaction:', error);
    throw error;
  }
});

export default journalEntries;
