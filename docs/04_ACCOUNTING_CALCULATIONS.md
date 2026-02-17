# AI ACCOUNTING AUTOMATION
## Accounting Calculations & Financial Reporting Specification

**Version:** 1.0  
**Date:** February 1, 2026  
**Purpose:** Define accounting logic, calculations, and financial statement generation

---

## OVERVIEW

This document specifies the **accounting calculations and financial reporting** that must be implemented after document extraction and categorization. This is the core value-add that transforms extracted transactions into meaningful financial statements.

---

## ACCOUNTING FUNDAMENTALS

### The Accounting Equation

```
Assets = Liabilities + Equity
```

**All transactions must maintain this balance.**

### Debit & Credit Rules

| Account Type | Normal Balance | Increase | Decrease |
|--------------|----------------|----------|----------|
| **Assets** | Debit | Debit | Credit |
| **Liabilities** | Credit | Credit | Debit |
| **Equity** | Credit | Credit | Debit |
| **Revenue** | Credit | Credit | Debit |
| **Expenses** | Debit | Debit | Credit |

### Transaction Types

**Income (Credit to Revenue, Debit to Bank):**
```
Debit:   Bank Account           £1,000
Credit:  Sales Revenue          £1,000
```

**Expense (Debit to Expense, Credit to Bank):**
```
Debit:   Telephone Expense      £50
Credit:  Bank Account           £50
```

**VAT on Purchase (Debit to Expense + VAT, Credit to Bank):**
```
Debit:   Purchases              £100
Debit:   VAT Reclaimable        £20
Credit:  Bank Account           £120
```

**VAT on Sale (Debit to Bank, Credit to Sales + VAT):**
```
Debit:   Bank Account           £120
Credit:  Sales Revenue          £100
Credit:  VAT Payable            £20
```

---

## CHART OF ACCOUNTS (UK STANDARD)

### Account Structure

```
1000-1999: Assets
2000-2999: Liabilities
3000-3999: Equity
4000-4999: Revenue
5000-5999: Cost of Sales
6000-6999: Operating Expenses
7000-7999: Other Income/Expenses
```

### Full Chart of Accounts

**Assets (1000-1999)**
```
1000 - Bank Current Account
1010 - Bank Savings Account
1020 - Cash in Hand
1100 - Accounts Receivable (Debtors)
1200 - Plant & Machinery
1300 - Motor Vehicles
1400 - Office Equipment
1500 - Accumulated Depreciation
```

**Liabilities (2000-2999)**
```
2000 - Accounts Payable (Creditors)
2100 - VAT Payable
2110 - VAT Reclaimable
2200 - PAYE/NIC Payable
2300 - Loans Payable
2400 - Credit Cards
```

**Equity (3000-3999)**
```
3000 - Owner's Capital
3100 - Retained Earnings
3200 - Current Year Profit/Loss
```

**Revenue (4000-4999)**
```
4000 - Sales Revenue
4100 - Service Income
4200 - Other Income
4300 - Interest Received
```

**Cost of Sales (5000-5999)**
```
5000 - Purchases
5100 - Direct Labour
5200 - Subcontractors
```

**Operating Expenses (6000-6999)**
```
6000 - Advertising & Marketing
6100 - Bank Charges
6200 - Telephone
6300 - Postage & Stationary
6400 - Motor Expenses
6500 - Travelling
6600 - Insurance
6700 - Rent & Rates
6800 - Repairs & Maintenance
6900 - Utilities (Gas, Electric, Water)
7000 - Accountancy & Legal
7100 - Subscriptions
7200 - Office Costs
7300 - Depreciation
7400 - Bad Debts
7500 - Sundries
```

### Category-to-Account Mapping

**Default Mappings:**
```typescript
const categoryToAccount: Record<string, string> = {
  "Sales": "4000",
  "Purchases": "5000",
  "Telephone": "6200",
  "Postage & Stationary": "6300",
  "Advertising": "6000",
  "Travelling": "6500",
  "Motor Expenses": "6400",
  "Insurance": "6600",
  "Plant & Machinery": "1200",
  "Motor Vehicles": "1300",
  "Bank Charges": "6100",
  "Accountancy Fees": "7000",
  "Legal & Professional": "7000",
  "Rent & Rates": "6700",
  "Repairs & Maintenance": "6800",
  "Subcontractors": "5200",
  "Utilities": "6900",
  "Subscriptions": "7100",
  "Office Costs": "7200",
  "Sundries": "7500"
};
```

