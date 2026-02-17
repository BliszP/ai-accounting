/**
 * Validation Schemas
 *
 * All API input validation using Zod for type-safe validation
 */

import { z } from 'zod';

/**
 * Organization schema
 */
export const organizationSchema = z.object({
  name: z.string()
    .min(1, 'Organization name is required')
    .max(200, 'Organization name too long'),
  plan: z.enum(['starter', 'growth', 'professional', 'enterprise']).default('growth'),
});

/**
 * User schema
 */
export const userSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email too long'),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  role: z.enum(['admin', 'accountant', 'viewer']).default('accountant'),
});

/**
 * Signup schema
 */
export const signupSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email too long'),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  organizationId: z.string().uuid().optional(),
  organizationName: z.string().min(1).max(200).optional(),
  role: z.enum(['admin', 'accountant', 'viewer']).default('admin'),
});

/**
 * Login schema
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Client schema - simplified to match database
 */
export const clientSchema = z.object({
  name: z.string()
    .min(1, 'Client name is required')
    .max(200, 'Client name too long'),
  contactEmail: z.string()
    .email('Invalid email address')
    .max(255, 'Email too long')
    .optional()
    .or(z.literal('')),
  companyNumber: z.string()
    .max(50)
    .optional()
    .or(z.literal('')),
  vatNumber: z.string()
    .max(50)
    .optional()
    .or(z.literal('')),
  financialYearStart: z.string()
    .optional()
    .or(z.literal('')),
});

/**
 * Client update schema (all fields optional)
 */
export const clientUpdateSchema = z.object({
  name: z.string()
    .min(1, 'Client name is required')
    .max(200, 'Client name too long')
    .optional(),
  contactEmail: z.string()
    .email('Invalid email address')
    .max(255, 'Email too long')
    .optional()
    .or(z.literal(''))
    .or(z.literal(null)),
  companyNumber: z.string()
    .max(50)
    .optional()
    .or(z.literal(''))
    .or(z.literal(null)),
  vatNumber: z.string()
    .max(50)
    .optional()
    .or(z.literal(''))
    .or(z.literal(null)),
  financialYearStart: z.string()
    .optional()
    .or(z.literal(''))
    .or(z.literal(null)),
});

/**
 * Document schema
 */
export const documentSchema = z.object({
  clientId: z.string().uuid('Invalid client ID'),
  fileName: z.string()
    .min(1, 'File name is required')
    .max(255, 'File name too long'),
  fileSize: z.number()
    .int('File size must be an integer')
    .max(10 * 1024 * 1024, 'File size too large (max 10MB)'),
  fileType: z.enum([
    'bank_statement',
    'receipt',
    'invoice_sales',
    'invoice_purchase'
  ]),
  mimeType: z.enum([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]),
});

/**
 * Transaction schema
 */
export const transactionSchema = z.object({
  documentId: z.string().uuid('Invalid document ID'),
  clientId: z.string().uuid('Invalid client ID'),
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (must be YYYY-MM-DD)'),
  merchant: z.string()
    .min(1, 'Merchant name is required')
    .max(200, 'Merchant name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  amount: z.number()
    .positive('Amount must be positive')
    .max(999999999.99, 'Amount too large'),
  type: z.enum(['debit', 'credit']),
  currency: z.enum(['GBP']).default('GBP'),
  category: z.string().max(100).optional(),
  vatAmount: z.number()
    .min(0, 'VAT amount cannot be negative')
    .max(999999999.99, 'VAT amount too large')
    .optional(),
  vatRate: z.number()
    .min(0, 'VAT rate cannot be negative')
    .max(1, 'VAT rate cannot exceed 100%')
    .optional(),
});

/**
 * Transaction update schema (for review and editing)
 */
export const transactionUpdateSchema = z.object({
  status: z.enum(['approved', 'rejected', 'flagged']).optional(),
  merchant: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  amount: z.number().positive().optional(),
  category: z.string().max(100).optional().nullable(),
  matchedTransactionId: z.string().uuid().optional().nullable(),
  reviewNotes: z.string().max(1000).optional(),
  vatAmount: z.number().min(0).optional().nullable(),
  vatRate: z.number().min(0).max(1).optional().nullable(),
});

/**
 * Bulk approve transactions schema
 */
export const bulkApproveSchema = z.object({
  transactionIds: z.array(z.string().uuid())
    .min(1, 'At least one transaction ID is required')
    .max(2000, 'Cannot approve more than 2000 transactions at once'),
  category: z.string().max(100).optional(),
});

/**
 * Export schema
 */
export const exportSchema = z.object({
  clientId: z.string().uuid('Invalid client ID'),
  startDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid start date format (must be YYYY-MM-DD)'),
  endDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid end date format (must be YYYY-MM-DD)'),
  format: z.enum(['iris', 'xero', 'quickbooks', 'sage', 'csv']),
  status: z.enum(['approved', 'all']).default('approved'),
});

/**
 * Journal entry schema
 */
export const journalEntrySchema = z.object({
  transactionId: z.string().uuid('Invalid transaction ID'),
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (must be YYYY-MM-DD)'),
  accountCode: z.string()
    .regex(/^\d{4}$/, 'Account code must be 4 digits'),
  debit: z.number()
    .min(0, 'Debit amount cannot be negative')
    .max(999999999.99, 'Debit amount too large')
    .optional()
    .nullable(),
  credit: z.number()
    .min(0, 'Credit amount cannot be negative')
    .max(999999999.99, 'Credit amount too large')
    .optional()
    .nullable(),
  description: z.string()
    .max(500, 'Description too long'),
  reference: z.string()
    .max(50, 'Reference too long')
    .optional(),
});

/**
 * Query parameters schemas
 */
export const paginationSchema = z.object({
  limit: z.coerce.number()
    .int()
    .min(1)
    .max(100)
    .default(50),
  offset: z.coerce.number()
    .int()
    .min(0)
    .default(0),
});

export const dateRangeSchema = z.object({
  startDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid start date format')
    .optional(),
  endDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid end date format')
    .optional(),
});

/**
 * Helper function to validate data against schema
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Helper function to validate and return result with error handling
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Type exports for use in other files
 */
export type Organization = z.infer<typeof organizationSchema>;
export type User = z.infer<typeof userSchema>;
export type Signup = z.infer<typeof signupSchema>;
export type Login = z.infer<typeof loginSchema>;
export type Client = z.infer<typeof clientSchema>;
export type ClientUpdate = z.infer<typeof clientUpdateSchema>;
export type Document = z.infer<typeof documentSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type TransactionUpdate = z.infer<typeof transactionUpdateSchema>;
export type BulkApprove = z.infer<typeof bulkApproveSchema>;
export type Export = z.infer<typeof exportSchema>;
export type JournalEntry = z.infer<typeof journalEntrySchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;
