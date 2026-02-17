/**
 * TypeScript Type Definitions (Frontend)
 *
 * Shared types for the React application
 */

/**
 * User types
 */
export interface User {
  id: string;
  email: string;
  role: 'admin' | 'accountant' | 'viewer';
  firstName: string | null;
  lastName: string | null;
  organization: {
    id: string;
    name: string;
    plan: string;
  };
}

/**
 * Auth types
 */
export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  organizationName: string;
}

/**
 * Client types - simplified to match database schema
 */
export interface Client {
  id: string;
  organization_id: string;
  name: string;
  contact_email?: string | null;
  vat_number?: string | null;
  company_number?: string | null;
  financial_year_start?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ClientFormData {
  name: string;
  contactEmail?: string;
  vatNumber?: string;
  companyNumber?: string;
  financialYearStart?: string;
}

export interface ClientStats {
  documentCount: number;
  transactionCount: number;
  totalRevenue: string;
  totalExpenses: string;
  netProfit: string;
}

/**
 * Document types
 */
export interface Document {
  id: string;
  clientId: string;
  clientName: string;
  fileName: string;
  fileType: 'bank_statement' | 'receipt' | 'invoice_sales' | 'invoice_purchase';
  status: 'queued' | 'processing' | 'complete' | 'error';
  errorMessage?: string;
  uploadedAt: string;
  processedAt?: string;
}

/**
 * Transaction types
 */
export interface Transaction {
  id: string;
  documentId: string;
  clientId: string;
  clientName: string;
  date: string;
  merchant: string;
  amount: number;
  type: 'debit' | 'credit';
  category?: string;
  categoryConfidence?: number;
  vatAmount?: number;
  vatRate?: number;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  extractionConfidence?: number;
  matchedTransaction?: MatchedTransaction;
  matchConfidence?: number;
}

export interface MatchedTransaction {
  id: string;
  date: string;
  merchant: string;
  amount: number;
}

/**
 * Export types
 */
export interface ExportRequest {
  clientId: string;
  startDate: string;
  endDate: string;
  format: 'iris' | 'xero' | 'quickbooks' | 'sage' | 'csv';
  status: 'approved' | 'all';
}

export interface ExportRecord {
  id: string;
  clientName: string;
  format: string;
  startDate: string;
  endDate: string;
  transactionCount: number;
  downloadUrl: string;
  createdAt: string;
}

/**
 * Dashboard types
 */
export interface DashboardStats {
  uploaded: number;
  processed: number;
  pending: number;
  errors: number;
  recentUploads: RecentUpload[];
}

export interface RecentUpload {
  filename: string;
  client: string;
  status: string;
  uploadedAt: string;
}

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
 * Form types
 */
export interface FormError {
  field: string;
  message: string;
}

/**
 * Upload progress
 */
export interface UploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}
