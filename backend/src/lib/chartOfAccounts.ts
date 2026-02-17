/**
 * Standard UK Chart of Accounts
 *
 * Provides a default chart of accounts structure for UK businesses
 */

export interface Account {
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  subtype: string;
  normalBalance: 'debit' | 'credit';
  isDefault: boolean;
}

/**
 * Standard UK Chart of Accounts
 * Based on UK GAAP and common SME accounting practices
 */
export const DEFAULT_CHART_OF_ACCOUNTS: Account[] = [
  // ASSETS (1000-1999)
  // Current Assets (1000-1499)
  { code: '1000', name: 'Bank Current Account', type: 'asset', subtype: 'Current Assets', normalBalance: 'debit', isDefault: true },
  { code: '1001', name: 'Bank Savings Account', type: 'asset', subtype: 'Current Assets', normalBalance: 'debit', isDefault: true },
  { code: '1002', name: 'Petty Cash', type: 'asset', subtype: 'Current Assets', normalBalance: 'debit', isDefault: true },
  { code: '1100', name: 'Accounts Receivable', type: 'asset', subtype: 'Current Assets', normalBalance: 'debit', isDefault: true },
  { code: '1200', name: 'Inventory', type: 'asset', subtype: 'Current Assets', normalBalance: 'debit', isDefault: true },
  { code: '1300', name: 'Prepaid Expenses', type: 'asset', subtype: 'Current Assets', normalBalance: 'debit', isDefault: true },
  { code: '1400', name: 'VAT Receivable', type: 'asset', subtype: 'Current Assets', normalBalance: 'debit', isDefault: true },

  // Fixed Assets (1500-1999)
  { code: '1500', name: 'Equipment', type: 'asset', subtype: 'Fixed Assets', normalBalance: 'debit', isDefault: true },
  { code: '1510', name: 'Equipment - Accumulated Depreciation', type: 'asset', subtype: 'Fixed Assets', normalBalance: 'credit', isDefault: true },
  { code: '1600', name: 'Vehicles', type: 'asset', subtype: 'Fixed Assets', normalBalance: 'debit', isDefault: true },
  { code: '1610', name: 'Vehicles - Accumulated Depreciation', type: 'asset', subtype: 'Fixed Assets', normalBalance: 'credit', isDefault: true },
  { code: '1700', name: 'Furniture & Fixtures', type: 'asset', subtype: 'Fixed Assets', normalBalance: 'debit', isDefault: true },
  { code: '1710', name: 'Furniture - Accumulated Depreciation', type: 'asset', subtype: 'Fixed Assets', normalBalance: 'credit', isDefault: true },
  { code: '1800', name: 'Leasehold Improvements', type: 'asset', subtype: 'Fixed Assets', normalBalance: 'debit', isDefault: true },

  // LIABILITIES (2000-2999)
  // Current Liabilities (2000-2499)
  { code: '2000', name: 'Accounts Payable', type: 'liability', subtype: 'Current Liabilities', normalBalance: 'credit', isDefault: true },
  { code: '2100', name: 'Credit Card', type: 'liability', subtype: 'Current Liabilities', normalBalance: 'credit', isDefault: true },
  { code: '2200', name: 'VAT Payable', type: 'liability', subtype: 'Current Liabilities', normalBalance: 'credit', isDefault: true },
  { code: '2300', name: 'PAYE/NI Payable', type: 'liability', subtype: 'Current Liabilities', normalBalance: 'credit', isDefault: true },
  { code: '2400', name: 'Accrued Expenses', type: 'liability', subtype: 'Current Liabilities', normalBalance: 'credit', isDefault: true },

  // Long-term Liabilities (2500-2999)
  { code: '2500', name: 'Bank Loan', type: 'liability', subtype: 'Long-term Liabilities', normalBalance: 'credit', isDefault: true },
  { code: '2600', name: 'Director Loan', type: 'liability', subtype: 'Long-term Liabilities', normalBalance: 'credit', isDefault: true },

  // EQUITY (3000-3999)
  { code: '3000', name: 'Share Capital', type: 'equity', subtype: 'Equity', normalBalance: 'credit', isDefault: true },
  { code: '3100', name: 'Retained Earnings', type: 'equity', subtype: 'Equity', normalBalance: 'credit', isDefault: true },
  { code: '3200', name: 'Current Year Earnings', type: 'equity', subtype: 'Equity', normalBalance: 'credit', isDefault: true },
  { code: '3300', name: 'Drawings', type: 'equity', subtype: 'Equity', normalBalance: 'debit', isDefault: true },

  // INCOME (4000-4999)
  { code: '4000', name: 'Sales Revenue', type: 'income', subtype: 'Revenue', normalBalance: 'credit', isDefault: true },
  { code: '4100', name: 'Service Revenue', type: 'income', subtype: 'Revenue', normalBalance: 'credit', isDefault: true },
  { code: '4200', name: 'Interest Income', type: 'income', subtype: 'Other Income', normalBalance: 'credit', isDefault: true },
  { code: '4300', name: 'Other Income', type: 'income', subtype: 'Other Income', normalBalance: 'credit', isDefault: true },

  // EXPENSES (5000-9999)
  // Cost of Sales (5000-5999)
  { code: '5000', name: 'Cost of Goods Sold', type: 'expense', subtype: 'Cost of Sales', normalBalance: 'debit', isDefault: true },
  { code: '5100', name: 'Direct Labour', type: 'expense', subtype: 'Cost of Sales', normalBalance: 'debit', isDefault: true },
  { code: '5200', name: 'Subcontractors', type: 'expense', subtype: 'Cost of Sales', normalBalance: 'debit', isDefault: true },

  // Operating Expenses (6000-8999)
  { code: '6000', name: 'Salaries & Wages', type: 'expense', subtype: 'Payroll Expenses', normalBalance: 'debit', isDefault: true },
  { code: '6100', name: 'Employer NI Contributions', type: 'expense', subtype: 'Payroll Expenses', normalBalance: 'debit', isDefault: true },
  { code: '6200', name: 'Pension Contributions', type: 'expense', subtype: 'Payroll Expenses', normalBalance: 'debit', isDefault: true },

  { code: '6500', name: 'Rent', type: 'expense', subtype: 'Occupancy Costs', normalBalance: 'debit', isDefault: true },
  { code: '6510', name: 'Rates', type: 'expense', subtype: 'Occupancy Costs', normalBalance: 'debit', isDefault: true },
  { code: '6520', name: 'Utilities', type: 'expense', subtype: 'Occupancy Costs', normalBalance: 'debit', isDefault: true },
  { code: '6530', name: 'Insurance', type: 'expense', subtype: 'Occupancy Costs', normalBalance: 'debit', isDefault: true },

  { code: '7000', name: 'Marketing & Advertising', type: 'expense', subtype: 'Sales & Marketing', normalBalance: 'debit', isDefault: true },
  { code: '7100', name: 'Website & Hosting', type: 'expense', subtype: 'Sales & Marketing', normalBalance: 'debit', isDefault: true },

  { code: '7500', name: 'Office Supplies', type: 'expense', subtype: 'Administrative', normalBalance: 'debit', isDefault: true },
  { code: '7510', name: 'Postage & Courier', type: 'expense', subtype: 'Administrative', normalBalance: 'debit', isDefault: true },
  { code: '7520', name: 'Telephone & Internet', type: 'expense', subtype: 'Administrative', normalBalance: 'debit', isDefault: true },
  { code: '7530', name: 'Software Subscriptions', type: 'expense', subtype: 'Administrative', normalBalance: 'debit', isDefault: true },

  { code: '8000', name: 'Professional Fees', type: 'expense', subtype: 'Professional Services', normalBalance: 'debit', isDefault: true },
  { code: '8010', name: 'Accountancy Fees', type: 'expense', subtype: 'Professional Services', normalBalance: 'debit', isDefault: true },
  { code: '8020', name: 'Legal Fees', type: 'expense', subtype: 'Professional Services', normalBalance: 'debit', isDefault: true },

  { code: '8500', name: 'Motor Expenses', type: 'expense', subtype: 'Vehicle Expenses', normalBalance: 'debit', isDefault: true },
  { code: '8510', name: 'Fuel', type: 'expense', subtype: 'Vehicle Expenses', normalBalance: 'debit', isDefault: true },

  { code: '8700', name: 'Travel & Accommodation', type: 'expense', subtype: 'Travel & Entertainment', normalBalance: 'debit', isDefault: true },
  { code: '8710', name: 'Meals & Entertainment', type: 'expense', subtype: 'Travel & Entertainment', normalBalance: 'debit', isDefault: true },

  { code: '9000', name: 'Bank Charges & Fees', type: 'expense', subtype: 'Financial Costs', normalBalance: 'debit', isDefault: true },
  { code: '9010', name: 'Interest Expense', type: 'expense', subtype: 'Financial Costs', normalBalance: 'debit', isDefault: true },
  { code: '9100', name: 'Depreciation', type: 'expense', subtype: 'Non-cash Expenses', normalBalance: 'debit', isDefault: true },
];

/**
 * Get account by code
 */
export function getAccountByCode(code: string): Account | undefined {
  return DEFAULT_CHART_OF_ACCOUNTS.find(acc => acc.code === code);
}

/**
 * Get accounts by type
 */
export function getAccountsByType(type: Account['type']): Account[] {
  return DEFAULT_CHART_OF_ACCOUNTS.filter(acc => acc.type === type);
}

/**
 * Get accounts by subtype
 */
export function getAccountsBySubtype(subtype: string): Account[] {
  return DEFAULT_CHART_OF_ACCOUNTS.filter(acc => acc.subtype === subtype);
}

/**
 * Validate account code format (4 digits)
 */
export function isValidAccountCode(code: string): boolean {
  return /^\d{4}$/.test(code);
}

/**
 * Get next available account code in a range
 */
export function getNextAccountCode(startCode: string): string {
  const start = parseInt(startCode);
  const existing = DEFAULT_CHART_OF_ACCOUNTS.map(acc => parseInt(acc.code));
  let next = start;

  while (existing.includes(next)) {
    next++;
  }

  return next.toString().padStart(4, '0');
}