---

## TRANSACTION RECORDING

### Transaction Data Model

```typescript
interface AccountingTransaction {
  id: string;
  date: Date;
  description: string;
  reference: string;
  
  // Journal entries (double-entry)
  entries: [
    {
      account: string;      // e.g., "1000" (Bank)
      account_name: string; // e.g., "Bank Current Account"
      debit: number | null;
      credit: number | null;
    },
    {
      account: string;      // e.g., "6200" (Telephone)
      account_name: string; // e.g., "Telephone"
      debit: number | null;
      credit: number | null;
    }
  ];
  
  // Validation
  balanced: boolean;  // debit_total === credit_total
}
```

### Recording Rules

**Rule 1: Bank Deposit (Income)**
```typescript
// Transaction: £1,000 sales deposited
{
  date: "2026-02-01",
  description: "Customer payment",
  entries: [
    { account: "1000", debit: 1000, credit: null },   // Bank increases (Asset ↑)
    { account: "4000", debit: null, credit: 1000 }    // Sales increases (Revenue ↑)
  ]
}
```

**Rule 2: Bank Payment (Expense)**
```typescript
// Transaction: £50 telephone bill paid
{
  date: "2026-02-01",
  description: "BT Mobile",
  entries: [
    { account: "6200", debit: 50, credit: null },    // Telephone increases (Expense ↑)
    { account: "1000", debit: null, credit: 50 }     // Bank decreases (Asset ↓)
  ]
}
```

**Rule 3: VAT on Expense**
```typescript
// Transaction: £120 purchase (£100 + £20 VAT)
{
  date: "2026-02-01",
  description: "Tesco - Office supplies",
  entries: [
    { account: "5000", debit: 100, credit: null },   // Purchases
    { account: "2110", debit: 20, credit: null },    // VAT Reclaimable (Asset ↑)
    { account: "1000", debit: null, credit: 120 }    // Bank (Asset ↓)
  ]
}
```

**Rule 4: VAT on Income**
```typescript
// Transaction: £1,200 sale (£1,000 + £200 VAT)
{
  date: "2026-02-01",
  description: "Invoice #123",
  entries: [
    { account: "1000", debit: 1200, credit: null },  // Bank (Asset ↑)
    { account: "4000", debit: null, credit: 1000 },  // Sales (Revenue ↑)
    { account: "2100", debit: null, credit: 200 }    // VAT Payable (Liability ↑)
  ]
}
```

**Rule 5: Cash Purchase (No bank transaction)**
```typescript
// Transaction: £20 cash purchase
{
  date: "2026-02-01",
  description: "Stamps - Cash",
  entries: [
    { account: "6300", debit: 20, credit: null },    // Postage (Expense ↑)
    { account: "1020", debit: null, credit: 20 }     // Cash (Asset ↓)
  ]
}
```

---

## FINANCIAL STATEMENTS

### 1. Income Statement (Profit & Loss)

**Purpose:** Show profitability over a period

**Structure:**
```
Income Statement
For the period: 01/01/2026 - 31/01/2026

REVENUE
  Sales Revenue                              £10,000
  Service Income                              £2,000
  Other Income                                  £500
                                            --------
  Total Revenue                              £12,500

COST OF SALES
  Purchases                                   £4,000
  Direct Labour                               £1,000
  Subcontractors                                £500
                                            --------
  Total Cost of Sales                         £5,500

GROSS PROFIT                                  £7,000
Gross Profit Margin: 56.0%

OPERATING EXPENSES
  Advertising & Marketing                       £200
  Bank Charges                                   £50
  Telephone                                     £150
  Motor Expenses                                £300
  Travelling                                    £100
  Insurance                                     £200
  Rent & Rates                                  £500
  Utilities                                     £150
  Accountancy & Legal                           £400
  Office Costs                                  £100
  Sundries                                       £50
                                            --------
  Total Operating Expenses                    £2,200

NET PROFIT                                    £4,800
Net Profit Margin: 38.4%
```

