/**
 * Chart of Accounts Page
 * Manage organization's chart of accounts
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/layout/Navigation';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Plus, Edit, CheckCircle, XCircle, Loader2, BookOpen } from 'lucide-react';
import apiClient from '../lib/api';
import { toast } from 'sonner';

interface Account {
  id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  subtype: string;
  normal_balance: 'debit' | 'credit';
  is_active: boolean;
  is_default: boolean;
  balance?: string;
}

export default function Accounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'expense' as Account['type'],
    subtype: '',
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/accounts');
      setAccounts(response.data.accounts || []);
    } catch (error: any) {
      console.error('Failed to load accounts:', error);
      toast.error(error.response?.data?.error || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }

  async function handleInitialize() {
    try {
      setInitializing(true);
      await apiClient.post('/api/accounts/initialize');
      toast.success('Chart of accounts initialized successfully');
      await loadAccounts();
    } catch (error: any) {
      console.error('Failed to initialize accounts:', error);
      toast.error(error.response?.data?.error || 'Failed to initialize accounts');
    } finally {
      setInitializing(false);
    }
  }

  async function handleAddAccount() {
    try {
      await apiClient.post('/api/accounts', formData);
      toast.success('Account created successfully');
      setIsAddDialogOpen(false);
      setFormData({ code: '', name: '', type: 'expense', subtype: '' });
      await loadAccounts();
    } catch (error: any) {
      console.error('Failed to create account:', error);
      toast.error(error.response?.data?.error || 'Failed to create account');
    }
  }

  async function handleEditAccount() {
    if (!editingAccount) return;

    try {
      await apiClient.put(`/api/accounts/${editingAccount.id}`, {
        name: formData.name,
        subtype: formData.subtype,
      });
      toast.success('Account updated successfully');
      setIsEditDialogOpen(false);
      setEditingAccount(null);
      setFormData({ code: '', name: '', type: 'expense', subtype: '' });
      await loadAccounts();
    } catch (error: any) {
      console.error('Failed to update account:', error);
      toast.error(error.response?.data?.error || 'Failed to update account');
    }
  }

  function openEditDialog(account: Account) {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      type: account.type,
      subtype: account.subtype,
    });
    setIsEditDialogOpen(true);
  }

  // Group accounts by type
  const groupedAccounts = accounts.reduce((acc, account) => {
    if (!acc[account.type]) {
      acc[account.type] = [];
    }
    acc[account.type].push(account);
    return acc;
  }, {} as Record<string, Account[]>);

  const accountTypes = [
    { key: 'asset', label: 'Assets', color: 'text-green-600' },
    { key: 'liability', label: 'Liabilities', color: 'text-red-600' },
    { key: 'equity', label: 'Equity', color: 'text-blue-600' },
    { key: 'income', label: 'Income', color: 'text-emerald-600' },
    { key: 'expense', label: 'Expenses', color: 'text-orange-600' },
  ];

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
              <h1 className="text-3xl font-bold text-slate-900">Chart of Accounts</h1>
              <p className="mt-2 text-slate-600">
                Manage your organization's chart of accounts
              </p>
            </div>
            <div className="flex gap-3">
              {accounts.length === 0 && (
                <Button onClick={handleInitialize} disabled={initializing} className="bg-slate-800 hover:bg-slate-700">
                  {initializing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Initializing...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Initialize Default Accounts
                    </>
                  )}
                </Button>
              )}
              <Button onClick={() => setIsAddDialogOpen(true)} className="bg-slate-800 hover:bg-slate-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {accounts.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <BookOpen className="h-16 w-16 text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No accounts found</h3>
              <p className="text-slate-600 mb-6 text-center max-w-md">
                Get started by initializing the default UK chart of accounts, or create your own custom accounts.
              </p>
              <Button onClick={handleInitialize} disabled={initializing} className="bg-slate-800 hover:bg-slate-700">
                {initializing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Initialize Default Accounts
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Accounts List */}
        {accounts.length > 0 && (
          <div className="space-y-6">
            {accountTypes.map(({ key, label, color }) => {
              const typeAccounts = groupedAccounts[key] || [];
              if (typeAccounts.length === 0) return null;

              return (
                <Card key={key}>
                  <CardHeader>
                    <CardTitle className={color}>{label}</CardTitle>
                    <CardDescription>{typeAccounts.length} accounts</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-700">Code</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-700">Name</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-700">Subtype</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-700">Normal Balance</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-700">Status</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-slate-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {typeAccounts.map((account) => (
                            <tr key={account.id} className="border-b last:border-0 hover:bg-slate-50">
                              <td className="py-3 px-4 text-sm font-mono">{account.code}</td>
                              <td className="py-3 px-4 text-sm font-medium">{account.name}</td>
                              <td className="py-3 px-4 text-sm text-slate-600">{account.subtype}</td>
                              <td className="py-3 px-4 text-sm">
                                <span className={`capitalize ${account.normal_balance === 'debit' ? 'text-green-600' : 'text-red-600'}`}>
                                  {account.normal_balance}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-sm">
                                {account.is_active ? (
                                  <span className="inline-flex items-center gap-1 text-green-600">
                                    <CheckCircle className="h-4 w-4" />
                                    Active
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-slate-400">
                                    <XCircle className="h-4 w-4" />
                                    Inactive
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <Button
                                  onClick={() => openEditDialog(account)}
                                  variant="ghost"
                                  size="sm"
                                  className="hover:bg-slate-100"
                                >
                                  <Edit className="h-4 w-4 text-slate-600" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Account Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="code">Account Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g., 8000"
              />
            </div>
            <div>
              <Label htmlFor="name">Account Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Marketing Expenses"
              />
            </div>
            <div>
              <Label htmlFor="type">Account Type</Label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as Account['type'] })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-800"
              >
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="equity">Equity</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div>
              <Label htmlFor="subtype">Subtype</Label>
              <Input
                id="subtype"
                value={formData.subtype}
                onChange={(e) => setFormData({ ...formData, subtype: e.target.value })}
                placeholder="e.g., Administrative"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddAccount} className="bg-slate-800 hover:bg-slate-700">
                Create Account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-code">Account Code</Label>
              <Input
                id="edit-code"
                value={formData.code}
                disabled
                className="bg-slate-100"
              />
              <p className="text-xs text-slate-500 mt-1">Code cannot be changed</p>
            </div>
            <div>
              <Label htmlFor="edit-name">Account Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-subtype">Subtype</Label>
              <Input
                id="edit-subtype"
                value={formData.subtype}
                onChange={(e) => setFormData({ ...formData, subtype: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditAccount} className="bg-slate-800 hover:bg-slate-700">
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
