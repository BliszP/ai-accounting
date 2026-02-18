-- ========================================
-- AI ACCOUNTING DATABASE SCHEMA
-- Complete script for Supabase SQL Editor
-- ========================================
-- Version: 1.1
-- Date: February 18, 2026
--
-- Changes in v1.1:
--   - Enable RLS on organizations (security fix)
--   - Enable RLS on chart_of_accounts + account_category_mappings
--   - Add SET search_path = public to all functions (security fix)
--   - Add is_org_admin() security-definer helper function
--   - All RLS policies use (SELECT current_setting(...)) pattern for
--     per-query evaluation instead of per-row (performance fix)
--   - Add composite index idx_users_org_role
--
-- Instructions:
-- 1. Open Supabase → SQL Editor
-- 2. Copy this ENTIRE file
-- 3. Paste into SQL Editor
-- 4. Click "Run" (or press Ctrl+Enter)
-- 5. Verify: Tables → Should see 10 tables
-- ========================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- TABLES
-- ========================================

-- 1. Organizations (multi-tenant container)
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

-- 2. Users (with roles)
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

-- 3. Clients (organizations' clients)
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company_number TEXT,
  vat_number TEXT,
  contact_email TEXT,
  financial_year_start DATE,
  status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'archived'
  deleted_at TIMESTAMP,  -- Soft delete timestamp
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Documents (uploaded files)
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id),

  -- File storage
  storage_path TEXT NOT NULL,  -- Path in Supabase Storage bucket
  mime_type TEXT,              -- MIME type of the file
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_hash TEXT,  -- SHA-256 hash for duplicate detection
  file_type TEXT NOT NULL,  -- 'bank_statement', 'receipt', 'invoice_sales', 'invoice_purchase'

  -- Processing
  status TEXT NOT NULL DEFAULT 'queued',  -- 'queued', 'processing', 'complete', 'error'
  error_message TEXT,
  processed_at TIMESTAMP,

  -- Metadata (from extraction)
  metadata JSONB,  -- e.g., {"bank": "Lloyds", "extractedText": "...", "isImageBased": false}

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Transactions (extracted transaction data)
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

-- 6. Journal Entries (double-entry bookkeeping)
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id),

  date DATE NOT NULL,
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  debit_amount NUMERIC(12,2),
  credit_amount NUMERIC(12,2),
  description TEXT,
  reference TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 7. Chart of Accounts (accounting categories)
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL,  -- 'asset', 'liability', 'equity', 'revenue', 'expense'
  parent_account TEXT,
  normal_balance TEXT NOT NULL,  -- 'debit' or 'credit'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(organization_id, account_code)
);

-- 8. Account Category Mappings (transaction category → account code)
CREATE TABLE account_category_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  account_code TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(organization_id, category)
);

-- 9. Learning Rules (merchant → category mappings)
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
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 10. Exports (export history)
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

-- ========================================
-- INDEXES (Performance)
-- ========================================

-- Organizations
CREATE INDEX idx_organizations_status ON organizations(status);

-- Users
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
-- Composite index for is_org_admin() lookup: WHERE id=? AND role=? AND org_id=?
CREATE INDEX idx_users_org_role ON users(organization_id, role);

-- Clients
CREATE INDEX idx_clients_organization_id ON clients(organization_id);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_name ON clients(name);

