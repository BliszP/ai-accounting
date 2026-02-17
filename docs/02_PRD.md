# AI ACCOUNTING AUTOMATION
## Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** February 1, 2026  
**Product Owner:** Hi (WeldQAi Founder)  
**Target Release:** Month 4 (Beta), Month 5 (Production)

---

## PRODUCT OVERVIEW

### Vision Statement
Eliminate manual data entry for UK accounting firms by providing AI-powered document processing that achieves 99% accuracy at 85% lower cost than existing solutions.

### Product Description
Multi-tenant SaaS platform that automatically extracts data from bank statements and receipts, categorizes transactions using AI, matches receipts to bank transactions, and exports to accounting software (IRIS Kashflow, Xero, QuickBooks, Sage).

### Target Users

**Primary User: UK Accountants/Bookkeepers**
- Role: Process financial documents for 100-500 clients
- Current process: 100% manual data entry (30+ hours/week)
- Pain points: Time waste, errors, chasing receipts, poor quality images
- Tech savviness: Medium (comfortable with IRIS, Excel, email)

**Secondary User: Accounting Firm Owners**
- Role: Manage practice, review efficiency
- Pain points: Labor costs, capacity constraints, scaling challenges
- Decision maker: Yes (approves software purchases)

---

## DESIGN PARTNER REQUIREMENTS

### Tax Company Profile
- **Clients:** 450 (sole traders, small limited companies, freelancers)
- **Industries:** Construction, Hospitality, Leisure, Professional
- **Volume:** 11,000 docs/month (1,000 statements + 10,000 receipts)
- **Current software:** IRIS Kashflow (primary), IRIS VAT, Sage Payroll
- **Staff:** 3 accountants
- **Categories:** 20-30 expense categories (UK standard chart with customizations)

### Must-Have Features (From Questionnaire)

**Document Processing:**
- ✅ Automatic extraction from bank statements (ALL UK banks, ALL formats)
- ✅ Automatic extraction from receipts (ALL formats)
- ✅ Handle poor quality images/scans (10-25% of receipts)
- ✅ Batch upload (multiple files at once)

**Intelligence:**
- ✅ Auto-categorization based on merchant
- ✅ Learn from corrections over time
- ✅ Suggest receipt-transaction matches
- ✅ Detect duplicates automatically

**Output:**
- ✅ Export to IRIS Kashflow
- ✅ Generate VAT returns (Box 1-9)
- ✅ Produce management reports
- ✅ Audit trail

**Success Criteria:**
- ✅ Save 25 hours/week
- ✅ 99%+ accuracy
- ✅ Process all UK banks
- ✅ Handle "pots" (Monzo/Starling virtual accounts)

---

## USER STORIES

### Epic 1: Document Upload & Management

**US-101: Bulk Upload Bank Statements**
- **As an** accountant
- **I want to** upload multiple bank statements at once (PDF, CSV, Excel)
- **So that** I don't waste time uploading one by one
- **Acceptance Criteria:**
  - Upload up to 100 files at once
  - Supports PDF, CSV, XLS, XLSX
  - Shows upload progress
  - Validates file types
  - Displays errors for invalid files

**US-102: Bulk Upload Receipts**
- **As an** accountant
- **I want to** upload multiple receipts (photos, PDFs, scans)
- **So that** I can process all client receipts in one batch
- **Acceptance Criteria:**
  - Upload up to 500 files at once
  - Supports JPG, PNG, PDF
  - Drag-and-drop interface
  - Auto-detects duplicates (hash check)
  - Shows thumbnails of uploaded images

**US-103: Organize by Client**
- **As an** accountant
- **I want to** tag uploads with client name
- **So that** documents are organized by client
- **Acceptance Criteria:**
  - Select client from dropdown (450 clients)
  - Searchable client list
  - Remembers last-selected client
  - Bulk tagging (all uploads → same client)

### Epic 2: Bank Statement Processing

**US-201: Extract All UK Banks**
- **As an** accountant
- **I want to** extract transactions from ANY UK bank statement
- **So that** I don't need to manually type them
- **Acceptance Criteria:**
  - Supports: Lloyds, HSBC, Barclays, NatWest, Santander, TSB, Metro, Monzo, Starling, Revolut, + others
  - Supports PDF, CSV, Excel formats
  - Extracts: Date, Merchant, Amount (debit/credit), Balance, Type (DD/SO/Card), Reference
  - Handles multi-page statements
  - Identifies statement period (from/to dates)
  - Extracts opening/closing balance

**US-202: Handle Monzo/Starling Pots**
- **As an** accountant
- **I want to** correctly categorize Monzo "pots" transactions
- **So that** transfers between pots don't appear as expenses
- **Acceptance Criteria:**
  - Detects pot transfers (e.g., "Transfer to Holiday Pot")
  - Categorizes as "Internal Transfer" (not expense)
  - Shows pot balance separately
  - Doesn't double-count transactions

**US-203: Incremental Processing**
- **As an** accountant
- **I want to** only process NEW transactions when uploading updated statements
- **So that** I don't pay to re-process the same data
- **Acceptance Criteria:**
  - Detects previously processed transactions (date + amount + merchant hash)
  - Only sends new transactions to API
  - Shows "X new, Y already processed"
  - Updates running balance

### Epic 3: Receipt Processing

