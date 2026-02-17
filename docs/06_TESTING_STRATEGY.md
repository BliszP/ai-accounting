# AI ACCOUNTING AUTOMATION
## Testing Strategy & Test Case Documentation

**Version:** 1.0  
**Date:** February 1, 2026  
**Purpose:** Complete testing strategy, test cases, and quality assurance procedures

---

## OVERVIEW

Testing is **CRITICAL** for this application because:
- ❗ **Financial accuracy** - Wrong calculations = client loses money
- ❗ **Data security** - Breach = GDPR violation (£20M fine)
- ❗ **Trust** - Design partner needs 95%+ accuracy to trust system
- ❗ **Compliance** - VAT errors = HMRC penalties for clients
- ❗ **Business success** - No bugs = testimonial = referrals = growth

**Testing Philosophy:** "Test early, test often, test everything financial twice"

---

## TESTING TECH STACK

### **Frontend Testing**

**1. Vitest** (Unit & Integration Tests)
- **What:** Fast unit testing framework (Vite-based)
- **Why:** 10x faster than Jest, TypeScript native
- **Use for:** React components, utility functions, hooks

```bash
npm install -D vitest @vitest/ui
npm install -D @testing-library/react @testing-library/user-event
npm install -D @testing-library/jest-dom jsdom
```

**2. React Testing Library** (Component Tests)
- **What:** Test components like users interact with them
- **Why:** Focus on behavior, not implementation
- **Use for:** UI components, user interactions

**3. Playwright** (E2E Tests)
- **What:** End-to-end browser testing
- **Why:** Tests real user workflows in real browsers
- **Use for:** Complete user journeys (login → upload → review → export)

```bash
npm install -D @playwright/test
npx playwright install
```

### **Backend Testing**

**4. Vitest** (API & Service Tests)
- **What:** Same framework as frontend
- **Why:** Unified testing approach
- **Use for:** API endpoints, workers, database functions

**5. Supertest** (HTTP Testing)
- **What:** HTTP assertions library
- **Why:** Test REST APIs easily
- **Use for:** API endpoint testing

```bash
npm install -D supertest
```

**6. PostgreSQL Test Database** (Isolated Testing)
- **What:** Separate database for tests
- **Why:** Don't corrupt production data
- **Use for:** Database integration tests

### **Accounting Testing**

**7. Custom Accounting Test Suite** (Financial Validation)
- **What:** Custom tests for accounting logic
- **Why:** Verify double-entry bookkeeping, trial balance, etc.
- **Use for:** Financial calculations, report generation

### **AI Testing**

**8. Claude API Mocking** (Deterministic AI Tests)
- **What:** Mock Claude responses for predictable tests
- **Why:** Can't rely on non-deterministic AI in tests
- **Use for:** Extraction worker tests

---

## TESTING LEVELS

### **Level 1: Unit Tests** (Test individual functions)

**Coverage:** 80%+ of utility functions, calculations

**Examples:**

```typescript
// tests/lib/vat.test.ts
import { describe, it, expect } from 'vitest';
import { calculateVAT, extractVAT } from '@/lib/vat';

describe('VAT Calculations', () => {
  it('calculates 20% VAT correctly', () => {
    const result = calculateVAT(100, 0.20);
    expect(result).toBe(20);
  });

  it('extracts VAT from gross amount', () => {
    const result = extractVAT(120, 0.20);
    expect(result).toEqual({
      net: 100,
      vat: 20,
      gross: 120
    });
  });

  it('handles zero VAT', () => {
    const result = calculateVAT(100, 0);
    expect(result).toBe(0);
  });

  it('rounds to 2 decimal places', () => {
    const result = calculateVAT(33.33, 0.20);
    expect(result).toBe(6.67); // Not 6.666
  });
});
```

