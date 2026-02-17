/**
 * Bank Reconciliation Page
 * Reconcile bank statements with accounting records
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/layout/Navigation';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Loader2, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import apiClient from '../lib/api';
import { toast } from 'sonner';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  subtype: string;
}

interface JournalEntry {
  id: string;
  entry_id: string;
  date: string;
  description: string;
  reference: string | null;
  debit_amount: string | null;
  credit_amount: string | null;
  is_reconciled: boolean;
}

interface ReconciliationSummary {
  book_balance: string;
  reconciled_balance: string;
  unreconciled_balance: string;
  total_entries: number;
  reconciled_count: number;
  unreconciled_count: number;
}

export default function BankReconciliation() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [statementBalance, setStatementBalance] = useState('');
  const [reconciling, setReconciling] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      loadEntries();
      loadSummary();
    }
  }, [selectedAccount, startDate, endDate]);

  async function loadAccounts() {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/bank-reconciliation/accounts');
      setAccounts(response.data.accounts || []);
      if (response.data.accounts?.length > 0) {
        setSelectedAccount(response.data.accounts[0].id);
      }
    } catch (error: any) {
      console.error('Failed to load accounts:', error);
      toast.error(error.response?.data?.error || 'Failed to load bank accounts');
    } finally {
      setLoading(false);
    }
  }

  async function loadEntries() {
    try {
      const response = await apiClient.get('/api/bank-reconciliation/unreconciled', {
        params: {
          accountId: selectedAccount,
          startDate,
          endDate,
        },
      });
      setEntries(response.data.entries || []);
      setSelectedEntries(new Set());
    } catch (error: any) {
      console.error('Failed to load entries:', error);
      toast.error(error.response?.data?.error || 'Failed to load unreconciled entries');
    }
  }

  async function loadSummary() {
    try {
      const response = await apiClient.get('/api/bank-reconciliation/summary', {
        params: {
          accountId: selectedAccount,
          asOfDate: endDate,
        },
      });
      setSummary(response.data.summary);
    } catch (error: any) {
      console.error('Failed to load summary:', error);
      toast.error(error.response?.data?.error || 'Failed to load reconciliation summary');
    }
  }

  function toggleEntry(entryId: string) {
    const newSelected = new Set(selectedEntries);
    if (newSelected.has(entryId)) {
      newSelected.delete(entryId);
    } else {
      newSelected.add(entryId);
    }
    setSelectedEntries(newSelected);
  }

  function toggleAll() {
    if (selectedEntries.size === entries.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(entries.map((e) => e.id)));
    }
  }

  function calculateSelectedBalance() {
    return entries
      .filter((e) => selectedEntries.has(e.id))
      .reduce((sum, entry) => {
        const debit = parseFloat(entry.debit_amount || '0');
        const credit = parseFloat(entry.credit_amount || '0');
        return sum + debit - credit;
      }, 0);
  }

  async function handleReconcile() {
    if (selectedEntries.size === 0) {
      toast.error('Please select at least one entry to reconcile');
      return;
    }

    if (!statementBalance) {
      toast.error('Please enter the statement balance');
      return;
    }

    const selectedBalance = calculateSelectedBalance();
    const statementBalanceNum = parseFloat(statementBalance);
    const difference = Math.abs(selectedBalance - statementBalanceNum);

    if (difference > 0.01) {
      const proceed = confirm(
        `Warning: Selected balance (£${selectedBalance.toFixed(2)}) does not match statement balance (£${statementBalanceNum.toFixed(2)}). ` +
        `Difference: £${difference.toFixed(2)}. Do you want to proceed anyway?`
      );
      if (!proceed) return;
    }

    try {
      setReconciling(true);
      await apiClient.post('/api/bank-reconciliation/mark-reconciled', {
        entryIds: Array.from(selectedEntries),
        reconciledDate: new Date().toISOString(),
        statementBalance: statementBalanceNum,
      });
      toast.success(`Successfully reconciled ${selectedEntries.size} entries`);
      await loadEntries();
      await loadSummary();
      setStatementBalance('');
    } catch (error: any) {
      console.error('Failed to reconcile entries:', error);
      toast.error(error.response?.data?.error || 'Failed to reconcile entries');
    } finally {
      setReconciling(false);
    }
  }

  const selectedBalance = calculateSelectedBalance();

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
          <h1 className="text-3xl font-bold text-slate-900">Bank Reconciliation</h1>
          <p className="mt-2 text-slate-600">
            Match your bank statement with accounting records
          </p>
        </div>

        {/* No Accounts Warning */}
        {accounts.length === 0 ? (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="flex items-start gap-3 py-8">
              <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <p className="font-medium text-orange-900">No bank accounts found</p>
                <p className="text-sm text-orange-700 mt-1">
                  Please create bank accounts in your chart of accounts first (accounts with "Bank" in the subtype).
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            {/* Main Reconciliation Panel */}
            <div className="col-span-2 space-y-6">
              {/* Filters */}
              <Card>
                <CardHeader>
                  <CardTitle>Reconciliation Filters</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="account">Bank Account</Label>
                      <select
                        id="account"
                        value={selectedAccount}
                        onChange={(e) => setSelectedAccount(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-800"
                      >
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="start-date">Start Date</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="end-date">End Date</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Entries List */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Unreconciled Entries</CardTitle>
                      <CardDescription>
                        {entries.length} unreconciled {entries.length === 1 ? 'entry' : 'entries'}
                      </CardDescription>
                    </div>
                    {entries.length > 0 && (
                      <Button onClick={toggleAll} variant="outline" size="sm">
                        {selectedEntries.size === entries.length ? 'Deselect All' : 'Select All'}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {entries.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                      <p>All entries are reconciled for this period</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-3 w-12"></th>
                            <th className="text-left py-3 px-3 text-sm font-medium text-slate-700">Date</th>
                            <th className="text-left py-3 px-3 text-sm font-medium text-slate-700">Description</th>
                            <th className="text-left py-3 px-3 text-sm font-medium text-slate-700">Reference</th>
                            <th className="text-right py-3 px-3 text-sm font-medium text-slate-700">Debit</th>
                            <th className="text-right py-3 px-3 text-sm font-medium text-slate-700">Credit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map((entry) => (
                            <tr
                              key={entry.id}
                              className={`border-b hover:bg-slate-50 cursor-pointer ${
                                selectedEntries.has(entry.id) ? 'bg-blue-50' : ''
                              }`}
                              onClick={() => toggleEntry(entry.id)}
                            >
                              <td className="py-3 px-3">
                                <Checkbox
                                  checked={selectedEntries.has(entry.id)}
                                  onCheckedChange={() => toggleEntry(entry.id)}
                                />
                              </td>
                              <td className="py-3 px-3 text-sm">
                                {new Date(entry.date).toLocaleDateString('en-GB')}
                              </td>
                              <td className="py-3 px-3 text-sm">{entry.description}</td>
                              <td className="py-3 px-3 text-sm text-slate-500">{entry.reference || '—'}</td>
                              <td className="py-3 px-3 text-sm text-right font-mono text-green-600">
                                {entry.debit_amount ? `£${parseFloat(entry.debit_amount).toFixed(2)}` : '—'}
                              </td>
                              <td className="py-3 px-3 text-sm text-right font-mono text-red-600">
                                {entry.credit_amount ? `£${parseFloat(entry.credit_amount).toFixed(2)}` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Reconciliation Action */}
              {entries.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Complete Reconciliation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="statement-balance">Statement Balance</Label>
                          <Input
                            id="statement-balance"
                            type="number"
                            step="0.01"
                            value={statementBalance}
                            onChange={(e) => setStatementBalance(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label>Selected Balance</Label>
                          <div className="mt-2 text-2xl font-bold font-mono">
                            £{selectedBalance.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {statementBalance && (
                        <div className="p-4 rounded-lg bg-slate-50 border">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-700">Difference:</span>
                            <span className={`text-lg font-bold font-mono ${
                              Math.abs(selectedBalance - parseFloat(statementBalance)) < 0.01
                                ? 'text-green-600'
                                : 'text-orange-600'
                            }`}>
                              £{Math.abs(selectedBalance - parseFloat(statementBalance)).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}

                      <Button
                        onClick={handleReconcile}
                        disabled={selectedEntries.size === 0 || !statementBalance || reconciling}
                        className="w-full bg-slate-800 hover:bg-slate-700"
                      >
                        {reconciling ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Reconciling...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Reconcile {selectedEntries.size} {selectedEntries.size === 1 ? 'Entry' : 'Entries'}
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Summary Sidebar */}
            <div className="col-span-1">
              <Card className="sticky top-8">
                <CardHeader>
                  <CardTitle>Reconciliation Summary</CardTitle>
                  <CardDescription>As of {new Date(endDate).toLocaleDateString('en-GB')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {summary ? (
                    <div className="space-y-4">
                      <div className="border-b pb-3">
                        <p className="text-xs text-slate-500 mb-1">Book Balance</p>
                        <p className="text-2xl font-bold font-mono">£{parseFloat(summary.book_balance).toFixed(2)}</p>
                      </div>

                      <div className="border-b pb-3">
                        <p className="text-xs text-slate-500 mb-1">Reconciled Balance</p>
                        <p className="text-lg font-semibold font-mono text-green-600">
                          £{parseFloat(summary.reconciled_balance).toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {summary.reconciled_count} {summary.reconciled_count === 1 ? 'entry' : 'entries'}
                        </p>
                      </div>

                      <div className="border-b pb-3">
                        <p className="text-xs text-slate-500 mb-1">Unreconciled Balance</p>
                        <p className="text-lg font-semibold font-mono text-orange-600">
                          £{parseFloat(summary.unreconciled_balance).toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {summary.unreconciled_count} {summary.unreconciled_count === 1 ? 'entry' : 'entries'}
                        </p>
                      </div>

                      <div className="pt-2">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-slate-500">Reconciliation Progress</span>
                          <span className="text-xs font-medium">
                            {summary.total_entries > 0
                              ? Math.round((summary.reconciled_count / summary.total_entries) * 100)
                              : 0}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full transition-all"
                            style={{
                              width: summary.total_entries > 0
                                ? `${(summary.reconciled_count / summary.total_entries) * 100}%`
                                : '0%',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
