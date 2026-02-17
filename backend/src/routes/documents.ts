/**
 * Document Routes
 *
 * Handles document upload, listing, and processing
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { errors, APIError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { processDocument } from '../workers/documentProcessor.js';
import { extractSpecificMonths } from '../lib/claude.js';
import { detectStatementDateRange } from '../lib/pdfProcessor.js';
import { extractTextFromPDF, detectDateRangeFromText } from '../lib/pdfTextExtractor.js';

const documents = new Hono();

// All routes require authentication
documents.use('*', requireAuth);

/**
 * GET /api/documents
 * Get all documents for the authenticated user's organization
 */
documents.get('/', async (c) => {
  try {
    const user = c.get('user');
    const clientId = c.req.query('clientId');

    let query = supabaseAdmin
      .from('documents')
      .select(`
        *,
        clients!inner(
          id,
          name,
          organization_id
        )
      `)
      .eq('clients.organization_id', user.organizationId)
      .order('created_at', { ascending: false });

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to fetch documents:', error);
      throw errors.internal('Failed to fetch documents');
    }

    return c.json({ documents: data || [] });
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (error instanceof APIError) throw error;
    logger.error('Error in GET /api/documents:', error);
    throw error;
  }
});

/**
 * GET /api/documents/:id
 * Get a specific document by ID
 */
documents.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    const documentId = c.req.param('id');

    const { data, error } = await supabaseAdmin
      .from('documents')
      .select(`
        *,
        clients!inner(
          id,
          name,
          organization_id
        )
      `)
      .eq('id', documentId)
      .eq('clients.organization_id', user.organizationId)
      .single();

    if (error || !data) {
      logger.error('Document not found:', error);
      throw errors.notFound('Document not found');
    }

    return c.json({ document: data });
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (error instanceof APIError) throw error;
    logger.error('Error in GET /api/documents/:id:', error);
    throw error;
  }
});

/**
 * POST /api/documents/upload-url
 * Generate a pre-signed upload URL for document upload
 */
documents.post('/upload-url', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { fileName, fileType, mimeType, clientId } = body;

    logger.info('📤 Upload URL request:', { fileName, fileType, mimeType, clientId, userId: user.userId });

    // Validate client belongs to organization
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('organization_id', user.organizationId)
      .single();

    if (clientError) {
      logger.error('❌ Client validation error:', clientError);
      throw errors.notFound('Client not found');
    }

    if (!client) {
      logger.error('❌ Client not found:', { clientId, organizationId: user.organizationId });
      throw errors.notFound('Client not found');
    }

    logger.info('✅ Client validated:', client.id);

    // Validate file type
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowedMimeTypes.includes(mimeType)) {
      throw errors.badRequest('Invalid file type');
    }

    // Generate unique file path
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const extension = fileName.split('.').pop();
    const storagePath = `${user.organizationId}/${clientId}/${timestamp}-${randomStr}.${extension}`;

    // Generate signed upload URL (expires in 10 minutes)
    logger.info('🔐 Creating signed upload URL for:', storagePath);
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from('documents')
      .createSignedUploadUrl(storagePath);

    if (uploadError) {
      logger.error('❌ Failed to generate upload URL:', uploadError);
      throw errors.internal('Failed to generate upload URL');
    }

    logger.info('✅ Signed upload URL created');

    // Create document record in database
    logger.info('💾 Creating document record in database');
    const { data: document, error: documentError } = await supabaseAdmin
      .from('documents')
      .insert({
        organization_id: user.organizationId,
        client_id: clientId,
        file_name: fileName,
        file_type: fileType,
        storage_path: storagePath,
        mime_type: mimeType,
        status: 'queued',
        uploaded_by: user.userId,
      })
      .select()
      .single();

    if (documentError) {
      logger.error('❌ Failed to create document record:', documentError);
      throw errors.internal('Failed to create document record');
    }

    logger.info('✅ Document record created:', document.id);

    logger.info(`Document upload URL generated: ${document.id}`);

    return c.json({
      uploadUrl: uploadData.signedUrl,
      uploadToken: uploadData.token,
      document: document,
    });
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (error instanceof APIError) throw error;
    logger.error('Error in POST /api/documents/upload-url:', error);
    throw error;
  }
});