**US-301: Extract Receipt Data**
- **As an** accountant
- **I want to** extract key fields from every receipt
- **So that** I don't manually type them
- **Acceptance Criteria:**
  - Extracts: Merchant, Date, Total Amount, Payment Method, Currency
  - Extracts: VAT Amount, VAT Rate (20%/5%/0%), VAT Registration Number
  - Handles all formats: Paper receipts (scanned), Phone photos, Email PDFs, Screenshots
  - Works on poor quality images (faded, blurry, angled)
  - Confidence score per field (0-100%)

**US-302: Handle Poor Quality Receipts**
- **As an** accountant
- **I want to** process faded thermal paper receipts
- **So that** I can still extract data from old receipts
- **Acceptance Criteria:**
  - Uses Claude Sonnet (better vision) for low-quality images
  - Pre-processes images (brightness, contrast, rotation)
  - Flags low-confidence extractions for manual review
  - Shows original image alongside extracted data
  - Allows manual override

**US-303: No Line-Item Extraction Needed**
- **As an** accountant
- **I DON'T need** individual line items from receipts
- **Because** I only care about: Total, VAT, Merchant, Date
- **Acceptance Criteria:**
  - Does NOT extract item-by-item details
  - Saves API costs (simpler extraction)
  - Focuses on must-have fields only

### Epic 4: Categorization & Learning

**US-401: Auto-Categorize Transactions**
- **As an** accountant
- **I want** transactions auto-categorized based on merchant
- **So that** I don't manually categorize 11,000 docs/month
- **Acceptance Criteria:**
  - Uses 20-30 UK standard expense categories
  - Merchant-to-category rules (e.g., "Tesco" → Purchases)
  - Purpose-based logic (e.g., "Telephone bill" → Telephone)
  - Confidence score per categorization
  - Shows top 3 suggestions if uncertain

**US-402: Learn from Corrections**
- **As an** accountant
- **I want** the system to learn when I correct a category
- **So that** it doesn't make the same mistake twice
- **Acceptance Criteria:**
  - Stores correction: Merchant X → Category Y (per organization)
  - Applies learned rule to future transactions
  - Shows "Learned from your correction" message
  - Per-client learning (Merchant X → Category Y for Client A, different for Client B)

**US-403: Custom Categories**
- **As an** accountant
- **I want to** add custom categories beyond UK standard
- **So that** I can match my existing chart of accounts
- **Acceptance Criteria:**
  - Add/edit/delete categories
  - Map to standard UK categories (for reporting)
  - Import categories from IRIS Kashflow
  - Category usage analytics (most/least used)

### Epic 5: Matching & Reconciliation

**US-501: Smart Receipt-Transaction Matching**
- **As an** accountant
- **I want** receipts automatically matched to bank transactions
- **So that** I don't manually match 10,000 receipts/month
- **Acceptance Criteria:**
  - Fuzzy matching: Amount + Merchant + Date (±3 days for posting delays)
  - Confidence score per match (0-100%)
  - Shows potential matches (top 3)
  - Allows manual override
  - Handles partial matches (receipt £45.32, bank £45.00 - card fee)

**US-502: Flag Unmatched Items**
- **As an** accountant
- **I want to** see receipts with no matching bank transaction
- **So that** I can identify cash purchases or missing transactions
- **Acceptance Criteria:**
  - "Unmatched Receipts" queue
  - Shows: Receipt details, Possible reasons (cash purchase, missing statement)
  - Action: Mark as "Cash Purchase", Request Statement, Ignore
  - "Missing Receipts" queue (bank transactions with no receipt)
  - Action: Request from client, Mark as "No receipt required", Ignore

**US-503: Duplicate Detection**
- **As an** accountant
- **I want** duplicate receipts/transactions detected automatically
- **So that** I don't double-count expenses
- **Acceptance Criteria:**
  - Detects exact duplicates (same amount, date, merchant)
  - Detects near-duplicates (same amount, ±1 day, similar merchant)
  - Shows both entries side-by-side
  - Action: Keep One, Keep Both, Needs Review
  - Prevents duplicates from being exported

### Epic 6: Review & Approval

**US-601: Review Queue**
- **As an** accountant
- **I want** a queue of items needing my review
- **So that** I efficiently review low-confidence extractions
- **Acceptance Criteria:**
  - Queue sorted by: Confidence (lowest first), Client, Date
  - Shows: Original document, Extracted data, Suggested category, Confidence %
  - Actions: Approve, Edit & Approve, Reject, Flag for Discussion
  - Bulk actions (Approve All, Reject All)
  - Filter by: Client, Date range, Category, Confidence threshold

**US-602: Side-by-Side Review**
- **As an** accountant
- **I want to** see original document next to extracted data
- **So that** I can quickly verify accuracy
- **Acceptance Criteria:**
  - Split screen: Document (left), Extracted data (right)
  - Zoom in/out on document
  - Highlight extracted fields on document
  - Keyboard shortcuts (Approve: Enter, Edit: E, Next: →)

**US-603: Bulk Approve Similar**
- **As an** accountant
- **I want to** bulk approve all transactions from same merchant
- **So that** I don't review 100 identical "Tesco → Purchases" entries
- **Acceptance Criteria:**
  - "Approve All Like This" button
  - Shows count (e.g., "Approve 23 similar transactions")
  - Confirms before applying
  - Learns rule for future

### Epic 6: Accounting Calculations & Financial Reporting

**⚠️ CRITICAL: See [04_ACCOUNTING_CALCULATIONS.md](./04_ACCOUNTING_CALCULATIONS.md) for complete specification**

