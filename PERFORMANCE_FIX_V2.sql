-- ============================================================
-- PERFORMANCE FIX V2
-- Run this in: Supabase → SQL Editor → New Query → Run
--
-- Addresses the remaining 32 performance warnings:
--   1. Removes ALL existing RLS policies on every table
--   2. Re-creates exactly ONE clean policy per table with
--      the (SELECT ...) InitPlan pattern
--   3. Adds RLS + policy for journal_entry_lines (missing table)
--
-- Safe to run: uses DROP IF EXISTS everywhere.
-- ============================================================


-- ============================================================
-- STEP 1: DIAGNOSTIC — Run this block first (uncomment) to see
--         exactly which policies currently exist.
-- ============================================================

-- SELECT tablename, policyname, cmd, roles, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- -- Count policies per table/command (flag duplicates):
-- SELECT tablename, cmd, count(*) AS policy_count
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- GROUP BY tablename, cmd
-- HAVING count(*) > 1
-- ORDER BY tablename, cmd;


-- ============================================================
-- STEP 2: DROP *ALL* existing policies on all affected tables
--
-- We drop by name AND drop all remaining policies via a brute-
-- force loop so that any policy with an unexpected name (added
-- manually in Supabase Studio) is also removed.
-- ============================================================

-- ── organizations ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Users see own organization"               ON public.organizations;
DROP POLICY IF EXISTS "organizations_select_policy"             ON public.organizations;

-- ── users ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own organization"          ON public.users;
DROP POLICY IF EXISTS "Admins can manage users"                  ON public.users;
DROP POLICY IF EXISTS "users_select_policy"                      ON public.users;
DROP POLICY IF EXISTS "users_all_policy"                         ON public.users;

-- ── clients ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users see own organization clients"       ON public.clients;
DROP POLICY IF EXISTS "clients_select_policy"                    ON public.clients;

-- ── documents ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users see own organization documents"     ON public.documents;
DROP POLICY IF EXISTS "documents_select_policy"                  ON public.documents;

-- ── transactions ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Users see own organization transactions"  ON public.transactions;
DROP POLICY IF EXISTS "transactions_select_policy"               ON public.transactions;

-- ── journal_entries ───────────────────────────────────────────
DROP POLICY IF EXISTS "Users see own organization journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "journal_entries_select_policy"            ON public.journal_entries;

-- ── journal_entry_lines ───────────────────────────────────────
DROP POLICY IF EXISTS "Users see own organization entry lines"   ON public.journal_entry_lines;
DROP POLICY IF EXISTS "journal_entry_lines_select_policy"        ON public.journal_entry_lines;

-- ── learning_rules ────────────────────────────────────────────
DROP POLICY IF EXISTS "Users see own organization rules"         ON public.learning_rules;
DROP POLICY IF EXISTS "learning_rules_select_policy"             ON public.learning_rules;

-- ── exports ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users see own organization exports"       ON public.exports;
DROP POLICY IF EXISTS "exports_select_policy"                    ON public.exports;

-- ── chart_of_accounts ─────────────────────────────────────────
DROP POLICY IF EXISTS "Users see own organization accounts"      ON public.chart_of_accounts;
DROP POLICY IF EXISTS "chart_of_accounts_select_policy"          ON public.chart_of_accounts;

-- ── account_category_mappings ─────────────────────────────────
DROP POLICY IF EXISTS "Users see own organization mappings"      ON public.account_category_mappings;
DROP POLICY IF EXISTS "account_category_mappings_select_policy"  ON public.account_category_mappings;

-- Catch-all: drop ANY remaining policy on these tables whose name
-- we might have missed (uses DO block to iterate pg_policies).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'organizations', 'users', 'clients', 'documents', 'transactions',
        'journal_entries', 'journal_entry_lines', 'learning_rules', 'exports',
        'chart_of_accounts', 'account_category_mappings'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END;
$$;


-- ============================================================
-- STEP 3: Ensure RLS is enabled on every table
-- ============================================================

