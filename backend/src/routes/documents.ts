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
    logger.error('Error in DELETE /api/documents/:id:', error);
    throw error;
  }
});

/**
 * POST /api/documents/:id/re-extract
 * Re-process an existing document (deletes old transactions, runs extraction again).
 */
documents.post('/:id/re-extract', async (c) => {
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

    // Reset status to queued so the processor picks it up fresh
    const { error: updateError } = await supabaseAdmin
      .from('documents')
      .update({
        status: 'queued',
        error_message: null,
        processed_at: null,
      })
      .eq('id', documentId);

    if (updateError) {
      logger.error('Failed to reset document status for re-extract:', updateError);
      throw errors.internal('Failed to queue document for re-extraction');
    }

    logger.info(`Document queued for re-extraction: ${documentId}`);

    // Trigger processing (documentProcessor will delete old transactions before inserting new ones)
    processDocument(documentId).catch(error => {
      logger.error('Re-extraction failed', { documentId, error });
    });

    return c.json({ message: 'Re-extraction started. Old transactions will be replaced.' });
  } catch (error) {
    if (error instanceof APIError) throw error;
    logger.error('Error in POST /api/documents/:id/re-extract:', error);
    throw error;
  }
});

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
    logger.error('Error in GET /api/documents/stats/overview:', error);
    throw error;
  }
});

export default documents;
 
