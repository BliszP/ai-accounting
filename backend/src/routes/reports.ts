/**
 * Financial Reports Routes
 *
 * Generates Trial Balance, P&L, and Balance Sheet reports
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { errors, APIError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { addAmounts, subtractAmounts } from '../lib/calculations.js';

const reports = new Hono();

// All routes require authentication
reports.use('*', requireAuth);

/**
 * GET /api/reports/trial-balance
 * Generate Trial Balance report
 */
reports.get('/trial-balance', async (c) => {
  try {
    const user = c.get('user');
    const asOfDate = c.req.query('asOfDate') || new Date().toISOString().split('T')[0];
    const clientId = c.req.query('clientId'); // Optional client filter

    // Get all accounts
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('chart_of_accounts')
      .select('*')
      .eq('organization_id', user.organizationId)
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (accountsError) {
      throw errors.internal('Failed to fetch accounts');
    }

    // Get journal entry lines up to asOfDate
    let entriesQuery = supabaseAdmin
      .from('journal_entry_lines')
      .select(`
        account_id,
        debit,
        credit,
        journal_entries!inner (
          organization_id,
          date,
          client_id
        )
      `)
      .eq('journal_entries.organization_id', user.organizationId)
      .lte('journal_entries.date', asOfDate);

    // Filter by client if specified
    if (clientId && clientId !== 'all') {
      entriesQuery = entriesQuery.eq('journal_entries.client_id', clientId);
    }

    const { data: entries, error: entriesError } = await entriesQuery;

    if (entriesError) {
      throw errors.internal('Failed to fetch journal entries');
    }

    // Calculate balances for each account
    const accountBalances = accounts?.map(account => {
      const accountEntries = entries?.filter(e => e.account_id === account.id) || [];

      const debits = accountEntries
        .map(e => parseFloat(e.debit || '0'))
        .filter(amt => amt > 0);

      const credits = accountEntries
        .map(e => parseFloat(e.credit || '0'))
        .filter(amt => amt > 0);

      const totalDebits = debits.length > 0 ? addAmounts(...debits) : 0;
      const totalCredits = credits.length > 0 ? addAmounts(...credits) : 0;

      let balance = 0;
      if (account.normal_balance === 'debit') {
        balance = subtractAmounts(totalDebits, totalCredits);
      } else {
        balance = subtractAmounts(totalCredits, totalDebits);
      }

      return {
        code: account.code,
        name: account.name,
        type: account.type,
        debit_balance: balance > 0 && account.normal_balance === 'debit' ? balance.toFixed(2) : '0.00',
        credit_balance: balance > 0 && account.normal_balance === 'credit' ? balance.toFixed(2) : '0.00',
      };
    }) || [];

    // Calculate totals using Decimal.js for financial precision
    const debitAmounts = accountBalances.map(acc => parseFloat(acc.debit_balance)).filter(n => n > 0);
    const creditAmounts = accountBalances.map(acc => parseFloat(acc.credit_balance)).filter(n => n > 0);
    const totalDebits = debitAmounts.length > 0 ? addAmounts(...debitAmounts) : 0;
    const totalCredits = creditAmounts.length > 0 ? addAmounts(...creditAmounts) : 0;

    // Filter out zero balances
    const nonZeroBalances = accountBalances.filter(
      acc => parseFloat(acc.debit_balance) > 0 || parseFloat(acc.credit_balance) > 0
    );

    return c.json({
      report_type: 'Trial Balance',
      as_of_date: asOfDate,
      accounts: nonZeroBalances,
      totals: {
        total_debits: totalDebits.toFixed(2),
        total_credits: totalCredits.toFixed(2),
        in_balance: Math.abs(subtractAmounts(totalDebits, totalCredits)) < 0.01,
      },
    });
  } catch (error) {
    if (error instanceof APIError) throw error;
    logger.error('Error in GET /api/reports/trial-balance:', error);
    throw error;
  }
});

/**
 * GET /api/reports/profit-loss
 * Generate Profit & Loss (Income Statement) report
 */