-- Documents
CREATE INDEX idx_documents_organization_id ON documents(organization_id);
CREATE INDEX idx_documents_client_id ON documents(client_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_file_hash ON documents(file_hash);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX idx_documents_org_created ON documents(organization_id, created_at DESC);
CREATE INDEX idx_documents_client ON documents(client_id, created_at DESC);
CREATE INDEX idx_documents_status_org ON documents(status, organization_id);

-- Transactions
CREATE INDEX idx_transactions_organization_id ON transactions(organization_id);
CREATE INDEX idx_transactions_client_id ON transactions(client_id);
CREATE INDEX idx_transactions_document_id ON transactions(document_id);
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_merchant ON transactions(merchant);
CREATE INDEX idx_transactions_matched_id ON transactions(matched_transaction_id);
CREATE INDEX idx_transactions_client_date ON transactions(client_id, date DESC);
CREATE INDEX idx_transactions_document ON transactions(document_id);
CREATE INDEX idx_transactions_approved ON transactions(organization_id, status, created_at DESC);

-- Journal Entries
CREATE INDEX idx_journal_entries_transaction_id ON journal_entries(transaction_id);
CREATE INDEX idx_journal_entries_account_code ON journal_entries(account_code);
CREATE INDEX idx_journal_entries_transaction ON journal_entries(transaction_id);
CREATE INDEX idx_journal_entries_account ON journal_entries(account_code, created_at DESC);
CREATE INDEX idx_journal_entries_org ON journal_entries(organization_id);
CREATE INDEX idx_journal_entries_client ON journal_entries(client_id);

-- Chart of Accounts
CREATE INDEX idx_chart_of_accounts_org ON chart_of_accounts(organization_id);
CREATE INDEX idx_chart_of_accounts_code ON chart_of_accounts(account_code);

-- Account Category Mappings
CREATE INDEX idx_account_category_mappings_org ON account_category_mappings(organization_id);

-- Learning Rules
CREATE INDEX idx_learning_rules_organization_id ON learning_rules(organization_id);
CREATE INDEX idx_learning_rules_merchant_normalized ON learning_rules(merchant_normalized);
-- Unique index: one rule per merchant per client (handles NULL client_id)
CREATE UNIQUE INDEX idx_learning_rules_unique_merchant ON learning_rules(
  organization_id,
  COALESCE(client_id, '00000000-0000-0000-0000-000000000000'::uuid),
  merchant_normalized
);

-- Exports
CREATE INDEX idx_exports_organization_id ON exports(organization_id);
CREATE INDEX idx_exports_client_id ON exports(client_id);
CREATE INDEX idx_exports_created_at ON exports(created_at DESC);

-- ========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
--
-- Performance note: current_setting() is wrapped in (SELECT ...)
-- so PostgreSQL evaluates it once per query (InitPlan), not once
-- per row. This eliminates the most common RLS performance warning.
--
-- Service role (used by the backend via supabaseAdmin) always
-- bypasses RLS automatically — no explicit policy needed for it.
-- ========================================

-- Organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own organization"
  ON organizations FOR SELECT
  USING (id = (SELECT current_setting('app.current_organization_id', true)::uuid));

-- Users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization"
  ON users FOR SELECT
  USING (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );

-- Admin helper: security-definer so it can query users without
-- triggering the RLS policy on users (avoids self-referencing subquery).
-- STABLE lets PostgreSQL cache the result once per query.
CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id              = (SELECT current_setting('app.current_user_id', true)::uuid)
      AND role            = 'admin'
      AND organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );
$$;

CREATE POLICY "Admins can manage users"
  ON users FOR ALL
  USING (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
    AND (SELECT public.is_org_admin())
  )
  WITH CHECK (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
    AND (SELECT public.is_org_admin())
  );

-- Clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own organization clients"
  ON clients FOR SELECT
  USING (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );

-- Documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own organization documents"
  ON documents FOR SELECT
  USING (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );

-- Transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own organization transactions"
  ON transactions FOR SELECT
  USING (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );

-- Journal Entries
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own organization journal entries"
  ON journal_entries FOR SELECT
  USING (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );

-- Learning Rules
ALTER TABLE learning_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own organization rules"
  ON learning_rules FOR SELECT
  USING (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );

-- Exports
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own organization exports"
  ON exports FOR SELECT
  USING (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );

-- Chart of Accounts
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own organization accounts"
  ON chart_of_accounts FOR SELECT
  USING (
    organization_id IS NULL  -- global/shared accounts visible to all
    OR organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );

-- Account Category Mappings
ALTER TABLE account_category_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own organization mappings"
  ON account_category_mappings FOR SELECT
  USING (
    organization_id IS NULL
    OR organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );

-- ========================================
-- DATABASE FUNCTIONS
--
-- Security note: SET search_path = public prevents schema-injection
-- attacks where a malicious user creates objects in a search_path
-- schema to intercept function calls.
-- ========================================

-- Function: normalize_merchant()
-- Normalizes merchant name for comparison
CREATE OR REPLACE FUNCTION public.normalize_merchant(merchant_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN LOWER(TRIM(REGEXP_REPLACE(merchant_text, '[^a-zA-Z0-9\s]', '', 'g')));
END;
$$;

-- Function: get_or_create_learning_rule()
-- Gets existing learning rule or creates new one
CREATE OR REPLACE FUNCTION public.get_or_create_learning_rule(
  p_organization_id UUID,
  p_client_id UUID,
  p_merchant TEXT,
  p_category TEXT
) RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
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
    SET category     = p_category,
        usage_count  = usage_count + 1,
        last_used_at = NOW(),
        updated_at   = NOW()
    WHERE id = v_rule_id;
  END IF;

  RETURN v_rule_id;
END;
$$;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Run these after the script completes to verify:

-- Check all tables were created (should return 10 rows)
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('organizations', 'users', 'clients', 'documents', 'transactions',
--                    'journal_entries', 'chart_of_accounts', 'account_category_mappings',
--                    'learning_rules', 'exports')
-- ORDER BY table_name;

-- Check indexes were created (should return 40+ rows)
-- SELECT tablename, indexname FROM pg_indexes
-- WHERE schemaname = 'public'
-- AND tablename IN ('organizations', 'users', 'clients', 'documents', 'transactions',
--                   'journal_entries', 'chart_of_accounts', 'account_category_mappings',
--                   'learning_rules', 'exports')
-- ORDER BY tablename, indexname;

-- Check RLS is enabled on all tables (rlsenabled should be true for all):
-- SELECT relname, relrowsecurity AS rlsenabled
-- FROM pg_class
-- WHERE relname IN (
--   'organizations','users','clients','documents','transactions',
--   'journal_entries','learning_rules','exports',
--   'chart_of_accounts','account_category_mappings'
-- )
-- ORDER BY relname;

-- Check RLS policies were created (should return 11+ rows):
-- SELECT tablename, policyname FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- Check functions were created and have secure search_path (should return 3 rows):
-- SELECT proname, proconfig
-- FROM pg_proc
-- WHERE proname IN ('normalize_merchant', 'get_or_create_learning_rule', 'is_org_admin')
--   AND pronamespace = 'public'::regnamespace;
-- Expected: proconfig includes 'search_path=public' for all three.

-- ========================================
-- SETUP COMPLETE!
-- ========================================
-- Next steps:
-- 1. Insert test data (see below)
-- 2. Configure backend .env with Supabase credentials
-- 3. Test backend connection
-- ========================================

-- ========================================
-- TEST DATA (Optional - for development)
-- ========================================

-- Insert test organization
-- INSERT INTO organizations (name, plan)
-- VALUES ('Test Accounting Firm', 'growth')
-- RETURNING id;

-- Insert test user (use the organization_id from above)
-- Note: Password hash for "password123" - CHANGE IN PRODUCTION!
-- INSERT INTO users (organization_id, email, password_hash, role, first_name, last_name)
-- VALUES (
--   '[PASTE-ORG-ID-HERE]',
--   'admin@test.com',
--   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeQcbAZw4Xh1yV9Ze',
--   'admin',
--   'Test',
--   'Admin'
-- );

-- Insert test client
-- INSERT INTO clients (organization_id, name, vat_number)
-- VALUES (
--   '[PASTE-ORG-ID-HERE]',
--   'ACME Ltd',
--   'GB123456789'
-- );