**Calculation Logic:**
```typescript
function calculateIncomeStatement(
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): IncomeStatement {
  
  // Filter transactions in date range
  const filtered = transactions.filter(
    tx => tx.date >= startDate && tx.date <= endDate
  );
  
  // Sum by account type
  const revenue = sumByAccountRange(filtered, "4000", "4999");      // Revenue accounts
  const costOfSales = sumByAccountRange(filtered, "5000", "5999");  // COGS accounts
  const expenses = sumByAccountRange(filtered, "6000", "7999");     // Expense accounts
  
  // Calculate totals
  const totalRevenue = sumCredits(revenue) - sumDebits(revenue);
  const totalCOGS = sumDebits(costOfSales) - sumCredits(costOfSales);
  const totalExpenses = sumDebits(expenses) - sumCredits(expenses);
  
  const grossProfit = totalRevenue - totalCOGS;
  const netProfit = grossProfit - totalExpenses;
  
  const grossMargin = (grossProfit / totalRevenue) * 100;
  const netMargin = (netProfit / totalRevenue) * 100;
  
  return {
    period: { start: startDate, end: endDate },
    revenue: {
      items: breakdownByAccount(revenue),
      total: totalRevenue
    },
    costOfSales: {
      items: breakdownByAccount(costOfSales),
      total: totalCOGS
    },
    expenses: {
      items: breakdownByAccount(expenses),
      total: totalExpenses
    },
    grossProfit,
    grossMargin,
    netProfit,
    netMargin
  };
}
```

---

### 2. Balance Sheet

**Purpose:** Show financial position at a point in time

**Structure:**
```
Balance Sheet
As at: 31/01/2026

ASSETS

Current Assets
  Bank Current Account                        £5,000
  Cash in Hand                                  £200
  Accounts Receivable                         £1,500
                                            --------
  Total Current Assets                        £6,700

Fixed Assets
  Plant & Machinery                           £8,000
  Motor Vehicles                             £12,000
  Less: Accumulated Depreciation             (£2,000)
                                            --------
  Net Fixed Assets                           £18,000

TOTAL ASSETS                                 £24,700

LIABILITIES

Current Liabilities
  Accounts Payable                            £2,000
  VAT Payable (Net)                             £500
  PAYE/NIC Payable                              £300
                                            --------
  Total Current Liabilities                   £2,800

Long-term Liabilities
  Loans Payable                               £5,000
                                            --------
  Total Liabilities                           £7,800

EQUITY

  Owner's Capital                            £12,000
  Retained Earnings                           £4,900
                                            --------
  Total Equity                               £16,900

TOTAL LIABILITIES & EQUITY                   £24,700

Accounting Equation: ✅ BALANCED
Assets (£24,700) = Liabilities (£7,800) + Equity (£16,900)
```

**Calculation Logic:**
```typescript
function calculateBalanceSheet(
  transactions: Transaction[],
  asOfDate: Date
): BalanceSheet {
  
  // Get all transactions up to date
  const filtered = transactions.filter(tx => tx.date <= asOfDate);
  
  // Calculate account balances
  const assets = calculateAccountBalances(filtered, "1000", "1999");
  const liabilities = calculateAccountBalances(filtered, "2000", "2999");
  const equity = calculateAccountBalances(filtered, "3000", "3999");
  
  // Separate current vs fixed assets
  const currentAssets = assets.filter(a => a.account < "1200");
  const fixedAssets = assets.filter(a => a.account >= "1200");
  
  // Separate current vs long-term liabilities
  const currentLiabilities = liabilities.filter(l => l.account < "2300");
  const longTermLiabilities = liabilities.filter(l => l.account >= "2300");
  
  // Calculate totals
  const totalAssets = sumBalances(assets);
  const totalLiabilities = sumBalances(liabilities);
  const totalEquity = sumBalances(equity);
  
  // Validate accounting equation
  const balanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;
  
  return {
    asOfDate,
    assets: {
      current: { items: currentAssets, total: sumBalances(currentAssets) },
      fixed: { items: fixedAssets, total: sumBalances(fixedAssets) },
      total: totalAssets
    },
    liabilities: {
      current: { items: currentLiabilities, total: sumBalances(currentLiabilities) },
      longTerm: { items: longTermLiabilities, total: sumBalances(longTermLiabilities) },
      total: totalLiabilities
    },
    equity: {
      items: equity,
      total: totalEquity
    },
    balanced,
    difference: totalAssets - (totalLiabilities + totalEquity)
  };
}

function calculateAccountBalances(
  transactions: Transaction[],
  accountFrom: string,
  accountTo: string
): AccountBalance[] {
  
  const accounts = new Map<string, number>();
  
  for (const tx of transactions) {
    for (const entry of tx.entries) {
      if (entry.account >= accountFrom && entry.account <= accountTo) {
        const current = accounts.get(entry.account) || 0;
        const change = (entry.debit || 0) - (entry.credit || 0);
        accounts.set(entry.account, current + change);
      }
    }
  }
  
  return Array.from(accounts.entries()).map(([account, balance]) => ({
    account,
    account_name: getAccountName(account),
    balance
  }));
}
```

