/**
 * Financial Reports Page
 * View Trial Balance, P&L, and Balance Sheet
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/layout/Navigation';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Loader2, Download, Calendar } from 'lucide-react';
import apiClient from '../lib/api';
import { toast } from 'sonner';

interface Client {
  id: string;
  name: string;
}

interface TrialBalanceAccount {
  code: string;
  name: string;
  type: string;
  debit_balance: string;
  credit_balance: string;
}

interface TrialBalance {
  report_type: string;
  as_of_date: string;
  accounts: TrialBalanceAccount[];
  totals: {
    total_debits: string;
    total_credits: string;
    in_balance: boolean;
  };
}

interface PLAccount {
  code: string;
  name: string;
  subtype: string;
  amount: string;
}

interface ProfitLoss {
  report_type: string;
  period: {
    start_date: string;
    end_date: string;
  };
  income: {
    accounts: PLAccount[];
    total: string;
  };
  expenses: {
    accounts: PLAccount[];
    total: string;
  };
  net_profit: string;
}

interface BSAccount {
  code: string;
  name: string;
  subtype: string;
  amount: string;
}

interface BalanceSheet {
  report_type: string;
  as_of_date: string;
  assets: {
    accounts: BSAccount[];
    total: string;
  };
  liabilities: {
    accounts: BSAccount[];
    total: string;
  };
  equity: {
    accounts: BSAccount[];
    total: string;
  };
  totals: {
    total_assets: string;
    total_liabilities_and_equity: string;
    in_balance: boolean;
  };
}

export default function Reports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null);
  const [profitLoss, setProfitLoss] = useState<ProfitLoss | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);

  // Client filters
  const [selectedClientTB, setSelectedClientTB] = useState<string>('all');
  const [selectedClientPL, setSelectedClientPL] = useState<string>('all');
  const [selectedClientBS, setSelectedClientBS] = useState<string>('all');

  // Trial Balance params
  const [tbDate, setTbDate] = useState(new Date().toISOString().split('T')[0]);

  // P&L params
  const [plStartDate, setPlStartDate] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  );
  const [plEndDate, setPlEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Balance Sheet params
  const [bsDate, setBsDate] = useState(new Date().toISOString().split('T')[0]);

  // Fetch clients on mount
  useEffect(() => {
    async function fetchClients() {
      try {
        const response = await apiClient.get('/api/clients');
        setClients(response.data.clients);
      } catch (error) {
        console.error('Failed to fetch clients:', error);
      }
    }
    fetchClients();
  }, []);

  async function loadTrialBalance() {
    try {
      setLoading(true);
      const params: any = { asOfDate: tbDate };
      if (selectedClientTB !== 'all') {
        params.clientId = selectedClientTB;
      }
      const response = await apiClient.get('/api/reports/trial-balance', { params });
      setTrialBalance(response.data);
    } catch (error: any) {
      console.error('Failed to load trial balance:', error);
      toast.error(error.response?.data?.error || 'Failed to load trial balance');
    } finally {
      setLoading(false);
    }
  }

  async function loadProfitLoss() {
    try {
      setLoading(true);
      const params: any = { startDate: plStartDate, endDate: plEndDate };
      if (selectedClientPL !== 'all') {
        params.clientId = selectedClientPL;
      }
      const response = await apiClient.get('/api/reports/profit-loss', { params });
      setProfitLoss(response.data);
    } catch (error: any) {
      console.error('Failed to load P&L:', error);
      toast.error(error.response?.data?.error || 'Failed to load profit & loss statement');
    } finally {
      setLoading(false);
    }
  }

  async function loadBalanceSheet() {
    try {
      setLoading(true);
      const params: any = { asOfDate: bsDate };
      if (selectedClientBS !== 'all') {
        params.clientId = selectedClientBS;
      }
      const response = await apiClient.get('/api/reports/balance-sheet', { params });
      setBalanceSheet(response.data);
    } catch (error: any) {
      console.error('Failed to load balance sheet:', error);
      toast.error(error.response?.data?.error || 'Failed to load balance sheet');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Financial Reports</h1>
          <p className="mt-2 text-slate-600">
            View comprehensive financial reports for your organization
          </p>
        </div>

        {/* Reports Tabs */}
        <Tabs defaultValue="trial-balance" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
            <TabsTrigger value="profit-loss">Profit & Loss</TabsTrigger>
            <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
          </TabsList>

          {/* Trial Balance Tab */}
          <TabsContent value="trial-balance">
            <Card>
              <CardHeader>
                <CardTitle>Trial Balance</CardTitle>
                <CardDescription>
                  Verify that total debits equal total credits across all accounts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Parameters */}
                  <div className="flex gap-4 items-end">
                    <div className="flex-1 max-w-xs">
                      <Label htmlFor="tb-client">Client</Label>
                      <Select value={selectedClientTB} onValueChange={setSelectedClientTB}>
                        <SelectTrigger id="tb-client">
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Clients (Consolidated)</SelectItem>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 max-w-xs">
                      <Label htmlFor="tb-date">As of Date</Label>
                      <Input
                        id="tb-date"
                        type="date"
                        value={tbDate}
                        onChange={(e) => setTbDate(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={loadTrialBalance}
                      disabled={loading}
                      className="bg-slate-800 hover:bg-slate-700"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <Calendar className="h-4 w-4 mr-2" />
                          Generate Report
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Report */}
                  {trialBalance && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-slate-50 px-6 py-4 border-b">
                        <h3 className="text-lg font-semibold">{trialBalance.report_type}</h3>
                        <p className="text-sm text-slate-600">
                          As of {new Date(trialBalance.as_of_date).toLocaleDateString('en-GB')}
                        </p>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b bg-slate-50">
                              <th className="text-left py-3 px-4 text-sm font-medium text-slate-700">Code</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-slate-700">Account</th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-slate-700">Type</th>
                              <th className="text-right py-3 px-4 text-sm font-medium text-slate-700">Debit</th>
                              <th className="text-right py-3 px-4 text-sm font-medium text-slate-700">Credit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {trialBalance.accounts.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="text-center py-8 text-slate-500">
                                  No account balances found for this period
                                </td>
                              </tr>
                            ) : (
                              trialBalance.accounts.map((account) => (
                                <tr key={account.code} className="border-b hover:bg-slate-50">
                                  <td className="py-3 px-4 text-sm font-mono">{account.code}</td>
                                  <td className="py-3 px-4 text-sm">{account.name}</td>
                                  <td className="py-3 px-4 text-sm capitalize">{account.type}</td>
                                  <td className="py-3 px-4 text-sm text-right font-mono text-green-600">
                                    {parseFloat(account.debit_balance) > 0
                                      ? `£${parseFloat(account.debit_balance).toFixed(2)}`
                                      : '—'}
                                  </td>
                                  <td className="py-3 px-4 text-sm text-right font-mono text-red-600">
                                    {parseFloat(account.credit_balance) > 0
                                      ? `£${parseFloat(account.credit_balance).toFixed(2)}`
                                      : '—'}
                                  </td>
                                </tr>
                              ))
                            )}
                            {trialBalance.accounts.length > 0 && (
                              <tr className="font-semibold bg-slate-100 border-t-2">
                                <td colSpan={3} className="py-3 px-4 text-sm">Total</td>
                                <td className="py-3 px-4 text-sm text-right font-mono text-green-700">
                                  £{parseFloat(trialBalance.totals.total_debits).toFixed(2)}
                                </td>
                                <td className="py-3 px-4 text-sm text-right font-mono text-red-700">
                                  £{parseFloat(trialBalance.totals.total_credits).toFixed(2)}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {trialBalance.accounts.length > 0 && (
                        <div className="px-6 py-4 bg-slate-50 border-t">
                          <p className={`text-sm font-medium ${trialBalance.totals.in_balance ? 'text-green-600' : 'text-red-600'}`}>
                            {trialBalance.totals.in_balance ? '✓ In Balance' : '⚠ Out of Balance'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profit & Loss Tab */}
          <TabsContent value="profit-loss">
            <Card>
              <CardHeader>
                <CardTitle>Profit & Loss Statement</CardTitle>
                <CardDescription>
                  Summary of income and expenses over a period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Parameters */}
                  <div className="flex gap-4 items-end">
                    <div className="flex-1 max-w-xs">
                      <Label htmlFor="pl-client">Client</Label>
                      <Select value={selectedClientPL} onValueChange={setSelectedClientPL}>
                        <SelectTrigger id="pl-client">
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Clients (Consolidated)</SelectItem>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 max-w-xs">
                      <Label htmlFor="pl-start">Start Date</Label>
                      <Input
                        id="pl-start"
                        type="date"
                        value={plStartDate}
                        onChange={(e) => setPlStartDate(e.target.value)}
                      />
                    </div>
                    <div className="flex-1 max-w-xs">
                      <Label htmlFor="pl-end">End Date</Label>
                      <Input
                        id="pl-end"
                        type="date"
                        value={plEndDate}
                        onChange={(e) => setPlEndDate(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={loadProfitLoss}
                      disabled={loading}
                      className="bg-slate-800 hover:bg-slate-700"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <Calendar className="h-4 w-4 mr-2" />
                          Generate Report
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Report */}
                  {profitLoss && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-slate-50 px-6 py-4 border-b">
                        <h3 className="text-lg font-semibold">{profitLoss.report_type}</h3>
                        <p className="text-sm text-slate-600">
                          {new Date(profitLoss.period.start_date).toLocaleDateString('en-GB')} to{' '}
                          {new Date(profitLoss.period.end_date).toLocaleDateString('en-GB')}
                        </p>
                      </div>

                      <div className="p-6 space-y-6">
                        {/* Income Section */}
                        <div>
                          <h4 className="font-semibold text-slate-900 mb-3">Income</h4>
                          {profitLoss.income.accounts.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">No income accounts</p>
                          ) : (
                            <div className="space-y-1">
                              {profitLoss.income.accounts.map((account) => (
                                <div key={account.code} className="flex justify-between py-1">
                                  <span className="text-sm">
                                    <span className="font-mono text-xs text-slate-500">{account.code}</span>
                                    {' '}{account.name}
                                  </span>
                                  <span className="text-sm font-mono text-green-600">
                                    £{parseFloat(account.amount).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                              <div className="flex justify-between py-2 border-t font-semibold">
                                <span className="text-sm">Total Income</span>
                                <span className="text-sm font-mono text-green-700">
                                  £{parseFloat(profitLoss.income.total).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Expenses Section */}
                        <div>
                          <h4 className="font-semibold text-slate-900 mb-3">Expenses</h4>
                          {profitLoss.expenses.accounts.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">No expense accounts</p>
                          ) : (
                            <div className="space-y-1">
                              {profitLoss.expenses.accounts.map((account) => (
                                <div key={account.code} className="flex justify-between py-1">
                                  <span className="text-sm">
                                    <span className="font-mono text-xs text-slate-500">{account.code}</span>
                                    {' '}{account.name}
                                  </span>
                                  <span className="text-sm font-mono text-red-600">
                                    £{parseFloat(account.amount).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                              <div className="flex justify-between py-2 border-t font-semibold">
                                <span className="text-sm">Total Expenses</span>
                                <span className="text-sm font-mono text-red-700">
                                  £{parseFloat(profitLoss.expenses.total).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Net Profit */}
                        <div className="border-t-2 pt-4">
                          <div className="flex justify-between items-center">
                            <span className="text-lg font-bold">Net Profit</span>
                            <span className={`text-lg font-bold font-mono ${
                              parseFloat(profitLoss.net_profit) >= 0 ? 'text-green-700' : 'text-red-700'
                            }`}>
                              £{parseFloat(profitLoss.net_profit).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Balance Sheet Tab */}
          <TabsContent value="balance-sheet">
            <Card>
              <CardHeader>
                <CardTitle>Balance Sheet</CardTitle>
                <CardDescription>
                  Financial position showing assets, liabilities, and equity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Parameters */}
                  <div className="flex gap-4 items-end">
                    <div className="flex-1 max-w-xs">
                      <Label htmlFor="bs-client">Client</Label>
                      <Select value={selectedClientBS} onValueChange={setSelectedClientBS}>
                        <SelectTrigger id="bs-client">
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Clients (Consolidated)</SelectItem>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 max-w-xs">
                      <Label htmlFor="bs-date">As of Date</Label>
                      <Input
                        id="bs-date"
                        type="date"
                        value={bsDate}
                        onChange={(e) => setBsDate(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={loadBalanceSheet}
                      disabled={loading}
                      className="bg-slate-800 hover:bg-slate-700"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <Calendar className="h-4 w-4 mr-2" />
                          Generate Report
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Report */}
                  {balanceSheet && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-slate-50 px-6 py-4 border-b">
                        <h3 className="text-lg font-semibold">{balanceSheet.report_type}</h3>
                        <p className="text-sm text-slate-600">
                          As of {new Date(balanceSheet.as_of_date).toLocaleDateString('en-GB')}
                        </p>
                      </div>

                      <div className="p-6 space-y-6">
                        {/* Assets */}
                        <div>
                          <h4 className="font-semibold text-slate-900 mb-3 text-green-700">Assets</h4>
                          {balanceSheet.assets.accounts.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">No asset accounts</p>
                          ) : (
                            <div className="space-y-1">
                              {balanceSheet.assets.accounts.map((account) => (
                                <div key={account.code} className="flex justify-between py-1">
                                  <span className="text-sm">
                                    <span className="font-mono text-xs text-slate-500">{account.code}</span>
                                    {' '}{account.name}
                                  </span>
                                  <span className="text-sm font-mono">
                                    £{parseFloat(account.amount).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                              <div className="flex justify-between py-2 border-t font-semibold">
                                <span className="text-sm">Total Assets</span>
                                <span className="text-sm font-mono text-green-700">
                                  £{parseFloat(balanceSheet.assets.total).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Liabilities */}
                        <div>
                          <h4 className="font-semibold text-slate-900 mb-3 text-red-700">Liabilities</h4>
                          {balanceSheet.liabilities.accounts.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">No liability accounts</p>
                          ) : (
                            <div className="space-y-1">
                              {balanceSheet.liabilities.accounts.map((account) => (
                                <div key={account.code} className="flex justify-between py-1">
                                  <span className="text-sm">
                                    <span className="font-mono text-xs text-slate-500">{account.code}</span>
                                    {' '}{account.name}
                                  </span>
                                  <span className="text-sm font-mono">
                                    £{parseFloat(account.amount).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                              <div className="flex justify-between py-2 border-t font-semibold">
                                <span className="text-sm">Total Liabilities</span>
                                <span className="text-sm font-mono text-red-700">
                                  £{parseFloat(balanceSheet.liabilities.total).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Equity */}
                        <div>
                          <h4 className="font-semibold text-slate-900 mb-3 text-blue-700">Equity</h4>
                          {balanceSheet.equity.accounts.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">No equity accounts</p>
                          ) : (
                            <div className="space-y-1">
                              {balanceSheet.equity.accounts.map((account) => (
                                <div key={account.code} className="flex justify-between py-1">
                                  <span className="text-sm">
                                    <span className="font-mono text-xs text-slate-500">{account.code}</span>
                                    {' '}{account.name}
                                  </span>
                                  <span className="text-sm font-mono">
                                    £{parseFloat(account.amount).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                              <div className="flex justify-between py-2 border-t font-semibold">
                                <span className="text-sm">Total Equity</span>
                                <span className="text-sm font-mono text-blue-700">
                                  £{parseFloat(balanceSheet.equity.total).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Accounting Equation */}
                        <div className="border-t-2 pt-4 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-lg font-bold">Total Liabilities & Equity</span>
                            <span className="text-lg font-bold font-mono">
                              £{parseFloat(balanceSheet.totals.total_liabilities_and_equity).toFixed(2)}
                            </span>
                          </div>
                          <div className={`text-sm font-medium ${balanceSheet.totals.in_balance ? 'text-green-600' : 'text-red-600'}`}>
                            {balanceSheet.totals.in_balance ? '✓ Balance Sheet Balances' : '⚠ Balance Sheet Does Not Balance'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
