// frontend/src/App.tsx
// COMPLETE NAVIGATION SETUP - ALL SCREENS CONNECTED

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Auth screens
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import ForgotPassword from './pages/auth/ForgotPassword'

// Main layout
import MainLayout from './components/layout/MainLayout'

// Main screens
import Dashboard from './pages/Dashboard'
import DocumentsList from './pages/documents/DocumentsList'
import DocumentDetail from './pages/documents/DocumentDetail'
import DocumentUpload from './pages/documents/DocumentUpload'
import ClientsList from './pages/clients/ClientsList'
import ClientDetail from './pages/clients/ClientDetail'
import ClientForm from './pages/clients/ClientForm'
import ReviewQueue from './pages/ReviewQueue'
import Reports from './pages/reports/Reports'
import IncomeStatement from './pages/reports/IncomeStatement'
import BalanceSheet from './pages/reports/BalanceSheet'
import TrialBalance from './pages/reports/TrialBalance'
import CashFlow from './pages/reports/CashFlow'
import VATReturn from './pages/reports/VATReturn'
import Comparison from './pages/reports/Comparison'
import Export from './pages/Export'
import Settings from './pages/settings/Settings'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC ROUTES (No login required) */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* PROTECTED ROUTES (Login required) */}
        <Route element={<MainLayout />}>
          {/* Dashboard - Default after login */}
          <Route path="/dashboard" element={<Dashboard />} />
          
          {/* Documents */}
          <Route path="/documents" element={<DocumentsList />} />
          <Route path="/documents/upload" element={<DocumentUpload />} />
          <Route path="/documents/:id" element={<DocumentDetail />} />
          
          {/* Clients */}
          <Route path="/clients" element={<ClientsList />} />
          <Route path="/clients/new" element={<ClientForm />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/clients/:id/edit" element={<ClientForm />} />
          
          {/* Review Queue */}
          <Route path="/review" element={<ReviewQueue />} />
          
          {/* Reports */}
          <Route path="/reports" element={<Reports />} />
          <Route path="/reports/income-statement" element={<IncomeStatement />} />
          <Route path="/reports/balance-sheet" element={<BalanceSheet />} />
          <Route path="/reports/trial-balance" element={<TrialBalance />} />
          <Route path="/reports/cash-flow" element={<CashFlow />} />
          <Route path="/reports/vat-return" element={<VATReturn />} />
          <Route path="/reports/comparison" element={<Comparison />} />
          
          {/* Export */}
          <Route path="/export" element={<Export />} />
          
          {/* Settings */}
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/:section" element={<Settings />} />
        </Route>

        {/* DEFAULT ROUTES */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App


// ===================================================================
// NAVIGATION HELPER - USE IN ANY COMPONENT
// ===================================================================

// Example usage in ANY component:
/*
import { useNavigate } from 'react-router-dom'

function MyComponent() {
  const navigate = useNavigate()
  
  // Go to different screens:
  navigate('/dashboard')           // Dashboard
  navigate('/documents')            // Documents List
  navigate('/documents/upload')     // Upload Screen
  navigate('/documents/123')        // Specific document
  navigate('/clients')              // Clients List
  navigate('/clients/new')          // Add New Client
  navigate('/clients/456')          // Specific client
  navigate('/review')               // Review Queue
  navigate('/reports')              // Reports Menu
  navigate('/reports/income-statement')  // Income Statement
  navigate('/export')               // Export Screen
  navigate('/settings')             // Settings
  navigate('/login')                // Logout (go to login)
}
*/


// ===================================================================
// BUTTON EXAMPLES - HOW TO CONNECT SCREENS
// ===================================================================

// EXAMPLE 1: Login Button
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

function LoginButton() {
  const navigate = useNavigate()
  
  const handleLogin = async () => {
    // Your login logic here (call API, etc.)
    const success = await loginUser(email, password)
    
    if (success) {
      navigate('/dashboard')  // ← Go to dashboard after login!
    }
  }
  
  return <Button onClick={handleLogin}>Login</Button>
}


// EXAMPLE 2: Upload Documents Button (on Dashboard)
function UploadButton() {
  const navigate = useNavigate()
  
  return (
    <Button onClick={() => navigate('/documents/upload')}>
      Upload Documents
    </Button>
  )
}


// EXAMPLE 3: View Document (click table row)
function DocumentRow({ documentId }) {
  const navigate = useNavigate()
  
  return (
    <tr 
      onClick={() => navigate(`/documents/${documentId}`)}
      className="cursor-pointer hover:bg-gray-50"
    >
      <td>Bank_Statement_Jan.pdf</td>
      <td>Complete</td>
    </tr>
  )
}


// EXAMPLE 4: Back Button
function BackButton() {
  const navigate = useNavigate()
  
  return (
    <Button 
      variant="outline" 
      onClick={() => navigate(-1)}  // ← Goes back to previous page!
    >
      ← Back
    </Button>
  )
}


// EXAMPLE 5: Sidebar Navigation
function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  
  const isActive = (path) => location.pathname === path
  
  return (
    <div className="sidebar">
      <button 
        onClick={() => navigate('/dashboard')}
        className={isActive('/dashboard') ? 'active' : ''}
      >
        📊 Dashboard
      </button>
      
      <button 
        onClick={() => navigate('/documents')}
        className={isActive('/documents') ? 'active' : ''}
      >
        📄 Documents
      </button>
      
      <button 
        onClick={() => navigate('/clients')}
        className={isActive('/clients') ? 'active' : ''}
      >
        👥 Clients
      </button>
      
      <button 
        onClick={() => navigate('/review')}
        className={isActive('/review') ? 'active' : ''}
      >
        ✅ Review
      </button>
      
      <button 
        onClick={() => navigate('/reports')}
        className={isActive('/reports') ? 'active' : ''}
      >
        📈 Reports
      </button>
      
      <button 
        onClick={() => navigate('/export')}
        className={isActive('/export') ? 'active' : ''}
      >
        📤 Export
      </button>
      
      <button 
        onClick={() => navigate('/settings')}
        className={isActive('/settings') ? 'active' : ''}
      >
        ⚙️ Settings
      </button>
    </div>
  )
}


// ===================================================================
// PROTECTED ROUTE (Requires Login)
// ===================================================================

// frontend/src/components/layout/MainLayout.tsx
import { Navigate, Outlet } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'

function MainLayout() {
  // Check if user is logged in
  const isAuthenticated = !!localStorage.getItem('token')  // Simple check
  
  // If not logged in, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  // If logged in, show the layout with header + sidebar
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />  {/* This shows the current page (Dashboard, Documents, etc.) */}
        </main>
      </div>
    </div>
  )
}