/**
 * POST /api/documents/:id/complete
 * Mark document as uploaded and queue for processing
 */
documents.post('/:id/complete', async (c) => {
  try {
    const user = c.get('user');
    const documentId = c.req.param('id');

    // Verify document belongs to user's organization
    const { data: document, error: fetchError } = await supabaseAdmin
      .from('documents')
      .select(`
        *,
        clients!inner(
          id,
          organization_id
        )
      `)
      .eq('id', documentId)
      .eq('clients.organization_id', user.organizationId)
      .single();

    if (fetchError || !document) {
      throw errors.notFound('Document not found');
    }

    // Keep status as 'queued' - the document processor will change it to 'processing'
    // Update timestamp to confirm upload completion
    const { data: updatedDocument, error: updateError } = await supabaseAdmin
      .from('documents')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)
      .select()
      .single();

    if (updateError) {
      logger.error('Failed to update document status:', updateError);
      throw errors.internal('Failed to update document');
    }

    logger.info(`Document uploaded successfully, triggering processing: ${documentId}`);

    // Trigger processing directly instead of waiting for next poll cycle
    processDocument(documentId).catch(error => {
      logger.error('Direct document processing failed, will be retried by poller', { documentId, error });
    });

    return c.json({
      document: updatedDocument,
      message: 'Document uploaded successfully and processing started',
    });
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (error instanceof APIError) throw error;
    logger.error('Error in POST /api/documents/:id/complete:', error);
    throw error;
  }
});

/**
 * DELETE /api/documents/:id
 * Delete a document and its file from storage
 */
documents.delete('/:id', async (c) => {
  try {
    const user = c.get('user');
    const documentId = c.req.param('id');

    // Verify document belongs to user's organization
    const { data: document, error: fetchError } = await supabaseAdmin
      .from('documents')
      .select(`
        *,
        clients!inner(
          id,
          organization_id
        )
      `)
      .eq('id', documentId)
      .eq('clients.organization_id', user.organizationId)
      .single();

    if (fetchError || !document) {
      throw errors.notFound('Document not found');
    }

    // Delete file from storage
    const { error: storageError } = await supabaseAdmin
      .storage
      .from('documents')
      .remove([document.storage_path]);

    if (storageError) {
      logger.warn('Failed to delete file from storage:', storageError);
      // Continue with database deletion even if storage deletion fails
    }

    // Delete document record
    const { error: deleteError } = await supabaseAdmin
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (deleteError) {
      logger.error('Failed to delete document:', deleteError);
      throw errors.internal('Failed to delete document');
    }

    logger.info(`Document deleted: ${documentId}`);

    return c.json({ message: 'Document deleted successfully' });
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (error instanceof APIError) throw error;
    logger.error('Error in DELETE /api/documents/:id:', error);
    throw error;
  }
});

/**
 * POST /api/documents/:id/extract-missing
 * Extract transactions for missing months from an already-uploaded document
 * Avoids re-uploading and only uses API calls for months not yet extracted
 */
