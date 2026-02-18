/**
 * Documents Page
 *
 * Upload and manage documents with drag-and-drop
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../lib/api';
import Navigation from '../components/layout/Navigation';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Upload,
  File,
  FileText,
  Receipt,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  RefreshCw,
} from 'lucide-react';

interface Client {
  id: string;
  name: string;
}

interface Document {
  id: string;
  file_name: string;
  file_type: string;
  status: 'queued' | 'processing' | 'complete' | 'error';
  error_message?: string;
  created_at: string;
  clients: {
    name: string;
  };
}

interface UploadingFile {
  id: string;
  file: File;
  clientId: string;
  fileType: string;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
  error?: string;
}

export default function Documents() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedFileType, setSelectedFileType] = useState<string>('bank_statement');
  const [loading, setLoading] = useState(true);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [filterClient, setFilterClient] = useState<string>('all'); // Filter for viewing documents

  useEffect(() => {
    fetchClients();
    fetchDocuments();
  }, []);

  // Poll for document status updates
  useEffect(() => {
    // Check if there are any documents being processed
    const hasProcessingDocs = documents.some(
      doc => doc.status === 'queued' || doc.status === 'processing'
    );

    if (!hasProcessingDocs) {
      return; // No polling needed
    }

    // Poll every 3 seconds
    const pollInterval = setInterval(() => {
      fetchDocuments();
    }, 3000);

    // Cleanup
    return () => clearInterval(pollInterval);
  }, [documents]);

  async function fetchClients() {
    try {
      const response = await apiClient.get('/api/clients');
      setClients(response.data.clients);
      if (response.data.clients.length > 0) {
        setSelectedClient(response.data.clients[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  }

  async function fetchDocuments() {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/documents');
      setDocuments(response.data.documents);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => handleFileUpload(file));
  }, [selectedClient, selectedFileType]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => handleFileUpload(file));
    // Reset input
    e.target.value = '';
  }, [selectedClient, selectedFileType]);

  async function handleFileUpload(file: File) {
    if (!selectedClient) {
      alert('Please select a client first');
      return;
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'text/csv'];
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Please upload PDF, JPG, PNG, or CSV files.');
      return;
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      alert(`File size (${fileSizeMB}MB) exceeds 50MB limit. Please split large bank statements into smaller periods.`);
      return;
    }

    const uploadId = Math.random().toString(36).substring(7);

    // Add to uploading files
    setUploadingFiles(prev => [...prev, {
      id: uploadId,
      file,
      clientId: selectedClient,
      fileType: selectedFileType,
      progress: 0,
      status: 'uploading',
    }]);

    try {
      // Step 1: Get upload URL
      const urlResponse = await apiClient.post('/api/documents/upload-url', {
        fileName: file.name,
        fileType: selectedFileType,
        mimeType: file.type,
        clientId: selectedClient,
      });

      const { uploadUrl, uploadToken, document } = urlResponse.data;

      // Step 2: Upload file to Supabase Storage
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
          'x-upsert': 'true',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      // Update progress
      setUploadingFiles(prev => prev.map(f =>
        f.id === uploadId ? { ...f, progress: 100 } : f
      ));

      // Step 3: Mark upload as complete
      await apiClient.post(`/api/documents/${document.id}/complete`);

      // Update status
      setUploadingFiles(prev => prev.map(f =>
        f.id === uploadId ? { ...f, status: 'complete' } : f
      ));

      // Refresh documents list
      fetchDocuments();

      // Remove from uploading after 2 seconds
      setTimeout(() => {
        setUploadingFiles(prev => prev.filter(f => f.id !== uploadId));
      }, 2000);
    } catch (error: any) {
      console.error('Upload failed:', error);
      setUploadingFiles(prev => prev.map(f =>
        f.id === uploadId ? {
          ...f,
          status: 'error',
          error: error.response?.data?.message || 'Upload failed',
        } : f
      ));
    }
  }

  async function handleDelete(documentId: string) {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await apiClient.delete(`/api/documents/${documentId}`);
      setDocuments(documents.filter(d => d.id !== documentId));
    } catch (error: any) {
      alert(error.response?.data?.error || error.response?.data?.message || 'Failed to delete document');
    }
  }

  async function handleReExtract(documentId: string) {
    try {
      await apiClient.post(`/api/documents/${documentId}/re-extract`);
      // Reset status in UI to show it's re-queued
      setDocuments(documents.map(d =>
        d.id === documentId ? { ...d, status: 'queued' } : d
      ));
    } catch (error: any) {
      alert(error.response?.data?.error || error.response?.data?.message || 'Failed to start re-extraction');
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />;
    }
  };

  const getFileTypeIcon = (fileType: string) => {
    switch (fileType) {
      case 'receipt':
        return <Receipt className="h-5 w-5 text-purple-500" />;
      case 'invoice_sales':
      case 'invoice_purchase':
        return <FileText className="h-5 w-5 text-blue-500" />;
      default:
        return <File className="h-5 w-5 text-gray-500" />;
    }
  };

  // Filter documents by selected client
  const filteredDocuments = filterClient === 'all'
    ? documents
    : documents.filter(doc => doc.clients.name === filterClient);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">Loading...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Documents
        </h1>

        {/* Upload Section */}
        <Card className="mb-8 border border-slate-200 shadow-md bg-white">
          <CardHeader>
            <CardTitle>Upload Documents</CardTitle>
            <CardDescription>
              Upload bank statements, receipts, and invoices for processing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Client</label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Document Type</label>
                <Select value={selectedFileType} onValueChange={setSelectedFileType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_statement">Bank Statement</SelectItem>
                    <SelectItem value="receipt">Receipt</SelectItem>
                    <SelectItem value="invoice_sales">Sales Invoice</SelectItem>
                    <SelectItem value="invoice_purchase">Purchase Invoice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Drag and Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                isDragging
                  ? 'border-slate-500 bg-slate-50 scale-105'
                  : 'border-gray-300 bg-gray-50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium mb-2">
                Drag and drop files here, or click to browse
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Supported formats: PDF, JPG, PNG, CSV (max 50MB)
              </p>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.csv"
                onChange={handleFileSelect}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedClient}
                className="bg-slate-700 hover:bg-slate-800"
              >
                <Upload className="mr-2 h-4 w-4" />
                Browse Files
              </Button>
              {!selectedClient && (
                <p className="text-xs text-red-500 mt-2">Please select a client first</p>
              )}
            </div>

            {/* Uploading Files */}
            {uploadingFiles.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium">Uploading...</h3>
                {uploadingFiles.map(file => (
                  <div key={file.id} className="flex items-center gap-3 p-3 bg-white rounded border">
                    <File className="h-5 w-5 text-gray-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{file.file.name}</p>
                      {/* Show file size */}
                      <p className="text-xs text-gray-500">
                        {(file.file.size / 1024).toFixed(0)}KB
                        {file.file.size > 100 * 1024 && ' • Will use chunked processing'}
                      </p>
                      {/* Show processing hint for large files */}
                      {file.file.size > 100 * 1024 && file.status === 'uploading' && (
                        <p className="text-xs text-blue-600 mt-0.5">
                          ⚡ Large document detected - processing in monthly chunks for 100% accuracy
                        </p>
                      )}
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                    </div>
                    {file.status === 'complete' && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    {file.status === 'error' && (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    {file.status === 'uploading' && (
                      <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card className="border border-slate-200 shadow-md bg-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Uploaded Documents</CardTitle>
                <CardDescription>
                  {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''}
                  {filterClient !== 'all' ? ` for ${filterClient}` : ' uploaded'}
                </CardDescription>
              </div>
              <div className="w-64">
                <label className="block text-sm font-medium mb-2">Filter by Client</label>
                <Select value={filterClient} onValueChange={setFilterClient}>
                  <SelectTrigger>
                    <SelectValue placeholder="All clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.name}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredDocuments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {filterClient === 'all'
                  ? 'No documents uploaded yet'
                  : `No documents found for ${filterClient}`
                }
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocuments.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded hover:bg-gray-100"
                  >
                    {getFileTypeIcon(doc.file_type)}
                    <div className="flex-1">
                      <p className="font-medium">{doc.file_name}</p>
                      <p className="text-sm text-gray-500">
                        {doc.clients.name} • {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(doc.status)}
                      <div className="flex flex-col items-end">
                        <span className="text-sm text-gray-600 capitalize">{doc.status}</span>
                        {doc.status === 'error' && doc.error_message && (
                          <span className="text-xs text-red-500" title={doc.error_message}>
                            {doc.error_message.substring(0, 50)}...
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Re-extract transactions (replaces existing data)"
                        onClick={() => handleReExtract(doc.id)}
                      >
                        <RefreshCw className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(doc.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