This epic covers the **core accounting logic** that transforms extracted transactions into meaningful financial statements. The full specification is in a separate document due to its complexity and specialized domain knowledge.

**Summary of Requirements:**

**US-601: Double-Entry Bookkeeping**
- All transactions must be recorded using double-entry accounting
- Each transaction creates 2+ journal entries (Debit + Credit)
- Total Debits must always equal Total Credits
- See Document 4 for: Debit/Credit rules, account types, transaction recording logic

**US-602: Chart of Accounts**
- UK standard chart of accounts (1000-7999)
- Category-to-account mapping (e.g., "Telephone" → 6200)
- Support for custom accounts per organization
- See Document 4 for: Full account structure, default mappings

**US-603: Income Statement (P&L)**
- Calculate Revenue, Cost of Sales, Expenses, Profit
- Gross Profit = Revenue - COGS
- Net Profit = Gross Profit - Operating Expenses
- See Document 4 for: Calculation algorithm, TypeScript implementation

**US-604: Balance Sheet**
- Calculate Assets, Liabilities, Equity
- Validate: Assets = Liabilities + Equity
- Point-in-time financial position
- See Document 4 for: Calculation algorithm, account grouping logic

**US-605: Trial Balance**
- List all accounts with Debit/Credit totals
- Validate: Total Debits = Total Credits
- Used to verify books balance
- See Document 4 for: Generation logic, validation tests

**US-606: Cash Flow Statement**
- Operating, Investing, Financing activities
- Reconcile to bank balance
- See Document 4 for: Activity classification, calculation algorithm

**US-607: Multi-Period Comparison**
- Compare two periods (month-over-month, year-over-year)
- Calculate variance (£ and %)
- See Document 4 for: Comparison logic

**Database Requirements:**
- Add `journal_entries` table (stores double-entry journal entries)
- Add `chart_of_accounts` table (account definitions)
- Add `account_category_mappings` table (category → account mapping)
- See Document 4 for: Full schema, indexes, constraints

**API Requirements:**
- GET /api/reports/income-statement
- GET /api/reports/balance-sheet
- GET /api/reports/trial-balance
- GET /api/reports/cash-flow
- GET /api/reports/comparison
- See Document 4 for: Full API specs, request/response formats

**Worker Requirements:**
- JournalEntryWorker: Converts transactions → journal entries
- See Document 4 for: Worker logic, TypeScript implementation

**Success Criteria:**
- ✅ 100% of transactions recorded as double-entry
- ✅ Trial balance always balances (tested automatically)
- ✅ Balance sheet always balances (Assets = Liabilities + Equity)
- ✅ Income statement calculates correctly
- ✅ Cash flow reconciles to bank balance
- ✅ <2 seconds to generate any financial report (up to 1,000 transactions)

**Why This is Separate:**
This is the most complex part of the system and requires deep accounting knowledge. Breaking it into a separate document:
1. Makes it easier to update accounting logic without editing the entire PRD
2. Allows accountants to review/validate the logic independently
3. Provides complete implementation details (algorithms, code examples)
4. Keeps the PRD focused on user stories while technical details are in the separate doc

**⚠️ Developers: You MUST read Document 4 before implementing Epic 6**

---

### Epic 7: VAT & Compliance

**US-701: VAT Calculations**
- **As an** accountant
- **I want** VAT automatically calculated for each transaction
- **So that** I don't manually calculate VAT for 11,000 docs/month
- **Acceptance Criteria:**
  - Extracts VAT amount from receipts
  - Validates VAT calculation (Total × 20% = VAT amount?)
  - Flags incorrect VAT calculations
  - Supports 20%, 5%, 0% VAT rates
  - Identifies VAT-exempt transactions

**US-702: VAT Return (Box 1-9)**
- **As an** accountant
- **I want to** generate MTD-compliant VAT returns
- **So that** I can submit to HMRC without manual calculation
- **Acceptance Criteria:**
  - Calculates Box 1-9 values
  - Period selection (monthly, quarterly)
  - Shows breakdown (which transactions in each box)
  - Export as JSON (MTD format)
  - Export as PDF (for client records)

**US-703: HMRC Compliance Check**
- **As an** accountant
- **I want** receipts validated against HMRC requirements
- **So that** I know they're audit-proof
- **Acceptance Criteria:**
  - Checks: Merchant name present, Date present, Amount present, VAT reg number (if >£250)
  - Flags non-compliant receipts
  - Shows compliance % per client
  - Generates compliance report

### Epic 8: Export & Integration

**US-801: Export to IRIS Kashflow**
- **As an** accountant
- **I want to** export transactions directly to IRIS Kashflow
- **So that** I don't manually re-enter data
- **Acceptance Criteria:**
  - Maps categories to IRIS Kashflow accounts
  - CSV export in IRIS format
  - Includes: Date, Description, Amount, VAT, Category, Client
  - One-click export
  - Confirms successful export (X transactions exported)

**US-802: Export to Other Software**
- **As an** accountant
- **I want to** export to Xero, QuickBooks, Sage
- **So that** I can use this with different clients' software
- **Acceptance Criteria:**
  - Xero format (CSV)
  - QuickBooks format (IIF)
  - Sage format (CSV)
  - Generic CSV (custom column mapping)

**US-803: Management Reports**
- **As an** practice owner
- **I want** management reports showing P&L by client
- **So that** I can review client profitability
- **Acceptance Criteria:**
  - Income by period/client/category
  - Expenses by period/client/category
  - Gross profit, Net profit, Margin %
  - Comparison: This month vs last month, This year vs last year
  - Export as PDF, Excel, CSV