documents.post('/:id/extract-missing', async (c) => {
  try {
    const user = c.get('user');
    const documentId = c.req.param('id');

    // 1. Get document and verify ownership
    const { data: document, error: fetchError } = await supabaseAdmin
      .from('documents')
      .select(`
        *,
        clients!inner(
          id,
          organization_id
        )
      `)
      .eq('id', documentId)
      .eq('clients.organization_id', user.organizationId)
      .single();

    if (fetchError || !document) {
      throw errors.notFound('Document not found');
    }

    if (document.mime_type !== 'application/pdf') {
      throw errors.badRequest('Extract missing months is only supported for PDF bank statements');
    }

    // 2. Get existing transactions for this document, grouped by month
    const { data: existingTxns, error: txnError } = await supabaseAdmin
      .from('transactions')
      .select('date')
      .eq('document_id', documentId);

    if (txnError) {
      throw errors.internal('Failed to fetch existing transactions');
    }

    const existingMonths = new Set<string>();
    (existingTxns || []).forEach((txn: any) => {
      const date = new Date(txn.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      existingMonths.add(key);
    });

    logger.info('Existing months with transactions', {
      documentId,
      existingMonths: Array.from(existingMonths),
      existingCount: existingTxns?.length || 0,
    });

    // 3. Try to use cached text from metadata first (avoids re-download + re-parse)
    const metadata = document.metadata as any;
    let base64Content: string;
    let cachedText: string | undefined;

    if (metadata?.extractedText && !metadata?.isImageBased) {
      logger.info('Using cached extracted text from metadata', { documentId });
      cachedText = metadata.extractedText;
    }

    // Download file from storage (needed for base64 content regardless)
    const { data: fileData, error: downloadError } = await supabaseAdmin
      .storage
      .from('documents')
      .download(document.storage_path);

    if (downloadError || !fileData) {
      throw errors.internal('Failed to download document from storage');
    }

    const arrayBuffer = await fileData.arrayBuffer();
    base64Content = Buffer.from(arrayBuffer).toString('base64');

    // If no cached text, try local extraction
    if (!cachedText) {
      const pdfResult = await extractTextFromPDF(base64Content);
      if (!pdfResult.isImageBased && pdfResult.text.length > 100) {
        cachedText = pdfResult.text;
      }
    }

    // 4. Detect the full statement date range (try regex first, then LLM fallback)
    let dateRange = cachedText ? detectDateRangeFromText(cachedText) : null;

    if (!dateRange) {
      dateRange = await detectStatementDateRange(base64Content);
    }

    if (!dateRange) {
      throw errors.badRequest('Could not detect statement date range from this document');
    }

    logger.info('Statement date range detected', dateRange);

    // 5. Calculate all expected months in the range
    const expectedMonths: { key: string; startDate: string; endDate: string; label: string }[] = [];
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);

    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
      const year = current.getFullYear();
      const month = current.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;

      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0); // Last day of month

      // Clamp to statement range
      const effectiveStart = monthStart < start ? start : monthStart;
      const effectiveEnd = monthEnd > end ? end : monthEnd;

      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

      expectedMonths.push({
        key,
        startDate: effectiveStart.toISOString().split('T')[0],
        endDate: effectiveEnd.toISOString().split('T')[0],
        label: `${monthNames[month]} ${year}`,
      });

      current.setMonth(current.getMonth() + 1);
    }

    // 6. Find missing months
    const missingMonths = expectedMonths.filter(m => !existingMonths.has(m.key));

    if (missingMonths.length === 0) {
      return c.json({
        message: 'All months already have transactions extracted',
        existingMonths: Array.from(existingMonths).sort(),
        expectedMonths: expectedMonths.map(m => m.key),
        missingMonths: [],
        newTransactions: 0,
      });
    }

    logger.info('Missing months identified', {
      documentId,
      expected: expectedMonths.map(m => m.key),
      existing: Array.from(existingMonths),
      missing: missingMonths.map(m => m.label),
      pipeline: cachedText ? 'text-haiku' : 'pdf-sonnet',
    });

    // 7. Update document status to processing
    await supabaseAdmin
      .from('documents')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', documentId);

    // 8. Extract missing months (this runs async - respond immediately)
    extractAndInsertMissing(documentId, document, base64Content, missingMonths, cachedText).catch(err => {
      logger.error('Extract missing months failed', { documentId, error: err });
    });

    return c.json({
      message: `Extracting ${missingMonths.length} missing month(s): ${missingMonths.map(m => m.label).join(', ')}`,
      existingMonths: Array.from(existingMonths).sort(),
      expectedMonths: expectedMonths.map(m => m.key),
      missingMonths: missingMonths.map(m => m.key),
      status: 'processing',
    });
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (error instanceof APIError) throw error;
    logger.error('Error in POST /api/documents/:id/extract-missing:', error);
    throw error;
  }
});