---

### 3. Trial Balance

**Purpose:** Verify all accounts balance (Total Debits = Total Credits)

**Structure:**
```
Trial Balance
As at: 31/01/2026

Account No | Account Name                | Debit      | Credit
-----------+-----------------------------+------------+-----------
1000       | Bank Current Account        | £5,000     |
1020       | Cash in Hand                | £200       |
1100       | Accounts Receivable         | £1,500     |
1200       | Plant & Machinery           | £8,000     |
1300       | Motor Vehicles              | £12,000    |
1500       | Accumulated Depreciation    |            | £2,000
2000       | Accounts Payable            |            | £2,000
2100       | VAT Payable                 |            | £700
2110       | VAT Reclaimable             | £200       |
2300       | Loans Payable               |            | £5,000
3000       | Owner's Capital             |            | £12,000
3200       | Current Year P/L            |            | £4,800
4000       | Sales Revenue               |            | £10,000
5000       | Purchases                   | £4,000     |
6200       | Telephone                   | £150       |
6400       | Motor Expenses              | £300       |
... (more accounts)
-----------+-----------------------------+------------+-----------
TOTALS                                   | £36,500    | £36,500

STATUS: ✅ BALANCED
```

**Calculation Logic:**
```typescript
function calculateTrialBalance(
  transactions: Transaction[],
  asOfDate: Date
): TrialBalance {
  
  const accountTotals = new Map<string, { debits: number, credits: number }>();
  
  // Sum all debits and credits by account
  for (const tx of transactions.filter(t => t.date <= asOfDate)) {
    for (const entry of tx.entries) {
      const current = accountTotals.get(entry.account) || { debits: 0, credits: 0 };
      current.debits += entry.debit || 0;
      current.credits += entry.credit || 0;
      accountTotals.set(entry.account, current);
    }
  }
  
  // Calculate net balances
  const accounts = Array.from(accountTotals.entries()).map(([account, totals]) => {
    const balance = totals.debits - totals.credits;
    return {
      account,
      account_name: getAccountName(account),
      debit: balance > 0 ? balance : null,
      credit: balance < 0 ? Math.abs(balance) : null
    };
  });
  
  // Calculate totals
  const totalDebits = accounts.reduce((sum, a) => sum + (a.debit || 0), 0);
  const totalCredits = accounts.reduce((sum, a) => sum + (a.credit || 0), 0);
  const balanced = Math.abs(totalDebits - totalCredits) < 0.01;
  
  return {
    asOfDate,
    accounts,
    totalDebits,
    totalCredits,
    balanced,
    difference: totalDebits - totalCredits
  };
}
```

---

### 4. Cash Flow Statement

**Purpose:** Track actual cash movement (not accrual-basis P&L)

**Structure:**
```
Cash Flow Statement
For the period: 01/01/2026 - 31/01/2026

OPERATING ACTIVITIES
  Cash receipts from customers              £12,000
  Cash paid to suppliers                    (£4,500)
  Cash paid for expenses                    (£2,200)
                                           ---------
  Net cash from operating activities         £5,300

INVESTING ACTIVITIES
  Purchase of plant & machinery             (£1,000)
  Purchase of motor vehicles                (£2,000)
                                           ---------
  Net cash from investing activities        (£3,000)

FINANCING ACTIVITIES
  Loan proceeds                              £5,000
  Loan repayments                           (£1,000)
  Owner drawings                            (£1,500)
                                           ---------
  Net cash from financing activities         £2,500

NET INCREASE IN CASH                         £4,800

Cash at beginning of period                    £200
Cash at end of period                        £5,000

RECONCILIATION
Bank balance (from Balance Sheet):           £5,000 ✅
```