### Epic 9: Multi-Tenancy & Admin

**US-901: Organization Management**
- **As a** practice owner
- **I want to** manage my organization's settings
- **So that** I can control access and billing
- **Acceptance Criteria:**
  - Organization name, logo, contact info
  - User management (add/remove accountants)
  - Role-based access (Admin, Accountant, Viewer)
  - Billing details (plan, usage, invoices)
  - Data retention settings (30/60/90 days)

**US-902: Client Management**
- **As an** accountant
- **I want to** manage my 450 clients
- **So that** I can organize uploads by client
- **Acceptance Criteria:**
  - Add/edit/delete clients
  - Client details: Name, Contact, VAT number, Financial year start
  - Search/filter clients
  - Archive inactive clients
  - Bulk import clients (CSV)

**US-903: User Permissions**
- **As a** practice owner
- **I want to** control what each accountant can see
- **So that** junior staff can't access sensitive client data
- **Acceptance Criteria:**
  - Admin: Full access
  - Accountant: Assigned clients only
  - Viewer: Read-only, no edits
  - Per-client permissions (Accountant A → Clients 1-100, Accountant B → Clients 101-200)

### Epic 10: Performance & Optimization

**US-1001: Fast Processing**
- **As an** accountant
- **I want** documents processed within 24 hours
- **So that** I can review and export next day
- **Acceptance Criteria:**
  - Batch processing overnight (queue uploaded during day, process at night)
  - Email notification when processing complete
  - Average processing time: <5 minutes per document
  - Shows processing status (Queued, Processing, Complete, Error)