ALTER TABLE public.organizations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_rules             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exports                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_category_mappings  ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 4: Ensure the is_org_admin() helper exists
--         (idempotent — safe to run even if it already exists)
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
    WHERE id              = (SELECT current_setting('app.current_user_id', true)::uuid)
      AND role            = 'admin'
      AND organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );
$$;


-- ============================================================
-- STEP 5: Re-create ONE clean policy per table
--
-- Pattern: (SELECT current_setting(...)) — evaluated once per
-- query (InitPlan), not once per row.
--
-- Backend uses service_role which bypasses RLS automatically,
-- so these policies only affect direct Supabase client access.
-- ============================================================

-- ── organizations ─────────────────────────────────────────────
CREATE POLICY "org_select"
  ON public.organizations FOR SELECT
  USING (id = (SELECT current_setting('app.current_organization_id', true)::uuid));


-- ── users — TWO operations, ONE policy each to avoid overlap ──
-- SELECT: anyone in the org can read users
CREATE POLICY "users_select"
  ON public.users FOR SELECT
  USING (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );

-- INSERT / UPDATE / DELETE: admin only
CREATE POLICY "users_write"
  ON public.users FOR ALL
  USING (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
    AND (SELECT public.is_org_admin())
  )
  WITH CHECK (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
    AND (SELECT public.is_org_admin())
  );


-- ── clients ───────────────────────────────────────────────────
CREATE POLICY "clients_select"
  ON public.clients FOR SELECT
  USING (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );


-- ── documents ─────────────────────────────────────────────────
CREATE POLICY "documents_select"
  ON public.documents FOR SELECT
  USING (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );


-- ── transactions ──────────────────────────────────────────────
CREATE POLICY "transactions_select"
  ON public.transactions FOR SELECT
  USING (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );


-- ── journal_entries ───────────────────────────────────────────
CREATE POLICY "journal_entries_select"
  ON public.journal_entries FOR SELECT
  USING (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );


-- ── journal_entry_lines ───────────────────────────────────────
-- No organization_id column — filter via parent journal_entries.
-- Using EXISTS + correlated subquery with InitPlan-safe pattern.
CREATE POLICY "journal_entry_lines_select"
  ON public.journal_entry_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.journal_entries je
      WHERE je.id              = journal_entry_lines.journal_entry_id
        AND je.organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
    )
  );


-- ── learning_rules ────────────────────────────────────────────
CREATE POLICY "learning_rules_select"
  ON public.learning_rules FOR SELECT
  USING (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );


-- ── exports ───────────────────────────────────────────────────
CREATE POLICY "exports_select"
  ON public.exports FOR SELECT
  USING (
    organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );


-- ── chart_of_accounts ─────────────────────────────────────────
-- organization_id IS NULL = global/shared accounts visible to all
CREATE POLICY "chart_of_accounts_select"
  ON public.chart_of_accounts FOR SELECT
  USING (
    organization_id IS NULL
    OR organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );


-- ── account_category_mappings ─────────────────────────────────
CREATE POLICY "account_category_mappings_select"
  ON public.account_category_mappings FOR SELECT
  USING (
    organization_id IS NULL
    OR organization_id = (SELECT current_setting('app.current_organization_id', true)::uuid)
  );


-- ============================================================
-- STEP 6: Composite index for is_org_admin() (idempotent)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_org_role
  ON public.users (organization_id, role);


-- ============================================================
-- VERIFICATION — Run after the script to confirm clean state
-- ============================================================

-- Total policy count (should be 13: 1 per table except users which has 2):
-- SELECT count(*) FROM pg_policies WHERE schemaname = 'public';

-- Full policy list:
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- Any table/cmd combination with multiple policies (should return 0 rows):
-- SELECT tablename, cmd, count(*) AS n
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- GROUP BY tablename, cmd
-- HAVING count(*) > 1;

-- ============================================================
-- DONE — refresh Supabase Advisor to confirm 0 warnings
-- ============================================================