**Calculation Logic:**
```typescript
function calculateCashFlowStatement(
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): CashFlowStatement {
  
  const filtered = transactions.filter(
    tx => tx.date >= startDate && tx.date <= endDate
  );
  
  // Operating activities (Revenue & Expense accounts that touched bank/cash)
  const operating = filtered.filter(tx =>
    tx.entries.some(e => e.account === "1000" || e.account === "1020") &&
    tx.entries.some(e => (e.account >= "4000" && e.account <= "7999"))
  );
  
  const receipts = sumCashInflows(operating);
  const payments = sumCashOutflows(operating);
  
  // Investing activities (Asset purchases)
  const investing = filtered.filter(tx =>
    tx.entries.some(e => e.account >= "1200" && e.account <= "1499")
  );
  
  const assetPurchases = sumCashOutflows(investing);
  const assetSales = sumCashInflows(investing);
  
  // Financing activities (Loans, drawings, capital)
  const financing = filtered.filter(tx =>
    tx.entries.some(e => e.account >= "2300" && e.account <= "3999")
  );
  
  const loanProceeds = sumCashInflows(financing);
  const loanRepayments = sumCashOutflows(financing);
  const drawings = sumDrawings(financing);
  const capitalContributions = sumCapitalContributions(financing);
  
  // Calculate net change
  const netOperating = receipts - payments;
  const netInvesting = assetSales - assetPurchases;
  const netFinancing = loanProceeds - loanRepayments + capitalContributions - drawings;
  
  const netChange = netOperating + netInvesting + netFinancing;
  
  // Get opening/closing balances
  const openingCash = getCashBalance(transactions, startDate);
  const closingCash = openingCash + netChange;
  
  return {
    period: { start: startDate, end: endDate },
    operating: {
      receipts,
      payments,
      net: netOperating
    },
    investing: {
      assetPurchases,
      assetSales,
      net: netInvesting
    },
    financing: {
      loanProceeds,
      loanRepayments,
      drawings,
      capitalContributions,
      net: netFinancing
    },
    netChange,
    openingCash,
    closingCash
  };
}
```

---

## VAT CALCULATIONS

### VAT Return (Box 1-9 for MTD)

```
VAT Return
For the period: 01/01/2026 - 31/03/2026

Box 1: VAT due on sales and outputs           £2,000
Box 2: VAT due on acquisitions from EU            £0
Box 3: Total VAT due (Box 1 + Box 2)          £2,000

Box 4: VAT reclaimed on purchases              £1,500
Box 5: Net VAT to pay (Box 3 - Box 4)           £500

Box 6: Total sales (excluding VAT)           £10,000
Box 7: Total purchases (excluding VAT)        £7,500
Box 8: Total supplies (excluding VAT)        £10,000
Box 9: Total acquisitions (excluding VAT)         £0
```

**Calculation Logic:**
```typescript
function calculateVATReturn(
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): VATReturn {
  
  const filtered = transactions.filter(
    tx => tx.date >= startDate && tx.date <= endDate
  );
  
  // Box 1: VAT on sales (Credit balance on 2100 account)
  const vatOnSales = sumAccountCredits(filtered, "2100");
  
  // Box 2: VAT on EU acquisitions (usually 0 for small businesses)
  const vatOnAcquisitions = 0;
  
  // Box 3: Total VAT due
  const totalVATDue = vatOnSales + vatOnAcquisitions;
  
  // Box 4: VAT reclaimed (Debit balance on 2110 account)
  const vatReclaimed = sumAccountDebits(filtered, "2110");
  
  // Box 5: Net VAT to pay (or reclaim if negative)
  const netVAT = totalVATDue - vatReclaimed;
  
  // Box 6: Total sales excluding VAT (Credit balances on 4000-4999)
  const totalSales = sumAccountCredits(filtered, "4000", "4999");
  
  // Box 7: Total purchases excluding VAT (Debit balances on 5000-6999)
  const totalPurchases = sumAccountDebits(filtered, "5000", "6999");
  
  // Box 8: Total supplies (same as Box 6 for most businesses)
  const totalSupplies = totalSales;
  
  // Box 9: Total acquisitions (EU only, usually 0)
  const totalAcquisitions = 0;
  
  return {
    period: { start: startDate, end: endDate },
    box1_vatOnSales: vatOnSales,
    box2_vatOnAcquisitions: vatOnAcquisitions,
    box3_totalVATDue: totalVATDue,
    box4_vatReclaimed: vatReclaimed,
    box5_netVAT: netVAT,
    box6_totalSales: totalSales,
    box7_totalPurchases: totalPurchases,
    box8_totalSupplies: totalSupplies,
    box9_totalAcquisitions: totalAcquisitions
  };
}
```