**US-1002: Cost Optimization**
- **As a** system
- **I want to** minimize Claude API costs
- **So that** margins stay healthy
- **Acceptance Criteria:**
  - Use Haiku for simple receipts (80% of volume)
  - Use Sonnet only for: Low quality images, Handwritten receipts, First-time merchants
  - Cache merchant-category mappings (don't re-ask Claude)
  - Skip duplicate document processing (hash check)

**US-1003: Error Handling**
- **As an** accountant
- **I want** clear error messages when processing fails
- **So that** I know what to fix
- **Acceptance Criteria:**
  - Error types: File corrupt, Unsupported format, Too large (>10MB), API timeout
  - Shows error reason + suggested fix
  - Retry mechanism (3 attempts)
  - Manual upload option if auto-processing fails

---

## FUNCTIONAL REQUIREMENTS

### Document Upload

**FU-001: Supported File Types**
- Bank Statements: PDF, CSV, XLS, XLSX
- Receipts: JPG, PNG, PDF
- Max file size: 10MB per file
- Max batch: 100 statements OR 500 receipts

**FU-002: Client Assignment**
- Dropdown list of all clients (searchable)
- Remembers last selection
- Bulk assignment (all uploads → same client)
- Required field (can't upload without client)

**FU-003: Upload Validation**
- File type check (reject unsupported types)
- File size check (reject >10MB)
- Duplicate check (hash match → show warning)
- Virus scan (ClamAV or VirusTotal)

### Data Extraction

**FU-004: Bank Statement Fields**
- **Required:** Date, Merchant/Description, Amount, Type (Debit/Credit)
- **Optional:** Balance, Reference, Transaction Type (DD/SO/Card), Sort Code, Account Number
- **Statement-level:** Period (from/to), Opening Balance, Closing Balance

**FU-005: Receipt Fields**
- **Required:** Merchant, Date, Total Amount
- **Optional:** Payment Method, Currency, VAT Amount, VAT Rate, VAT Reg Number
- **Not needed:** Line items, Quantities, Item categories

**FU-006: Confidence Scoring**
- Each field gets confidence score 0-100%
- <80% confidence → Flag for review
- 80-95% confidence → Show in review queue
- >95% confidence → Auto-approve (if enabled)

### Categorization

**FU-007: Default Categories (UK Standard)**
```
Sales
Purchases
Telephone
Postage & Stationary
Advertising
Travelling
Motor Expenses
Insurance
Plant & Machinery
Motor Vehicles
Bank Charges
Accountancy Fees
Legal & Professional
Rent & Rates
Repairs & Maintenance
Subcontractors
Utilities (Gas, Electric, Water)
Subscriptions
Office Costs
Sundries
```

**FU-008: Custom Categories**
- Add/edit/delete per organization
- Map to standard categories
- Import from accounting software

**FU-009: Categorization Logic**
- Merchant-based rules (e.g., "Tesco" → Purchases)
- Description-based rules (e.g., "Mobile bill" → Telephone)
- Amount-based hints (e.g., <£10 → Office Costs more likely)
- Historical patterns (this client usually categorizes Shell as Travel)
- Learning from corrections

### Matching

**FU-010: Matching Algorithm**
```python
# Pseudocode
def match_receipt_to_transaction(receipt, transactions):
    potential_matches = []
    
    for transaction in transactions:
        score = 0
        
        # Amount match (most important)
        if abs(receipt.amount - transaction.amount) < 0.50:  # Within 50p
            score += 50
        elif abs(receipt.amount - transaction.amount) < 2.00:  # Within £2
            score += 30
        
        # Date match (±3 days for posting delays)
        days_diff = abs((receipt.date - transaction.date).days)
        if days_diff == 0:
            score += 30
        elif days_diff <= 3:
            score += 20
        
        # Merchant match (fuzzy)
        if fuzzy_match(receipt.merchant, transaction.description) > 0.8:
            score += 20
        
        if score >= 60:  # Threshold
            potential_matches.append((transaction, score))
    
    return sorted(potential_matches, key=lambda x: x[1], reverse=True)[:3]
```

**FU-011: Duplicate Detection**
- Exact match: Same amount, same date, same merchant → 100% duplicate
- Near match: Same amount, ±1 day, similar merchant → 90% duplicate
- Possible match: Same amount, ±3 days → 70% duplicate

### VAT

**FU-012: VAT Extraction**
- Extract VAT amount from receipt
- Extract VAT rate (20%, 5%, 0%)
- Validate: `(Total - VAT) × Rate = VAT` (within 1p tolerance)
- Flag if calculation incorrect

**FU-013: VAT Return Calculation**
- Box 1: VAT due on sales (Output VAT)
- Box 2: VAT due on acquisitions
- Box 3: Total VAT due (Box 1 + Box 2)
- Box 4: VAT reclaimed on purchases (Input VAT)
- Box 5: Net VAT to pay (Box 3 - Box 4)
- Box 6: Total sales (excluding VAT)
- Box 7: Total purchases (excluding VAT)
- Box 8: Total supplies (excluding VAT)
- Box 9: Total acquisitions (excluding VAT)

### Export

**FU-014: IRIS Kashflow CSV Format**
```csv
Date,Description,Debit,Credit,VAT,Category,Client
01/02/2026,Tesco - Groceries,45.32,,7.55,Purchases,ABC Ltd
02/02/2026,BT Mobile,35.00,,5.83,Telephone,ABC Ltd
```

**FU-015: Generic CSV Format**
```csv
Date,Merchant,Amount,Type,Category,VAT Amount,VAT Rate,Client,Notes
01/02/2026,Tesco,45.32,Expense,Purchases,7.55,20%,ABC Ltd,Receipt matched
```

### Performance

**FU-016: Processing SLA**
- Batch upload → Processing starts within 5 minutes
- Processing time: <5 minutes per document (average)
- Total batch time: <24 hours
- Email notification on completion

**FU-017: API Rate Limits**
- Claude API: 50 requests/minute (batch to stay within limits)
- Supabase: 100 queries/second
- Railway: 2-3 concurrent workers

---

## NON-FUNCTIONAL REQUIREMENTS

### Performance

**NFR-001: Response Time**
- Page load: <2 seconds
- Document upload: <5 seconds for 100 files
- Search/filter: <1 second
- Export: <10 seconds for 1,000 transactions

**NFR-002: Scalability**
- Support 50 organizations (Year 1)
- Support 500K documents/month (Year 3)
- Auto-scale workers based on queue size

### Security

**NFR-003: Data Encryption**
- Data at rest: AES-256 encryption (Supabase)
- Data in transit: TLS 1.3
- API keys: Encrypted in database
- File storage: Encrypted (Supabase Storage)

**NFR-004: Authentication**
- Email + password (bcrypt hashing)
- Two-factor authentication (optional)
- Session timeout: 24 hours
- Password reset via email

**NFR-005: Authorization**
- Row-level security (RLS) in Supabase
- Users only see their organization's data
- Role-based access control (Admin, Accountant, Viewer)

### Compliance

**NFR-006: GDPR**
- Data stored in EU region (Supabase EU)
- Right to access: Users can export all data
- Right to deletion: Users can delete organization (cascade delete all data)
- Data retention: 90 days after account closure
- Privacy policy + Terms of Service

**NFR-007: HMRC Compliance**
- Audit trail: All changes logged (who, what, when)
- Immutable exports: Once exported, can't be changed
- Document retention: 6 years (HMRC requirement)
- MTD-compliant VAT returns

### Reliability

**NFR-008: Uptime**
- Target: 99.5% uptime (43 hours downtime/year)
- Monitoring: UptimeRobot (5-minute checks)
- Incident response: <1 hour for P1 (system down)

**NFR-009: Backup**
- Database: Daily backups (Supabase automatic)
- File storage: Redundant (Supabase multi-region)
- Recovery time objective (RTO): <4 hours
- Recovery point objective (RPO): <24 hours

### Usability

**NFR-010: Browser Support**
- Chrome 90+ (primary)
- Firefox 88+
- Safari 14+
- Edge 90+
- No IE11 support

**NFR-011: Mobile Support**
- Responsive design (works on mobile)
- Not a native mobile app (Year 1)
- Touch-friendly upload interface

**NFR-012: Accessibility**
- WCAG 2.1 Level AA compliance
- Keyboard navigation
- Screen reader support
- High contrast mode

---

## USER INTERFACE REQUIREMENTS

### Dashboard

**UI-001: Overview Screen**
- Summary cards:
  - Documents uploaded (this month)
  - Documents processed (this month)
  - Documents pending review
  - Processing errors
- Recent uploads (last 10)
- Quick actions:
  - Upload Documents
  - Review Queue
  - Export Data

### Upload Flow

**UI-002: Upload Interface**
```
┌─────────────────────────────────────────┐
│  Upload Documents                        │
├─────────────────────────────────────────┤
│  Select Client: [ABC Ltd        ▼]      │
│                                          │
│  ┌─────────────────────────────────┐   │
│  │  Drag & Drop Files Here          │   │
│  │           OR                     │   │
│  │      [Choose Files]              │   │
│  │                                   │   │
│  │  Supports: PDF, CSV, XLS, JPG    │   │
│  │  Max 100 statements or           │   │
│  │  500 receipts per batch          │   │
│  └─────────────────────────────────┘   │
│                                          │
│  Uploaded Files (23):                   │
│  ✓ statement_jan_2026.pdf (2.3 MB)     │
│  ✓ receipt_tesco_01.jpg (1.1 MB)       │
│  ✓ receipt_shell_02.jpg (850 KB)       │
│  ...                                     │
│                                          │
│  [Cancel]              [Process Files]  │
└─────────────────────────────────────────┘
```

### Review Queue

**UI-003: Review Interface**
```
┌──────────────────────────────────────────────────────────┐
│  Review Queue (87 items)                                  │
├──────────────────────────────────────────────────────────┤
│  Filter: [All ▼] [ABC Ltd ▼] [<80% Confidence ▼]        │
│  Sort: [Confidence (Low→High) ▼]                         │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────────┬──────────────────────────────┐  │
│  │   Original Image    │   Extracted Data             │  │
│  ├─────────────────────┼──────────────────────────────┤  │
│  │                     │  Merchant: Tesco              │  │
│  │  [Receipt image]    │  Date: 01/02/2026             │  │
│  │                     │  Amount: £45.32               │  │
│  │  Zoom: [+] [-]     │  VAT: £7.55 (20%)            │  │
│  │                     │                               │  │
│  │                     │  Suggested Category:          │  │
│  │                     │  ● Purchases (95% ✓)         │  │
│  │                     │  ○ Office Costs (3%)         │  │
│  │                     │  ○ Sundries (2%)             │  │
│  │                     │                               │  │
│  │                     │  Matched Transaction:         │  │
│  │                     │  02/02 - Tesco - £45.32      │  │
│  │                     │  (90% match ✓)               │  │
│  └─────────────────────┴──────────────────────────────┘  │
│                                                            │
│  [← Previous]  [Approve] [Edit] [Reject]  [Next →]       │
│                                                            │
│  Keyboard: Enter=Approve, E=Edit, R=Reject, ←→=Navigate  │
└──────────────────────────────────────────────────────────┘
```

### Export

**UI-004: Export Interface**
```
┌─────────────────────────────────────────┐
│  Export Transactions                     │
├─────────────────────────────────────────┤
│  Client: [ABC Ltd            ▼]         │
│  Period: [Jan 2026           ▼]         │
│  Status: [Approved Only      ▼]         │
│                                          │
│  Format:                                 │
│  ● IRIS Kashflow (CSV)                  │
│  ○ Xero (CSV)                           │
│  ○ QuickBooks (IIF)                     │
│  ○ Sage (CSV)                           │
│  ○ Generic (CSV)                        │
│                                          │
│  Preview (10 of 247 transactions):      │
│  ┌────────────────────────────────┐    │
│  │ Date     Merchant    Amount    │    │
│  │ 01/02    Tesco       £45.32    │    │
│  │ 02/02    BT Mobile   £35.00    │    │
│  │ ...                             │    │
│  └────────────────────────────────┘    │
│                                          │
│  [Cancel]          [Export (247)]       │
└─────────────────────────────────────────┘
```

---

## TECHNICAL REQUIREMENTS

### Architecture

**ARCH-001: Tech Stack**
- **Frontend:** React 18 + TypeScript + Tailwind CSS
- **Backend:** Node.js + Hono (Railway)
- **Database:** PostgreSQL (Supabase)
- **File Storage:** Supabase Storage
- **AI:** Claude 3.5 Sonnet + Claude 3.5 Haiku (Anthropic API)
- **Hosting:** Vercel (frontend), Railway (backend)

**ARCH-002: Multi-Tenancy**
- Database: `organization_id` on every table
- Row-Level Security (RLS) policies
- Shared infrastructure, isolated data

### Database Schema (Key Tables)

**SCHEMA-001: organizations**
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  plan TEXT NOT NULL,  -- 'starter', 'growth', 'professional', 'enterprise'
  status TEXT NOT NULL,  -- 'active', 'suspended', 'cancelled'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**SCHEMA-002: users**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,  -- 'admin', 'accountant', 'viewer'
  created_at TIMESTAMP DEFAULT NOW()
);
```

**SCHEMA-003: clients**
```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vat_number TEXT,
  financial_year_start DATE,
  status TEXT DEFAULT 'active',  -- 'active', 'archived'
  created_at TIMESTAMP DEFAULT NOW()
);
```

**SCHEMA-004: documents**
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT NOT NULL,  -- 'bank_statement', 'receipt', 'invoice'
  status TEXT DEFAULT 'queued',  -- 'queued', 'processing', 'complete', 'error'
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**SCHEMA-005: transactions**
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  
  -- Core fields
  date DATE NOT NULL,
  merchant TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  type TEXT NOT NULL,  -- 'debit', 'credit'
  
  -- Categorization
  category TEXT,
  category_confidence NUMERIC(3,2),  -- 0.00 to 1.00
  
  -- VAT
  vat_amount NUMERIC(10,2),
  vat_rate NUMERIC(3,2),  -- 0.20, 0.05, 0.00
  vat_reg_number TEXT,
  
  -- Matching
  matched_transaction_id UUID REFERENCES transactions(id),
  match_confidence NUMERIC(3,2),
  
  -- Status
  status TEXT DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

**SCHEMA-006: learning_rules**
```sql
CREATE TABLE learning_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id),  -- NULL = applies to all clients
  merchant TEXT NOT NULL,
  category TEXT NOT NULL,
  confidence NUMERIC(3,2) DEFAULT 1.00,
  usage_count INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(organization_id, client_id, merchant)
);
```

### API Endpoints

**API-001: Document Upload**
```
POST /api/documents/upload
Headers: Authorization: Bearer {token}
Body: multipart/form-data
  - client_id: UUID
  - files: File[]