```typescript
// tests/lib/accounting.test.ts
import { describe, it, expect } from 'vitest';
import { validateTrialBalance, generateIncomeStatement } from '@/lib/accounting';

describe('Trial Balance Validation', () => {
  it('validates balanced trial balance', () => {
    const accounts = [
      { code: '1000', debit: 5000, credit: 0 },   // Bank
      { code: '4000', debit: 0, credit: 5000 },   // Revenue
    ];
    
    const result = validateTrialBalance(accounts);
    expect(result.balanced).toBe(true);
    expect(result.totalDebits).toBe(5000);
    expect(result.totalCredits).toBe(5000);
  });

  it('detects unbalanced trial balance', () => {
    const accounts = [
      { code: '1000', debit: 5000, credit: 0 },
      { code: '4000', debit: 0, credit: 4000 }, // Unbalanced!
    ];
    
    const result = validateTrialBalance(accounts);
    expect(result.balanced).toBe(false);
    expect(result.difference).toBe(1000);
  });
});

describe('Income Statement Generation', () => {
  it('calculates profit correctly', () => {
    const transactions = [
      { account: '4000', debit: 0, credit: 10000 },      // Revenue
      { account: '5000', debit: 4000, credit: 0 },       // COGS
      { account: '6200', debit: 500, credit: 0 },        // Expenses
    ];
    
    const statement = generateIncomeStatement(transactions);
    expect(statement.totalRevenue).toBe(10000);
    expect(statement.totalCOGS).toBe(4000);
    expect(statement.totalExpenses).toBe(500);
    expect(statement.grossProfit).toBe(6000);
    expect(statement.netProfit).toBe(5500);
    expect(statement.netMargin).toBe(55); // 5500/10000 = 55%
  });
});
```

**Run Unit Tests:**
```bash
npm run test:unit
# Or with coverage
npm run test:unit -- --coverage
```

---

### **Level 2: Integration Tests** (Test components working together)

**Coverage:** Critical integrations (Upload → Extraction, Review → Approval)

**Examples:**

```typescript
// tests/integration/document-upload.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { uploadDocument, extractTransactions } from '@/lib/api';
import { createTestClient } from './helpers';

describe('Document Upload & Extraction', () => {
  let client;
  
  beforeEach(async () => {
    client = await createTestClient();
  });

  afterEach(async () => {
    await cleanupTestData(client.id);
  });

  it('uploads bank statement and extracts transactions', async () => {
    // 1. Upload document
    const file = new File([samplePDF], 'statement.pdf', { type: 'application/pdf' });
    const uploadResult = await uploadDocument(client.id, file);
    
    expect(uploadResult.status).toBe('queued');
    expect(uploadResult.documentId).toBeDefined();
    
    // 2. Wait for processing
    await waitForProcessing(uploadResult.documentId, 30000); // 30s timeout
    
    // 3. Verify extraction
    const transactions = await extractTransactions(uploadResult.documentId);
    
    expect(transactions.length).toBeGreaterThan(0);
    expect(transactions[0]).toHaveProperty('date');
    expect(transactions[0]).toHaveProperty('merchant');
    expect(transactions[0]).toHaveProperty('amount');
    expect(transactions[0]).toHaveProperty('category');
  });

  it('handles invalid file type', async () => {
    const file = new File(['invalid'], 'test.txt', { type: 'text/plain' });
    
    await expect(
      uploadDocument(client.id, file)
    ).rejects.toThrow('Invalid file type');
  });
});
```

```typescript
// tests/integration/review-approval.test.ts
import { describe, it, expect } from 'vitest';
import { approveTransaction, getJournalEntries } from '@/lib/api';

describe('Review & Approval Flow', () => {
  it('creates journal entries when transaction approved', async () => {
    // 1. Create test transaction
    const transaction = await createTestTransaction({
      merchant: 'Tesco',
      amount: 45.32,
      vat: 7.55,
      category: 'Purchases',
      type: 'debit'
    });
    
    // 2. Approve transaction
    await approveTransaction(transaction.id);
    
    // 3. Verify journal entries created
    const entries = await getJournalEntries(transaction.id);
    
    expect(entries).toHaveLength(3); // Purchases + VAT + Bank
    
    // Verify double-entry
    const totalDebits = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredits = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
    
    expect(totalDebits).toBe(totalCredits); // Must balance!
    expect(totalDebits).toBe(45.32);
  });
});
```

**Run Integration Tests:**
```bash
npm run test:integration
```

---

### **Level 3: End-to-End Tests** (Test complete user workflows)

**Coverage:** Critical user journeys

**Tech:** Playwright

**Examples:**

