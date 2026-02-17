-- ========================================
-- AI ACCOUNTING - DATABASE MIGRATION
-- Run this in Supabase → SQL Editor
-- ========================================
-- Safe to run multiple times (uses IF NOT EXISTS)
-- Fixes schema mismatches between SQL schema and backend code
-- ========================================

-- 1. Fix DOCUMENTS table
--    Backend uses: storage_path, mime_type (not file_url)

-- Add storage_path column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE documents ADD COLUMN storage_path TEXT;
    RAISE NOTICE 'Added storage_path to documents';
  END IF;
END $$;

-- Add mime_type column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'mime_type'
  ) THEN
    ALTER TABLE documents ADD COLUMN mime_type TEXT;
    RAISE NOTICE 'Added mime_type to documents';
  END IF;
END $$;

-- Make file_url nullable if it exists with NOT NULL constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents'
      AND column_name = 'file_url' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE documents ALTER COLUMN file_url DROP NOT NULL;
    RAISE NOTICE 'Made file_url nullable in documents';
  END IF;
END $$;

-- 2. Fix CLIENTS table
--    Backend uses: deleted_at for soft deletes

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE clients ADD COLUMN deleted_at TIMESTAMP;
    RAISE NOTICE 'Added deleted_at to clients';
  END IF;
END $$;

-- 3. Fix JOURNAL_ENTRIES table
--    Check if table matches what backend expects

-- Verify organizations table has all required columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organizations'
  ) THEN
    RAISE EXCEPTION 'organizations table does not exist - run COMPLETE_DATABASE_SCHEMA.sql first';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clients'
  ) THEN
    RAISE EXCEPTION 'clients table does not exist - run COMPLETE_DATABASE_SCHEMA.sql first';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'documents'
  ) THEN
    RAISE EXCEPTION 'documents table does not exist - run COMPLETE_DATABASE_SCHEMA.sql first';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'transactions'
  ) THEN
    RAISE EXCEPTION 'transactions table does not exist - run COMPLETE_DATABASE_SCHEMA.sql first';
  END IF;
  RAISE NOTICE 'All required tables exist';
END $$;

-- 4. Verify current schema state
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('clients', 'documents', 'organizations', 'users', 'transactions')
ORDER BY table_name, ordinal_position;