Response: {
  uploaded: number,
  failed: number,
  documents: [{id, file_name, status}]
}
```

**API-002: Process Documents**
```
POST /api/documents/process
Headers: Authorization: Bearer {token}
Body: {
  document_ids: UUID[]
}
Response: {
  queued: number,
  estimated_time: string
}
```

**API-003: Get Review Queue**
```
GET /api/transactions/review
Headers: Authorization: Bearer {token}
Query: ?client_id={uuid}&confidence_lt=0.80&limit=50
Response: {
  total: number,
  transactions: [{
    id, document_id, date, merchant, amount,
    category, confidence, matched_transaction,
    document_url
  }]
}
```

**API-004: Approve/Reject Transaction**
```
PUT /api/transactions/:id
Headers: Authorization: Bearer {token}
Body: {
  status: 'approved' | 'rejected',
  category?: string,  // if edited
  matched_transaction_id?: UUID  // if edited
}
Response: {
  success: boolean,
  learned: boolean  // true if rule created
}
```

**API-005: Export Transactions**
```
POST /api/export
Headers: Authorization: Bearer {token}
Body: {
  client_id: UUID,
  start_date: string,
  end_date: string,
  format: 'iris' | 'xero' | 'quickbooks' | 'sage' | 'csv',
  status: 'approved' | 'all'
}
Response: {
  download_url: string,
  count: number
}
```

### Claude AI Integration

**AI-001: Bank Statement Extraction Prompt**
```
You are a financial document processor for UK accounting firms.

