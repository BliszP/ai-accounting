# AI ACCOUNTING AUTOMATION
## Technical Architecture Document

**Version:** 1.0  
**Date:** February 1, 2026  
**Technical Lead:** Hi (WeldQAi Founder)  
**Stack:** React + Node.js + PostgreSQL + Claude AI

---

## SYSTEM OVERVIEW

### High-Level Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    USER (Accountant)                        │
└─────────────────────┬──────────────────────────────────────┘
                      │
                      │ HTTPS
                      ▼
┌────────────────────────────────────────────────────────────┐
│                 FRONTEND (Vercel)                          │
│  React 18 + TypeScript + Tailwind CSS                     │
│  - Authentication                                           │
│  - Document Upload                                          │
│  - Review Queue                                             │
│  - Export Interface                                         │
└─────────────────────┬──────────────────────────────────────┘
                      │
                      │ REST API (HTTPS)
                      ▼
┌────────────────────────────────────────────────────────────┐
│                 BACKEND API (Railway)                       │
│  Node.js + Hono Framework                                  │
│  - Authentication & Authorization                           │
│  - Document Processing Queue                                │
│  - Business Logic                                           │
│  - Claude AI Integration                                    │
└───────┬───────────────┬───────────────────┬────────────────┘
        │               │                   │
        │               │                   │
        ▼               ▼                   ▼
┌──────────────┐ ┌─────────────────┐ ┌────────────────┐
│  DATABASE    │ │  FILE STORAGE   │ │  CLAUDE API    │
│ (Supabase)   │ │  (Supabase)     │ │  (Anthropic)   │
│              │ │                 │ │                │
│ PostgreSQL   │ │ PDFs, Images    │ │ Sonnet 3.5     │
│ Multi-tenant │ │ Encrypted       │ │ Haiku 3.5      │
│ RLS enabled  │ │                 │ │                │
└──────────────┘ └─────────────────┘ └────────────────┘
```

### Technology Stack

**Frontend:**
- React 18.2+
- TypeScript 5.0+
- Tailwind CSS 3.4+
- Vite (build tool)
- React Query (data fetching)
- React Router (navigation)
- Zustand (state management)

**Backend:**
- Node.js 20+ LTS
- Hono 4.x (lightweight web framework)
- TypeScript 5.0+
- BullMQ (job queue, Redis-backed)
- Zod (validation)
- Jose (JWT tokens)

**Database & Storage:**
- PostgreSQL 15+ (Supabase)
- Supabase Storage (S3-compatible)
- Redis 7+ (BullMQ queue, Railway addon)

**External APIs:**
- Anthropic Claude API (3.5 Sonnet + Haiku)

**Infrastructure:**
- Vercel (frontend hosting, CDN)
- Railway (backend hosting, auto-scaling)
- Supabase (database, storage, auth helpers)
- Sentry (error monitoring)
- PostHog (analytics)

---

## SYSTEM ARCHITECTURE

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    Upload    │  │    Review    │  │    Export    │      │
│  │  Component   │  │  Component   │  │  Component   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │               │
│         └──────────────────┼──────────────────┘              │
│                            │                                  │
│                 ┌──────────▼──────────┐                      │
│                 │   API Client Layer   │                      │
│                 │  (React Query)       │                      │
│                 └──────────┬───────────┘                      │
└────────────────────────────┼────────────────────────────────┘
                             │
                   HTTPS REST API
                             │
┌────────────────────────────▼─────────────────────────────────┐
│                      BACKEND LAYER                            │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │               API ROUTES (Hono)                          │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │ /auth/* │ /documents/* │ /transactions/* │ /export/*   │ │
│  └────┬────────────┬────────────┬──────────────┬───────────┘ │
│       │            │            │              │              │
│       ▼            ▼            ▼              ▼              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                  SERVICE LAYER                           │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │  AuthService  │  DocumentService  │  ExportService     │ │
│  │  UserService  │  TransactionSvc   │  CategoryService   │ │
│  └────┬────────────┬────────────┬──────────────┬───────────┘ │
│       │            │            │              │              │
│       ▼            ▼            ▼              ▼              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                PROCESSING WORKERS                        │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │  ExtractionWorker │ CategorizationWorker │ MatchWorker │ │
│  │  (BullMQ Jobs)                                          │ │
│  └────┬───────────────────┬───────────────────┬────────────┘ │
│       │                   │                   │               │
│       ▼                   ▼                   ▼               │
│  ┌─────────────────┐ ┌─────────────┐ ┌──────────────────┐  │
│  │   Supabase DB   │ │   Storage   │ │   Claude API     │  │
│  └─────────────────┘ └─────────────┘ └──────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Data Flow: Document Processing

```
1. User uploads documents
   │
   ▼
2. Frontend: Upload to Supabase Storage
   │
   ▼
