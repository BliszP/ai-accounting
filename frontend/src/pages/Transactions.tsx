/**
 * Transactions Page
 *
 * View, review, and approve transactions
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
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
  clients: {
    name: string;
  };
  documents: {
    file_name: string;
  };
}

interface Client {
  id: string;
  name: string;
}

// Default categories
const DEFAULT_CATEGORIES = [
  'Office Supplies',
  'Travel',
  'Meals & Entertainment',
  'Professional Fees',
  'Utilities',
  'Rent',
  'Salaries',
  'Marketing',
  'Software',
  'Equipment',
  'Insurance',
  'Bank Charges',
  'Other',
];

export default function Transactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  // Edit transaction state
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    merchant: '',
    description: '',
    amount: '',
    category: '',
    vatAmount: '',
    vatRate: '',
  });
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    fetchClients();
    fetchTransactions();
  }, [selectedClient, selectedStatus]);

  // Clear selection when month filter changes
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

      if (selectedClient !== 'all') {
        params.append('clientId', selectedClient);
      }

      if (selectedStatus !== 'all') {
        params.append('status', selectedStatus);
      }

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
      await apiClient.put(`/api/transactions/${transactionId}`, {
        status: 'approved',
      });

      // Update local state
      setTransactions(transactions.map(t =>
        t.id === transactionId ? { ...t, status: 'approved' as const } : t
      ));

      // Remove from selected
      const newSelected = new Set(selectedIds);
      newSelected.delete(transactionId);
      setSelectedIds(newSelected);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to approve transaction');
    }
  }

  async function handleReject(transactionId: string) {
    try {
      await apiClient.put(`/api/transactions/${transactionId}`, {
        status: 'rejected',
      });

      setTransactions(transactions.map(t =>
        t.id === transactionId ? { ...t, status: 'rejected' as const } : t
      ));

      const newSelected = new Set(selectedIds);
      newSelected.delete(transactionId);
      setSelectedIds(newSelected);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to reject transaction');
    }
  }

  async function handleFlag(transactionId: string) {
    try {
      await apiClient.put(`/api/transactions/${transactionId}`, {
        status: 'flagged',
      });

      setTransactions(transactions.map(t =>
        t.id === transactionId ? { ...t, status: 'flagged' as const } : t
      ));
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to flag transaction');
    }
  }

  async function handleBulkApprove() {
    if (selectedIds.size === 0) {
      alert('Please select transactions to approve');
      return;
    }

    try {
      await apiClient.post('/api/transactions/bulk-approve', {
        transactionIds: Array.from(selectedIds),
      });

      // Refresh transactions
      fetchTransactions();
      setSelectedIds(new Set());
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to approve transactions');
    }
  }

  async function handlePostToLedger(transactionId: string) {
    try {
      await apiClient.post(`/api/journal-entries/from-transaction/${transactionId}`);

      // Refresh transactions to show updated status
      fetchTransactions();

      alert('Transaction posted to ledger successfully!');
    } catch (error: any) {
      alert(error.response?.data?.message || error.response?.data?.error || 'Failed to post transaction to ledger');
    }
  }

  async function handleBulkPostToLedger() {
    if (selectedIds.size === 0) {
      alert('Please select approved transactions to post');
      return;
    }

    const approvedSelected = transactions.filter(
      t => selectedIds.has(t.id) && t.status === 'approved'
    );

    if (approvedSelected.length === 0) {
      alert('Please select approved transactions to post to ledger');
      return;
    }

    // Group transactions by category and type for preview
    const categoryGroups = new Map<string, { transactions: Transaction[], type: string, total: number }>();
    for (const txn of approvedSelected) {
      const category = txn.category || 'Other';
      const key = `${category}-${txn.type}`;

      if (!categoryGroups.has(key)) {
        categoryGroups.set(key, {
          transactions: [],
          type: txn.type,
          total: 0
        });
      }

      const group = categoryGroups.get(key)!;
      group.transactions.push(txn);
      group.total += parseFloat(txn.amount);
    }

    // Calculate totals
    let totalDebits = 0;
    let totalCredits = 0;

    const groupSummary = Array.from(categoryGroups.entries())
      .map(([key, group]) => {
        const [category] = key.split('-');
        const typeLabel = group.type === 'debit' ? 'Expense' : 'Income';
        const amount = group.total;

        if (group.type === 'debit') {
          totalDebits += amount;
        } else {
          totalCredits += amount;
        }

        return `  • ${category} (${typeLabel}): ${group.transactions.length} transaction(s) = £${amount.toFixed(2)}`;
      })
      .join('\n');

    const netAmount = Math.abs(totalDebits - totalCredits);
    const balanceInfo = totalDebits === totalCredits
      ? '\n✓ Balanced'
      : `\nNet: £${netAmount.toFixed(2)} ${totalDebits > totalCredits ? 'expense' : 'income'}`;

    const confirmMessage = `Post ${approvedSelected.length} transaction(s) grouped by category?\n\nThis will create ${categoryGroups.size} journal entry/entries:\n\n${groupSummary}\n\n─────────────────────────\nTotal Expenses: £${totalDebits.toFixed(2)}\nTotal Income: £${totalCredits.toFixed(2)}${balanceInfo}`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const transactionIds = approvedSelected.map(t => t.id);

      const response = await apiClient.post('/api/journal-entries/from-transactions/grouped', {
        transactionIds,
      });

      // Refresh transactions
      fetchTransactions();
      setSelectedIds(new Set());

      alert(response.data.message || 'Successfully posted transactions to the ledger!');
    } catch (error: any) {
      alert(error.response?.data?.message || error.response?.data?.error || 'Failed to post transactions');
    }
  }

  async function handleDelete(transactionId: string) {
    if (!confirm('Are you sure you want to delete this transaction?')) {
      return;
    }

    try {
      await apiClient.delete(`/api/transactions/${transactionId}`);
      setTransactions(transactions.filter(t => t.id !== transactionId));
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete transaction');
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

      // Update local state
      setTransactions(transactions.map(t =>
        t.id === editingTransaction.id ? { ...t, ...response.data.transaction } : t
      ));

      setIsEditDialogOpen(false);
      setEditingTransaction(null);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to update transaction');
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
    const newSelected = new Set(selectedIds);
    if (newSelected.has(transactionId)) {
      newSelected.delete(transactionId);
    } else {
      newSelected.add(transactionId);
    }
    setSelectedIds(newSelected);
  }

  function toggleSelectAll() {
    const selectableTransactions = filteredTransactions.filter(
      t => t.status === 'pending' || t.status === 'approved'
    );

    if (selectedIds.size === selectableTransactions.length && selectableTransactions.length > 0) {
      // Deselect all
      setSelectedIds(new Set());
    } else {
      // Select all pending and approved (in current filtered view)
      setSelectedIds(new Set(selectableTransactions.map(t => t.id)));
    }
  }

  function toggleClientExpansion(clientName: string) {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clientName)) {
      newExpanded.delete(clientName);
    } else {
      newExpanded.add(clientName);
    }
    setExpandedClients(newExpanded);
  }

  // Extract available months from transactions for the filter dropdown
  function getAvailableMonths(): { value: string; label: string }[] {
    const monthSet = new Map<string, string>();

    transactions.forEach(txn => {
      const date = new Date(txn.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthSet.has(key)) {
        const label = date.toLocaleDateString('en-GB', { year: 'numeric', month: 'long' });
        monthSet.set(key, label);
      }
    });

    // Sort chronologically
    return Array.from(monthSet.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, label]) => ({ value, label }));
  }

  // Filter transactions by selected month
  const filteredTransactions = selectedMonth === 'all'
    ? transactions
    : transactions.filter(txn => {
        const date = new Date(txn.date);
        const txnMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return txnMonth === selectedMonth;
      });

  // Group transactions by client (using filtered transactions)
  function groupTransactionsByClient() {
    const groups = new Map<string, Transaction[]>();

    filteredTransactions.forEach(txn => {
      const clientName = txn.clients.name;
      if (!groups.has(clientName)) {
        groups.set(clientName, []);
      }
      groups.get(clientName)!.push(txn);
    });

    return Array.from(groups.entries()).map(([clientName, clientTransactions]) => ({
      clientName,
      transactions: clientTransactions,
      deposits: clientTransactions
        .filter(t => t.type === 'credit' || t.type === 'income' || t.type === 'sale')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0),
      outgoings: clientTransactions
        .filter(t => t.type === 'debit' || t.type === 'expense' || t.type === 'purchase')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0),
      pendingCount: clientTransactions.filter(t => t.status === 'pending').length,
      approvedCount: clientTransactions.filter(t => t.status === 'approved').length,
    }));
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'flagged':
        return <Flag className="h-5 w-5 text-orange-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'approved':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'rejected':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'flagged':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      default:
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    }
  }

  const pendingCount = filteredTransactions.filter(t => t.status === 'pending').length;
  const approvedCount = filteredTransactions.filter(t => t.status === 'approved').length;
  const rejectedCount = filteredTransactions.filter(t => t.status === 'rejected').length;
  const selectableCount = pendingCount + approvedCount;

  // Calculate separate deposit/outgoing totals for accurate validation against bank statements
  const totalDeposits = filteredTransactions
    .filter(t => t.type === 'credit' || t.type === 'income' || t.type === 'sale')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalOutgoings = filteredTransactions
    .filter(t => t.type === 'debit' || t.type === 'expense' || t.type === 'purchase')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const netBalance = totalDeposits - totalOutgoings;

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Transactions
          </h1>
          {selectedIds.size > 0 && (
            <div className="flex gap-2">
              {filteredTransactions.some(t => selectedIds.has(t.id) && t.status === 'pending') && (
                <Button onClick={handleBulkApprove} className="bg-slate-700 hover:bg-slate-800">
                  <Check className="mr-2 h-4 w-4" />
                  Approve {filteredTransactions.filter(t => selectedIds.has(t.id) && t.status === 'pending').length} Selected
                </Button>
              )}
              {filteredTransactions.some(t => selectedIds.has(t.id) && t.status === 'approved') && (
                <Button onClick={handleBulkPostToLedger} className="bg-green-700 hover:bg-green-800">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Post {filteredTransactions.filter(t => selectedIds.has(t.id) && t.status === 'approved').length} to Ledger (Grouped)
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
              <p className="text-xs text-slate-500 mt-1">
                {approvedCount} approved · {rejectedCount} rejected
              </p>
            </CardContent>
          </Card>
          <Card className="border border-slate-200 shadow-md bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-800">{filteredTransactions.length}</div>
              <p className="text-xs text-slate-500 mt-1">
                {filteredTransactions.filter(t => t.type === 'credit' || t.type === 'income' || t.type === 'sale').length} deposits · {filteredTransactions.filter(t => t.type === 'debit' || t.type === 'expense' || t.type === 'purchase').length} outgoings
              </p>
            </CardContent>
          </Card>
          <Card className="border border-green-200 shadow-md bg-green-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-700">Total Deposits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">
                £{totalDeposits.toFixed(2)}
              </div>
              <p className="text-xs text-green-600 mt-1">
                Money in (credits)
              </p>
            </CardContent>
          </Card>
          <Card className="border border-red-200 shadow-md bg-red-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-700">Total Outgoings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">
                £{totalOutgoings.toFixed(2)}
              </div>
              <p className="text-xs text-red-600 mt-1">
                Money out (debits)
              </p>
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
              <p className={`text-xs mt-1 ${netBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                Deposits − Outgoings
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6 border border-slate-200 shadow-md bg-white">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Client</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Month</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {getAvailableMonths().map(month => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
              {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''} found
              {selectedMonth !== 'all' && (
                <span className="ml-1">
                  in {getAvailableMonths().find(m => m.value === selectedMonth)?.label}
                </span>
              )}
              {selectedMonth !== 'all' && transactions.length !== filteredTransactions.length && (
                <span className="text-slate-400 ml-1">
                  (of {transactions.length} total)
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {selectedMonth !== 'all'
                  ? `No transactions found for ${getAvailableMonths().find(m => m.value === selectedMonth)?.label || selectedMonth}`
                  : 'No transactions found'
                }
              </div>
            ) : (
              <div className="space-y-3">
                {/* Select All Checkbox */}
                {selectableCount > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <input
                      type="checkbox"
                      id="select-all"
                      className="w-4 h-4"
                      checked={selectedIds.size === selectableCount && selectableCount > 0}
                      onChange={toggleSelectAll}
                    />
                    <label htmlFor="select-all" className="text-sm font-medium text-slate-700 cursor-pointer">
                      Select All {selectableCount} Transaction{selectableCount !== 1 ? 's' : ''}
                      {pendingCount > 0 && approvedCount > 0 && (
                        <span className="text-xs text-slate-500 ml-1">
                          ({pendingCount} pending, {approvedCount} approved)
                        </span>
                      )}
                      {pendingCount > 0 && approvedCount === 0 && (
                        <span className="text-xs text-slate-500 ml-1">(pending)</span>
                      )}
                      {approvedCount > 0 && pendingCount === 0 && (
                        <span className="text-xs text-slate-500 ml-1">(approved)</span>
                      )}
                    </label>
                    {selectedIds.size > 0 && (
                      <span className="text-xs text-slate-600">
                        ({selectedIds.size} selected)
                      </span>
                    )}
                  </div>
                )}

                {/* Group transactions by client */}
                {groupTransactionsByClient().map(group => {
                  const isExpanded = expandedClients.has(group.clientName);

                  return (
                    <Card key={group.clientName} className="border border-slate-300 bg-slate-50">
                      <CardHeader
                        className="cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => toggleClientExpansion(group.clientName)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-slate-600" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-slate-600" />
                            )}
                            <div>
                              <CardTitle className="text-lg">{group.clientName}</CardTitle>
                              <CardDescription>
                                {group.transactions.length} transaction{group.transactions.length !== 1 ? 's' : ''}
                                {group.pendingCount > 0 && (
                                  <span className="ml-2 text-yellow-600">
                                    • {group.pendingCount} pending
                                  </span>
                                )}
                                {group.approvedCount > 0 && (
                                  <span className="ml-2 text-green-600">
                                    • {group.approvedCount} approved
                                  </span>
                                )}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            {group.deposits > 0 && (
                              <div className="text-sm">
                                <span className="text-green-600 font-semibold">+£{group.deposits.toFixed(2)}</span>
                                <span className="text-slate-400 ml-1">in</span>
                              </div>
                            )}
                            {group.outgoings > 0 && (
                              <div className="text-sm">
                                <span className="text-red-600 font-semibold">-£{group.outgoings.toFixed(2)}</span>
                                <span className="text-slate-400 ml-1">out</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      {/* Client's Transactions - Expandable */}
                      {isExpanded && (
                        <CardContent className="pt-4">
                          <div className="space-y-3">
                            {group.transactions.map(txn => (
                              <div
                                key={txn.id}
                                className={`border rounded-lg p-4 ${getStatusColor(txn.status)}`}
                              >
                                <div className="flex items-start gap-4">
                                  {/* Checkbox for selection (pending and approved) */}
                                  {(txn.status === 'pending' || txn.status === 'approved') && (
                                    <input
                                      type="checkbox"
                                      className="mt-1"
                                      checked={selectedIds.has(txn.id)}
                                      onChange={() => toggleSelection(txn.id)}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  )}

                                  {/* Status Icon */}
                                  <div className="shrink-0">
                                    {getStatusIcon(txn.status)}
                                  </div>

                                  {/* Transaction Details */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-2">
                                      <div>
                                        <h3 className="font-semibold text-lg">{txn.merchant}</h3>
                                      </div>
                                      <div className="text-right">
                                        <p className={`font-bold text-lg ${
                                          txn.type === 'credit' || txn.type === 'income' || txn.type === 'sale'
                                            ? 'text-green-700'
                                            : 'text-red-700'
                                        }`}>
                                          {txn.type === 'credit' || txn.type === 'income' || txn.type === 'sale' ? '+' : '-'}£{parseFloat(txn.amount).toFixed(2)}
                                        </p>
                                        <p className="text-xs text-gray-600 capitalize">
                                          {txn.type === 'credit' || txn.type === 'income' || txn.type === 'sale' ? 'Deposit' : 'Outgoing'}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                      <div className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {new Date(txn.date).toLocaleDateString()}
                                      </div>
                                      {txn.category && (
                                        <div className="flex items-center gap-1">
                                          <Tag className="h-3 w-3" />
                                          {txn.category}
                                        </div>
                                      )}
                                      {txn.vat_amount && (
                                        <div className="flex items-center gap-1">
                                          <DollarSign className="h-3 w-3" />
                                          VAT: £{parseFloat(txn.vat_amount).toFixed(2)}
                                        </div>
                                      )}
                                      <div className="flex items-center gap-1">
                                        <FileText className="h-3 w-3" />
                                        {txn.documents.file_name}
                                      </div>
                                    </div>

                                    {txn.description && (
                                      <p className="text-sm mt-2 text-gray-700">{txn.description}</p>
                                    )}
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex gap-2 shrink-0">
                                    {txn.status === 'pending' && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="default"
                                          onClick={() => handleApprove(txn.id)}
                                          title="Approve"
                                        >
                                          <Check className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleFlag(txn.id)}
                                          title="Flag for review"
                                        >
                                          <Flag className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={() => handleReject(txn.id)}
                                          title="Reject"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}
                                    {txn.status === 'approved' && (
                                      <Button
                                        size="sm"
                                        variant="default"
                                        onClick={() => handlePostToLedger(txn.id)}
                                        className="bg-green-700 hover:bg-green-800"
                                        title="Post to General Ledger"
                                      >
                                        <BookOpen className="h-4 w-4 mr-1" />
                                        Post to Ledger
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleEdit(txn)}
                                      title="Edit transaction"
                                    >
                                      <Edit className="h-4 w-4 text-blue-500" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDelete(txn.id)}
                                      title="Delete"
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      )}
                    </Card>
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
              <DialogDescription>
                Update transaction details and category
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="merchant">Merchant *</Label>
                <Input
                  id="merchant"
                  value={editFormData.merchant}
                  onChange={(e) => setEditFormData({ ...editFormData, merchant: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  placeholder="Additional details about this transaction..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount">Amount *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={editFormData.amount}
                    onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={editFormData.category}
                    onValueChange={(value) => setEditFormData({ ...editFormData, category: value })}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEFAULT_CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                      {customCategories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat} (Custom)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Add Custom Category */}
              <div className="border-t pt-4">
                <Label className="text-sm font-medium mb-2 block">Add Custom Category</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter new category name..."
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddCategory}
                    disabled={!newCategory}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>

              {/* VAT Details */}
              <div className="border-t pt-4">
                <Label className="text-sm font-medium mb-2 block">VAT Details (Optional)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="vatAmount">VAT Amount</Label>
                    <Input
                      id="vatAmount"
                      type="number"
                      step="0.01"
                      value={editFormData.vatAmount}
                      onChange={(e) => setEditFormData({ ...editFormData, vatAmount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <Label htmlFor="vatRate">VAT Rate (%)</Label>
                    <Input
                      id="vatRate"
                      type="number"
                      step="0.01"
                      value={editFormData.vatRate}
                      onChange={(e) => setEditFormData({ ...editFormData, vatRate: e.target.value })}
                      placeholder="20"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingTransaction(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} className="bg-slate-700 hover:bg-slate-800">
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