Extract ALL transactions from this bank statement.

For each transaction, extract:
- date: Transaction date (format: YYYY-MM-DD)
- merchant: Merchant/payee name (clean up cryptic descriptions)
- amount: Amount (always positive number)
- type: "debit" or "credit"
- balance: Running balance after transaction
- reference: Transaction reference (if present)
- transaction_type: "DD" (Direct Debit), "SO" (Standing Order), "CARD", "TRANSFER", "CHQ" (Cheque), "OTHER"

Also extract statement-level info:
- period_start: Statement start date
- period_end: Statement end date
- opening_balance: Balance at start
- closing_balance: Balance at end
- account_number: Last 4 digits only
- sort_code: XX-XX-XX format

IMPORTANT:
- For Monzo/Starling "pot" transactions, set type="TRANSFER" and add "[POT]" to merchant
- For cryptic merchant names like "POS PURCHASE 1234", try to identify actual merchant from description
- Skip header/footer rows
- Return ONLY valid JSON, no explanations

Return JSON array:
{
  "statement": {
    "period_start": "2026-01-01",
    "period_end": "2026-01-31",
    "opening_balance": 1234.56,
    "closing_balance": 2345.67,
    "account_number": "1234",
    "sort_code": "12-34-56"
  },
  "transactions": [
    {
      "date": "2026-01-15",
      "merchant": "Tesco",
      "amount": 45.32,
      "type": "debit",
      "balance": 1189.24,
      "reference": "CARD-1234",
      "transaction_type": "CARD"
    }
  ]
}
```

**AI-002: Receipt Extraction Prompt**
```
You are a financial document processor for UK accounting firms.

Extract key information from this receipt image.

Extract:
- merchant: Store/business name
- date: Purchase date (format: YYYY-MM-DD)
- time: Purchase time (HH:MM, optional)
- total_amount: Total amount paid
- payment_method: "CASH", "CARD", "BANK_TRANSFER", "OTHER", or "UNKNOWN"
- currency: "GBP" (default if not specified)
- vat_amount: VAT amount (if shown separately)
- vat_rate: VAT rate as decimal (0.20, 0.05, 0.00)
- vat_reg_number: VAT registration number (if present)

IMPORTANT:
- If image is poor quality (faded, blurry), do your best but flag low confidence
- Return confidence score (0.0 to 1.0) for each field
- If field not found, return null (not empty string)
- Don't extract line items (we don't need them)

Return JSON:
{
  "merchant": {"value": "Tesco", "confidence": 0.98},
  "date": {"value": "2026-01-15", "confidence": 1.0},
  "total_amount": {"value": 45.32, "confidence": 0.95},
  "vat_amount": {"value": 7.55, "confidence": 0.90},
  "vat_rate": {"value": 0.20, "confidence": 0.85},
  "payment_method": {"value": "CARD", "confidence": 0.70}
}
```

**AI-003: Categorization Prompt**
```
You are a UK accounting expert.

Categorize this transaction into one of these categories:
{list of 20-30 categories from organization}

Transaction:
- Merchant: {merchant}
- Description: {description}
- Amount: £{amount}
- Date: {date}

Previous categorizations for this merchant:
{learned_rules if any}

Guidelines:
- Use learned rules if available
- Purpose-based logic: "Mobile bill" → Telephone
- Amount hints: Very small (<£10) often Office Costs
- UK context: "MOT" → Motor Vehicles, "Council Tax" → Rent & Rates