```typescript
// tests/e2e/upload-to-export.spec.ts
import { test, expect } from '@playwright/test';

test('Complete workflow: Upload → Review → Export', async ({ page }) => {
  // 1. Login
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  
  await expect(page).toHaveURL('/dashboard');
  
  // 2. Navigate to Upload
  await page.click('text=Upload Documents');
  
  // 3. Select client
  await page.selectOption('select[name="client"]', 'ABC Ltd');
  
  // 4. Upload file
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles('./test-data/sample-statement.pdf');
  
  // 5. Process
  await page.click('text=Process Files');
  
  // 6. Wait for processing (show toast)
  await expect(page.locator('text=Processing complete')).toBeVisible({ timeout: 60000 });
  
  // 7. Navigate to Review Queue
  await page.click('text=Review Queue');
  
  // 8. Verify transactions loaded
  await expect(page.locator('[data-testid="transaction-card"]')).toBeVisible();
  
  // 9. Approve first transaction
  await page.click('button:has-text("Approve")');
  
  // 10. Wait for approval
  await expect(page.locator('text=Transaction approved')).toBeVisible();
  
  // 11. Navigate to Export
  await page.click('text=Export');
  
  // 12. Select format
  await page.selectOption('select[name="format"]', 'iris-kashflow');
  
  // 13. Export
  const downloadPromise = page.waitForEvent('download');
  await page.click('text=Export');
  const download = await downloadPromise;
  
  // 14. Verify file downloaded
  expect(download.suggestedFilename()).toMatch(/export.*\.csv/);
});
```

```typescript
// tests/e2e/client-management.spec.ts
import { test, expect } from '@playwright/test';

test('Add client and upload document', async ({ page }) => {
  await page.goto('/login');
  // ... login ...
  
  // 1. Add new client
  await page.click('text=Clients');
  await page.click('text=Add Client');
  
  await page.fill('[name="name"]', 'Test Corp Ltd');
  await page.fill('[name="vatNumber"]', 'GB123456789');
  await page.fill('[name="email"]', 'contact@testcorp.com');
  
  await page.click('button:has-text("Add Client")');
  
  await expect(page.locator('text=Client added successfully')).toBeVisible();
  
  // 2. Upload document for new client
  await page.click('text=Upload Documents');
  
  // Client should be pre-selected (or select it)
  const selectedClient = await page.locator('select[name="client"]').inputValue();
  expect(selectedClient).toContain('Test Corp Ltd');
  
  // ... rest of upload flow ...
});
```

**Run E2E Tests:**
```bash
npm run test:e2e
# Or in UI mode
npm run test:e2e -- --ui
```

---

### **Level 4: API Tests** (Test backend endpoints)

**Coverage:** All API endpoints

**Examples:**

```typescript
// tests/api/documents.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '@/server';
import { createTestUser, getAuthToken } from './helpers';

describe('POST /api/documents/upload', () => {
  let authToken;
  
  beforeAll(async () => {
    const user = await createTestUser();
    authToken = await getAuthToken(user.email, 'password');
  });

  it('uploads document successfully', async () => {
    const response = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .field('clientId', 'client-123')
      .attach('file', './test-data/sample.pdf')
      .expect(201);
    
    expect(response.body).toHaveProperty('documentId');
    expect(response.body.status).toBe('queued');
  });

  it('rejects unauthorized requests', async () => {
    await request(app)
      .post('/api/documents/upload')
      .field('clientId', 'client-123')
      .attach('file', './test-data/sample.pdf')
      .expect(401);
  });

  it('validates file type', async () => {
    const response = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .field('clientId', 'client-123')
      .attach('file', './test-data/invalid.txt')
      .expect(400);
    
    expect(response.body.error).toContain('Invalid file type');
  });

  it('validates file size', async () => {
    const response = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .field('clientId', 'client-123')
      .attach('file', './test-data/huge-file.pdf') // >10MB
      .expect(413);
    
    expect(response.body.error).toContain('File too large');
  });
});

describe('GET /api/reports/income-statement', () => {
  it('generates income statement', async () => {
    const response = await request(app)
      .get('/api/reports/income-statement')
      .set('Authorization', `Bearer ${authToken}`)
      .query({
        clientId: 'client-123',
        startDate: '2026-01-01',
        endDate: '2026-01-31'
      })
      .expect(200);
    
    expect(response.body).toHaveProperty('revenue');
    expect(response.body).toHaveProperty('expenses');
    expect(response.body).toHaveProperty('netProfit');
    expect(response.body.revenue.total).toBeGreaterThanOrEqual(0);
  });

  it('validates date range', async () => {
    await request(app)
      .get('/api/reports/income-statement')
      .set('Authorization', `Bearer ${authToken}`)
      .query({
        clientId: 'client-123',
        startDate: 'invalid',
        endDate: '2026-01-31'
      })
      .expect(400);
  });
});
```