export default MainLayout


// ===================================================================
// COMPLETE NAVIGATION MAP (Reference)
// ===================================================================

/*
ROUTE PATH                    → COMPONENT              → ACCESSIBLE FROM
─────────────────────────────────────────────────────────────────────────
/login                        → Login                  → Public
/signup                       → Signup                 → Public
/forgot-password              → ForgotPassword         → Public

/dashboard                    → Dashboard              → Default after login
/documents                    → DocumentsList          → Sidebar
/documents/upload             → DocumentUpload         → Documents List, Dashboard
/documents/:id                → DocumentDetail         → Documents List, Dashboard

/clients                      → ClientsList            → Sidebar
/clients/new                  → ClientForm             → Clients List
/clients/:id                  → ClientDetail           → Clients List
/clients/:id/edit             → ClientForm             → Client Detail

/review                       → ReviewQueue            → Sidebar, Dashboard

/reports                      → Reports                → Sidebar
/reports/income-statement     → IncomeStatement        → Reports
/reports/balance-sheet        → BalanceSheet           → Reports
/reports/trial-balance        → TrialBalance           → Reports
/reports/cash-flow            → CashFlow               → Reports
/reports/vat-return           → VATReturn              → Reports
/reports/comparison           → Comparison             → Reports

/export                       → Export                 → Sidebar, Dashboard

/settings                     → Settings               → Sidebar, Header (user menu)
/settings/:section            → Settings (with section)→ Settings sidebar


BUTTON CLICKS:
─────────────────────────────────────────────────────────────────────────
Login → [Login] → navigate('/dashboard')
Dashboard → [Upload Documents] → navigate('/documents/upload')
Dashboard → [Review Queue] → navigate('/review')
Dashboard → [Export Data] → navigate('/export')
Document Row Click → navigate(`/documents/${id}`)
Client Row Click → navigate(`/clients/${id}`)
Reports → [Generate Income Statement] → navigate('/reports/income-statement')
Any [Back] Button → navigate(-1)
Logout → navigate('/login')
*/