reports.get('/profit-loss', async (c) => {
  try {
    const user = c.get('user');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate') || new Date().toISOString().split('T')[0];
    const clientId = c.req.query('clientId'); // Optional client filter

    if (!startDate) {
      throw errors.badRequest('Start date is required');
    }

    // Get income and expense accounts
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('chart_of_accounts')
      .select('*')
      .eq('organization_id', user.organizationId)
      .in('type', ['income', 'expense'])
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (accountsError) {
      throw errors.internal('Failed to fetch accounts');
    }

    // Get journal entry lines for the period
    let entriesQuery = supabaseAdmin
      .from('journal_entry_lines')
      .select(`
        account_id,
        debit,
        credit,
        journal_entries!inner (
          organization_id,
          date,
          client_id
        )
      `)
      .eq('journal_entries.organization_id', user.organizationId)
      .gte('journal_entries.date', startDate)
      .lte('journal_entries.date', endDate);

    // Filter by client if specified
    if (clientId && clientId !== 'all') {
      entriesQuery = entriesQuery.eq('journal_entries.client_id', clientId);
    }

    const { data: entries, error: entriesError } = await entriesQuery;

    if (entriesError) {
      throw errors.internal('Failed to fetch journal entries');
    }

    // Calculate balances
    const incomeAccounts = [];
    const expenseAccounts = [];

    for (const account of accounts || []) {
      const accountEntries = entries?.filter(e => e.account_id === account.id) || [];

      const debits = accountEntries
        .map(e => parseFloat(e.debit || '0'))
        .filter(amt => amt > 0);

      const credits = accountEntries
        .map(e => parseFloat(e.credit || '0'))
        .filter(amt => amt > 0);

      const totalDebits = debits.length > 0 ? addAmounts(...debits) : 0;
      const totalCredits = credits.length > 0 ? addAmounts(...credits) : 0;

      let balance = 0;
      if (account.type === 'income') {
        balance = subtractAmounts(totalCredits, totalDebits);
        if (balance > 0) {
          incomeAccounts.push({
            code: account.code,
            name: account.name,
            subtype: account.subtype,
            amount: balance.toFixed(2),
          });
        }
      } else {
        balance = subtractAmounts(totalDebits, totalCredits);
        if (balance > 0) {
          expenseAccounts.push({
            code: account.code,
            name: account.name,
            subtype: account.subtype,
            amount: balance.toFixed(2),
          });
        }
      }
    }

    // Calculate totals using Decimal.js for financial precision
    const incomeAmounts = incomeAccounts.map(acc => parseFloat(acc.amount));
    const expenseAmounts = expenseAccounts.map(acc => parseFloat(acc.amount));
    const totalIncome = incomeAmounts.length > 0 ? addAmounts(...incomeAmounts) : 0;
    const totalExpenses = expenseAmounts.length > 0 ? addAmounts(...expenseAmounts) : 0;

    const netProfit = subtractAmounts(totalIncome, totalExpenses);

    return c.json({
      report_type: 'Profit & Loss Statement',
      period: {
        start_date: startDate,
        end_date: endDate,
      },
      income: {
        accounts: incomeAccounts,
        total: totalIncome.toFixed(2),
      },
      expenses: {
        accounts: expenseAccounts,
        total: totalExpenses.toFixed(2),
      },
      net_profit: netProfit.toFixed(2),
    });
  } catch (error) {
    if (error instanceof APIError) throw error;
    logger.error('Error in GET /api/reports/profit-loss:', error);
    throw error;
  }
});

/**
 * GET /api/reports/balance-sheet
 * Generate Balance Sheet report
 */
reports.get('/balance-sheet', async (c) => {
  try {
    const user = c.get('user');
    const asOfDate = c.req.query('asOfDate') || new Date().toISOString().split('T')[0];
    const clientId = c.req.query('clientId'); // Optional client filter

    // Get all balance sheet accounts (assets, liabilities, equity)
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('chart_of_accounts')
      .select('*')
      .eq('organization_id', user.organizationId)
      .in('type', ['asset', 'liability', 'equity'])
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (accountsError) {
      throw errors.internal('Failed to fetch accounts');
    }

    // Get journal entry lines up to asOfDate
    let entriesQuery = supabaseAdmin
      .from('journal_entry_lines')
      .select(`
        account_id,
        debit,
        credit,
        journal_entries!inner (
          organization_id,
          date,
          client_id
        )
      `)
      .eq('journal_entries.organization_id', user.organizationId)
      .lte('journal_entries.date', asOfDate);

    // Filter by client if specified
    if (clientId && clientId !== 'all') {
      entriesQuery = entriesQuery.eq('journal_entries.client_id', clientId);
    }

    const { data: entries, error: entriesError } = await entriesQuery;

    if (entriesError) {
      throw errors.internal('Failed to fetch journal entries');
    }

    const assets = [];
    const liabilities = [];
    const equity = [];

    for (const account of accounts || []) {
      const accountEntries = entries?.filter(e => e.account_id === account.id) || [];

      const debits = accountEntries
        .map(e => parseFloat(e.debit || '0'))
        .filter(amt => amt > 0);

      const credits = accountEntries
        .map(e => parseFloat(e.credit || '0'))
        .filter(amt => amt > 0);

      const totalDebits = debits.length > 0 ? addAmounts(...debits) : 0;
      const totalCredits = credits.length > 0 ? addAmounts(...credits) : 0;

      let balance = 0;
      if (account.normal_balance === 'debit') {
        balance = subtractAmounts(totalDebits, totalCredits);
      } else {
        balance = subtractAmounts(totalCredits, totalDebits);
      }

      if (balance > 0) {
        const accountData = {
          code: account.code,
          name: account.name,
          subtype: account.subtype,
          amount: balance.toFixed(2),
        };

        if (account.type === 'asset') {
          assets.push(accountData);
        } else if (account.type === 'liability') {
          liabilities.push(accountData);
        } else {
          equity.push(accountData);
        }
      }
    }

    // Calculate totals using Decimal.js for financial precision
    const assetAmounts = assets.map(acc => parseFloat(acc.amount));
    const liabilityAmounts = liabilities.map(acc => parseFloat(acc.amount));
    const equityAmounts = equity.map(acc => parseFloat(acc.amount));
    const totalAssets = assetAmounts.length > 0 ? addAmounts(...assetAmounts) : 0;
    const totalLiabilities = liabilityAmounts.length > 0 ? addAmounts(...liabilityAmounts) : 0;
    const totalEquity = equityAmounts.length > 0 ? addAmounts(...equityAmounts) : 0;

    const totalLiabilitiesAndEquity = addAmounts(totalLiabilities, totalEquity);

    return c.json({
      report_type: 'Balance Sheet',
      as_of_date: asOfDate,
      assets: {
        accounts: assets,
        total: totalAssets.toFixed(2),
      },
      liabilities: {
        accounts: liabilities,
        total: totalLiabilities.toFixed(2),
      },
      equity: {
        accounts: equity,
        total: totalEquity.toFixed(2),
      },
      totals: {
        total_assets: totalAssets.toFixed(2),
        total_liabilities_and_equity: totalLiabilitiesAndEquity.toFixed(2),
        in_balance: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
      },
    });
  } catch (error) {
    if (error instanceof APIError) throw error;
    logger.error('Error in GET /api/reports/balance-sheet:', error);
    throw error;
  }
});

export default reports;