3. Frontend: POST /api/documents with storage URLs
   │
   ▼
4. Backend: Validate, create document records (status='queued')
   │
   ▼
5. Backend: Add jobs to BullMQ queue
   │
   ├──▶ ExtractionWorker (processes in background)
   │    │
   │    ├─▶ Fetch file from storage
   │    ├─▶ Call Claude API (Haiku or Sonnet)
   │    ├─▶ Parse JSON response
   │    ├─▶ Create transaction records
   │    └─▶ Update document status='complete'
   │
   ├──▶ CategorizationWorker (after extraction)
   │    │
   │    ├─▶ Fetch uncategorized transactions
   │    ├─▶ Check learning rules first
   │    ├─▶ Call Claude API if no rule
   │    └─▶ Update transaction categories
   │
   └──▶ MatchingWorker (after categorization)
        │
        ├─▶ Fetch unmatched receipts
        ├─▶ Fetch bank transactions in date range
        ├─▶ Run fuzzy matching algorithm
        └─▶ Update match suggestions
   │
   ▼
6. User receives email notification
   │
   ▼
7. User reviews transactions in Review Queue
   │
   ▼
8. User approves/edits → Learning rules updated
   │
   ▼
9. User exports to accounting software
```

---

## DATABASE SCHEMA

**⚠️ IMPORTANT:** This section shows the core database schema for document processing and transactions. For **accounting-specific tables** (journal_entries, chart_of_accounts, account_category_mappings), see [04_ACCOUNTING_CALCULATIONS.md](./04_ACCOUNTING_CALCULATIONS.md) Section: "Implementation Requirements → Database Schema Additions".

The complete database includes:
- **Core tables** (below): organizations, users, clients, documents, transactions, learning_rules, exports
- **Accounting tables** (Document 4): journal_entries, chart_of_accounts, account_category_mappings

### Entity-Relationship Diagram

```
┌──────────────────┐       ┌──────────────────┐
│  organizations   │◄─────┐│      users       │
├──────────────────┤       │├──────────────────┤
│ id (PK)          │       ││ id (PK)          │
│ name             │       ││ organization_id  │─┐
│ plan             │       ││ email            │ │
│ status           │       ││ password_hash    │ │
│ created_at       │       ││ role             │ │
└──────────────────┘       │└──────────────────┘ │
         │                 │                      │
         │                 │                      │
         │                 └──────────────────────┘
         │
         ├─────────────────────────────────────┐
         │                                     │
         ▼                                     ▼
┌──────────────────┐                  ┌──────────────────┐
│     clients      │                  │    documents     │
├──────────────────┤                  ├──────────────────┤
│ id (PK)          │◄────────────────┐│ id (PK)          │
│ organization_id  │                 ││ organization_id  │
│ name             │                 ││ client_id        │
│ vat_number       │                 ││ uploaded_by      │
│ fy_start         │                 ││ file_url         │
│ status           │                 ││ file_type        │
└──────────────────┘                 ││ status           │
         │                           │└──────────────────┘
         │                           │         │
         │                           │         │
         │                           │         ▼
         │                           │┌──────────────────┐
         └───────────────────────────┼┤  transactions    │
                                     ││├──────────────────┤
                                     │││ id (PK)          │
                                     │││ organization_id  │
                                     │││ client_id        │
                                     │││ document_id      │
                                     │││ date             │
                                     │││ merchant         │
                                     │││ amount           │
                                     │││ type             │
                                     │││ category         │
                                     │││ vat_amount       │
                                     │││ vat_rate         │
                                     │││ matched_tx_id    │──┐
                                     │││ status           │  │
                                     ││└──────────────────┘  │
                                     ││         │            │
                                     ││         │            │
                                     │└─────────┼────────────┘
                                     │          │ (self-reference)
                                     │          │
                                     │          ▼
                                     │┌──────────────────┐
                                     ││ learning_rules   │
                                     │├──────────────────┤
                                     ││ id (PK)          │
                                     ││ organization_id  │
                                     ││ client_id        │
                                     ││ merchant         │
                                     ││ category         │
                                     ││ confidence       │
                                     ││ usage_count      │
                                     │└──────────────────┘
                                     │
                                     └─────────────────────┐
                                                           ▼
                                                  ┌──────────────────┐
                                                  │      exports     │
                                                  ├──────────────────┤
                                                  │ id (PK)          │
                                                  │ organization_id  │
                                                  │ client_id        │
                                                  │ created_by       │
                                                  │ format           │
                                                  │ start_date       │
                                                  │ end_date         │
                                                  │ file_url         │
                                                  │ tx_count         │
                                                  │ created_at       │
                                                  └──────────────────┘
```

### Table Schemas

**organizations**
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'growth',  -- 'starter', 'growth', 'professional', 'enterprise'
  status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'suspended', 'cancelled'
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  document_count_current_month INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_organizations_status ON organizations(status);
```