Return JSON:
{
  "category": "Purchases",
  "confidence": 0.92,
  "reasoning": "Tesco is a supermarket, typically categorized as Purchases",
  "alternatives": [
    {"category": "Office Costs", "confidence": 0.05},
    {"category": "Sundries", "confidence": 0.03}
  ]
}
```

---

## SUCCESS METRICS

### Product Metrics (Track Weekly)

**PM-001: Extraction Accuracy**
- **Target:** >95% for bank statements, >95% for receipts
- **Measure:** Correct extractions ÷ Total extractions (validated sample of 100)
- **Method:** Weekly random sample, manual validation

**PM-002: Categorization Accuracy**
- **Target:** >90% first attempt, >95% with learning
- **Measure:** Approved categories ÷ Total suggestions
- **Track:** Per-organization (learning improves over time)

**PM-003: Matching Accuracy**
- **Target:** >85% matches approved without edit
- **Measure:** Auto-matches approved ÷ Total auto-matches

**PM-004: Processing Time**
- **Target:** <24 hours batch, <5 min per document
- **Measure:** Timestamp(complete) - Timestamp(upload)

**PM-005: User Satisfaction**
- **Target:** NPS 50+, CSAT 8+/10
- **Measure:** Quarterly in-app survey

### Business Metrics (Track Monthly)

**BM-001: Time Saved**
- **Target:** 25+ hours/week per customer
- **Measure:** Self-reported in monthly check-in

**BM-002: Documents Processed**
- **Target:** 10,000+/month by Month 12
- **Measure:** Count in database

**BM-003: Customer Count**
- **Target:** 4 by Month 12, 20 by Month 24
- **Measure:** Active organizations in database

**BM-004: Monthly Recurring Revenue (MRR)**
- **Target:** £2,800 by Month 12, £20,000 by Month 24
- **Measure:** Sum of active subscriptions

**BM-005: Gross Margin**
- **Target:** 30%+ after optimization
- **Measure:** (Revenue - COGS) ÷ Revenue

**BM-006: Churn Rate**
- **Target:** <10% annual
- **Measure:** Churned customers ÷ Total customers (last 12 months)

---

## RELEASE PLAN

### Phase 0: Requirements & Design (Weeks 1-2) ✅ DONE
- ✅ Requirements questionnaire completed
- ✅ Business case documented
- ✅ PRD created
- Next: Technical architecture document

### Phase 1: MVP Development (Weeks 3-10)

**Week 3-4: Foundation**
- Set up infrastructure (Railway, Supabase, Vercel)
- Database schema + migrations
- Authentication (email/password)
- Multi-tenancy (RLS policies)

**Week 5-6: Document Upload**
- Upload interface (drag-drop)
- File validation + storage
- Client management (CRUD)
- Batch upload

**Week 7-8: Extraction**
- Claude API integration
- Bank statement extraction (start with 1 bank, expand)
- Receipt extraction
- Confidence scoring

**Week 9-10: Review & Categorization**
- Review queue UI
- Auto-categorization (Claude prompt)
- Learning rules (store corrections)
- Approval workflow

### Phase 2: Beta Testing (Weeks 11-14)

**Week 11-12: Integration & Polish**
- IRIS Kashflow export
- Matching algorithm
- Duplicate detection
- Error handling

**Week 13-14: Beta with Design Partner**
- Onboard 2-3 accountants from tax company
- Process 500-1,000 real documents
- Gather feedback
- Fix bugs
- Measure: Accuracy, Time saved, User satisfaction

### Phase 3: Production Launch (Week 15+)

**Week 15: Production Deployment**
- All 3 accountants onboarded
- All 450 clients migrated
- Full 11,000 docs/month processing
- Billing starts (£800/month)

**Week 16-20: Stabilization**
- Monitor performance
- Fix production bugs
- Optimize costs (switch to Haiku)
- Monthly check-in with customer

**Week 21+: Growth**
- Get testimonial + case study
- Get 3-5 referrals
- Close Customer 2 (Month 7 target)

---

## APPENDIX

### Glossary

**MTD (Making Tax Digital):** UK HMRC requirement for digital VAT returns  
**RLS (Row Level Security):** Database security feature (Supabase)  
**OCR (Optical Character Recognition):** Text extraction from images  
**Fuzzy Matching:** Approximate string matching (handles typos, variations)  
**Pots:** Monzo/Starling virtual savings accounts within main account  
**SLA (Service Level Agreement):** Guaranteed service standards  
**NPS (Net Promoter Score):** Customer satisfaction metric (-100 to +100)  
**CSAT (Customer Satisfaction):** Simple satisfaction score (1-10)  
**ARR (Annual Recurring Revenue):** MRR × 12  
**Churn:** Customer cancellations  

### Assumptions

1. Design partner (tax company) will provide real documents for testing
2. IRIS Kashflow has CSV import (confirmed in questionnaire)
3. Claude API accuracy >95% (needs validation in beta)
4. Customers willing to wait 24 hours for processing (vs real-time)
5. UK banks won't change statement formats frequently
6. Supabase can handle 50 organizations, 500K docs/month (needs testing at scale)

### Out of Scope (v1)

- Mobile native app (web-only)
- Real-time processing (batch overnight)
- Direct bank API integration (manual upload only)
- Line-item extraction from receipts (not needed)
- Multi-currency support (GBP only)
- Tax return generation (VAT only)
- Client portal (accountant-only interface)
- White-label/reseller program (direct sales only)
- International expansion (UK market only)

---

**Document Version:** 1.0  
**Last Updated:** February 1, 2026  
**Next Review:** After Beta Testing (Week 14)