---

## IMPLEMENTATION REQUIREMENTS

### Database Schema Additions

**Add to transactions table:**
```sql
ALTER TABLE transactions ADD COLUMN account_code TEXT;
ALTER TABLE transactions ADD COLUMN account_name TEXT;
ALTER TABLE transactions ADD COLUMN debit_amount NUMERIC(12,2);
ALTER TABLE transactions ADD COLUMN credit_amount NUMERIC(12,2);

-- Ensure double-entry: each source transaction creates 2+ journal entries
-- Option 1: Store as JSONB in existing table
ALTER TABLE transactions ADD COLUMN journal_entries JSONB;

-- Option 2: Separate journal_entries table (recommended)
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY,
  transaction_id UUID REFERENCES transactions(id),
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  debit_amount NUMERIC(12,2),
  credit_amount NUMERIC(12,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_journal_entries_transaction_id ON journal_entries(transaction_id);
CREATE INDEX idx_journal_entries_account_code ON journal_entries(account_code);
```

**New table: chart_of_accounts**
```sql
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL, -- 'asset', 'liability', 'equity', 'revenue', 'expense'
  parent_account TEXT,
  normal_balance TEXT NOT NULL, -- 'debit' or 'credit'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(organization_id, account_code)
);
```

**New table: account_category_mappings**
```sql
CREATE TABLE account_category_mappings (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  category TEXT NOT NULL,
  account_code TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(organization_id, category)
);
```

### API Endpoints to Add

**GET /api/reports/income-statement**
```typescript
Query: ?client_id=xxx&start_date=2026-01-01&end_date=2026-01-31
Response: IncomeStatement (as defined above)
```

**GET /api/reports/balance-sheet**
```typescript
Query: ?client_id=xxx&as_of_date=2026-01-31
Response: BalanceSheet (as defined above)
```

**GET /api/reports/trial-balance**
```typescript
Query: ?client_id=xxx&as_of_date=2026-01-31
Response: TrialBalance (as defined above)
```

**GET /api/reports/cash-flow**
```typescript
Query: ?client_id=xxx&start_date=2026-01-01&end_date=2026-01-31
Response: CashFlowStatement (as defined above)
```

**GET /api/reports/vat-return**
```typescript
Query: ?client_id=xxx&start_date=2026-01-01&end_date=2026-03-31
Response: VATReturn (Box 1-9 as defined above)
```

**GET /api/reports/comparison**
```typescript
Query: ?client_id=xxx&period1_start=...&period1_end=...&period2_start=...&period2_end=...
Response: {
  period1: IncomeStatement,
  period2: IncomeStatement,
  variance: {
    revenue: { amount: xxx, percent: xxx },
    expenses: { amount: xxx, percent: xxx },
    profit: { amount: xxx, percent: xxx }
  }
}
```

### Worker to Add: JournalEntryWorker

**Purpose:** Convert extracted transactions into double-entry journal entries

**Process:**
1. After transaction is categorized, trigger journal entry creation
2. Determine debit/credit based on transaction type and category
3. Create 2+ journal entries per transaction (double-entry)
4. Validate entries balance (total debits = total credits)
5. Store in journal_entries table

