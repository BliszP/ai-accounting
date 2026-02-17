/**
 * Client Management Routes
 *
 * Handles CRUD operations for clients
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { clientSchema, clientUpdateSchema } from '../lib/validation.js';
import { errors, APIError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';

const clients = new Hono();

// All routes require authentication
clients.use('*', requireAuth);

/**
 * GET /api/clients
 * Get all clients for the authenticated user's organization
 */
clients.get('/', async (c) => {
  try {
    const user = c.get('user');

    const { data, error } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('organization_id', user.organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch clients:', error);
      throw errors.internal('Failed to fetch clients');
    }

    return c.json({ clients: data || [] });
  } catch (error) {
    if (error instanceof APIError) throw error;
    logger.error('Error in GET /api/clients:', error);
    throw error;
  }
});

/**
 * GET /api/clients/:id
 * Get a specific client by ID
 */
clients.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    const clientId = c.req.param('id');

    const { data, error } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .eq('organization_id', user.organizationId)
      .single();

    if (error || !data) {
      logger.error('Client not found:', error);
      throw errors.notFound('Client not found');
    }

    return c.json({ client: data });
  } catch (error) {
    if (error instanceof APIError) throw error;
    logger.error('Error in GET /api/clients/:id:', error);
    throw error;
  }
});

/**
 * POST /api/clients
 * Create a new client
 */
clients.post('/', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();

    // Validate input
    const validated = clientSchema.parse(body);

    // Check for duplicate client name within organization
    const { data: existing } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('organization_id', user.organizationId)
      .eq('name', validated.name)
      .single();

    if (existing) {
      throw errors.badRequest('Client with this name already exists');
    }

    // Create client
    const { data, error} = await supabaseAdmin
      .from('clients')
      .insert({
        organization_id: user.organizationId,
        name: validated.name,
        contact_email: validated.contactEmail || null,
        vat_number: validated.vatNumber || null,
        company_number: validated.companyNumber || null,
        financial_year_start: validated.financialYearStart || null,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create client:', error);
      throw errors.internal('Failed to create client');
    }

    logger.info(`Client created: ${data.id}`);
    return c.json({ client: data }, 201);
  } catch (error) {
    if (error instanceof APIError) throw error;
    logger.error('Error in POST /api/clients:', error);
    throw error;
  }
});

/**
 * PUT /api/clients/:id
 * Update an existing client
 */
clients.put('/:id', async (c) => {
  try {
    const user = c.get('user');
    const clientId = c.req.param('id');
    const body = await c.req.json();

    // Validate input
    const validated = clientUpdateSchema.parse(body);

    // Check if client exists and belongs to organization
    const { data: existing } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('organization_id', user.organizationId)
      .single();

    if (!existing) {
      throw errors.notFound('Client not found');
    }

    // Update client
    const { data, error } = await supabaseAdmin
      .from('clients')
      .update({
        ...(validated.name && { name: validated.name }),
        ...(validated.contactEmail !== undefined && { contact_email: validated.contactEmail || null }),
        ...(validated.vatNumber !== undefined && { vat_number: validated.vatNumber || null }),
        ...(validated.companyNumber !== undefined && { company_number: validated.companyNumber || null }),
        ...(validated.financialYearStart !== undefined && { financial_year_start: validated.financialYearStart || null }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId)
      .eq('organization_id', user.organizationId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update client:', error);
      throw errors.internal('Failed to update client');
    }

    logger.info(`Client updated: ${clientId}`);
    return c.json({ client: data });
  } catch (error) {
    if (error instanceof APIError) throw error;
    logger.error('Error in PUT /api/clients/:id:', error);
    throw error;
  }
});

/**
 * DELETE /api/clients/:id
 * Delete a client (soft delete by setting deleted_at)
 */
clients.delete('/:id', async (c) => {
  try {
    const user = c.get('user');
    const clientId = c.req.param('id');

    // Check if client exists and belongs to organization
    const { data: existing } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('organization_id', user.organizationId)
      .single();

    if (!existing) {
      throw errors.notFound('Client not found');
    }

    // Check if client has associated documents
    const { data: documents } = await supabaseAdmin
      .from('documents')
      .select('id')
      .eq('client_id', clientId)
      .limit(1);

    if (documents && documents.length > 0) {
      throw errors.badRequest(
        'Cannot delete client with associated documents. Please delete or reassign documents first.'
      );
    }

    // Soft delete
    const { error } = await supabaseAdmin
      .from('clients')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', clientId)
      .eq('organization_id', user.organizationId);

    if (error) {
      logger.error('Failed to delete client:', error);
      throw errors.internal('Failed to delete client');
    }

    logger.info(`Client deleted: ${clientId}`);
    return c.json({ message: 'Client deleted successfully' });
  } catch (error) {
    if (error instanceof APIError) throw error;
    logger.error('Error in DELETE /api/clients/:id:', error);
    throw error;
  }
});

/**
 * GET /api/clients/:id/stats
 * Get statistics for a specific client
 */
clients.get('/:id/stats', async (c) => {
  try {
    const user = c.get('user');
    const clientId = c.req.param('id');

    // Check if client exists and belongs to organization
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('organization_id', user.organizationId)
      .single();

    if (!client) {
      throw errors.notFound('Client not found');
    }

    // Get document count
    const { count: documentCount } = await supabaseAdmin
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId);

    // Get transaction count
    const { count: transactionCount } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId);

    // Get total revenue and expenses
    const { data: transactions } = await supabaseAdmin
      .from('transactions')
      .select('amount, type')
      .eq('client_id', clientId);

    let totalRevenue = 0;
    let totalExpenses = 0;

    if (transactions) {
      transactions.forEach((t) => {
        if (t.type === 'income' || t.type === 'sale') {
          totalRevenue += parseFloat(t.amount);
        } else if (t.type === 'expense' || t.type === 'purchase') {
          totalExpenses += parseFloat(t.amount);
        }
      });
    }

    return c.json({
      stats: {
        documentCount: documentCount || 0,
        transactionCount: transactionCount || 0,
        totalRevenue: totalRevenue.toFixed(2),
        totalExpenses: totalExpenses.toFixed(2),
        netProfit: (totalRevenue - totalExpenses).toFixed(2),
      },
    });
  } catch (error) {
    if (error instanceof APIError) throw error;
    logger.error('Error in GET /api/clients/:id/stats:', error);
    throw error;
  }
});