**Run API Tests:**
```bash
npm run test:api
```

---

### **Level 5: Accounting Tests** (CRITICAL - Financial Validation)

**Coverage:** All accounting calculations, financial reports

**These are the most important tests because errors = client loses money**

```typescript
// tests/accounting/double-entry.test.ts
import { describe, it, expect } from 'vitest';
import { 
  createJournalEntries, 
  validateTrialBalance,
  generateBalanceSheet 
} from '@/lib/accounting';

describe('Double-Entry Bookkeeping', () => {
  it('creates balanced journal entries for income', () => {
    const transaction = {
      type: 'credit',
      amount: 1000,
      merchant: 'Customer A',
      category: 'Sales',
      vatAmount: 0
    };
    
    const entries = createJournalEntries(transaction);
    
    // Must have 2 entries (Bank + Revenue)
    expect(entries).toHaveLength(2);
    
    // Validate debits = credits
    const totalDebits = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredits = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
    
    expect(totalDebits).toBe(totalCredits);
    expect(totalDebits).toBe(1000);
    
    // Verify correct accounts
    expect(entries.find(e => e.account === '1000')?.debit).toBe(1000); // Bank debit
    expect(entries.find(e => e.account === '4000')?.credit).toBe(1000); // Sales credit
  });

  it('creates balanced journal entries for expense with VAT', () => {
    const transaction = {
      type: 'debit',
      amount: 120, // £100 + £20 VAT
      merchant: 'Tesco',
      category: 'Purchases',
      vatAmount: 20,
      vatRate: 0.20
    };
    
    const entries = createJournalEntries(transaction);
    
    // Must have 3 entries (Purchases + VAT + Bank)
    expect(entries).toHaveLength(3);
    
    // Validate debits = credits
    const totalDebits = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredits = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
    
    expect(totalDebits).toBe(totalCredits);
    expect(totalDebits).toBe(120);
    
    // Verify correct accounts
    expect(entries.find(e => e.account === '5000')?.debit).toBe(100);  // Purchases
    expect(entries.find(e => e.account === '2110')?.debit).toBe(20);   // VAT Reclaimable
    expect(entries.find(e => e.account === '1000')?.credit).toBe(120); // Bank
  });
});

describe('Trial Balance Validation', () => {
  it('validates accounting equation', () => {
    const accounts = [
      // Assets
      { code: '1000', name: 'Bank', debit: 5000, credit: 0 },
      { code: '1200', name: 'Equipment', debit: 10000, credit: 0 },
      // Liabilities
      { code: '2000', name: 'Creditors', debit: 0, credit: 2000 },
      { code: '2300', name: 'Loan', debit: 0, credit: 5000 },
      // Equity
      { code: '3000', name: 'Capital', debit: 0, credit: 8000 },
    ];
    
    const result = validateTrialBalance(accounts);
    
    expect(result.balanced).toBe(true);
    expect(result.totalDebits).toBe(15000);
    expect(result.totalCredits).toBe(15000);
    expect(result.difference).toBe(0);
  });
});

describe('Balance Sheet Generation', () => {
  it('validates Assets = Liabilities + Equity', async () => {
    // Create test transactions
    await createTestTransactions();
    
    const balanceSheet = await generateBalanceSheet('2026-01-31');
    
    const totalAssets = balanceSheet.assets.total;
    const totalLiabilities = balanceSheet.liabilities.total;
    const totalEquity = balanceSheet.equity.total;
    
    // CRITICAL: Accounting equation must balance
    expect(totalAssets).toBe(totalLiabilities + totalEquity);
    expect(balanceSheet.balanced).toBe(true);
    expect(Math.abs(balanceSheet.difference)).toBeLessThan(0.01); // Allow 1p rounding
  });
});

describe('VAT Return Calculation', () => {
  it('calculates Box 1-9 correctly', async () => {
    const vatReturn = await generateVATReturn('2026-01-01', '2026-03-31');
    
    // Box 3 = Box 1 + Box 2
    expect(vatReturn.box3_totalVATDue).toBe(
      vatReturn.box1_vatOnSales + vatReturn.box2_vatOnAcquisitions
    );
    
    // Box 5 = Box 3 - Box 4
    expect(vatReturn.box5_netVAT).toBe(
      vatReturn.box3_totalVATDue - vatReturn.box4_vatReclaimed
    );
    
    // All boxes should be non-negative
    expect(vatReturn.box1_vatOnSales).toBeGreaterThanOrEqual(0);
    expect(vatReturn.box4_vatReclaimed).toBeGreaterThanOrEqual(0);
    
    // Box 6 and 7 should match revenue and expenses
    expect(vatReturn.box6_totalSales).toBeGreaterThanOrEqual(0);
    expect(vatReturn.box7_totalPurchases).toBeGreaterThanOrEqual(0);
  });
});
```

