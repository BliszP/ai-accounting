# Workers

Background job processors using BullMQ.

## Workers to Implement

### 1. ExtractionWorker
**File:** `extraction.ts`
**Purpose:** Extract data from documents using Claude API
**Job Queue:** `extraction_queue`
**Processing:**
1. Fetch document from Supabase Storage
2. Call Claude API (Haiku for simple, Sonnet for complex)
3. Parse JSON response
4. Create transaction records
5. Update document status

### 2. CategorizationWorker
**File:** `categorization.ts`
**Purpose:** Auto-categorize transactions
**Job Queue:** `categorization_queue`
**Processing:**
1. Check learning_rules for merchant match
2. If no rule, call Claude API
3. Update transaction category
4. Store suggestion source

### 3. MatchingWorker
**File:** `matching.ts`
**Purpose:** Match receipts to bank transactions
**Job Queue:** `matching_queue`
**Processing:**
1. Fetch unmatched receipts
2. Fetch bank transactions in date range
3. Run fuzzy matching algorithm
4. Update match suggestions

### 4. JournalEntryWorker
**File:** `journalEntry.ts`
**Purpose:** Create double-entry bookkeeping entries
**Job Queue:** `journal_entry_queue`
**Processing:**
1. Fetch approved transaction
2. Determine account codes
3. Create balanced journal entries (debits = credits)
4. Validate balance
5. Insert to database

## Implementation Guide

Each worker should:
1. Use BullMQ for job processing
2. Handle errors with retries (max 3)
3. Log all operations
4. Update job progress
5. Clean up resources

See `docs/03_TECHNICAL_ARCHITECTURE.md` for detailed specifications.
