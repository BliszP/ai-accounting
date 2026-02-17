/**
 * Dashboard Page
 *
 * Main dashboard view with navigation and statistics
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../lib/api';
import Navigation from '../components/layout/Navigation';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/card';
import {
  Users,
  FileText,
  Receipt,
  Upload,
  FileCheck,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface DashboardStats {
  clientCount: number;
  documentCount: number;
  transactionCount: number;
  pendingCount: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    clientCount: 0,
    documentCount: 0,
    transactionCount: 0,
    pendingCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      setLoading(true);

      // Fetch clients count
      const clientsResponse = await apiClient.get('/api/clients');
      const clientCount = clientsResponse.data.clients?.length || 0;

      // Fetch documents count
      const documentsResponse = await apiClient.get('/api/documents');
      const documentCount = documentsResponse.data.documents?.length || 0;

      // Fetch transaction stats
      const transactionsResponse = await apiClient.get('/api/transactions');
      const allTransactions = transactionsResponse.data.transactions || [];
      const transactionCount = allTransactions.length;
      const pendingCount = allTransactions.filter((t: any) => t.status === 'pending').length;

      setStats({
        clientCount,
        documentCount,
        transactionCount,
        pendingCount,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.firstName}!
          </h2>
          <p className="text-gray-600 mt-2">
            Here's what's happening with your accounting today.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="border-none shadow-lg bg-white/80 backdrop-blur hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Clients</CardTitle>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {loading ? '...' : stats.clientCount}
              </div>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3 text-green-500" />
                Active clients
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-white/80 backdrop-blur hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Documents</CardTitle>
              <div className="p-2 bg-green-100 rounded-lg">
                <FileText className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {loading ? '...' : stats.documentCount}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Uploaded documents
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-white/80 backdrop-blur hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Transactions</CardTitle>
              <div className="p-2 bg-purple-100 rounded-lg">
                <Receipt className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {loading ? '...' : stats.transactionCount}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Processed
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-white/80 backdrop-blur hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending Review</CardTitle>
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertCircle className="h-4 w-4 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {loading ? '...' : stats.pendingCount}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Awaiting approval
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          <Card
            className="border border-slate-200 shadow-md bg-white cursor-pointer hover:shadow-lg hover:border-slate-300 transition-all group"
            onClick={() => navigate('/clients')}
          >
            <CardHeader>
              <div className="p-3 bg-slate-100 rounded-lg w-fit group-hover:bg-slate-200 transition-colors">
                <Users className="h-8 w-8 text-slate-700" />
              </div>
              <CardTitle className="text-slate-900 mt-4">Manage Clients</CardTitle>
              <CardDescription className="text-slate-600">
                Add, edit, or view your client list
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full border-slate-300 text-slate-700 hover:bg-slate-50"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/clients');
                }}
              >
                Go to Clients
              </Button>
            </CardContent>
          </Card>

          <Card
            className="border border-emerald-200 shadow-md bg-white cursor-pointer hover:shadow-lg hover:border-emerald-300 transition-all group"
            onClick={() => navigate('/documents')}
          >
            <CardHeader>
              <div className="p-3 bg-emerald-100 rounded-lg w-fit group-hover:bg-emerald-200 transition-colors">
                <Upload className="h-8 w-8 text-emerald-700" />
              </div>
              <CardTitle className="text-slate-900 mt-4">Upload Documents</CardTitle>
              <CardDescription className="text-slate-600">
                Upload bank statements, receipts, and invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/documents');
                }}
              >
                Go to Documents
              </Button>
            </CardContent>
          </Card>

          <Card
            className="border border-indigo-200 shadow-md bg-white cursor-pointer hover:shadow-lg hover:border-indigo-300 transition-all group"
            onClick={() => navigate('/transactions')}
          >
            <CardHeader>
              <div className="p-3 bg-indigo-100 rounded-lg w-fit group-hover:bg-indigo-200 transition-colors">
                <FileCheck className="h-8 w-8 text-indigo-700" />
              </div>
              <CardTitle className="text-slate-900 mt-4">Review Transactions</CardTitle>
              <CardDescription className="text-slate-600">
                Review and approve extracted transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/transactions');
                }}
              >
                Go to Transactions
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Getting Started Guide */}
        {stats.clientCount === 0 && !loading && (
          <Card className="border-none shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-l-blue-500">
            <CardHeader>
              <CardTitle className="text-blue-900">Getting Started</CardTitle>
              <CardDescription className="text-blue-700">
                Follow these steps to start using AI Accounting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shrink-0 shadow-md">
                  1
                </div>
                <div>
                  <p className="font-medium text-blue-900">Add your first client</p>
                  <p className="text-sm text-blue-700">
                    Start by adding a client to organize your accounting work
                  </p>
                  <Button
                    size="sm"
                    className="mt-2 bg-blue-600 hover:bg-blue-700"
                    onClick={() => navigate('/clients')}
                  >
                    Add Client Now
                  </Button>
                </div>
              </div>
              <div className="flex items-start gap-3 opacity-60">
                <div className="bg-gray-300 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shrink-0">
                  2
                </div>
                <div>
                  <p className="font-medium text-gray-600">Upload documents</p>
                  <p className="text-sm text-gray-500">
                    Upload bank statements or receipts for processing
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 opacity-60">
                <div className="bg-gray-300 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shrink-0">
                  3
                </div>
                <div>
                  <p className="font-medium text-gray-600">Review transactions</p>
                  <p className="text-sm text-gray-500">
                    AI will extract and categorize transactions for your review
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
