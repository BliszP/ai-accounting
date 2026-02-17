/**
 * Clients Page
 *
 * Displays list of clients with CRUD operations
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Client, ClientFormData } from '../types';
import apiClient from '../lib/api';
import Navigation from '../components/layout/Navigation';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { PlusCircle, Edit, Trash2, Building2, Mail } from 'lucide-react';

export default function Clients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<ClientFormData>({
    name: '',
    contactEmail: '',
    vatNumber: '',
    companyNumber: '',
    financialYearStart: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/api/clients');
      setClients(response.data.clients);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load clients');
      console.error('Failed to fetch clients:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleCreate() {
    setEditingClient(null);
    setFormData({
      name: '',
      contactEmail: '',
      vatNumber: '',
      companyNumber: '',
      financialYearStart: '',
    });
    setFormError(null);
    setIsDialogOpen(true);
  }

  function handleEdit(client: Client) {
    setEditingClient(client);
    setFormData({
      name: client.name,
      contactEmail: client.contact_email || '',
      vatNumber: client.vat_number || '',
      companyNumber: client.company_number || '',
      financialYearStart: client.financial_year_start || '',
    });
    setFormError(null);
    setIsDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      if (editingClient) {
        // Update existing client
        const response = await apiClient.put(`/api/clients/${editingClient.id}`, formData);
        setClients(clients.map(c => c.id === editingClient.id ? response.data.client : c));
      } else {
        // Create new client
        const response = await apiClient.post('/api/clients', formData);
        setClients([response.data.client, ...clients]);
      }
      setIsDialogOpen(false);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save client');
      console.error('Failed to save client:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(client: Client) {
    if (!confirm(`Are you sure you want to delete ${client.name}?`)) {
      return;
    }

    try {
      await apiClient.delete(`/api/clients/${client.id}`);
      setClients(clients.filter(c => c.id !== client.id));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete client');
      console.error('Failed to delete client:', err);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600">Loading clients...</div>
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
            Clients
          </h1>
          <Button onClick={handleCreate} className="bg-slate-700 hover:bg-slate-800 text-white">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {clients.length === 0 ? (
          <Card className="border border-slate-200 shadow-md bg-white">
            <CardContent className="pt-6 text-center">
              <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No clients yet</h3>
              <p className="text-gray-600 mb-4">Get started by adding your first client.</p>
              <Button onClick={handleCreate} className="bg-slate-700 hover:bg-slate-800 text-white">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Your First Client
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clients.map((client) => (
              <Card key={client.id} className="border border-slate-200 shadow-md bg-white hover:shadow-lg hover:border-slate-300 transition-all">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{client.name}</CardTitle>
                      <CardDescription>
                        {client.company_number && `Company: ${client.company_number}`}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(client)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(client)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {client.contact_email && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail className="h-4 w-4" />
                        {client.contact_email}
                      </div>
                    )}
                    {client.vat_number && (
                      <div className="text-gray-600">
                        VAT: {client.vat_number}
                      </div>
                    )}
                    {client.company_number && (
                      <div className="text-gray-600">
                        Company: {client.company_number}
                      </div>
                    )}
                    <div className="pt-2 mt-2 border-t text-xs text-gray-500">
                      Status: {client.status}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Edit Client' : 'Create New Client'}</DialogTitle>
            <DialogDescription>
              {editingClient ? 'Update client information' : 'Add a new client to your organization'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Client Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="ABC Company Ltd"
                />
              </div>

              <div>
                <Label htmlFor="contactEmail">Email (optional)</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  placeholder="contact@company.com"
                />
              </div>

              <div>
                <Label htmlFor="vatNumber">VAT Number (optional)</Label>
                <Input
                  id="vatNumber"
                  value={formData.vatNumber}
                  onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
                  placeholder="GB123456789"
                />
              </div>

              <div>
                <Label htmlFor="companyNumber">Company Number (optional)</Label>
                <Input
                  id="companyNumber"
                  value={formData.companyNumber}
                  onChange={(e) => setFormData({ ...formData, companyNumber: e.target.value })}
                  placeholder="12345678"
                />
              </div>

              <div>
                <Label htmlFor="financialYearStart">Financial Year Start (optional)</Label>
                <Input
                  id="financialYearStart"
                  type="date"
                  value={formData.financialYearStart}
                  onChange={(e) => setFormData({ ...formData, financialYearStart: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : editingClient ? 'Update Client' : 'Create Client'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
