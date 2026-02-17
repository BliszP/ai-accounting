/**
 * Document Processing Worker
 *
 * Processes uploaded documents and extracts transactions using Claude AI.
 * Uses local PDF text extraction + Haiku for text-based PDFs (99% cheaper).
 * Falls back to Sonnet PDF pipeline for scanned/image-based PDFs.
 */

import { createHash } from 'crypto';
import { supabaseAdmin } from '../lib/supabase.js';
import { extractTransactions } from '../lib/claude.js';
import { logger } from '../lib/logger.js';
import { requiresPreParsing, parseFileToText } from '../lib/fileParser.js';
import { extractTextFromPDF } from '../lib/pdfTextExtractor.js';

// Track documents currently being processed to prevent duplicate processing
const processingDocuments = new Set<string>();

/**
 * Process a single document
 */
export async function processDocument(documentId: string): Promise<void> {
  // Prevent duplicate processing - if already in progress, skip
  if (processingDocuments.has(documentId)) {
    logger.info('Document already being processed, skipping', { documentId });
    return;
  }

  processingDocuments.add(documentId);
  const supabase = supabaseAdmin;

  try {
    logger.info('Starting document processing', { documentId });

    // Get document from database
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Update status to processing
    await supabase
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', documentId);

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('documents')
      .download(document.storage_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    // Convert file to buffer/base64
    const arrayBuffer = await fileData.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const base64Content = fileBuffer.toString('base64');

    logger.info('File downloaded and converted', {
      documentId,
      fileSize: arrayBuffer.byteLength,
      mimeType: document.mime_type,
    });

    // --- FILE HASH DEDUPLICATION ---
    const fileHash = createHash('sha256').update(fileBuffer).digest('hex');
    logger.info('File hash computed', { documentId, fileHash: fileHash.substring(0, 16) + '...' });

    // Store the hash
    await supabase
      .from('documents')
      .update({ file_hash: fileHash })
      .eq('id', documentId);

    // Check if another document with same hash has already been processed
    const { data: existingDoc } = await supabase
      .from('documents')
      .select('id')
      .eq('file_hash', fileHash)
      .eq('status', 'complete')
      .neq('id', documentId)
      .limit(1)
      .single();

    if (existingDoc) {
      logger.info('Duplicate file detected, copying transactions from existing document', {
        documentId,
        sourceDocumentId: existingDoc.id,
      });

      // Copy transactions from the existing document
      const { data: existingTxns, error: txnFetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('document_id', existingDoc.id);

      if (!txnFetchError && existingTxns && existingTxns.length > 0) {
        const copiedTxns = existingTxns.map((txn: any) => ({
          organization_id: document.organization_id,
          client_id: document.client_id,
          document_id: documentId,
          date: txn.date,
          merchant: txn.merchant,
          description: txn.description,
          amount: txn.amount,
          type: txn.type,
          category: txn.category,
          category_confidence: txn.category_confidence,
          vat_amount: txn.vat_amount,
          vat_rate: txn.vat_rate,
          balance: txn.balance,
          status: txn.status,
          extraction_confidence: txn.extraction_confidence,
        }));

        const { error: insertError } = await supabase
          .from('transactions')
          .insert(copiedTxns);

        if (!insertError) {
          await supabase
            .from('documents')
            .update({
              status: 'complete',
              processed_at: new Date().toISOString(),
              metadata: { copiedFrom: existingDoc.id, fileHash },
            })
            .eq('id', documentId);

          logger.info('Duplicate processing complete - copied transactions', {
            documentId,
            copiedCount: copiedTxns.length,
            sourceDocumentId: existingDoc.id,
          });
          return; // Done! Zero API calls.
        }
      }
      // If copy failed, fall through to normal processing
      logger.warn('Failed to copy transactions from duplicate, falling through to normal processing');
    }

    // --- LOCAL PDF TEXT EXTRACTION ---
    let extractedText: string | null = null;
    let isImageBased = false;
    let pageCount = 0;

    if (document.mime_type === 'application/pdf') {
      const pdfResult = await extractTextFromPDF(base64Content);
      extractedText = pdfResult.text;
      isImageBased = pdfResult.isImageBased;
      pageCount = pdfResult.pageCount;

      // Cache extracted text in metadata for re-extract/extract-missing
      await supabase
        .from('documents')
        .update({
          metadata: {
            extractedText: extractedText.substring(0, 100000), // Cap at 100KB
            pageCount,
            isImageBased,
            fileHash,
            extractedAt: new Date().toISOString(),
          },
        })
        .eq('id', documentId);

      logger.info('PDF text extraction cached', {
        documentId,
        textLength: extractedText.length,
        isImageBased,
        pageCount,
      });
    }

    // --- PREPARE CONTENT FOR EXTRACTION ---
    let contentForExtraction = base64Content;
    let mimeTypeForExtraction = document.mime_type;

    // CSV/Excel: pre-parse to structured text
    if (requiresPreParsing(document.mime_type)) {
      logger.info('Pre-parsing file to structured text', {
        documentId,
        mimeType: document.mime_type,
      });

      const parsedText = await parseFileToText(base64Content, document.mime_type);
      contentForExtraction = parsedText;
      mimeTypeForExtraction = 'text/plain';

      logger.info('File pre-parsed successfully', {
        documentId,
        originalMimeType: document.mime_type,
        parsedTextLength: parsedText.length,
      });
    }

    // --- EXTRACT TRANSACTIONS ---
    // For text-based PDFs: pass extracted text so claude.ts can use optimized Haiku pipeline
    // For image-based PDFs: pass base64 PDF (falls back to Sonnet pipeline)
    const extractionResult = await extractTransactions(
      contentForExtraction,
      mimeTypeForExtraction,
      document.file_type,
      arrayBuffer.byteLength,
      // Pass extracted text for text-based PDFs so Haiku pipeline can use it
      (!isImageBased && extractedText && extractedText.length > 100) ? extractedText : undefined
    );

    if (!extractionResult.success) {
      throw new Error(extractionResult.error || 'Extraction failed');
    }

    logger.info('Extraction successful', {
      documentId,
      transactionCount: extractionResult.transactions.length,
    });

    // Save transactions to database
    const transactionsToInsert = extractionResult.transactions.map(txn => ({
      organization_id: document.organization_id,
      client_id: document.client_id,
      document_id: document.id,
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

    if (transactionsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('transactions')
        .insert(transactionsToInsert);

      if (insertError) {
        throw new Error(`Failed to insert transactions: ${insertError.message}`);
      }
    }

    // Update document status to complete
    await supabase
      .from('documents')
      .update({
        status: 'complete',
        processed_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    logger.info('Document processing complete', {
      documentId,
      transactionCount: transactionsToInsert.length,
    });
  } catch (error) {
    logger.error('Document processing failed', { documentId, error });

    // Update document status to error
    await supabase
      .from('documents')
      .update({
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', documentId);

    throw error;
  } finally {
    // Always remove from processing set so it can be retried later if needed
    processingDocuments.delete(documentId);
  }
}

/**
 * Process all queued documents
 */
export async function processQueuedDocuments(): Promise<void> {
  const supabase = supabaseAdmin;

  try {
    logger.info('Checking for queued documents');

    // Only pick up 'queued' documents - NOT 'processing' ones
    // Processing documents are already being handled and should not be picked up again
    const { data: documents, error } = await supabase
      .from('documents')
      .select('id')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(5);

    if (error) {
      throw new Error(`Failed to fetch queued documents: ${error.message}`);
    }

    if (!documents || documents.length === 0) {
      logger.info('No queued documents found');
      return;
    }

    logger.info(`Found ${documents.length} queued documents`);

    // Process each document
    for (const doc of documents) {
      try {
        await processDocument(doc.id);
      } catch (error) {
        logger.error('Failed to process document', { documentId: doc.id, error });
        // Continue processing other documents
      }
    }

    logger.info('Finished processing queued documents');
  } catch (error) {
    logger.error('Failed to process queued documents', { error });
    throw error;
  }
}

/**
 * Start polling for queued documents
 */
export function startDocumentProcessor(intervalMs: number = 60000): NodeJS.Timeout {
  logger.info('Starting document processor', { intervalMs });

  // Process immediately on start
  processQueuedDocuments().catch(error => {
    logger.error('Initial document processing failed', { error });
  });

  // Then poll at intervals
  return setInterval(() => {
    processQueuedDocuments().catch(error => {
      logger.error('Scheduled document processing failed', { error });
    });
  }, intervalMs);
}
