'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';
import { useToast } from '@/components/ui/toast-provider';

export interface DocumentDto {
  id: string;
  userId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  title?: string;
  status: 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';
  pageCount?: number;
  createdAt: string;
  updatedAt: string;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export default function DocumentsPage() {
  const { showToast } = useToast();
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Selected file state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete modal state
  const [docToDelete, setDocToDelete] = useState<DocumentDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Q&A Modal state
  const [activeQADoc, setActiveQADoc] = useState<DocumentDto | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [qaLoading, setQaLoading] = useState(false);
  const [qaAnswer, setQaAnswer] = useState<string | null>(null);
  const [qaError, setQaError] = useState<string | null>(null);

  // Fetch document list from API
  const fetchDocuments = async () => {
    try {
      const res = await fetchApi('/documents');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: DocumentDto[] = await res.json();
      setDocuments(data);
    } catch (err: any) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchDocuments();
  }, []);

  // Poll while any document is in UPLOADED or PROCESSING state
  useEffect(() => {
    const hasPendingDocs = documents.some(
      (doc) => doc.status === 'UPLOADED' || doc.status === 'PROCESSING',
    );

    if (!hasPendingDocs) return;

    const interval = setInterval(() => {
      fetchDocuments();
    }, 3000);

    return () => clearInterval(interval);
  }, [documents]);

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setValidationError('Only PDF documents (.pdf) are supported.');
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setValidationError('File size exceeds the maximum allowed limit of 10 MB.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  // Upload handler
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || uploading) return;

