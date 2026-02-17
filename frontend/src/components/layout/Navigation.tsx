/**
 * Navigation Component
 * Shared navigation bar for all pages
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  LogOut,
  User,
  BookOpen,
  FileSpreadsheet,
  BarChart3,
  Landmark,
  Calculator,
  ChevronDown,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export default function Navigation() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'Clients', path: '/clients' },
    { icon: FileText, label: 'Documents', path: '/documents' },
    { icon: Receipt, label: 'Transactions', path: '/transactions' },
  ];

  const accountingItems = [
    { icon: BookOpen, label: 'Chart of Accounts', path: '/accounts' },
    { icon: FileSpreadsheet, label: 'Journal Entries', path: '/journal-entries' },
    { icon: BarChart3, label: 'Reports', path: '/reports' },
    { icon: Landmark, label: 'Bank Reconciliation', path: '/bank-reconciliation' },
  ];

  const isActive = (path: string) => location.pathname === path;

  const isAccountingActive = accountingItems.some(item => location.pathname === item.path);

  return (
    <nav className="bg-slate-800 shadow-md border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-white cursor-pointer" onClick={() => navigate('/dashboard')}>
              AI Accounting
            </h1>
          </div>

          {/* Nav Links */}
          <div className="hidden md:flex space-x-1 items-center">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? 'bg-slate-700 text-white border border-slate-600'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}

            {/* Accounting Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    isAccountingActive
                      ? 'bg-slate-700 text-white border border-slate-600'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <Calculator className="h-4 w-4" />
                  Accounting
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-white">
                {accountingItems.map((item) => (
                  <DropdownMenuItem
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className="cursor-pointer hover:bg-slate-100"
                  >
                    <item.icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* User Info & Logout */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/profile')}
              className="hidden sm:flex items-center gap-2 text-white hover:bg-slate-700/50 px-3 py-2 rounded-md transition-colors"
            >
              <User className="h-5 w-5" />
              <div className="text-sm">
                <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-slate-300">{user?.role}</p>
              </div>
            </button>
            <Button
              onClick={logout}
              variant="outline"
              size="sm"
              className="bg-white text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
