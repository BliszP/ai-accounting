/**
 * Transactions Page
 *
 * Displays transactions grouped by Client → Document → Transactions.
 * Supports per-document and per-transaction selection for bulk approval
 * and grouped push to ledger.
 */

import { useState, useEffect } from 'react';
import apiClient from '../lib/api';
import Navigation from '../components/layout/Navigation';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Calendar,
  DollarSign,
  Tag,
  Check,
  X,
  Flag,
  Trash2,
  Edit,
  Plus,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Building2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';

interface Transaction {
  id: string;
  date: string;
  merchant: string;
  description: string | null;
  amount: string;
  type: string;
  category: string | null;
  category_confidence: number | null;
  vat_amount: string | null;
  vat_rate: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  extraction_confidence: number | null;
  clients: { name: string };
  documents: { id: string; file_name: string };
}

interface Client {
  id: string;
  name: string;
}

// Default categories
const DEFAULT_CATEGORIES = [
  'Office Supplies', 'Travel', 'Meals & Entertainment', 'Professional Fees',
  'Utilities', 'Rent', 'Salaries', 'Marketing', 'Software', 'Equipment',
  'Insurance', 'Bank Charges', 'Other',
];

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedDocuments, setExpandedDocuments] = useState<Set<string>>(new Set());

  // Edit transaction state
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    merchant: '', description: '', amount: '', category: '', vatAmount: '', vatRate: '',
  });
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    fetchClients();
    fetchTransactions();
  }, [selectedClient, selectedStatus]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedMonth]);

  async function fetchClients() {
    try {
      const response = await apiClient.get('/api/clients');
      setClients(response.data.clients);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  }

  async function fetchTransactions() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedClient !== 'all') params.append('clientId', selectedClient);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      const response = await apiClient.get(`/api/transactions?${params.toString()}`);
      setTransactions(response.data.transactions);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(transactionId: string) {
    try {
      await apiClient.put(`/api/transactions/${transactionId}`, { status: 'approved' });
      setTransactions(transactions.map(t =>
        t.id === transactionId ? { ...t, status: 'approved' as const } : t
      ));
      const ns = new Set(selectedIds); ns.delete(transactionId); setSelectedIds(ns);
    } catch (error: any) {
      alert(error.response?.data?.error || error.response?.data?.message || 'Failed to approve');
    }
  }

  async function handleReject(transactionId: string) {
    try {
      await apiClient.put(`/api/transactions/${transactionId}`, { status: 'rejected' });
      setTransactions(transactions.map(t =>
        t.id === transactionId ? { ...t, status: 'rejected' as const } : t
      ));
      const ns = new Set(selectedIds); ns.delete(transactionId); setSelectedIds(ns);
    } catch (error: any) {
      alert(error.response?.data?.error || error.response?.data?.message || 'Failed to reject');
    }
  }

  async function handleFlag(transactionId: string) {
    try {
      await apiClient.put(`/api/transactions/${transactionId}`, { status: 'flagged' });
      setTransactions(transactions.map(t =>
        t.id === transactionId ? { ...t, status: 'flagged' as const } : t
      ));
    } catch (error: any) {
      alert(error.response?.data?.error || error.response?.data?.message || 'Failed to flag');
    }
  }

  async function handleBulkApprove() {
    if (selectedIds.size === 0) { alert('Please select transactions to approve'); return; }
    try {
      await apiClient.post('/api/transactions/bulk-approve', { transactionIds: Array.from(selectedIds) });
      fetchTransactions();
      setSelectedIds(new Set());
    } catch (error: any) {
      alert(error.response?.data?.error || error.response?.data?.message || 'Failed to approve');
    }
  }

  async function handlePostToLedger(transactionId: string) {
    try {
      await apiClient.post(`/api/journal-entries/from-transaction/${transactionId}`);
      fetchTransactions();
      alert('Transaction posted to ledger successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || error.response?.data?.message || 'Failed to post to ledger');
    }
  }

  async function handleBulkPostToLedger() {
    if (selectedIds.size === 0) { alert('Please select approved transactions to post'); return; }

    const approvedSelected = filteredTransactions.filter(
      t => selectedIds.has(t.id) && t.status === 'approved'
    );
    if (approvedSelected.length === 0) {
      alert('Please select approved transactions to post to ledger'); return;
    }

    // Group by category + type for preview
    const categoryGroups = new Map<string, { transactions: Transaction[]; type: string; total: number }>();
    for (const txn of approvedSelected) {
      const key = `${txn.category || 'Other'}-${txn.type}`;
      if (!categoryGroups.has(key)) categoryGroups.set(key, { transactions: [], type: txn.type, total: 0 });
      const g = categoryGroups.get(key)!;
      g.transactions.push(txn);
      g.total += parseFloat(txn.amount);
    }

    let totalDebits = 0; let totalCredits = 0;
    const groupSummary = Array.from(categoryGroups.entries()).map(([key, g]) => {
      const [category] = key.split('-');
      const typeLabel = g.type === 'debit' ? 'Expense' : 'Income';
      if (g.type === 'debit') totalDebits += g.total; else totalCredits += g.total;
      return `  • ${category} (${typeLabel}): ${g.transactions.length} transaction(s) = £${g.total.toFixed(2)}`;
    }).join('\n');

    const netAmount = Math.abs(totalDebits - totalCredits);
    const balanceInfo = totalDebits === totalCredits
      ? '\n✓ Balanced'
      : `\nNet: £${netAmount.toFixed(2)} ${totalDebits > totalCredits ? 'expense' : 'income'}`;

    const confirmMessage = `Post ${approvedSelected.length} transaction(s) grouped by category?\n\nThis will create ${categoryGroups.size} journal entry/entries:\n\n${groupSummary}\n\n─────────────────────────\nTotal Expenses: £${totalDebits.toFixed(2)}\nTotal Income: £${totalCredits.toFixed(2)}${balanceInfo}`;
    if (!confirm(confirmMessage)) return;

    try {
      const response = await apiClient.post('/api/journal-entries/from-transactions/grouped', {
        transactionIds: approvedSelected.map(t => t.id),
      });
      fetchTransactions();
      setSelectedIds(new Set());
      alert(response.data.message || 'Successfully posted transactions to the ledger!');
    } catch (error: any) {
      alert(error.response?.data?.error || error.response?.data?.message || 'Failed to post');
    }
  }

  async function handleDelete(transactionId: string) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await apiClient.delete(`/api/transactions/${transactionId}`);
      setTransactions(transactions.filter(t => t.id !== transactionId));
    } catch (error: any) {
      alert(error.response?.data?.error || error.response?.data?.message || 'Failed to delete');
    }
  }

  function handleEdit(transaction: Transaction) {
    setEditingTransaction(transaction);
    setEditFormData({
      merchant: transaction.merchant,
      description: transaction.description || '',
      amount: transaction.amount,
      category: transaction.category || '',
      vatAmount: transaction.vat_amount || '',
      vatRate: transaction.vat_rate?.toString() || '',
    });
    setIsEditDialogOpen(true);
  }

  async function handleSaveEdit() {
    if (!editingTransaction) return;
    try {
      const response = await apiClient.put(`/api/transactions/${editingTransaction.id}`, {
        merchant: editFormData.merchant,
        description: editFormData.description || null,
        amount: parseFloat(editFormData.amount),
        category: editFormData.category || null,
        vatAmount: editFormData.vatAmount ? parseFloat(editFormData.vatAmount) : null,
        vatRate: editFormData.vatRate ? parseFloat(editFormData.vatRate) : null,
      });
      setTransactions(transactions.map(t =>
        t.id === editingTransaction.id ? { ...t, ...response.data.transaction } : t
      ));
      setIsEditDialogOpen(false);
      setEditingTransaction(null);
    } catch (error: any) {
      alert(error.response?.data?.error || error.response?.data?.message || 'Failed to update');
    }
  }

  function handleAddCategory() {
    if (newCategory && !customCategories.includes(newCategory) && !DEFAULT_CATEGORIES.includes(newCategory)) {
      setCustomCategories([...customCategories, newCategory]);
      setEditFormData({ ...editFormData, category: newCategory });
      setNewCategory('');
    }
  }

  function toggleSelection(transactionId: string) {
    const ns = new Set(selectedIds);
    ns.has(transactionId) ? ns.delete(transactionId) : ns.add(transactionId);
    setSelectedIds(ns);
  }

  /** Select/deselect all transactions from a specific document */
  function toggleDocumentSelection(_docId: string, docTransactions: Transaction[]) {
    const selectable = docTransactions.filter(t => t.status === 'pending' || t.status === 'approved');
    const allSelected = selectable.every(t => selectedIds.has(t.id));
    const ns = new Set(selectedIds);
    if (allSelected) {
      selectable.forEach(t => ns.delete(t.id));
    } else {
      selectable.forEach(t => ns.add(t.id));
    }
    setSelectedIds(ns);
  }

  function toggleSelectAll() {
    const selectable = filteredTransactions.filter(t => t.status === 'pending' || t.status === 'approved');
    const allSelected = selectable.length > 0 && selectable.every(t => selectedIds.has(t.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectable.map(t => t.id)));
    }
  }

  function toggleClientExpansion(clientName: string) {
    const ns = new Set(expandedClients);
    ns.has(clientName) ? ns.delete(clientName) : ns.add(clientName);
    setExpandedClients(ns);
  }

  function toggleDocumentExpansion(docKey: string) {
    const ns = new Set(expandedDocuments);
    ns.has(docKey) ? ns.delete(docKey) : ns.add(docKey);
    setExpandedDocuments(ns);
  }

  function getAvailableMonths(): { value: string; label: string }[] {
    const monthSet = new Map<string, string>();
    transactions.forEach(txn => {
      const date = new Date(txn.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthSet.has(key)) {
        monthSet.set(key, date.toLocaleDateString('en-GB', { year: 'numeric', month: 'long' }));
      }
    });
    return Array.from(monthSet.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([value, label]) => ({ value, label }));
  }

  const filteredTransactions = selectedMonth === 'all'
    ? transactions
    : transactions.filter(txn => {
        const d = new Date(txn.date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === selectedMonth;
      });

  /** Build 2-level hierarchy: client → documents → transactions */
  function groupByClientAndDocument() {
    // Group by client
    const clientMap = new Map<string, Map<string, Transaction[]>>();

    filteredTransactions.forEach(txn => {
      const clientName = txn.clients.name;
      const docKey = txn.documents.id || txn.documents.file_name; // use id when available

      if (!clientMap.has(clientName)) clientMap.set(clientName, new Map());
      const docMap = clientMap.get(clientName)!;
      if (!docMap.has(docKey)) docMap.set(docKey, []);
      docMap.get(docKey)!.push(txn);
    });

    return Array.from(clientMap.entries()).map(([clientName, docMap]) => {
      const allClientTxns = Array.from(docMap.values()).flat();
      return {
        clientName,
        documents: Array.from(docMap.entries()).map(([docKey, txns]) => {
          const fileName = txns[0].documents.file_name;
          const selectable = txns.filter(t => t.status === 'pending' || t.status === 'approved');
          const allDocSelected = selectable.length > 0 && selectable.every(t => selectedIds.has(t.id));
          const someDocSelected = selectable.some(t => selectedIds.has(t.id));
          const deposits = txns.filter(t => ['credit','income','sale'].includes(t.type)).reduce((s, t) => s + parseFloat(t.amount), 0);
          const outgoings = txns.filter(t => ['debit','expense','purchase'].includes(t.type)).reduce((s, t) => s + parseFloat(t.amount), 0);
          return {
            docKey,
            fileName,
            transactions: txns,
            selectable,
            allDocSelected,
            someDocSelected,
            deposits,
            outgoings,
            pendingCount: txns.filter(t => t.status === 'pending').length,
            approvedCount: txns.filter(t => t.status === 'approved').length,
          };
        }),
        totalDeposits: allClientTxns.filter(t => ['credit','income','sale'].includes(t.type)).reduce((s, t) => s + parseFloat(t.amount), 0),
        totalOutgoings: allClientTxns.filter(t => ['debit','expense','purchase'].includes(t.type)).reduce((s, t) => s + parseFloat(t.amount), 0),
        pendingCount: allClientTxns.filter(t => t.status === 'pending').length,
        approvedCount: allClientTxns.filter(t => t.status === 'approved').length,
        transactionCount: allClientTxns.length,
      };
    });
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'approved': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'flagged':  return <Flag className="h-4 w-4 text-orange-500" />;
      default:         return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'approved': return 'bg-green-50 border-green-200';
      case 'rejected': return 'bg-red-50 border-red-200';
      case 'flagged':  return 'bg-orange-50 border-orange-200';
      default:         return 'bg-yellow-50 border-yellow-200';
    }
  }

  const pendingCount = filteredTransactions.filter(t => t.status === 'pending').length;
  const approvedCount = filteredTransactions.filter(t => t.status === 'approved').length;
  const rejectedCount = filteredTransactions.filter(t => t.status === 'rejected').length;
  const selectableCount = filteredTransactions.filter(t => t.status === 'pending' || t.status === 'approved').length;

  const totalDeposits = filteredTransactions.filter(t => ['credit','income','sale'].includes(t.type)).reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalOutgoings = filteredTransactions.filter(t => ['debit','expense','purchase'].includes(t.type)).reduce((s, t) => s + parseFloat(t.amount), 0);
  const netBalance = totalDeposits - totalOutgoings;

  const pendingSelected = filteredTransactions.filter(t => selectedIds.has(t.id) && t.status === 'pending').length;
  const approvedSelected = filteredTransactions.filter(t => selectedIds.has(t.id) && t.status === 'approved').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">Loading transactions...</div>
        </main>
      </div>
    );
  }

  const clientGroups = groupByClientAndDocument();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
          {selectedIds.size > 0 && (
            <div className="flex gap-2">
              {pendingSelected > 0 && (
                <Button onClick={handleBulkApprove} className="bg-slate-700 hover:bg-slate-800">
                  <Check className="mr-2 h-4 w-4" />
                  Approve {pendingSelected} Selected
                </Button>
              )}
              {approvedSelected > 0 && (
                <Button onClick={handleBulkPostToLedger} className="bg-green-700 hover:bg-green-800">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Post {approvedSelected} to Ledger
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card className="border border-slate-200 shadow-md bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{pendingCount}</div>
              <p className="text-xs text-slate-500 mt-1">{approvedCount} approved · {rejectedCount} rejected</p>
            </CardContent>
          </Card>
          <Card className="border border-slate-200 shadow-md bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-800">{filteredTransactions.length}</div>
              <p className="text-xs text-slate-500 mt-1">
                {filteredTransactions.filter(t => ['credit','income','sale'].includes(t.type)).length} deposits ·{' '}
                {filteredTransactions.filter(t => ['debit','expense','purchase'].includes(t.type)).length} outgoings
              </p>
            </CardContent>
          </Card>
          <Card className="border border-green-200 shadow-md bg-green-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-700">Total Deposits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">£{totalDeposits.toFixed(2)}</div>
              <p className="text-xs text-green-600 mt-1">Money in (credits)</p>
            </CardContent>
          </Card>
          <Card className="border border-red-200 shadow-md bg-red-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-700">Total Outgoings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">£{totalOutgoings.toFixed(2)}</div>
              <p className="text-xs text-red-600 mt-1">Money out (debits)</p>
            </CardContent>
          </Card>
          <Card className={`border shadow-md ${netBalance >= 0 ? 'border-blue-200 bg-blue-50' : 'border-orange-200 bg-orange-50'}`}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-sm font-medium ${netBalance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Net Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${netBalance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                {netBalance >= 0 ? '+' : '-'}£{Math.abs(netBalance).toFixed(2)}
              </div>
              <p className={`text-xs mt-1 ${netBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Deposits − Outgoings</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6 border border-slate-200 shadow-md bg-white">
          <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Client</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Month</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {getAvailableMonths().map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="flagged">Flagged</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions List */}
        <Card className="border border-slate-200 shadow-md bg-white">
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>
              {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''} across {clientGroups.length} client{clientGroups.length !== 1 ? 's' : ''}
              {selectedMonth !== 'all' && (
                <span className="ml-1">in {getAvailableMonths().find(m => m.value === selectedMonth)?.label}</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {selectedMonth !== 'all'
                  ? `No transactions for ${getAvailableMonths().find(m => m.value === selectedMonth)?.label || selectedMonth}`
                  : 'No transactions found'}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Global select all */}
                {selectableCount > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4">
                    <input
                      type="checkbox"
                      id="select-all"
                      className="w-4 h-4"
                      checked={selectedIds.size === selectableCount && selectableCount > 0}
                      onChange={toggleSelectAll}
                    />
                    <label htmlFor="select-all" className="text-sm font-medium text-slate-700 cursor-pointer">
                      Select All {selectableCount} transaction{selectableCount !== 1 ? 's' : ''}
                    </label>
                    {selectedIds.size > 0 && (
                      <span className="text-xs text-slate-500">({selectedIds.size} selected)</span>
                    )}
                  </div>
                )}

                {/* Level 1: Clients */}
                {clientGroups.map(clientGroup => {
                  const isClientExpanded = expandedClients.has(clientGroup.clientName);

                  return (
                    <div key={clientGroup.clientName} className="border border-slate-300 rounded-xl overflow-hidden">
                      {/* Client Header */}
                      <div
                        className="flex items-center justify-between p-4 bg-slate-100 cursor-pointer hover:bg-slate-200 transition-colors"
                        onClick={() => toggleClientExpansion(clientGroup.clientName)}
                      >
                        <div className="flex items-center gap-3">
                          {isClientExpanded ? <ChevronUp className="h-5 w-5 text-slate-600" /> : <ChevronDown className="h-5 w-5 text-slate-600" />}
                          <Building2 className="h-5 w-5 text-slate-500" />
                          <div>
                            <p className="font-semibold text-slate-800 text-lg">{clientGroup.clientName}</p>
                            <p className="text-xs text-slate-500">
                              {clientGroup.transactionCount} transaction{clientGroup.transactionCount !== 1 ? 's' : ''} across {clientGroup.documents.length} document{clientGroup.documents.length !== 1 ? 's' : ''}
                              {clientGroup.pendingCount > 0 && <span className="ml-2 text-yellow-600">· {clientGroup.pendingCount} pending</span>}
                              {clientGroup.approvedCount > 0 && <span className="ml-2 text-green-600">· {clientGroup.approvedCount} approved</span>}
                            </p>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          {clientGroup.totalDeposits > 0 && (
                            <div className="text-sm"><span className="text-green-600 font-semibold">+£{clientGroup.totalDeposits.toFixed(2)}</span><span className="text-slate-400 ml-1">in</span></div>
                          )}
                          {clientGroup.totalOutgoings > 0 && (
                            <div className="text-sm"><span className="text-red-600 font-semibold">-£{clientGroup.totalOutgoings.toFixed(2)}</span><span className="text-slate-400 ml-1">out</span></div>
                          )}
                        </div>
                      </div>

                      {/* Level 2: Documents under this client */}
                      {isClientExpanded && (
                        <div className="divide-y divide-slate-200">
                          {clientGroup.documents.map(docGroup => {
                            const docExpandKey = `${clientGroup.clientName}::${docGroup.docKey}`;
                            const isDocExpanded = expandedDocuments.has(docExpandKey);

                            return (
                              <div key={docGroup.docKey} className="bg-white">
                                {/* Document Header */}
                                <div className="flex items-center justify-between px-6 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                                  <div className="flex items-center gap-3">
                                    {/* Document-level checkbox */}
                                    {docGroup.selectable.length > 0 && (
                                      <input
                                        type="checkbox"
                                        className="w-4 h-4"
                                        checked={docGroup.allDocSelected}
                                        ref={el => { if (el) el.indeterminate = docGroup.someDocSelected && !docGroup.allDocSelected; }}
                                        onChange={() => toggleDocumentSelection(docGroup.docKey, docGroup.transactions)}
                                        onClick={e => e.stopPropagation()}
                                      />
                                    )}
                                    <div
                                      className="flex items-center gap-2 cursor-pointer"
                                      onClick={() => toggleDocumentExpansion(docExpandKey)}
                                    >
                                      {isDocExpanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                                      <FileText className="h-4 w-4 text-blue-500" />
                                      <span className="text-sm font-medium text-slate-700">{docGroup.fileName}</span>
                                      <span className="text-xs text-slate-400">
                                        ({docGroup.transactions.length} transaction{docGroup.transactions.length !== 1 ? 's' : ''})
                                      </span>
                                      {docGroup.pendingCount > 0 && (
                                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{docGroup.pendingCount} pending</span>
                                      )}
                                      {docGroup.approvedCount > 0 && (
                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{docGroup.approvedCount} approved</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm">
                                    {docGroup.deposits > 0 && <span className="text-green-600 font-medium">+£{docGroup.deposits.toFixed(2)}</span>}
                                    {docGroup.outgoings > 0 && <span className="text-red-600 font-medium">-£{docGroup.outgoings.toFixed(2)}</span>}
                                  </div>
                                </div>

                                {/* Level 3: Transactions under this document */}
                                {isDocExpanded && (
                                  <div className="px-6 py-3 space-y-2">
                                    {docGroup.transactions.map(txn => (
                                      <div
                                        key={txn.id}
                                        className={`border rounded-lg p-4 ${getStatusColor(txn.status)}`}
                                      >
                                        <div className="flex items-start gap-3">
                                          {/* Transaction checkbox */}
                                          {(txn.status === 'pending' || txn.status === 'approved') && (
                                            <input
                                              type="checkbox"
                                              className="mt-1 w-4 h-4 shrink-0"
                                              checked={selectedIds.has(txn.id)}
                                              onChange={() => toggleSelection(txn.id)}
                                              onClick={e => e.stopPropagation()}
                                            />
                                          )}

                                          <div className="shrink-0 mt-0.5">{getStatusIcon(txn.status)}</div>

                                          {/* Details */}
                                          <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-1">
                                              <h3 className="font-semibold text-base">{txn.merchant}</h3>
                                              <div className="text-right ml-4">
                                                <p className={`font-bold text-base ${['credit','income','sale'].includes(txn.type) ? 'text-green-700' : 'text-red-700'}`}>
                                                  {['credit','income','sale'].includes(txn.type) ? '+' : '-'}£{parseFloat(txn.amount).toFixed(2)}
                                                </p>
                                                <p className="text-xs text-gray-500 capitalize">
                                                  {['credit','income','sale'].includes(txn.type) ? 'Deposit' : 'Outgoing'}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                                              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(txn.date).toLocaleDateString('en-GB')}</span>
                                              {txn.category && <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{txn.category}</span>}
                                              {txn.vat_amount && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />VAT: £{parseFloat(txn.vat_amount).toFixed(2)}</span>}
                                            </div>
                                            {txn.description && <p className="text-xs mt-1 text-gray-600">{txn.description}</p>}
                                          </div>

                                          {/* Action Buttons */}
                                          <div className="flex gap-1 shrink-0">
                                            {txn.status === 'pending' && (
                                              <>
                                                <Button size="sm" variant="default" onClick={() => handleApprove(txn.id)} title="Approve"><Check className="h-3 w-3" /></Button>
                                                <Button size="sm" variant="outline" onClick={() => handleFlag(txn.id)} title="Flag"><Flag className="h-3 w-3" /></Button>
                                                <Button size="sm" variant="destructive" onClick={() => handleReject(txn.id)} title="Reject"><X className="h-3 w-3" /></Button>
                                              </>
                                            )}
                                            {txn.status === 'approved' && (
                                              <Button size="sm" variant="default" onClick={() => handlePostToLedger(txn.id)} className="bg-green-700 hover:bg-green-800 text-xs" title="Post to Ledger">
                                                <BookOpen className="h-3 w-3 mr-1" />Post
                                              </Button>
                                            )}
                                            <Button size="sm" variant="ghost" onClick={() => handleEdit(txn)} title="Edit"><Edit className="h-3 w-3 text-blue-500" /></Button>
                                            <Button size="sm" variant="ghost" onClick={() => handleDelete(txn.id)} title="Delete"><Trash2 className="h-3 w-3 text-red-500" /></Button>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Transaction Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Transaction</DialogTitle>
              <DialogDescription>Update transaction details and category</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="merchant">Merchant *</Label>
                <Input id="merchant" value={editFormData.merchant} onChange={e => setEditFormData({ ...editFormData, merchant: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={editFormData.description} onChange={e => setEditFormData({ ...editFormData, description: e.target.value })} placeholder="Additional details..." rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount">Amount *</Label>
                  <Input id="amount" type="number" step="0.01" value={editFormData.amount} onChange={e => setEditFormData({ ...editFormData, amount: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select value={editFormData.category} onValueChange={v => setEditFormData({ ...editFormData, category: v })}>
                    <SelectTrigger id="category"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {DEFAULT_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                      {customCategories.map(cat => <SelectItem key={cat} value={cat}>{cat} (Custom)</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-sm font-medium mb-2 block">Add Custom Category</Label>
                <div className="flex gap-2">
                  <Input placeholder="Enter new category name..." value={newCategory} onChange={e => setNewCategory(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAddCategory()} />
                  <Button type="button" variant="outline" onClick={handleAddCategory} disabled={!newCategory}><Plus className="h-4 w-4 mr-1" />Add</Button>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-sm font-medium mb-2 block">VAT Details (Optional)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="vatAmount">VAT Amount</Label>
                    <Input id="vatAmount" type="number" step="0.01" value={editFormData.vatAmount} onChange={e => setEditFormData({ ...editFormData, vatAmount: e.target.value })} placeholder="0.00" />
                  </div>
                  <div>
                    <Label htmlFor="vatRate">VAT Rate (%)</Label>
                    <Input id="vatRate" type="number" step="0.01" value={editFormData.vatRate} onChange={e => setEditFormData({ ...editFormData, vatRate: e.target.value })} placeholder="20" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditingTransaction(null); }}>Cancel</Button>
                <Button onClick={handleSaveEdit} className="bg-slate-700 hover:bg-slate-800">Save Changes</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