/**
 * Background worker: extract and insert missing month transactions
 */
async function extractAndInsertMissing(
  documentId: string,
  document: any,
  base64Content: string,
  missingMonths: { startDate: string; endDate: string; label: string }[],
  extractedText?: string
) {
  try {
    const result = await extractSpecificMonths(base64Content, missingMonths, extractedText);

    if (!result.success || result.transactions.length === 0) {
      logger.warn('No transactions extracted for missing months', { documentId });
      await supabaseAdmin
        .from('documents')
        .update({ status: 'complete', updated_at: new Date().toISOString() })
        .eq('id', documentId);
      return;
    }

    // Deduplicate against existing transactions in the database
    const { data: existingTxns } = await supabaseAdmin
      .from('transactions')
      .select('date, merchant, amount, type')
      .eq('document_id', documentId);

    let newTransactions = result.transactions;
    if (existingTxns && existingTxns.length > 0) {
      const existingKeys = new Set(
        existingTxns.map(t => {
          const normMerchant = t.merchant.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
          return `${t.date}|${parseFloat(t.amount).toFixed(2)}|${t.type}|${normMerchant}`;
        })
      );

      const beforeCount = newTransactions.length;
      newTransactions = newTransactions.filter(txn => {
        const normMerchant = txn.merchant.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
        const key = `${txn.date}|${txn.amount.toFixed(2)}|${txn.type}|${normMerchant}`;
        return !existingKeys.has(key);
      });

      if (beforeCount !== newTransactions.length) {
        logger.info(`DB deduplication removed ${beforeCount - newTransactions.length} transactions already in database`);
      }
    }

    if (newTransactions.length === 0) {
      logger.info('No new transactions to insert after deduplication', { documentId });
      await supabaseAdmin
        .from('documents')
        .update({ status: 'complete', updated_at: new Date().toISOString() })
        .eq('id', documentId);
      return;
    }

    // Insert new transactions
    const transactionsToInsert = newTransactions.map(txn => ({
      organization_id: document.organization_id,
      client_id: document.client_id,
      document_id: documentId,
      date: txn.date,
      merchant: txn.merchant,
      description: txn.description,
      amount: txn.amount.toString(),
      type: txn.type,
      category: txn.category,
      category_confidence: txn.categoryConfidence,
      vat_amount: txn.vatAmount?.toString() || null,
      vat_rate: txn.vatRate,
      balance: txn.balance?.toString() || null,
      status: txn.extractionConfidence >= 0.8 ? 'pending' : 'flagged',
      extraction_confidence: txn.extractionConfidence,
    }));

    const { error: insertError } = await supabaseAdmin
      .from('transactions')
      .insert(transactionsToInsert);

    if (insertError) {
      logger.error('Failed to insert missing month transactions', { documentId, error: insertError });
      await supabaseAdmin
        .from('documents')
        .update({ status: 'error', error_message: `Insert failed: ${insertError.message}` })
        .eq('id', documentId);
      return;
    }

    // Update document status back to complete
    await supabaseAdmin
      .from('documents')
      .update({ status: 'complete', processed_at: new Date().toISOString() })
      .eq('id', documentId);

    logger.info('Missing months extraction complete', {
      documentId,
      monthsExtracted: missingMonths.map(m => m.label),
      newTransactions: transactionsToInsert.length,
    });
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (error instanceof APIError) throw error;
    logger.error('extractAndInsertMissing failed', { documentId, error });
    await supabaseAdmin
      .from('documents')
      .update({
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Extract missing failed',
      })
      .eq('id', documentId);
  }
}

/**
 * POST /api/documents/:id/re-extract
 * Delete all existing transactions for this document and re-extract with improved accuracy
 * Use this when the initial extraction had missing or incorrect transactions
 */