**Run Accounting Tests:**
```bash
npm run test:accounting
# These must pass 100% before production!
```

---

### **Level 6: AI Extraction Tests** (Mock Claude API)

**Coverage:** Document extraction accuracy

**Challenge:** Claude API is non-deterministic, so we mock it for tests

```typescript
// tests/ai/extraction.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractTransactions } from '@/workers/extraction';
import { mockClaudeAPI } from './mocks';

describe('Document Extraction', () => {
  beforeEach(() => {
    // Mock Claude API responses
    vi.mock('@/lib/claude', () => ({
      callClaude: mockClaudeAPI
    }));
  });

  it('extracts bank statement transactions', async () => {
    const document = {
      id: 'doc-123',
      type: 'bank_statement',
      fileUrl: './test-data/sample-statement.pdf'
    };
    
    const result = await extractTransactions(document);
    
    expect(result.transactions).toHaveLength(15);
    expect(result.transactions[0]).toMatchObject({
      date: expect.any(String),
      merchant: expect.any(String),
      amount: expect.any(Number),
      type: expect.stringMatching(/^(credit|debit)$/)
    });
  });

  it('extracts receipt with VAT', async () => {
    const document = {
      id: 'doc-456',
      type: 'receipt',
      fileUrl: './test-data/sample-receipt.jpg'
    };
    
    const result = await extractTransactions(document);
    
    expect(result.transactions).toHaveLength(1);
    
    const transaction = result.transactions[0];
    expect(transaction).toMatchObject({
      merchant: expect.any(String),
      amount: expect.any(Number),
      vatAmount: expect.any(Number),
      vatRate: 0.20 // UK VAT rate
    });
    
    // VAT should be ~16.67% of gross (20% of net)
    const expectedVAT = transaction.amount * (1/6);
    expect(Math.abs(transaction.vatAmount - expectedVAT)).toBeLessThan(0.05);
  });

  it('handles poor quality receipt', async () => {
    const document = {
      id: 'doc-789',
      type: 'receipt',
      fileUrl: './test-data/blurry-receipt.jpg'
    };
    
    const result = await extractTransactions(document);
    
    // Should still extract something (even if low confidence)
    expect(result.transactions).toHaveLength(1);
    expect(result.confidence).toBeLessThan(0.8); // Low confidence flag
  });
});
```

---

## TEST DATA

### **Sample Test Files**

Create these files in `tests/test-data/`:

```
tests/test-data/
├── sample-statement.pdf       # Bank statement with 15 transactions
├── sample-receipt.jpg          # Clear receipt with VAT
├── blurry-receipt.jpg         # Poor quality receipt
├── invalid.txt                # Invalid file type
├── huge-file.pdf              # >10MB file (for size validation)
├── sample-invoice.pdf         # Invoice PDF
└── expected-outputs.json      # Expected extraction results
```

### **Expected Outputs**

```json
// tests/test-data/expected-outputs.json
{
  "sample-statement.pdf": {
    "transactionCount": 15,
    "transactions": [
      {
        "date": "2026-01-02",
        "merchant": "TESCO STORES",
        "amount": 45.32,
        "type": "debit"
      },
      {
        "date": "2026-01-03",
        "merchant": "SALARY PAYMENT",
        "amount": 3000.00,
        "type": "credit"
      }
      // ... 13 more
    ]
  },
  "sample-receipt.jpg": {
    "transactionCount": 1,
    "transactions": [
      {
        "merchant": "TESCO",
        "date": "2026-01-15",
        "amount": 45.32,
        "vatAmount": 7.55,
        "vatRate": 0.20
      }
    ]
  }
}
```

---

## TEST CASE DOCUMENTATION

### **Critical Test Cases (Must Pass for Production)**