    try {
      setUploading(true);
      setValidationError(null);

      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetchApi('/documents', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Upload failed (HTTP ${res.status})`);
      }

      const newDoc: DocumentDto = await res.json();

      // Instantly add or refresh list
      setDocuments((prev) => [newDoc, ...prev.filter((d) => d.id !== newDoc.id)]);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      showToast('success', 'Document uploaded successfully. Ingestion in progress...');
      fetchDocuments();
    } catch (err: any) {
      setValidationError(err.message || 'Failed to upload document. Please try again.');
      showToast('error', 'Document upload failed.');
    } finally {
      setUploading(false);
    }
  };

  // Delete handler
  const confirmDeleteDocument = async () => {
    if (!docToDelete || deleting) return;

    try {
      setDeleting(true);
      const res = await fetchApi(`/documents/${docToDelete.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setDocuments((prev) => prev.filter((d) => d.id !== docToDelete.id));
      showToast('success', `Document "${docToDelete.filename}" deleted successfully.`);
      setDocToDelete(null);
    } catch (err: any) {
      showToast('error', `Failed to delete document: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  // Q&A handler via existing AI Chat API architecture
  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim() || !activeQADoc || qaLoading) return;

    try {
      setQaLoading(true);
      setQaAnswer(null);
      setQaError(null);

      // Prompt asking DocumentAgent about the active document
      const fullPrompt = `Document Query regarding ${activeQADoc.filename}: ${questionText.trim()}`;

      const res = await fetchApi('/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messageText: fullPrompt }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setQaAnswer(data.output || 'No response received.');
    } catch (err: any) {
      setQaError(err.message || 'Failed to query DocumentAgent.');
    } finally {
      setQaLoading(false);
    }
  };


  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStatusBadge = (status: DocumentDto['status']) => {
    switch (status) {
      case 'READY':
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            READY
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 animate-pulse">
            PROCESSING...
          </span>
        );
      case 'UPLOADED':
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
            UPLOADED
          </span>
        );
      case 'FAILED':
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-red-500/10 text-red-400 border border-red-500/30">
            FAILED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">

        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-6 gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <span className="h-3.5 w-3.5 rounded-full bg-indigo-500 animate-pulse"></span>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-amber-300 bg-clip-text text-transparent">
                Documents
              </h1>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Upload financial documents and ask Finora questions about them.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition duration-200"
            >
              ← System Monitor
            </Link>
          </div>
        </div>

        {/* Upload Section */}
        <div className="glass-card rounded-xl p-6 border border-slate-800 space-y-4">
          <h2 className="text-lg font-semibold text-slate-200">Upload PDF Document</h2>
          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileChange}
                disabled={uploading}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600/20 file:text-blue-400 hover:file:bg-blue-600/30 block w-full text-xs text-slate-400 border border-slate-800 rounded-lg p-2 bg-slate-900/50 cursor-pointer disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!selectedFile || uploading}
                className="px-6 py-2.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 shrink-0 flex items-center justify-center space-x-2"
              >
                {uploading ? (
                  <>
                    <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Uploading...</span>
                  </>
                ) : (
                  <span>Upload Document</span>
                )}
              </button>
            </div>

            {validationError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg">
                ⚠️ {validationError}
              </p>
            )}

            <p className="text-xs text-slate-500">
              Supported format: <strong>PDF (.pdf)</strong> • Maximum file size: <strong>10 MB</strong>
            </p>
          </form>
        </div>

        {/* Documents List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-slate-100">Uploaded Documents</h2>
            <span className="text-xs text-slate-400">Total: {documents.length}</span>
          </div>

          {loading ? (
            <div className="glass-card rounded-xl p-8 text-center text-slate-400 animate-pulse border border-slate-800">
              Loading financial documents...
            </div>
          ) : documents.length === 0 ? (
            /* Empty State */
            <div className="glass-card rounded-xl p-12 text-center border border-slate-800 space-y-4">
              <div className="h-16 w-16 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-3xl">
                📄
              </div>
              <h3 className="text-lg font-semibold text-slate-200">No documents uploaded yet</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Upload a financial report, 10-K filing, or PDF document above to enable Finora
                grounded question answering.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="glass-card rounded-xl p-5 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-slate-700"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-3">
                      <span className="text-xl">📄</span>
                      <h3 className="font-semibold text-slate-100 text-base">{doc.filename}</h3>
                      {getStatusBadge(doc.status)}
                    </div>
                    {doc.title && <p className="text-xs text-slate-300 italic pl-8">Title: {doc.title}</p>}
                    <div className="flex items-center space-x-4 text-xs text-slate-500 pl-8">
                      <span>Uploaded: {new Date(doc.createdAt).toLocaleDateString()}</span>
                      <span>Size: {formatBytes(doc.fileSize)}</span>
                      {typeof doc.pageCount === 'number' && <span>Pages: {doc.pageCount}</span>}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 self-end md:self-center">
                    {doc.status === 'READY' && (
                      <button
                        onClick={() => {
                          setActiveQADoc(doc);
                          setQuestionText('');
                          setQaAnswer(null);
                          setQaError(null);
                        }}
                        className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition duration-200"
                      >
                        💬 Ask Questions
                      </button>
                    )}
                    <button
                      onClick={() => setDocToDelete(doc)}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition duration-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {docToDelete && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass-card rounded-xl p-6 border border-slate-800 max-w-md w-full space-y-4">
              <h3 className="text-lg font-bold text-slate-100">Delete Document</h3>
              <p className="text-sm text-slate-300">
                Are you sure you want to delete <strong>{docToDelete.filename}</strong>? This action
                will permanently remove the document and its vector embeddings.
              </p>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setDocToDelete(null)}
                  disabled={deleting}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteDocument}
                  disabled={deleting}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 transition duration-200 flex items-center space-x-2"
                >
                  {deleting ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Document Grounded Q&A Modal */}
        {activeQADoc && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass-card rounded-2xl p-6 border border-slate-800 max-w-2xl w-full space-y-6 max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
                    <span>Ask Finora</span>
                    <span className="text-xs px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-full font-normal">
                      DocumentAgent
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Grounded inquiry on <strong>{activeQADoc.filename}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setActiveQADoc(null)}
                  className="text-slate-400 hover:text-slate-200 p-1"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {qaAnswer && (
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                      Finora Response
                    </p>
                    <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {qaAnswer}
                    </div>
                  </div>
                )}

                {qaError && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
                    ⚠️ {qaError}
                  </div>
                )}

                {!qaAnswer && !qaError && !qaLoading && (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    Type a question below (e.g. &quot;What is the revenue in this document?&quot;) to query the document chunks.
                  </div>
                )}

                {qaLoading && (
                  <div className="p-6 text-center text-slate-400 text-xs animate-pulse space-y-2">
                    <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <div>Searching vector chunks & generating grounded LLM response...</div>
                  </div>
                )}
              </div>

              <form onSubmit={handleAskQuestion} className="space-y-3 border-t border-slate-800 pt-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    placeholder={`Ask something about ${activeQADoc.filename}...`}
                    disabled={qaLoading}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                  />
                  <button
                    type="submit"
                    disabled={!questionText.trim() || qaLoading}
                    className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition duration-200"
                  >
                    Submit
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
}