**users**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'accountant',  -- 'admin', 'accountant', 'viewer'
  first_name TEXT,
  last_name TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);

-- RLS Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization" 
  ON users FOR SELECT 
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY "Admins can manage users" 
  ON users FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = current_setting('app.current_user_id')::uuid 
      AND u.role = 'admin'
      AND u.organization_id = users.organization_id
    )
  );
```

**clients**
```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company_number TEXT,
  vat_number TEXT,
  contact_email TEXT,
  financial_year_start DATE,
  status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'archived'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_clients_organization_id ON clients(organization_id);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_name ON clients(name);

-- RLS Policies
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own organization clients" 
  ON clients FOR SELECT 
  USING (organization_id = current_setting('app.current_organization_id')::uuid);
```

**documents**
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id),
  
  -- File info
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_hash TEXT,  -- SHA-256 hash for duplicate detection
  file_type TEXT NOT NULL,  -- 'bank_statement', 'receipt', 'invoice_sales', 'invoice_purchase'
  
  -- Processing
  status TEXT NOT NULL DEFAULT 'queued',  -- 'queued', 'processing', 'complete', 'error'
  error_message TEXT,
  processed_at TIMESTAMP,
  processing_time_ms INTEGER,
  
  -- Metadata (from extraction)
  metadata JSONB,  -- e.g., {"bank": "Lloyds", "period_start": "2026-01-01", ...}
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_documents_organization_id ON documents(organization_id);
CREATE INDEX idx_documents_client_id ON documents(client_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_file_hash ON documents(file_hash);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);

-- RLS Policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own organization documents" 
  ON documents FOR SELECT 
  USING (organization_id = current_setting('app.current_organization_id')::uuid);
```

**transactions**
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  
  -- Core transaction data
  date DATE NOT NULL,
  merchant TEXT NOT NULL,
  description TEXT,  -- Full description from bank statement
  amount NUMERIC(12,2) NOT NULL,  -- Always positive
  type TEXT NOT NULL,  -- 'debit', 'credit'
  balance NUMERIC(12,2),  -- Running balance (for bank statements)
  reference TEXT,  -- Bank reference number
  transaction_type TEXT,  -- 'DD', 'SO', 'CARD', 'TRANSFER', 'CHQ', 'CASH', 'OTHER'
  
  -- Categorization
  category TEXT,
  category_confidence NUMERIC(3,2),  -- 0.00 to 1.00
  category_suggested_by TEXT,  -- 'ai', 'rule', 'manual'
  
  -- VAT
  vat_amount NUMERIC(12,2),
  vat_rate NUMERIC(3,2),  -- 0.20, 0.05, 0.00
  vat_reg_number TEXT,
  
  -- Matching (for receipt-to-bank-transaction matching)
  matched_transaction_id UUID REFERENCES transactions(id),
  match_confidence NUMERIC(3,2),
  match_method TEXT,  -- 'auto', 'manual'
  
  -- Status & Review
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'flagged'
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  
  -- Extraction metadata
  extraction_confidence NUMERIC(3,2),
  extraction_metadata JSONB,  -- e.g., {"field_confidences": {"merchant": 0.98, ...}}
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_transactions_organization_id ON transactions(organization_id);
CREATE INDEX idx_transactions_client_id ON transactions(client_id);
CREATE INDEX idx_transactions_document_id ON transactions(document_id);
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_merchant ON transactions(merchant);
CREATE INDEX idx_transactions_matched_id ON transactions(matched_transaction_id);

-- RLS Policies
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own organization transactions" 
  ON transactions FOR SELECT 
  USING (organization_id = current_setting('app.current_organization_id')::uuid);
```

**learning_rules**
```sql
CREATE TABLE learning_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,  -- NULL = applies to all clients
  
  merchant TEXT NOT NULL,
  merchant_normalized TEXT NOT NULL,  -- Lowercase, trimmed
  category TEXT NOT NULL,
  confidence NUMERIC(3,2) DEFAULT 1.00,
  usage_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMP DEFAULT NOW(),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Ensure one rule per merchant per client
  UNIQUE(organization_id, COALESCE(client_id, '00000000-0000-0000-0000-000000000000'::uuid), merchant_normalized)
);

-- Indexes
CREATE INDEX idx_learning_rules_organization_id ON learning_rules(organization_id);
CREATE INDEX idx_learning_rules_merchant_normalized ON learning_rules(merchant_normalized);

-- RLS Policies
ALTER TABLE learning_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own organization rules" 
  ON learning_rules FOR SELECT 
  USING (organization_id = current_setting('app.current_organization_id')::uuid);