| ID | Test Case | Type | Priority | Pass Criteria |
|----|-----------|------|----------|---------------|
| **TC-001** | Upload PDF bank statement | E2E | CRITICAL | File uploads, processes, extracts 95%+ transactions |
| **TC-002** | Upload JPG receipt | E2E | CRITICAL | Image uploads, OCR works, extracts amount + VAT |
| **TC-003** | Review and approve transaction | E2E | CRITICAL | Transaction moves to approved, journal entries created |
| **TC-004** | Generate Income Statement | Integration | CRITICAL | Report generated, calculations correct |
| **TC-005** | Trial Balance validates | Accounting | CRITICAL | Debits = Credits (100% pass rate) |
| **TC-006** | Balance Sheet equation | Accounting | CRITICAL | Assets = Liabilities + Equity (100%) |
| **TC-007** | VAT Return Box 1-9 | Accounting | CRITICAL | All boxes calculated correctly |
| **TC-008** | Export to IRIS Kashflow | E2E | CRITICAL | CSV file downloads, format correct |
| **TC-009** | Multi-tenant isolation | Security | CRITICAL | User A cannot see User B's data |
| **TC-010** | File type validation | API | HIGH | Reject .txt, .exe, etc. |
| **TC-011** | File size validation | API | HIGH | Reject files >10MB |
| **TC-012** | Duplicate prevention | Business | HIGH | Don't process same document twice |
| **TC-013** | Categorization learning | Integration | MEDIUM | Learns from corrections |
| **TC-014** | Mobile responsive | UI | MEDIUM | Works on tablet/phone |
| **TC-015** | Keyboard navigation | Accessibility | MEDIUM | Tab through all controls |

---

## TESTING WORKFLOW

### **Phase 1: Development (Week 1-12)**

**Daily:**
```bash
# Run unit tests on save (watch mode)
npm run test:unit -- --watch

# Before committing
npm run test:unit
npm run test:api
git commit -m "Feature: ..."
```

**Weekly:**
```bash
# Run all tests
npm run test:all

# Check coverage
npm run test:coverage
# Target: 80%+ coverage
```

### **Phase 2: Integration Testing (Week 11-12)**

**Before beta:**
```bash
# Run full test suite
npm run test:all

# Run E2E tests
npm run test:e2e

# Run accounting tests
npm run test:accounting
# Must be 100% pass rate!

# Manual testing
# - Upload 100 real documents from design partner
# - Verify extraction accuracy
# - Check financial reports
```

### **Phase 3: Beta Testing (Week 13-14)**

**With design partner:**
1. Process 500-1,000 real documents
2. Track extraction accuracy
3. Verify financial reports match their expectations
4. Collect feedback
5. Fix critical bugs
6. Retest

### **Phase 4: Production (Week 15+)**

**Ongoing:**
```bash
# CI/CD pipeline runs on every push
- Unit tests
- Integration tests
- API tests
- Accounting tests

# Manual E2E tests before each release
# Security audit quarterly
# Performance testing monthly
```

---

## CONTINUOUS INTEGRATION (CI/CD)

### **GitHub Actions Workflow**

Create `.github/workflows/test.yml`:

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
      
      - name: Run API tests
        run: npm run test:api
      
      - name: Run accounting tests
        run: npm run test:accounting
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

---

## MANUAL TESTING CHECKLIST

### **Before Beta Launch**

**Functional Testing:**
- [ ] User can sign up and log in
- [ ] User can add clients
- [ ] User can upload all file types (PDF, CSV, XLS, JPG, PNG)
- [ ] Documents process successfully
- [ ] Extraction accuracy >95% (test with 100 real documents)
- [ ] Review queue shows pending transactions
- [ ] User can approve/reject transactions
- [ ] Categorization suggestions are accurate
- [ ] Learning system improves with corrections
- [ ] Financial reports generate correctly
- [ ] Income Statement calculations verified
- [ ] Balance Sheet balances (Assets = Liabilities + Equity)
- [ ] Trial Balance totals match
- [ ] VAT Return Box 1-9 correct
- [ ] Export to IRIS Kashflow works
- [ ] CSV format matches IRIS spec

**Security Testing:**
- [ ] Multi-tenant isolation (User A can't see User B's data)
- [ ] RLS policies enforced
- [ ] File upload validates file types
- [ ] File upload validates file sizes
- [ ] Authentication required for all protected routes
- [ ] JWT tokens expire correctly
- [ ] Password hashing works
- [ ] HTTPS enforced

