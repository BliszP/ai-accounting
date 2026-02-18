-- ============================================================
-- DATABASE SECURITY & PERFORMANCE FIXES
-- Run this in: Supabase → SQL Editor → New Query → Run
--
-- Fixes all 19 Supabase Advisor warnings:
--   3 Security: organizations RLS + mutable search_path functions
--  16 Performance: inefficient RLS policy evaluation patterns
-- ============================================================


-- ============================================================
-- SECURITY FIX 1: Enable RLS on public.organizations
-- Issue: "Table is public but RLS has not been enabled"
-- ============================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Users can read their own organization
CREATE POLICY "Users see own organization"
  ON public.organizations FOR SELECT
  USING (id = (SELECT current_setting('app.current_organization_id', true)::uuid));

-- Service role (backend) has unrestricted access (bypasses RLS entirely by design)
-- No explicit policy needed — service_role always bypasses RLS in Supabase.


-- ============================================================
-- SECURITY FIX 2: Secure search_path on normalize_merchant()
-- Issue: "Function has a role mutable search_path"
-- Fix: Add SET search_path = public so schema can't be hijacked
-- ============================================================

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


-- ============================================================
-- SECURITY FIX 3: Secure search_path on get_or_create_learning_rule()
-- Issue: "Function has a role mutable search_path"
-- ============================================================

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

  SELECT id INTO v_rule_id
  FROM learning_rules
  WHERE organization_id = p_organization_id
    AND (client_id = p_client_id OR (client_id IS NULL AND p_client_id IS NULL))
    AND merchant_normalized = v_merchant_normalized;

  IF v_rule_id IS NULL THEN
    INSERT INTO learning_rules (
      organization_id, client_id, merchant, merchant_normalized, category
    ) VALUES (
      p_organization_id, p_client_id, p_merchant, v_merchant_normalized, p_category
    ) RETURNING id INTO v_rule_id;
  ELSE
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


-- ============================================================
-- PERFORMANCE HELPER: Security-definer function for admin check
--
-- The original "Admins can manage users" policy contained a
-- correlated subquery that queried the SAME users table it was
-- protecting, causing recursive + N-per-row evaluation.
--
-- This SECURITY DEFINER function runs with elevated privileges
-- (bypassing RLS on its own query) and is STABLE so PostgreSQL
-- can cache the result once per query, not once per row.
-- ============================================================

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
    WHERE id             = (SELECT current_setting('app.current_user_id', true)::uuid)
      AND role           = 'admin'
      AND organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );
$$;


-- ============================================================
-- PERFORMANCE FIX: Rebuild all RLS policies
--
-- Problem: current_setting() called once PER ROW (expensive).
-- Fix:     Wrap in (SELECT ...) so PostgreSQL evaluates it once
--          PER QUERY as an InitPlan — massive speedup on large tables.
--
-- Affects all 16 performance warnings (each policy on each table).
-- ============================================================


-- ── users ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own organization"  ON public.users;
DROP POLICY IF EXISTS "Admins can manage users"          ON public.users;

CREATE POLICY "Users can view own organization"
  ON public.users FOR SELECT
  USING (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );

-- Rewritten to use is_org_admin() — eliminates self-referencing subquery
CREATE POLICY "Admins can manage users"
  ON public.users FOR ALL
  USING (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
    AND (SELECT public.is_org_admin())
  )
  WITH CHECK (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
    AND (SELECT public.is_org_admin())
  );


-- ── clients ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users see own organization clients" ON public.clients;

CREATE POLICY "Users see own organization clients"
  ON public.clients FOR SELECT
  USING (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );


-- ── documents ────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users see own organization documents" ON public.documents;

CREATE POLICY "Users see own organization documents"
  ON public.documents FOR SELECT
  USING (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );


-- ── transactions ─────────────────────────────────────────────

DROP POLICY IF EXISTS "Users see own organization transactions" ON public.transactions;

CREATE POLICY "Users see own organization transactions"
  ON public.transactions FOR SELECT
  USING (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );


-- ── journal_entries ──────────────────────────────────────────

DROP POLICY IF EXISTS "Users see own organization journal entries" ON public.journal_entries;

CREATE POLICY "Users see own organization journal entries"
  ON public.journal_entries FOR SELECT
  USING (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );


-- ── learning_rules ───────────────────────────────────────────

DROP POLICY IF EXISTS "Users see own organization rules" ON public.learning_rules;

CREATE POLICY "Users see own organization rules"
  ON public.learning_rules FOR SELECT
  USING (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );


-- ── exports ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users see own organization exports" ON public.exports;

CREATE POLICY "Users see own organization exports"
  ON public.exports FOR SELECT
  USING (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );


-- ── chart_of_accounts ────────────────────────────────────────

DROP POLICY IF EXISTS "Users see own organization accounts" ON public.chart_of_accounts;

-- chart_of_accounts may not have RLS yet — enable it safely
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own organization accounts"
  ON public.chart_of_accounts FOR SELECT
  USING (
    organization_id IS NULL  -- global/shared accounts visible to all
    OR organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );


-- ── account_category_mappings ────────────────────────────────

DROP POLICY IF EXISTS "Users see own organization mappings" ON public.account_category_mappings;

ALTER TABLE public.account_category_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own organization mappings"
  ON public.account_category_mappings FOR SELECT
  USING (
    organization_id IS NULL
    OR organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );


-- ============================================================
-- PERFORMANCE FIX: Composite index for is_org_admin() lookup
-- Supports the admin check: WHERE id=? AND role=? AND org_id=?
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_org_role
  ON public.users (organization_id, role);


-- ============================================================
-- VERIFICATION — uncomment and run after applying fixes
-- ============================================================

-- Check RLS is enabled on all tables (rlsenabled should be true):
-- SELECT relname, relrowsecurity AS rlsenabled
-- FROM pg_class
-- WHERE relname IN (
--   'organizations','users','clients','documents','transactions',
--   'journal_entries','learning_rules','exports',
--   'chart_of_accounts','account_category_mappings'
-- )
-- ORDER BY relname;

-- Check all policies:
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- Check function search_path:
-- SELECT proname, proconfig
-- FROM pg_proc
-- WHERE proname IN ('normalize_merchant','get_or_create_learning_rule','is_org_admin')
--   AND pronamespace = 'public'::regnamespace;

-- ============================================================
-- DONE — refresh the Supabase Advisor to confirm 0 warnings
-- ============================================================