```

**exports**
```sql
CREATE TABLE exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  
  format TEXT NOT NULL,  -- 'iris', 'xero', 'quickbooks', 'sage', 'csv'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status_filter TEXT,  -- 'approved', 'all'
  
  file_url TEXT,
  transaction_count INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_exports_organization_id ON exports(organization_id);
CREATE INDEX idx_exports_client_id ON exports(client_id);
CREATE INDEX idx_exports_created_at ON exports(created_at DESC);

-- RLS Policies
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own organization exports" 
  ON exports FOR SELECT 
  USING (organization_id = current_setting('app.current_organization_id')::uuid);
```

### Database Functions

**Function: normalize_merchant()**
```sql
CREATE OR REPLACE FUNCTION normalize_merchant(merchant_text TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(TRIM(REGEXP_REPLACE(merchant_text, '[^a-zA-Z0-9\s]', '', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

**Function: get_or_create_learning_rule()**
```sql
CREATE OR REPLACE FUNCTION get_or_create_learning_rule(
  p_organization_id UUID,
  p_client_id UUID,
  p_merchant TEXT,
  p_category TEXT
) RETURNS UUID AS $$
DECLARE
  v_rule_id UUID;
  v_merchant_normalized TEXT;
BEGIN
  v_merchant_normalized := normalize_merchant(p_merchant);
  
  -- Try to find existing rule
  SELECT id INTO v_rule_id
  FROM learning_rules
  WHERE organization_id = p_organization_id
    AND (client_id = p_client_id OR (client_id IS NULL AND p_client_id IS NULL))
    AND merchant_normalized = v_merchant_normalized;
  
  IF v_rule_id IS NULL THEN
    -- Create new rule
    INSERT INTO learning_rules (
      organization_id, client_id, merchant, merchant_normalized, category
    ) VALUES (
      p_organization_id, p_client_id, p_merchant, v_merchant_normalized, p_category
    ) RETURNING id INTO v_rule_id;
  ELSE
    -- Update existing rule
    UPDATE learning_rules
    SET category = p_category,
        usage_count = usage_count + 1,
        last_used_at = NOW(),
        updated_at = NOW()
    WHERE id = v_rule_id;
  END IF;
  
  RETURN v_rule_id;
END;
$$ LANGUAGE plpgsql;
```

---

## API SPECIFICATION

**⚠️ IMPORTANT:** This section covers APIs for document processing, transactions, and exports. For **financial reporting APIs** (/api/reports/*), see [04_ACCOUNTING_CALCULATIONS.md](./04_ACCOUNTING_CALCULATIONS.md) Section: "Implementation Requirements → API Endpoints to Add".

Additional endpoints in Document 4:
- GET /api/reports/income-statement
- GET /api/reports/balance-sheet
- GET /api/reports/trial-balance
- GET /api/reports/cash-flow
- GET /api/reports/vat-return
- GET /api/reports/comparison

### Authentication

**POST /api/auth/login**
```typescript
Request:
{
  email: string,
  password: string
}

Response:
{
  token: string,  // JWT, expires in 24 hours
  user: {
    id: string,
    email: string,
    role: string,
    organization: {
      id: string,
      name: string,
      plan: string
    }
  }
}

Errors:
400: Invalid credentials
429: Too many attempts
```

**POST /api/auth/refresh**
```typescript
Headers:
  Authorization: Bearer {token}

Response:
{
  token: string  // New JWT
}

Errors:
401: Invalid/expired token
```

### Document Management

**POST /api/documents/upload**
```typescript
Headers:
  Authorization: Bearer {token}

Request (multipart/form-data):
{
  client_id: string (UUID),
  files: File[]
}

Response:
{
  uploaded: number,
  failed: number,
  documents: [{
    id: string,
    file_name: string,
    file_size: number,
    status: 'queued'
  }]
}

Errors:
400: Invalid client_id, files too large, unsupported format
413: Payload too large (>100MB total)
429: Rate limit exceeded
```

**POST /api/documents/process**
```typescript
Headers:
  Authorization: Bearer {token}

Request:
{
  document_ids: string[]  // UUIDs
}

Response:
{
  queued: number,
  estimated_time: string  // e.g., "Processing will complete in ~2 hours"
}

Errors:
400: Invalid document IDs
404: Documents not found
```

**GET /api/documents**
```typescript
Headers:
  Authorization: Bearer {token}

Query Params:
  client_id?: string (UUID)
  status?: 'queued' | 'processing' | 'complete' | 'error'
  limit?: number (default: 50, max: 100)
  offset?: number (default: 0)

Response:
{
  total: number,
  documents: [{
    id: string,
    client_id: string,
    client_name: string,
    file_name: string,
    file_type: string,
    status: string,
    created_at: string,
    processed_at?: string
  }]
}
```

### Transaction Management

**GET /api/transactions/review**
```typescript
Headers:
  Authorization: Bearer {token}

Query Params:
  client_id?: string (UUID)
  status?: 'pending' | 'approved' | 'rejected' | 'flagged'
  confidence_lt?: number (e.g., 0.80 for <80% confidence)
  date_from?: string (YYYY-MM-DD)
  date_to?: string (YYYY-MM-DD)
  limit?: number (default: 50)
  offset?: number (default: 0)

Response:
{
  total: number,
  transactions: [{
    id: string,
    document_id: string,
    document_url: string,
    client_id: string,
    client_name: string,
    date: string,
    merchant: string,
    amount: number,
    type: 'debit' | 'credit',
    category: string,
    category_confidence: number,
    vat_amount?: number,
    vat_rate?: number,
    matched_transaction?: {
      id: string,
      date: string,
      merchant: string,
      amount: number
    },
    match_confidence?: number,
    extraction_confidence: number
  }]
}
```

**PUT /api/transactions/:id**
```typescript
Headers:
  Authorization: Bearer {token}

Request:
{
  status?: 'approved' | 'rejected' | 'flagged',
  category?: string,
  matched_transaction_id?: string | null,
  review_notes?: string
}

Response:
{
  success: boolean,
  transaction: {...},  // Updated transaction
  learned: boolean,  // True if learning rule created
  rule_id?: string
}

Errors:
400: Invalid data
404: Transaction not found
403: Unauthorized (different organization)
```

**POST /api/transactions/bulk-approve**
```typescript
Headers:
  Authorization: Bearer {token}

Request:
{
  transaction_ids: string[],
  category?: string  // If provided, updates category for all
}

Response:
{
  approved: number,
  failed: number,
  learned: boolean
}
```

### Export

**POST /api/export**
```typescript
Headers:
  Authorization: Bearer {token}

Request:
{
  client_id: string (UUID),
  start_date: string (YYYY-MM-DD),
  end_date: string (YYYY-MM-DD),
  format: 'iris' | 'xero' | 'quickbooks' | 'sage' | 'csv',
  status: 'approved' | 'all'
}

Response:
{
  export_id: string,
  download_url: string,  // Signed URL, expires in 1 hour
  transaction_count: number,
  file_size: number
}

Errors:
400: Invalid parameters
404: Client not found
500: Export generation failed
```

**GET /api/exports**
```typescript
Headers:
  Authorization: Bearer {token}

Query Params:
  client_id?: string (UUID)
  limit?: number (default: 20)
  offset?: number (default: 0)

Response:
{
  total: number,
  exports: [{
    id: string,
    client_name: string,
    format: string,
    start_date: string,
    end_date: string,
    transaction_count: number,
    download_url: string,
    created_at: string
  }]
}
```

---

## PROCESSING WORKERS

**⚠️ IMPORTANT:** This section covers the three main processing workers (ExtractionWorker, CategorizationWorker, MatchingWorker). For the **JournalEntryWorker** (converts transactions to double-entry journal entries), see [04_ACCOUNTING_CALCULATIONS.md](./04_ACCOUNTING_CALCULATIONS.md) Section: "Implementation Requirements → Worker to Add: JournalEntryWorker".

Workers in this document:
- ExtractionWorker: Extract data from documents using Claude API
- CategorizationWorker: Auto-categorize transactions
- MatchingWorker: Match receipts to bank transactions

Additional worker in Document 4:
- JournalEntryWorker: Create double-entry journal entries for accounting

### Worker Architecture

```
┌─────────────────────────────────────────┐
│         BullMQ Queue (Redis)            │
├─────────────────────────────────────────┤
│                                          │
│  ┌────────────────────────────────┐    │
│  │     extraction_queue            │    │
│  │  {document_id, priority}        │    │
│  └────────────────────────────────┘    │
│                                          │
│  ┌────────────────────────────────┐    │
│  │   categorization_queue          │    │
│  │  {transaction_id}               │    │
│  └────────────────────────────────┘    │
│                                          │
│  ┌────────────────────────────────┐    │
│  │      matching_queue             │    │
│  │  {client_id, date_range}        │    │
│  └────────────────────────────────┘    │
│                                          │
└─────────────────────────────────────────┘
         ▲                  │
         │  Add Job         │ Process Job
         │                  ▼
┌──────────────┐   ┌──────────────────────┐
│  API Server  │   │  Worker Processes    │
│   (Hono)     │   │  (3x instances)      │
└──────────────┘   └──────────────────────┘
```

### ExtractionWorker

**Purpose:** Extract data from bank statements and receipts using Claude API

**Job Data:**
```typescript
{
  document_id: string,
  organization_id: string,
  file_url: string,
  file_type: 'bank_statement' | 'receipt'
}
```

**Process:**
1. Fetch document from Supabase Storage
2. Determine Claude model (Haiku for simple, Sonnet for complex)
3. Call Claude API with appropriate prompt
4. Parse JSON response
5. Create transaction records
6. Update document status to 'complete'
7. Trigger categorization jobs for new transactions

**Error Handling:**
- Retry 3 times with exponential backoff
- If all retries fail, mark document as 'error'
- Store error message in document.error_message

**Optimization:**
- Check file hash before processing (skip duplicates)
- Batch similar documents (e.g., all Lloyds statements together)
- Use Haiku for 80% of receipts (simple, clear)
- Use Sonnet for: Low quality, handwritten, first-time merchant

### CategorizationWorker

**Purpose:** Auto-categorize transactions using learning rules or Claude AI

**Job Data:**
```typescript
{
  transaction_id: string,
  organization_id: string,
  merchant: string,
  description: string,
  amount: number,
  date: string
}
```

**Process:**
1. Check learning_rules table for exact merchant match
2. If rule exists → Apply category (confidence = 1.0)
3. If no rule → Call Claude API for categorization
4. Update transaction.category and transaction.category_confidence
5. Store category_suggested_by ('rule' or 'ai')

**Learning Rule Matching:**
```sql
SELECT category, confidence
FROM learning_rules
WHERE organization_id = ?
  AND (client_id = ? OR client_id IS NULL)
  AND merchant_normalized = normalize_merchant(?)
ORDER BY client_id DESC NULLS LAST  -- Prefer client-specific rules
LIMIT 1;
```

### MatchingWorker

**Purpose:** Match receipts to bank transactions using fuzzy matching

**Job Data:**
```typescript
{
  client_id: string,
  organization_id: string,
  date_range: {
    start: string,
    end: string
  }
}
```

**Process:**
1. Fetch all unmatched receipts for client in date range
2. Fetch all bank transactions for client in date range (±7 days)
3. For each receipt, run matching algorithm
4. Update matched_transaction_id and match_confidence
5. Flag potential duplicates (same amount, same date, already matched)

**Matching Algorithm:**
```typescript
function calculateMatchScore(receipt: Transaction, bankTx: Transaction): number {
  let score = 0;
  
  // Amount match (50 points max)
  const amountDiff = Math.abs(receipt.amount - bankTx.amount);
  if (amountDiff < 0.50) score += 50;
  else if (amountDiff < 2.00) score += 30;
  else if (amountDiff < 5.00) score += 10;
  
  // Date match (30 points max)
  const daysDiff = Math.abs(daysBetween(receipt.date, bankTx.date));
  if (daysDiff === 0) score += 30;
  else if (daysDiff <= 3) score += 20;
  else if (daysDiff <= 7) score += 10;
  
  // Merchant match (20 points max)
  const merchantSimilarity = fuzzyMatch(receipt.merchant, bankTx.description);
  score += merchantSimilarity * 20;
  
  return score / 100;  // Normalize to 0-1
}

// Threshold: score >= 0.60 (60%) to suggest match
```

---

## INFRASTRUCTURE

### Deployment Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    CLOUDFLARE CDN                         │
│          (DDoS protection, SSL, Caching)                  │
└────────────────────┬─────────────────────────────────────┘
                     │
         ┌───────────┴────────────┐
         │                        │
         ▼                        ▼
┌─────────────────┐      ┌─────────────────┐
│  VERCEL         │      │   RAILWAY       │
│  (Frontend)     │      │   (Backend)     │
├─────────────────┤      ├─────────────────┤
│ - React App     │      │ - Hono API      │
│ - Edge Cache    │      │ - Workers       │
│ - Auto-scale    │      │ - Auto-scale    │
│                 │      │ - Health checks │
│ Region: Global  │      │ Region: EU West │
└─────────────────┘      └────────┬────────┘
                                  │
                    ┌─────────────┼────────────┐
                    │             │            │
                    ▼             ▼            ▼
           ┌──────────────┐ ┌─────────┐ ┌──────────┐
           │  SUPABASE    │ │  REDIS  │ │ ANTHROPIC│
           │  (Database)  │ │(Railway)│ │   (API)  │
           ├──────────────┤ ├─────────┤ ├──────────┤
           │ - PostgreSQL │ │ - Queue │ │ - Claude │
           │ - Storage    │ │ - Cache │ │ - Sonnet │
           │ - Multi-AZ   │ │         │ │ - Haiku  │
           │              │ │         │ │          │
           │ Region: EU   │ │         │ │          │
           └──────────────┘ └─────────┘ └──────────┘
```

### Environment Configuration

**Frontend (.env)**
```bash
VITE_API_URL=https://api.aiaccounting.io
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_POSTHOG_KEY=phc_...
```

**Backend (.env)**
```bash
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@db.supabase.co:5432/postgres

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...  # Service role key (server-side only)

# Redis
REDIS_URL=redis://default:pass@redis.railway.internal:6379

# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# JWT
JWT_SECRET=random-256-bit-secret
JWT_EXPIRES_IN=24h

# Email
SENDGRID_API_KEY=SG...
FROM_EMAIL=noreply@aiaccounting.io

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
POSTHOG_KEY=phc_...
```

### Scaling Strategy

**Frontend (Vercel):**
- Auto-scales globally (CDN)
- No configuration needed

**Backend (Railway):**
- Start: 1 instance (512MB RAM, 0.5 CPU)
- Scale trigger: CPU >70% for 5 minutes
- Max: 3 instances (Year 1), 10 instances (Year 3)
- Horizontal scaling (stateless API)

**Workers (Railway):**
- Start: 1 worker instance
- Scale trigger: Queue length >100 jobs
- Max: 5 worker instances (Year 3)

**Database (Supabase):**
- Start: Free tier (500MB, 1GB storage)
- Upgrade: Pro tier ($25/month) at 50GB database or 10 concurrent connections
- Team tier ($599/month) at 100 customers or 100GB database

**Redis (Railway):**
- Start: 256MB
- Scale: 1GB at 10,000 jobs/day

---

## SECURITY

### Authentication & Authorization

**JWT Structure:**
```json
{
  "sub": "user-uuid",
  "organization_id": "org-uuid",
  "role": "accountant",
  "iat": 1706745600,
  "exp": 1706832000
}
```

**RLS Context:**
```sql
-- Set on every request
SET app.current_user_id = 'user-uuid';
SET app.current_organization_id = 'org-uuid';

-- Used in RLS policies
CREATE POLICY "..." ON table_name
  USING (organization_id = current_setting('app.current_organization_id')::uuid);
```

**Permissions:**

| Action | Admin | Accountant | Viewer |
|--------|-------|------------|--------|
| Upload documents | ✅ | ✅ | ❌ |
| Review transactions | ✅ | ✅ | ✅ (read-only) |
| Approve transactions | ✅ | ✅ | ❌ |
| Export data | ✅ | ✅ | ❌ |
| Manage users | ✅ | ❌ | ❌ |
| Manage billing | ✅ | ❌ | ❌ |
| View all clients | ✅ | Assigned only | Assigned only |

### Data Security

**Encryption at Rest:**
- Database: AES-256 (Supabase default)
- File Storage: AES-256 (Supabase Storage)
- Backups: Encrypted (Supabase automatic)

**Encryption in Transit:**
- TLS 1.3 (all API calls)
- HSTS headers (force HTTPS)
- Certificate: Let's Encrypt (auto-renewed)

**Sensitive Data Handling:**
- Passwords: bcrypt (cost factor 12)
- API keys: Encrypted in database
- JWT secrets: Stored in environment variables (not in code)
- File URLs: Signed URLs (expire in 1 hour)

### GDPR Compliance

**Data Subject Rights:**

1. **Right to Access:**
   - API: GET /api/gdpr/export-data
   - Returns: All data for user's organization (JSON)

2. **Right to Deletion:**
   - API: DELETE /api/gdpr/delete-organization
   - Cascade deletes: All documents, transactions, users
   - Retention: 30 days grace period (soft delete)

3. **Right to Portability:**
   - API: GET /api/gdpr/export-data?format=csv
   - Returns: Standardized CSV export

**Data Retention:**
- Active data: Indefinite (until customer deletes)
- Deleted data: 30 days (soft delete, recoverable)
- After 30 days: Hard delete (permanent)
- Backups: 90 days (HMRC compliance)

**Privacy Policy:**
- Data controller: AI Accounting Ltd
- Data processor: Supabase (EU), Anthropic (US - data processing agreement)
- Data location: EU (Supabase EU region)
- Third-party processors: Anthropic (Claude API), SendGrid (emails), Stripe (payments)

### Rate Limiting

**API Rate Limits:**
```
POST /api/auth/login: 5 requests/min per IP
POST /api/documents/upload: 10 requests/min per user
GET /api/transactions/review: 60 requests/min per user
All other endpoints: 100 requests/min per user
```

**Implementation:**
```typescript
// Using upstash/ratelimit
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "1 m"),
});

// In middleware
const { success } = await ratelimit.limit(userId);
if (!success) {
  return c.json({ error: "Rate limit exceeded" }, 429);
}
```

---

## MONITORING & OBSERVABILITY

### Error Monitoring (Sentry)

**Tracked Errors:**
- API errors (500, 400)
- Worker failures
- Claude API errors
- Database connection issues
- Unhandled promise rejections

**Error Context:**
```typescript
Sentry.setContext("transaction", {
  organization_id: "...",
  document_id: "...",
  user_id: "...",
});

Sentry.captureException(error, {
  level: "error",
  tags: {
    service: "extraction_worker",
    claude_model: "haiku",
  },
});
```

### Analytics (PostHog)

**Tracked Events:**
- User actions: login, upload, review, approve, export
- System events: document_processed, extraction_complete, categorization_complete
- Performance: api_response_time, extraction_time, worker_queue_length

**Example:**
```typescript
posthog.capture('document_uploaded', {
  $set: { organization_id: '...' },
  document_type: 'receipt',
  file_size: 2048000,
  client_id: '...',
});
```

### Performance Monitoring

**Metrics to Track:**
- API response time (p50, p95, p99)
- Database query time
- Claude API latency
- Worker processing time
- Queue length (extraction, categorization, matching)
- Document processing throughput (docs/hour)

**Alerting Thresholds:**
- API p95 >2s → Slack alert
- Worker queue >1000 jobs → Slack alert
- Error rate >1% → Slack alert
- Database connections >80% → Slack alert
- Claude API errors >5% → Slack alert

---

## COST OPTIMIZATION

### Claude API Optimization

**Strategy 1: Model Selection**
```typescript
function selectModel(document: Document): 'haiku' | 'sonnet' {
  // Use Haiku (cheap) for simple cases
  if (document.file_type === 'receipt' && document.file_size < 500000) {
    return 'haiku';  // £0.01-0.02 per receipt
  }
  
  // Use Sonnet (expensive) for complex cases
  if (document.quality === 'poor' || document.is_handwritten) {
    return 'sonnet';  // £0.10 per receipt
  }
  
  return 'haiku';  // Default to cheap
}
```

**Strategy 2: Caching**
```typescript
// Cache merchant-category mappings
const cachedCategory = await redis.get(`merchant:${merchant}:category`);
if (cachedCategory) {
  return cachedCategory;  // Skip Claude API call
}

// Call Claude, then cache
const category = await callClaudeForCategory(merchant);
await redis.set(`merchant:${merchant}:category`, category, { ex: 86400 });  // 24h TTL
```

**Strategy 3: Batch Processing**
```typescript
// Process 10 receipts in one Claude API call instead of 10 separate calls
// Saves on API overhead
const receipts = await getReceiptBatch(10);
const prompt = `Extract data from these ${receipts.length} receipts...`;
```

**Strategy 4: Incremental Processing**
```typescript
// Only process NEW transactions from bank statements
const existingHashes = await getProcessedTransactionHashes(documentId);
const newTransactions = allTransactions.filter(
  tx => !existingHashes.includes(hash(tx))
);
// Only send newTransactions to Claude (skip duplicates)
```

### Infrastructure Optimization

**Railway:**
- Use scheduled scaling (scale down overnight)
- Use spot instances where available
- Optimize Docker image (multi-stage build, Alpine Linux)

**Supabase:**
- Use connection pooling (pgBouncer)
- Index optimization (EXPLAIN ANALYZE)
- Vacuum & analyze (automatic)

**Redis:**
- Use LRU eviction policy
- Set TTL on all cached data
- Compress large values (>1KB)

---

## APPENDIX

### Technology Decisions

**Why Hono instead of Express?**
- 3x faster (benchmarks)
- TypeScript-first
- Lightweight (no bloat)
- Modern API (async/await native)

**Why Supabase instead of raw PostgreSQL?**
- Built-in Row Level Security
- File storage included
- Auto-backups
- Real-time subscriptions (future feature)
- Cheaper than self-hosting (Year 1)

**Why Railway instead of AWS/GCP?**
- Simpler (no DevOps expertise needed)
- Auto-scaling out of the box
- Integrated Redis
- Cheaper for small scale
- Migrate to AWS if needed (Year 3+)

**Why BullMQ instead of cloud queues (SQS)?**
- Simpler (Redis-backed)
- Cheaper (no per-message pricing)
- Better local development
- Rich dashboard
- Can migrate to SQS later if needed

### Performance Targets

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| API response (p95) | <1s | <2s |
| Document upload | <5s | <10s |
| Extraction time | <3 min/doc | <5 min/doc |
| Batch processing | <24h | <48h |
| Database query | <100ms | <500ms |
| Page load | <2s | <5s |

### Disaster Recovery

**Backup Strategy:**
- Database: Daily automatic (Supabase)
- Files: Redundant storage (Supabase multi-region)
- Code: Git (GitHub private repo)
- Config: 1Password (environment variables)

**Recovery Procedures:**

1. **Database Corruption:**
   - Restore from latest backup (Supabase dashboard)
   - RTO: 1 hour
   - RPO: 24 hours

2. **Total Infrastructure Failure:**
   - Deploy new Railway instance
   - Point to Supabase (data intact)
   - RTO: 4 hours

3. **Supabase Failure (unlikely):**
   - Spin up new PostgreSQL (Railway)
   - Restore from backup
   - RTO: 8 hours

---

**Document Version:** 1.0  
**Last Updated:** February 1, 2026  
**Next Review:** After MVP Launch (Week 15)