**Performance Testing:**
- [ ] Upload 100 files at once (doesn't crash)
- [ ] Process 500 documents overnight (<24h)
- [ ] Dashboard loads <2 seconds
- [ ] Reports generate <3 seconds
- [ ] No memory leaks (long-running processes)

**UX Testing:**
- [ ] All buttons have hover states
- [ ] All forms have validation
- [ ] All actions show loading states
- [ ] All actions show success/error feedback
- [ ] Keyboard navigation works
- [ ] Mobile responsive (test on phone/tablet)
- [ ] Empty states display correctly
- [ ] Error messages are helpful

**Accessibility Testing:**
- [ ] Screen reader announces all interactive elements
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG AA
- [ ] Form labels associated with inputs
- [ ] Alt text on images

---

## PERFORMANCE TESTING

### **Load Testing with k6**

```bash
npm install -D k6
```

```javascript
// tests/performance/upload-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 10, // 10 virtual users
  duration: '60s',
};

export default function () {
  const url = 'http://localhost:3000/api/documents/upload';
  const file = open('./test-data/sample.pdf', 'b');
  
  const data = {
    file: http.file(file, 'sample.pdf'),
    clientId: 'client-123',
  };
  
  const params = {
    headers: {
      'Authorization': 'Bearer ' + __ENV.AUTH_TOKEN,
    },
  };
  
  const response = http.post(url, data, params);
  
  check(response, {
    'status is 201': (r) => r.status === 201,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });
  
  sleep(1);
}
```

**Run load test:**
```bash
k6 run tests/performance/upload-load.js
```

---

## SECURITY TESTING

### **OWASP Top 10 Checklist**

- [ ] **SQL Injection** - Use parameterized queries (Supabase RLS)
- [ ] **XSS** - Sanitize user input, use React (auto-escapes)
- [ ] **CSRF** - Use CSRF tokens on forms
- [ ] **Broken Authentication** - JWT with expiry, password hashing
- [ ] **Sensitive Data Exposure** - HTTPS, encrypt at rest (AES-256)
- [ ] **XML External Entities** - N/A (no XML parsing)
- [ ] **Broken Access Control** - RLS policies, multi-tenant isolation
- [ ] **Security Misconfiguration** - Environment variables, no defaults
- [ ] **Using Components with Known Vulnerabilities** - `npm audit`
- [ ] **Insufficient Logging** - Log all security events

**Run security audit:**
```bash
npm audit
npm audit fix
```

---

## TEST COVERAGE TARGETS

### **Minimum Coverage Requirements**

| Component | Target Coverage | Critical |
|-----------|----------------|----------|
| **Accounting calculations** | 100% | ✅ YES |
| **Financial report generation** | 100% | ✅ YES |
| **API endpoints** | 90% | ✅ YES |
| **Database functions** | 90% | ✅ YES |
| **UI components** | 80% | NO |
| **Utility functions** | 85% | NO |
| **Workers** | 90% | ✅ YES |

**Check coverage:**
```bash
npm run test:coverage

# View HTML report
open coverage/index.html
```

---

## PACKAGE.JSON SCRIPTS

Add these to `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run src/**/*.test.ts",
    "test:integration": "vitest run tests/integration/**/*.test.ts",
    "test:api": "vitest run tests/api/**/*.test.ts",
    "test:accounting": "vitest run tests/accounting/**/*.test.ts",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:api && npm run test:accounting && npm run test:e2e",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## CRITICAL SUCCESS CRITERIA

### **Before Production Launch:**

**Must achieve:**
- ✅ 100% pass rate on accounting tests
- ✅ 95%+ extraction accuracy (on 100 real documents)
- ✅ 100% multi-tenant isolation (security test)
- ✅ Trial balance always balances
- ✅ Balance sheet equation always true
- ✅ Zero data corruption bugs
- ✅ All critical E2E tests pass

**If ANY of these fail → DO NOT LAUNCH**

---

## DOCUMENT METADATA

**Version:** 1.0  
**Last Updated:** February 1, 2026  
**Status:** Complete ✅  

**Cross-references:**
- PRD: 02_PRD.md (test user stories)
- Technical Architecture: 03_TECHNICAL_ARCHITECTURE.md (test infrastructure)
- Accounting Calculations: 04_ACCOUNTING_CALCULATIONS.md (test financial logic)
- UI/UX Specification: 05_UI_UX_SPECIFICATION.md (test UI components)

---

**END OF TESTING STRATEGY DOCUMENT**