documents.post('/:id/re-extract', async (c) => {
  try {
    const user = c.get('user');
    const documentId = c.req.param('id');

    // 1. Get document and verify ownership
    const { data: document, error: fetchError } = await supabaseAdmin
      .from('documents')
      .select(`
        *,
        clients!inner(
          id,
          organization_id
        )
      `)
      .eq('id', documentId)
      .eq('clients.organization_id', user.organizationId)
      .single();

    if (fetchError || !document) {
      throw errors.notFound('Document not found');
    }

    if (document.mime_type !== 'application/pdf') {
      throw errors.badRequest('Re-extraction is only supported for PDF bank statements');
    }

    // 2. Count existing transactions that will be deleted
    const { count: existingCount } = await supabaseAdmin
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', documentId);

    logger.info('Re-extract requested', {
      documentId,
      existingTransactions: existingCount,
    });

    // 3. Delete all existing transactions for this document
    const { error: deleteError } = await supabaseAdmin
      .from('transactions')
      .delete()
      .eq('document_id', documentId);

    if (deleteError) {
      logger.error('Failed to delete existing transactions', { documentId, error: deleteError });
      throw errors.internal('Failed to delete existing transactions');
    }

    logger.info(`Deleted ${existingCount} existing transactions for re-extraction`, { documentId });

    // 4. Try cached text from metadata, then download file
    const reExtractMetadata = document.metadata as any;
    let cachedTextForReExtract: string | undefined;

    if (reExtractMetadata?.extractedText && !reExtractMetadata?.isImageBased) {
      logger.info('Using cached extracted text for re-extraction', { documentId });
      cachedTextForReExtract = reExtractMetadata.extractedText;
    }

    const { data: fileData, error: downloadError } = await supabaseAdmin
      .storage
      .from('documents')
      .download(document.storage_path);

    if (downloadError || !fileData) {
      throw errors.internal('Failed to download document from storage');
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const base64Content = Buffer.from(arrayBuffer).toString('base64');

    // If no cached text, try local extraction
    if (!cachedTextForReExtract) {
      const pdfResult = await extractTextFromPDF(base64Content);
      if (!pdfResult.isImageBased && pdfResult.text.length > 100) {
        cachedTextForReExtract = pdfResult.text;
      }
    }

    // 5. Update document status to processing
    await supabaseAdmin
      .from('documents')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', documentId);

    // 6. Detect date range (try regex first, then LLM fallback)
    let dateRange = cachedTextForReExtract ? detectDateRangeFromText(cachedTextForReExtract) : null;

    if (!dateRange) {
      dateRange = await detectStatementDateRange(base64Content);
    }

    if (!dateRange) {
      throw errors.badRequest('Could not detect statement date range');
    }

    const allMonths: { startDate: string; endDate: string; label: string }[] = [];
    const periodStart = new Date(dateRange.startDate);
    const periodEnd = new Date(dateRange.endDate);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    let current = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);
    while (current <= periodEnd) {
      const year = current.getFullYear();
      const month = current.getMonth();
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);

      const effectiveStart = monthStart < periodStart ? periodStart : monthStart;
      const effectiveEnd = monthEnd > periodEnd ? periodEnd : monthEnd;

      allMonths.push({
        startDate: effectiveStart.toISOString().split('T')[0],
        endDate: effectiveEnd.toISOString().split('T')[0],
        label: `${monthNames[month]} ${year}`,
      });

      current.setMonth(current.getMonth() + 1);
    }

    // 7. Run full re-extraction in background (with cached text if available)
    reExtractAllMonths(documentId, document, base64Content, allMonths, cachedTextForReExtract).catch(err => {
      logger.error('Re-extraction failed', { documentId, error: err });
    });

    return c.json({
      message: `Re-extracting all ${allMonths.length} months with improved accuracy. Deleted ${existingCount} old transactions.`,
      months: allMonths.map(m => m.label),
      deletedTransactions: existingCount,
      status: 'processing',
    });
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (error instanceof APIError) throw error;
    logger.error('Error in POST /api/documents/:id/re-extract:', error);
    throw error;
  }
});