/**
 * GET /api/clients/:id/balance
 * Get complete balance summary for a client including all documents, transactions, and journal entries
 */
clients.get('/:id/balance', async (c) => {
  try {
    const user = c.get('user');
    const clientId = c.req.param('id');

    // Get client
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .eq('organization_id', user.organizationId)
      .single();

    if (clientError || !client) {
      throw errors.notFound('Client not found');
    }

    // Get all documents for this client
    const { data: documents } = await supabaseAdmin
      .from('documents')
      .select('id, file_name, file_type, created_at, status')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    // Get all transactions for this client
    const { data: transactions } = await supabaseAdmin
      .from('transactions')
      .select('id, date, merchant, amount, type, category, status, journal_entry_id')
      .eq('client_id', clientId)
      .order('date', { ascending: false });

    // Get all journal entries for this client
    const { data: journalEntries } = await supabaseAdmin
      .from('journal_entries')
      .select(`
        id,
        date,
        description,
        reference,
        journal_entry_lines (
          debit,
          credit
        )
      `)
      .eq('client_id', clientId)
      .order('date', { ascending: false });

    // Calculate totals
    let totalDebits = 0;
    let totalCredits = 0;

    (journalEntries || []).forEach((entry: any) => {
      (entry.journal_entry_lines || []).forEach((line: any) => {
        totalDebits += parseFloat(line.debit || 0);
        totalCredits += parseFloat(line.credit || 0);
      });
    });

    const netBalance = totalDebits - totalCredits;

    // Count posted vs unposted transactions
    const postedTransactions = (transactions || []).filter(t => t.journal_entry_id).length;
    const unpostedTransactions = (transactions || []).filter(t => !t.journal_entry_id).length;

    return c.json({
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
      },
      summary: {
        totalDocuments: (documents || []).length,
        totalTransactions: (transactions || []).length,
        postedTransactions,
        unpostedTransactions,
        totalJournalEntries: (journalEntries || []).length,
      },
      balance: {
        totalDebits: totalDebits.toFixed(2),
        totalCredits: totalCredits.toFixed(2),
        netBalance: netBalance.toFixed(2),
        balanceType: netBalance > 0 ? 'debit' : netBalance < 0 ? 'credit' : 'balanced',
      },
      documents: documents || [],
      transactions: (transactions || []).map(t => ({
        id: t.id,
        date: t.date,
        merchant: t.merchant,
        amount: t.amount,
        type: t.type,
        category: t.category,
        status: t.status,
        posted: !!t.journal_entry_id,
      })),
      journalEntries: (journalEntries || []).map((entry: any) => {
        const entryDebits = (entry.journal_entry_lines || []).reduce((sum: number, line: any) =>
          sum + parseFloat(line.debit || 0), 0);
        const entryCredits = (entry.journal_entry_lines || []).reduce((sum: number, line: any) =>
          sum + parseFloat(line.credit || 0), 0);

        return {
          id: entry.id,
          date: entry.date,
          description: entry.description,
          reference: entry.reference,
          totalDebits: entryDebits.toFixed(2),
          totalCredits: entryCredits.toFixed(2),
          netBalance: (entryDebits - entryCredits).toFixed(2),
        };
      }),
    });
  } catch (error) {
    if (error instanceof APIError) throw error;
    logger.error('Error in GET /api/clients/:id/balance:', error);
    throw error;
  }
});

export default clients;