**Example:**
```typescript
async function createJournalEntries(transaction: Transaction) {
  const entries: JournalEntry[] = [];
  
  // Determine transaction type
  if (transaction.type === 'credit') {
    // Income: Debit Bank, Credit Revenue
    entries.push({
      account_code: "1000",
      account_name: "Bank Current Account",
      debit_amount: transaction.amount,
      credit_amount: null
    });
    
    const revenueAccount = getCategoryAccount(transaction.category);
    entries.push({
      account_code: revenueAccount.code,
      account_name: revenueAccount.name,
      debit_amount: null,
      credit_amount: transaction.amount
    });
    
    // VAT if applicable
    if (transaction.vat_amount) {
      entries[1].credit_amount = transaction.amount - transaction.vat_amount;
      entries.push({
        account_code: "2100",
        account_name: "VAT Payable",
        debit_amount: null,
        credit_amount: transaction.vat_amount
      });
    }
    
  } else if (transaction.type === 'debit') {
    // Expense: Debit Expense, Credit Bank
    const expenseAccount = getCategoryAccount(transaction.category);
    entries.push({
      account_code: expenseAccount.code,
      account_name: expenseAccount.name,
      debit_amount: transaction.amount - (transaction.vat_amount || 0),
      credit_amount: null
    });
    
    // VAT if applicable
    if (transaction.vat_amount) {
      entries.push({
        account_code: "2110",
        account_name: "VAT Reclaimable",
        debit_amount: transaction.vat_amount,
        credit_amount: null
      });
    }
    
    entries.push({
      account_code: "1000",
      account_name: "Bank Current Account",
      debit_amount: null,
      credit_amount: transaction.amount
    });
  }
  
  // Validate entries balance
  const totalDebits = entries.reduce((sum, e) => sum + (e.debit_amount || 0), 0);
  const totalCredits = entries.reduce((sum, e) => sum + (e.credit_amount || 0), 0);
  
  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    throw new Error("Journal entries don't balance");
  }
  
  // Save to database
  await saveJournalEntries(transaction.id, entries);
}
```

---

## TESTING & VALIDATION

### Accounting Equation Tests

**Test 1: Balance Sheet Equation**
```typescript
test('Balance sheet balances', () => {
  const balanceSheet = calculateBalanceSheet(transactions, new Date('2026-01-31'));
  
  expect(balanceSheet.balanced).toBe(true);
  expect(balanceSheet.assets.total).toBeCloseTo(
    balanceSheet.liabilities.total + balanceSheet.equity.total,
    2
  );
});
```

**Test 2: Trial Balance**
```typescript
test('Trial balance balances', () => {
  const trialBalance = calculateTrialBalance(transactions, new Date('2026-01-31'));
  
  expect(trialBalance.balanced).toBe(true);
  expect(trialBalance.totalDebits).toBeCloseTo(trialBalance.totalCredits, 2);
});
```

**Test 3: Journal Entries Balance**
```typescript
test('All journal entries balance', () => {
  for (const transaction of transactions) {
    const entries = getJournalEntries(transaction.id);
    const debits = entries.reduce((sum, e) => sum + (e.debit_amount || 0), 0);
    const credits = entries.reduce((sum, e) => sum + (e.credit_amount || 0), 0);
    
    expect(debits).toBeCloseTo(credits, 2);
  }
});
```

**Test 4: Cash Flow Reconciles to Bank Balance**
```typescript
test('Cash flow reconciles to balance sheet', () => {
  const cashFlow = calculateCashFlowStatement(transactions, startDate, endDate);
  const balanceSheet = calculateBalanceSheet(transactions, endDate);
  
  const bankBalance = balanceSheet.assets.current.items.find(
    a => a.account === "1000"
  )?.balance || 0;
  
  expect(cashFlow.closingCash).toBeCloseTo(bankBalance, 2);
});
```

---

## SUCCESS CRITERIA

### Functional Requirements
- ✅ All transactions recorded as double-entry (2+ journal entries each)
- ✅ Trial balance always balances (debits = credits)
- ✅ Balance sheet always balances (Assets = Liabilities + Equity)
- ✅ Income statement calculates correctly (Revenue - Expenses = Profit)
- ✅ Cash flow reconciles to bank balance
- ✅ VAT return Box 1-9 calculated correctly
- ✅ Multi-period comparison shows accurate variance

### Performance Requirements
- ✅ Income statement generation: <2 seconds for 1,000 transactions
- ✅ Balance sheet generation: <2 seconds for 1,000 transactions
- ✅ Trial balance generation: <3 seconds for 1,000 transactions

### Accuracy Requirements
- ✅ 100% accuracy on arithmetic (no rounding errors >£0.01)
- ✅ 100% compliance with UK accounting standards
- ✅ 100% MTD-compliant VAT returns

---

**Document Version:** 1.0  
**Last Updated:** February 1, 2026  
**Next Review:** After MVP Testing (Week 14)