/**
 * Background worker: re-extract all months with improved accuracy
 */
async function reExtractAllMonths(
  documentId: string,
  document: any,
  base64Content: string,
  months: { startDate: string; endDate: string; label: string }[],
  extractedText?: string
) {
  try {
    const result = await extractSpecificMonths(base64Content, months, extractedText);

    if (!result.success || result.transactions.length === 0) {
      logger.warn('No transactions extracted during re-extraction', { documentId });
      await supabaseAdmin
        .from('documents')
        .update({ status: 'error', error_message: 'Re-extraction produced no transactions' })
        .eq('id', documentId);
      return;
    }

    // Insert new transactions
    const transactionsToInsert = result.transactions.map(txn => ({
      organization_id: document.organization_id,
      client_id: document.client_id,
      document_id: documentId,
      date: txn.date,
      merchant: txn.merchant,
      description: txn.description,
      amount: txn.amount.toString(),
      type: txn.type,
      category: txn.category,
      category_confidence: txn.categoryConfidence,
      vat_amount: txn.vatAmount?.toString() || null,
      vat_rate: txn.vatRate,
      balance: txn.balance?.toString() || null,
      status: txn.extractionConfidence >= 0.8 ? 'pending' : 'flagged',
      extraction_confidence: txn.extractionConfidence,
    }));

    const { error: insertError } = await supabaseAdmin
      .from('transactions')
      .insert(transactionsToInsert);

    if (insertError) {
      logger.error('Failed to insert re-extracted transactions', { documentId, error: insertError });
      await supabaseAdmin
        .from('documents')
        .update({ status: 'error', error_message: `Insert failed: ${insertError.message}` })
        .eq('id', documentId);
      return;
    }

    // Log verification metadata if available
    const meta = result.metadata as any;
    if (meta?.verification) {
      logger.info('Re-extraction verification', {
        documentId,
        pdfDeposits: meta.verification.pdfDeposits,
        pdfOutgoings: meta.verification.pdfOutgoings,
        extractedDeposits: meta.verification.extractedDeposits,
        extractedOutgoings: meta.verification.extractedOutgoings,
        isAccurate: meta.verification.isAccurate,
      });
    }
    if (meta?.duplicatesRemoved) {
      logger.info(`Re-extraction deduplication removed ${meta.duplicatesRemoved} duplicates`, { documentId });
    }

    await supabaseAdmin
      .from('documents')
      .update({ status: 'complete', processed_at: new Date().toISOString() })
      .eq('id', documentId);

    logger.info('Re-extraction complete', {
      documentId,
      monthsExtracted: months.map(m => m.label),
      newTransactions: transactionsToInsert.length,
    });
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (error instanceof APIError) throw error;
    logger.error('reExtractAllMonths failed', { documentId, error });
    await supabaseAdmin
      .from('documents')
      .update({
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Re-extraction failed',
      })
      .eq('id', documentId);
  }
}

/**
 * GET /api/documents/stats
 * Get document statistics for the organization
 */
documents.get('/stats/overview', async (c) => {
  try {
    const user = c.get('user');

    // Get document counts by status
    const { data: docs, error } = await supabaseAdmin
      .from('documents')
      .select(`
        status,
        clients!inner(organization_id)
      `)
      .eq('clients.organization_id', user.organizationId);

    if (error) {
      logger.error('Failed to fetch document stats:', error);
      throw errors.internal('Failed to fetch statistics');
    }

    const stats = {
      total: docs?.length || 0,
      queued: docs?.filter((d: any) => d.status === 'queued').length || 0,
      processing: docs?.filter((d: any) => d.status === 'processing').length || 0,
      complete: docs?.filter((d: any) => d.status === 'complete').length || 0,
      error: docs?.filter((d: any) => d.status === 'error').length || 0,
    };

    return c.json({ stats });
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (error instanceof APIError) throw error;
    logger.error('Error in GET /api/documents/stats/overview:', error);
    throw error;
  }
});

export default documents;
 
