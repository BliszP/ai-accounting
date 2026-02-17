/**
 * TypeScript Type Definitions
 *
 * Shared types across the application
 */

/**
 * API Response types
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}

/**
 * Database entity types
 */
export interface Organization {
  id: string;
  name: string;
  plan: 'starter' | 'growth' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  document_count_current_month: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  organization_id: string;
  email: string;
  role: 'admin' | 'accountant' | 'viewer';
  first_name: string | null;
  last_name: string | null;
  email_verified: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  organization_id: string;
  name: string;
  company_number: string | null;
  vat_number: string | null;
  contact_email: string | null;
  financial_year_start: string | null;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  organization_id: string;
  client_id: string;
  uploaded_by: string;
  file_url: string;
  file_name: string;
  file_size: number;
  file_hash: string;
  file_type: 'bank_statement' | 'receipt' | 'invoice_sales' | 'invoice_purchase';
  status: 'queued' | 'processing' | 'complete' | 'error';
  error_message: string | null;
  processed_at: string | null;
  processing_time_ms: number | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  organization_id: string;
  client_id: string;
  document_id: string;
  date: string;
  merchant: string;
  description: string | null;
  amount: number;
  type: 'debit' | 'credit';
  balance: number | null;
  reference: string | null;
  transaction_type: string | null;
  category: string | null;
  category_confidence: number | null;
  category_suggested_by: 'ai' | 'rule' | 'manual' | null;
  vat_amount: number | null;
  vat_rate: number | null;
  vat_reg_number: string | null;
  matched_transaction_id: string | null;
  match_confidence: number | null;
  match_method: 'auto' | 'manual' | null;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  extraction_confidence: number | null;
  extraction_metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
  id: string;
  organization_id: string;
  client_id: string;
  transaction_id: string;
  date: string;
  account_code: string;
  debit: number | null;
  credit: number | null;
  description: string;
  reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChartOfAccount {
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  category: string;
  subcategory: string | null;
  normal_balance: 'debit' | 'credit';
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LearningRule {
  id: string;
  organization_id: string;
  client_id: string | null;
  merchant: string;
  merchant_normalized: string;
  category: string;
  confidence: number;
  usage_count: number;
  last_used_at: string;
  created_at: string;
  updated_at: string;
}

export interface Export {
  id: string;
  organization_id: string;
  client_id: string;
  created_by: string;
  format: 'iris' | 'xero' | 'quickbooks' | 'sage' | 'csv';
  start_date: string;
  end_date: string;
  status_filter: string | null;
  file_url: string | null;
  transaction_count: number | null;
  created_at: string;
}

/**
 * Worker job types
 */
export interface ExtractionJobData {
  document_id: string;
  organization_id: string;
  file_url: string;
  file_type: 'bank_statement' | 'receipt';
}

export interface CategorizationJobData {
  transaction_id: string;
  organization_id: string;
  merchant: string;
  description: string;
  amount: number;
  date: string;
}

export interface MatchingJobData {
  client_id: string;
  organization_id: string;
  date_range: {
    start: string;
    end: string;
  };
}

export interface JournalEntryJobData {
  transaction_id: string;
  organization_id: string;
  client_id: string;
}

/**
 * Utility types
 */
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
