/**
 * Journal Entries Page
 * Create and view double-entry journal entries
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/layout/Navigation';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Plus, Trash2, Loader2, FileSpreadsheet, AlertCircle, ChevronDown, ChevronUp, User } from 'lucide-react';
import apiClient from '../lib/api';
import { toast } from 'sonner';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  normal_balance: 'debit' | 'credit';
}

interface JournalLine {
  account_id: string;
  debit_amount: string;
  credit_amount: string;
}

interface JournalEntry {
  entry_id: string;
  date: string;
  description: string;
  reference: string | null;
  client: {
    id: string;
    name: string;
  } | null;
  transaction_count: number;
  transactions: Array<{
    id: string;
    date: string;
    merchant: string;
    description: string | null;
    amount: string;
    type: string;
    category: string | null;
    client: {
      id: string;
      name: string;
    } | null;
  }>;
  lines: Array<{
    id: string;
    account_id: string;
    debit_amount: string | null;
    credit_amount: string | null;
    account: {
      code: string;
      name: string;
    };
  }>;
  total_debits: string;
  total_credits: string;
}

export default function JournalEntries() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
  });
  const [lines, setLines] = useState<JournalLine[]>([
    { account_id: '', debit_amount: '', credit_amount: '' },
    { account_id: '', debit_amount: '', credit_amount: '' },
  ]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [entriesRes, accountsRes] = await Promise.all([
        apiClient.get('/api/journal-entries'),
        apiClient.get('/api/accounts'),
      ]);
      setEntries(entriesRes.data.entries || []);
      setAccounts(accountsRes.data.accounts || []);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      toast.error(error.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  function addLine() {
    setLines([...lines, { account_id: '', debit_amount: '', credit_amount: '' }]);
  }

  function removeLine(index: number) {
    if (lines.length <= 2) {
      toast.error('At least 2 lines are required for a journal entry');
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  }

  function updateLine(index: number, field: keyof JournalLine, value: string) {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  }

  function calculateTotals() {
    const totalDebits = lines.reduce((sum, line) => {
      return sum + (parseFloat(line.debit_amount) || 0);
    }, 0);
    const totalCredits = lines.reduce((sum, line) => {
      return sum + (parseFloat(line.credit_amount) || 0);
    }, 0);
    return { totalDebits, totalCredits, balanced: Math.abs(totalDebits - totalCredits) < 0.01 };
  }

  async function handleCreateEntry() {
    try {
      const { totalDebits, totalCredits, balanced } = calculateTotals();

      if (!balanced) {
        toast.error('Entry is not balanced. Debits must equal credits.');
        return;
      }

      if (totalDebits === 0) {
        toast.error('Entry must have non-zero amounts.');
        return;
      }

      const payload = {
        date: formData.date,
        description: formData.description,
        reference: formData.reference || null,
        lines: lines.map(line => ({
          account_id: line.account_id,
          debit_amount: parseFloat(line.debit_amount) || null,
          credit_amount: parseFloat(line.credit_amount) || null,
        })),
      };

      await apiClient.post('/api/journal-entries', payload);
      toast.success('Journal entry created successfully');
      setIsCreateDialogOpen(false);
      resetForm();
      await loadData();
    } catch (error: any) {
      console.error('Failed to create entry:', error);
      toast.error(error.response?.data?.error || 'Failed to create entry');
    }
  }

  async function handleDeleteEntry(entryId: string) {
    if (!confirm('Are you sure you want to delete this journal entry?')) return;

    try {
      await apiClient.delete(`/api/journal-entries/${entryId}`);
      toast.success('Journal entry deleted successfully');
      await loadData();
    } catch (error: any) {
      console.error('Failed to delete entry:', error);
      toast.error(error.response?.data?.error || 'Failed to delete entry');
    }
  }

  async function handleDeleteClientEntries(clientName: string, entryIds: string[]) {
    if (!confirm(`Are you sure you want to delete ALL ${entryIds.length} journal entries for ${clientName}? This action cannot be undone.`)) return;

    try {
      // Delete all entries for this client
      await Promise.all(entryIds.map(id => apiClient.delete(`/api/journal-entries/${id}`)));
      toast.success(`Deleted ${entryIds.length} journal entries for ${clientName}`);
      await loadData();
    } catch (error: any) {
      console.error('Failed to delete entries:', error);
      toast.error(error.response?.data?.error || 'Failed to delete some entries');
    }
  }

  function resetForm() {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      description: '',
      reference: '',
    });
    setLines([
      { account_id: '', debit_amount: '', credit_amount: '' },
      { account_id: '', debit_amount: '', credit_amount: '' },
    ]);
  }

  const { totalDebits, totalCredits, balanced } = calculateTotals();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Journal Entries</h1>
              <p className="mt-2 text-slate-600">
                Create and manage double-entry journal entries
              </p>
            </div>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-slate-800 hover:bg-slate-700"
              disabled={accounts.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Entry
            </Button>
          </div>
        </div>

        {/* No Accounts Warning */}
        {accounts.length === 0 && (
          <Card className="mb-6 border-orange-200 bg-orange-50">
            <CardContent className="flex items-start gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <p className="font-medium text-orange-900">No chart of accounts found</p>
                <p className="text-sm text-orange-700 mt-1">
                  Please initialize your chart of accounts first before creating journal entries.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {entries.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileSpreadsheet className="h-16 w-16 text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No journal entries</h3>
              <p className="text-slate-600 mb-6 text-center max-w-md">
                Get started by creating your first journal entry. All entries must balance (debits = credits).
              </p>
              {accounts.length > 0 && (
                <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-slate-800 hover:bg-slate-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Entry
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Group entries by client */}
            {(() => {
              // Group entries by client
              const clientGroups = new Map<string, { client: any, entries: JournalEntry[] }>();

              entries.forEach(entry => {
                const clientId = entry.client?.id || 'no-client';
                const clientName = entry.client?.name || 'No Client';

                if (!clientGroups.has(clientId)) {
                  clientGroups.set(clientId, {
                    client: entry.client || { id: 'no-client', name: 'No Client' },
                    entries: []
                  });
                }
                clientGroups.get(clientId)!.entries.push(entry);
              });

              return Array.from(clientGroups.entries()).map(([clientId, group]) => {
                const isClientExpanded = expandedClients.has(clientId);

                // Calculate client totals
                let clientDebits = 0;
                let clientCredits = 0;
                let totalTransactions = 0;

                group.entries.forEach(entry => {
                  clientDebits += parseFloat(entry.total_debits);
                  clientCredits += parseFloat(entry.total_credits);
                  totalTransactions += entry.transaction_count;
                });

                const netBalance = clientDebits - clientCredits;

                return (
                  <Card key={clientId} className="border-2">
                    {/* Client Header - Always Visible */}
                    <CardHeader className="bg-slate-100 cursor-pointer hover:bg-slate-200"
                      onClick={() => {
                        const newExpanded = new Set(expandedClients);
                        if (isClientExpanded) {
                          newExpanded.delete(clientId);
                        } else {
                          newExpanded.add(clientId);
                        }
                        setExpandedClients(newExpanded);
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            {isClientExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            <User className="h-5 w-5 text-blue-600" />
                            <CardTitle className="text-xl">{group.client.name}</CardTitle>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                              {group.entries.length} journal {group.entries.length > 1 ? 'entries' : 'entry'}
                            </span>
                            {totalTransactions > 0 && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                                {totalTransactions} transaction{totalTransactions > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>

                          {/* Client Balance Summary - Always Visible */}
                          <div className="mt-3 flex gap-6 text-sm">
                            <div>
                              <span className="text-slate-600">Total Debits: </span>
                              <span className="font-bold text-green-600">£{clientDebits.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-slate-600">Total Credits: </span>
                              <span className="font-bold text-red-600">£{clientCredits.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-slate-600">Net Balance: </span>
                              <span className={`font-bold ${
                                netBalance === 0 ? 'text-slate-600' :
                                netBalance > 0 ? 'text-red-600' : 'text-green-600'
                              }`}>
                                {netBalance === 0 ? '✓ Balanced (£0.00)' :
                                 netBalance > 0 ? `£${netBalance.toFixed(2)} Debit` :
                                 `£${Math.abs(netBalance).toFixed(2)} Credit`}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Delete All Button */}
                        <Button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent expanding/collapsing
                            handleDeleteClientEntries(group.client.name, group.entries.map(e => e.entry_id));
                          }}
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Delete all journal entries for this client"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete All
                        </Button>
                      </div>
                    </CardHeader>

                    {/* Client's Journal Entries - Expandable */}
                    {isClientExpanded && (
                      <CardContent className="pt-4">
                        <div className="space-y-3">
                          {group.entries.map((entry) => {
                            const isEntryExpanded = expandedEntries.has(entry.entry_id);
                            const hasTransactions = entry.transaction_count > 0;

                            return (
                              <Card key={entry.entry_id} className="border border-slate-300">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-lg">{entry.description}</CardTitle>
                          {hasTransactions && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                              {entry.transaction_count} txn{entry.transaction_count > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <CardDescription className="flex items-center gap-2">
                          <span>{new Date(entry.date).toLocaleDateString('en-GB')}</span>
                          {entry.reference && <span>• Ref: {entry.reference}</span>}
                          {entry.client && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {entry.client.name}
                              </span>
                            </>
                          )}
                        </CardDescription>
                      </div>
                      <Button
                        onClick={() => handleDeleteEntry(entry.entry_id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Expandable Transaction Details */}
                    {hasTransactions && (
                      <div className="mb-4">
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedEntries);
                            if (isEntryExpanded) {
                              newExpanded.delete(entry.entry_id);
                            } else {
                              newExpanded.add(entry.entry_id);
                            }
                            setExpandedEntries(newExpanded);
                          }}
                          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {isEntryExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          {isEntryExpanded ? 'Hide' : 'Show'} Individual Transactions
                        </button>

                        {isEntryExpanded && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-md border border-blue-200">
                            <h4 className="text-sm font-medium text-slate-700 mb-2">Source Transactions:</h4>
                            <div className="space-y-2">
                              {entry.transactions.map((txn) => (
                                <div key={txn.id} className="flex justify-between items-start text-sm bg-white p-2 rounded border border-blue-100">
                                  <div className="flex-1">
                                    <div className="font-medium text-slate-900">{txn.merchant}</div>
                                    <div className="text-xs text-slate-600">
                                      {new Date(txn.date).toLocaleDateString('en-GB')}
                                      {txn.category && ` • ${txn.category}`}
                                      {txn.client && ` • ${txn.client.name}`}
                                    </div>
                                    {txn.description && (
                                      <div className="text-xs text-slate-500 mt-1">{txn.description}</div>
                                    )}
                                  </div>
                                  <div className={`font-mono font-medium ${txn.type === 'debit' ? 'text-red-600' : 'text-green-600'}`}>
                                    £{parseFloat(txn.amount).toFixed(2)}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 pt-2 border-t border-blue-200">
                              <div className="flex justify-between text-sm font-medium text-slate-700">
                                <span>Verification Total:</span>
                                <span className="font-mono">
                                  £{entry.transactions.reduce((sum, txn) => sum + parseFloat(txn.amount), 0).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Journal Entry Lines */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-3 text-sm font-medium text-slate-700">Account</th>
                            <th className="text-right py-2 px-3 text-sm font-medium text-slate-700">Debit</th>
                            <th className="text-right py-2 px-3 text-sm font-medium text-slate-700">Credit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.lines.map((line) => (
                            <tr key={line.id} className="border-b last:border-0">
                              <td className="py-2 px-3 text-sm">
                                <span className="font-mono text-xs text-slate-500">{line.account.code}</span>
                                {' '}
                                <span>{line.account.name}</span>
                              </td>
                              <td className="py-2 px-3 text-sm text-right font-mono">
                                {line.debit_amount ? `£${parseFloat(line.debit_amount).toFixed(2)}` : '—'}
                              </td>
                              <td className="py-2 px-3 text-sm text-right font-mono">
                                {line.credit_amount ? `£${parseFloat(line.credit_amount).toFixed(2)}` : '—'}
                              </td>
                            </tr>
                          ))}
                          <tr className="font-semibold bg-slate-50">
                            <td className="py-2 px-3 text-sm">Total</td>
                            <td className="py-2 px-3 text-sm text-right font-mono text-green-600">
                              £{parseFloat(entry.total_debits).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-sm text-right font-mono text-red-600">
                              £{parseFloat(entry.total_credits).toFixed(2)}
                            </td>
                          </tr>
                          <tr className="font-bold bg-blue-50">
                            <td className="py-2 px-3 text-sm">Net Balance</td>
                            <td colSpan={2} className={`py-2 px-3 text-sm text-right font-mono ${
                              parseFloat(entry.total_debits) > parseFloat(entry.total_credits)
                                ? 'text-red-600'
                                : parseFloat(entry.total_credits) > parseFloat(entry.total_debits)
                                ? 'text-green-600'
                                : 'text-slate-600'
                            }`}>
                              {parseFloat(entry.total_debits) === parseFloat(entry.total_credits)
                                ? '✓ Balanced (£0.00)'
                                : parseFloat(entry.total_debits) > parseFloat(entry.total_credits)
                                ? `£${(parseFloat(entry.total_debits) - parseFloat(entry.total_credits)).toFixed(2)} Debit`
                                : `£${(parseFloat(entry.total_credits) - parseFloat(entry.total_debits)).toFixed(2)} Credit`
                              }
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
});
})()}
          </div>
        )}
      </div>

      {/* Create Entry Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Journal Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Entry Details */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Record monthly rent expense"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="reference">Reference (Optional)</Label>
              <Input
                id="reference"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                placeholder="e.g., INV-001"
              />
            </div>

            {/* Journal Lines */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <Label>Journal Lines</Label>
                <Button onClick={addLine} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Line
                </Button>
              </div>

              <div className="space-y-3">
                {lines.map((line, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-6">
                      <Label className="text-xs">Account</Label>
                      <select
                        value={line.account_id}
                        onChange={(e) => updateLine(index, 'account_id', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
                      >
                        <option value="">Select account...</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Debit</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={line.debit_amount}
                        onChange={(e) => updateLine(index, 'debit_amount', e.target.value)}
                        placeholder="0.00"
                        className="text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Credit</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={line.credit_amount}
                        onChange={(e) => updateLine(index, 'credit_amount', e.target.value)}
                        placeholder="0.00"
                        className="text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <Button
                        onClick={() => removeLine(index)}
                        variant="ghost"
                        size="sm"
                        className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                        disabled={lines.length <= 2}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Balance Summary */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <div className="flex gap-8">
                  <div>
                    <p className="text-xs text-slate-500">Total Debits</p>
                    <p className="text-lg font-semibold text-green-600">£{totalDebits.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total Credits</p>
                    <p className="text-lg font-semibold text-red-600">£{totalCredits.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Difference</p>
                    <p className={`text-lg font-semibold ${balanced ? 'text-green-600' : 'text-orange-600'}`}>
                      £{Math.abs(totalDebits - totalCredits).toFixed(2)}
                    </p>
                  </div>
                </div>
                <div>
                  {balanced ? (
                    <span className="text-sm text-green-600 font-medium">✓ Balanced</span>
                  ) : (
                    <span className="text-sm text-orange-600 font-medium">⚠ Not Balanced</span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateEntry}
                className="bg-slate-800 hover:bg-slate-700"
                disabled={!balanced || totalDebits === 0}
              >
                Create Entry
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
