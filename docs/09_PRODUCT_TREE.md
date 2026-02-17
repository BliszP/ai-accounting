# AI ACCOUNTING AUTOMATION
## Product Tree - Complete System Architecture

**Version:** 1.0  
**Date:** February 2, 2026  
**Purpose:** Visual hierarchy showing all components, features, and how they connect

---

## 🌳 PRODUCT TREE OVERVIEW

```
AI ACCOUNTING AUTOMATION (SaaS Platform)
│
├── 👤 USER LAYER (Who uses it)
│   ├── Accountants (Primary users)
│   ├── Bookkeepers (Secondary users)
│   └── Accounting Firm Admins (Managers)
│
├── 🎨 FRONTEND (React SPA - Vercel)
│   ├── Authentication Module
│   ├── Dashboard Module
│   ├── Document Management Module
│   ├── Client Management Module
│   ├── Review & Approval Module
│   ├── Reports Module
│   ├── Export Module
│   ├── Admin Module
│   └── Settings Module
│
├── ⚙️ BACKEND (Node.js API - Railway)
│   ├── API Layer (REST endpoints)
│   ├── Authentication Service
│   ├── Document Processing Service
│   ├── AI Processing Service (Claude API)
│   ├── Accounting Engine
│   ├── Export Service
│   └── Notification Service
│
├── 🤖 WORKER LAYER (Background Jobs - BullMQ)
│   ├── Extraction Worker (Claude API)
│   ├── Categorization Worker
│   ├── Matching Worker
│   ├── Journal Entry Worker
│   └── Report Generation Worker
│
├── 💾 DATA LAYER (PostgreSQL - Supabase)
│   ├── Core Tables (users, organizations, clients)
│   ├── Document Tables (documents, transactions)
│   ├── Accounting Tables (journal_entries, accounts)
│   ├── Configuration Tables (settings, rules)
│   └── Audit Tables (logs, history)
│
├── 📊 MONITORING & ANALYTICS
│   ├── Error Tracking (Sentry)
│   ├── Product Analytics (PostHog)
│   ├── Uptime Monitoring (Uptime Robot)
│   ├── Cost Tracking (Custom dashboard)
│   └── Logs (Winston/Pino)
│
└── 🔌 EXTERNAL INTEGRATIONS
    ├── Claude API (Anthropic)
    ├── File Storage (Supabase Storage)
    ├── Email (SendGrid/Resend)
    ├── Accounting Software APIs (IRIS, Xero, QuickBooks)
    └── Slack (Alerts)
```

---

## 📱 FRONTEND MODULE TREE (User Interface)

```
FRONTEND (React + TypeScript + Tailwind)
│
├── 🔐 AUTHENTICATION MODULE
│   ├── Login Screen
│   │   ├── Email/Password form
│   │   ├── Remember me
│   │   └── Forgot password link
│   ├── Signup Screen
│   │   ├── Organization creation
│   │   ├── User registration
│   │   └── Email verification
│   ├── Password Reset
│   │   ├── Email input
│   │   └── Reset link sender
│   └── Session Management
│       ├── JWT token storage
│       ├── Auto-refresh tokens
│       └── Logout
│
├── 📊 DASHBOARD MODULE
│   ├── Overview Screen (Home)
│   │   ├── Stats Cards
│   │   │   ├── Documents Uploaded
│   │   │   ├── Processed This Month
│   │   │   ├── Pending Review
│   │   │   └── Processing Errors
│   │   ├── Recent Uploads (Last 5)
│   │   ├── Quick Actions
│   │   │   ├── Upload Documents button
│   │   │   ├── Review Queue button
│   │   │   └── Export Data button
│   │   └── Activity Timeline
│   └── Navigation
│       ├── Header (Logo, Notifications, User menu)
│       └── Sidebar (Main navigation)
│
├── 📄 DOCUMENT MANAGEMENT MODULE
│   ├── Upload Screen
│   │   ├── Client Selector dropdown
│   │   ├── Drag & Drop Zone
│   │   │   ├── File type validation
│   │   │   ├── File size validation
│   │   │   └── Batch upload (100 statements, 500 receipts)
│   │   ├── File Preview List
│   │   │   ├── Remove file option
│   │   │   ├── File details (name, size, type)
│   │   │   └── Upload progress bars
│   │   └── Process Button
│   ├── Documents List Screen
│   │   ├── Filters
│   │   │   ├── Client filter
│   │   │   ├── Status filter (Queued, Processing, Complete, Error)
│   │   │   ├── Type filter (Bank Statement, Receipt, Invoice)
│   │   │   └── Date range filter
│   │   ├── Search Bar
│   │   ├── Documents Table
│   │   │   ├── File name
│   │   │   ├── Client name
│   │   │   ├── Type badge
│   │   │   ├── Status badge
│   │   │   ├── Upload date
│   │   │   └── Actions (View, Delete)
│   │   └── Pagination
│   └── Document Detail Screen
│       ├── Document Viewer (PDF/Image)
│       │   ├── Zoom controls
│       │   └── Download button
│       ├── Metadata Panel
│       │   ├── File info
│       │   ├── Client info
│       │   ├── Processing status
│       │   └── Upload details
│       ├── Extracted Transactions Table
│       │   ├── Date
│       │   ├── Merchant
│       │   ├── Amount
│       │   ├── Category
│       │   └── Confidence score
│       └── Actions
│           ├── Reprocess button
│           └── Delete button
│
├── 👥 CLIENT MANAGEMENT MODULE
│   ├── Clients List Screen
│   │   ├── Search Bar
│   │   ├── Add Client Button
│   │   ├── Clients Table
│   │   │   ├── Client name
│   │   │   ├── Contact email
│   │   │   ├── VAT number
│   │   │   ├── Status (Active/Archived)
│   │   │   └── Actions (Edit, View)
│   │   └── Pagination
│   ├── Add/Edit Client Screen
│   │   ├── Client Information Form
│   │   │   ├── Client name *
│   │   │   ├── Company number
│   │   │   ├── VAT number
│   │   │   ├── Contact email
│   │   │   ├── Financial year start
│   │   │   └── Status (Active/Archived)
│   │   ├── Validation
│   │   └── Save/Cancel buttons
│   └── Client Detail Screen
│       ├── Client Info Card
│       │   ├── Name, VAT, Email
│       │   ├── Financial year
│       │   └── Status
│       ├── Activity Summary
│       │   ├── Documents this month
│       │   ├── Pending review
│       │   └── Last upload
│       ├── Recent Documents List
│       └── Quick Actions
│           ├── Upload documents
│           ├── View reports
│           └── Export data
│
├── ✅ REVIEW & APPROVAL MODULE
│   ├── Review Queue Screen
│   │   ├── Filters
│   │   │   ├── Client filter
│   │   │   ├── Confidence threshold
│   │   │   ├── Category filter
│   │   │   └── Date range
│   │   ├── Sort Options
│   │   │   ├── Confidence (Low → High)
│   │   │   ├── Date (Newest first)
│   │   │   └── Amount (Highest first)
│   │   ├── Review Card (Current item)
│   │   │   ├── LEFT: Document Viewer
│   │   │   │   ├── Image/PDF display
│   │   │   │   └── Zoom controls
│   │   │   └── RIGHT: Extracted Data Panel
│   │   │       ├── Transaction Details
│   │   │       │   ├── Merchant
│   │   │       │   ├── Date
│   │   │       │   ├── Amount
│   │   │       │   └── VAT
│   │   │       ├── Category Suggestions
│   │   │       │   ├── Suggested (with confidence %)
│   │   │       │   ├── Alternative categories
│   │   │       │   └── Manual override
│   │   │       ├── Matched Bank Transaction
│   │   │       │   ├── Match confidence %
│   │   │       │   └── Transaction details
│   │   │       └── Review Notes (optional)
│   │   ├── Navigation
│   │   │   ├── Previous button
│   │   │   ├── Item counter (X of Y)
│   │   │   └── Next button
│   │   ├── Action Buttons
│   │   │   ├── Reject button (red)
│   │   │   ├── Edit button (gray)
│   │   │   ├── Approve button (green)
│   │   │   └── Bulk Approve All
│   │   └── Keyboard Shortcuts
│   │       ├── Enter = Approve
│   │       ├── E = Edit
│   │       ├── R = Reject
│   │       └── ← → = Navigate
│   └── Empty State
│       └── "All caught up! ✓" message
│
├── 📈 REPORTS MODULE
│   ├── Reports Navigation (Sidebar submenu)
│   │   ├── Income Statement
│   │   ├── Balance Sheet
│   │   ├── Trial Balance
│   │   ├── Cash Flow Statement
│   │   ├── VAT Return
│   │   └── Period Comparison
│   ├── Report Parameters (All reports)
│   │   ├── Client selector
│   │   ├── Period selector
│   │   │   ├── Monthly
│   │   │   ├── Quarterly
│   │   │   ├── Yearly
│   │   │   └── Custom date range
│   │   └── Generate button
│   ├── Income Statement Screen
│   │   ├── Report Header
│   │   │   ├── Client name
│   │   │   └── Period
│   │   ├── REVENUE Section
│   │   │   ├── Line items (Sales, Service, Other)
│   │   │   └── Total Revenue
│   │   ├── COST OF SALES Section
│   │   │   ├── Line items
│   │   │   └── Total COGS
│   │   ├── GROSS PROFIT
│   │   │   └── Gross Margin %
│   │   ├── OPERATING EXPENSES Section
│   │   │   ├── Line items by category
│   │   │   └── Total Expenses
│   │   ├── NET PROFIT
│   │   │   └── Net Margin %
│   │   └── Export Options
│   │       ├── Export PDF
│   │       └── Export Excel
│   ├── Balance Sheet Screen
│   │   ├── ASSETS Section
│   │   │   ├── Current Assets
│   │   │   ├── Fixed Assets
│   │   │   └── Total Assets
│   │   ├── LIABILITIES Section
│   │   │   ├── Current Liabilities
│   │   │   ├── Long-term Liabilities
│   │   │   └── Total Liabilities
│   │   ├── EQUITY Section
│   │   │   ├── Owner's Capital
│   │   │   ├── Retained Earnings
│   │   │   └── Total Equity
│   │   ├── Validation Banner
│   │   │   └── ✓ Assets = Liabilities + Equity
│   │   └── Export Options
│   ├── Trial Balance Screen
│   │   ├── Account List
│   │   │   ├── Account Code
│   │   │   ├── Account Name
│   │   │   ├── Debit
│   │   │   └── Credit
│   │   ├── Totals Row
│   │   │   ├── Total Debits
│   │   │   └── Total Credits
│   │   ├── Validation Banner
│   │   │   └── ✓ Debits = Credits
│   │   └── Export Options
│   ├── Cash Flow Statement Screen
│   │   ├── Operating Activities
│   │   ├── Investing Activities
│   │   ├── Financing Activities
│   │   ├── Net Cash Flow
│   │   └── Export Options
│   ├── VAT Return Screen
│   │   ├── Box 1-9 (HMRC format)
│   │   │   ├── Box 1: VAT on Sales
│   │   │   ├── Box 2: VAT on Acquisitions
│   │   │   ├── Box 3: Total VAT Due
│   │   │   ├── Box 4: VAT Reclaimed
│   │   │   ├── Box 5: Net VAT (payable/reclaimable)
│   │   │   ├── Box 6: Total Sales
│   │   │   ├── Box 7: Total Purchases
│   │   │   ├── Box 8: Total Supplies to EU
│   │   │   └── Box 9: Total Acquisitions from EU
│   │   ├── Period Selector
│   │   │   ├── Monthly
│   │   │   └── Quarterly
│   │   └── Export Options
│   │       ├── Export PDF
│   │       └── Export MTD JSON
│   └── Period Comparison Screen
│       ├── Period Selectors
│       │   ├── Period 1
│       │   └── Period 2
│       ├── Side-by-Side Comparison
│       │   ├── Income Statement format
│       │   ├── This Period column
│       │   ├── Last Period column
│       │   └── Variance column (£ and %)
│       └── Variance Highlighting
│           ├── Green = Positive
│           └── Red = Negative
│
├── 📤 EXPORT MODULE
│   ├── Export Screen
│   │   ├── Parameters Form
│   │   │   ├── Client selector *
│   │   │   ├── Date Range *
│   │   │   │   ├── From date
│   │   │   │   └── To date
│   │   │   ├── Status Filter
│   │   │   │   ├── Approved only (recommended)
│   │   │   │   └── All transactions
│   │   │   └── Export Format *
│   │   │       ├── ● IRIS Kashflow (CSV)
│   │   │       ├── ○ Xero (CSV)
│   │   │       ├── ○ QuickBooks (IIF)
│   │   │       ├── ○ Sage (CSV)
│   │   │       └── ○ Generic CSV
│   │   ├── Preview Section
│   │   │   ├── Transaction count
│   │   │   ├── Sample rows (first 10)
│   │   │   └── Column mapping display
│   │   ├── Export Button
│   │   │   └── "Export (247 transactions)"
│   │   └── Export History
│   │       ├── Past exports list
│   │       ├── Download links
│   │       └── Export details
│   └── Download Handler
│       └── File downloads immediately
│
├── ⚙️ ADMIN MODULE
│   ├── User Management Screen (Admin only)
│   │   ├── Users List
│   │   │   ├── Name
│   │   │   ├── Email
│   │   │   ├── Role (Admin/Accountant/Viewer)
│   │   │   ├── Last login
│   │   │   └── Actions (Edit, Delete)
│   │   ├── Add User Button
│   │   └── Add/Edit User Form
│   │       ├── Name
│   │       ├── Email
│   │       ├── Role dropdown
│   │       ├── Send invitation checkbox
│   │       └── Assign clients (multi-select)
│   ├── Organization Settings Screen
│   │   ├── Organization Details Form
│   │   │   ├── Organization name
│   │   │   ├── Contact email
│   │   │   ├── Address
│   │   │   └── Logo upload
│   │   ├── Financial Settings
│   │   │   └── Financial year start
│   │   └── Save button
│   ├── Billing Screen
│   │   ├── Current Plan Card
│   │   │   ├── Plan name (Professional)
│   │   │   ├── Price (£1,200/month)
│   │   │   └── Renewal date
│   │   ├── Usage This Month
│   │   │   ├── Documents processed
│   │   │   ├── Progress bar
│   │   │   └── % of limit
│   │   ├── Payment Method
│   │   │   ├── Card ending in 1234
│   │   │   └── Update card button
│   │   ├── Invoices Table
│   │   │   ├── Date
│   │   │   ├── Amount
│   │   │   ├── Status
│   │   │   └── Download PDF
│   │   └── Plan Actions
│   │       ├── Upgrade button
│   │       └── Cancel subscription
│   ├── Chart of Accounts Screen
│   │   ├── Accounts Table
│   │   │   ├── Account Code
│   │   │   ├── Account Name
│   │   │   ├── Type (Asset/Liability/Equity/Revenue/Expense)
│   │   │   ├── Status (Active/Inactive)
│   │   │   └── Actions (Edit, Delete)
│   │   ├── Add Account Button
│   │   ├── Import from CSV Button
│   │   └── Reset to UK Standard Button
│   └── Category Mappings Screen
│       ├── Mappings Table
│       │   ├── Category Name (e.g., "Telephone")
│       │   ├── Maps to Account (e.g., "6200 - Telephone Expense")
│       │   └── Actions (Edit)
│       └── Edit Mapping
│           ├── Category (read-only)
│           ├── Account dropdown
│           └── Save button
│
├── 🔧 SETTINGS MODULE (User-level)
│   ├── Profile Screen
│   │   ├── Personal Details
│   │   │   ├── Name
│   │   │   ├── Email
│   │   │   └── Password change
│   │   ├── Preferences
│   │   │   ├── Email notifications
│   │   │   ├── Language
│   │   │   └── Timezone
│   │   └── 2FA Settings
│   │       ├── Enable/Disable toggle
│   │       └── QR code for setup
│   └── Notifications Settings
│       ├── Email Notifications
│       │   ├── Document processed
│       │   ├── Review needed
│       │   └── Weekly summary
│       └── In-App Notifications
│           ├── Real-time alerts
│           └── Notification badge
│
└── 🎨 SHARED UI COMPONENTS
    ├── Layout Components
    │   ├── MainLayout (Header + Sidebar + Content)
    │   ├── Header (Logo, Notifications, User menu)
    │   └── Sidebar (Navigation menu)
    ├── Form Components
    │   ├── Input (text, email, password)
    │   ├── Select dropdown
    │   ├── Checkbox
    │   ├── Radio buttons
    │   ├── Date picker
    │   ├── File upload
    │   └── Form validation
    ├── Display Components
    │   ├── Card
    │   ├── Stats Card
    │   ├── Table (sortable, filterable)
    │   ├── Badge/Pill (status indicators)
    │   ├── Button (Primary, Secondary, Danger)
    │   ├── Alert (Info, Warning, Error, Success)
    │   └── Toast notifications
    ├── Loading States
    │   ├── Skeleton loaders
    │   ├── Spinner
    │   └── Progress bars
    ├── Empty States
    │   ├── No data placeholders
    │   └── Call-to-action buttons
    └── Error States
        ├── 404 Page
        ├── 500 Error
        └── Error boundaries
```

---

## ⚙️ BACKEND API TREE (Node.js + Hono)

```
BACKEND API (Node.js + Hono + TypeScript - Railway)
│
├── 🔐 AUTHENTICATION SERVICE
│   ├── POST /api/auth/signup
│   │   ├── Input: email, password, name, organizationName
│   │   ├── Process: Hash password, Create org, Create user
│   │   └── Output: JWT token + user object
│   ├── POST /api/auth/login
│   │   ├── Input: email, password
│   │   ├── Process: Verify credentials, Generate JWT
│   │   └── Output: JWT token + user object
│   ├── POST /api/auth/refresh
│   │   ├── Input: refresh token
│   │   └── Output: new JWT token
│   ├── POST /api/auth/forgot-password
│   │   ├── Input: email
│   │   └── Process: Send reset link
│   ├── POST /api/auth/reset-password
│   │   ├── Input: token, new password
│   │   └── Process: Update password
│   └── POST /api/auth/logout
│       └── Process: Invalidate token
│
├── 📊 DASHBOARD SERVICE
│   └── GET /api/dashboard/stats
│       ├── Auth: JWT required
│       ├── Process: Query documents, Calculate stats
│       └── Output: {uploaded, processed, pending, errors, recentUploads}
│
├── 📄 DOCUMENT SERVICE
│   ├── POST /api/documents/upload
│   │   ├── Auth: JWT required
│   │   ├── Input: file (multipart), clientId
│   │   ├── Process:
│   │   │   ├── Validate file type/size
│   │   │   ├── Upload to Supabase Storage
│   │   │   ├── Create document record
│   │   │   └── Queue extraction job
│   │   └── Output: {documentId, status: 'queued'}
│   ├── GET /api/documents
│   │   ├── Auth: JWT required
│   │   ├── Query: clientId, status, type, dateRange, page, limit
│   │   ├── Process: Filter documents (RLS enforced)
│   │   └── Output: {documents[], total, page, pages}
│   ├── GET /api/documents/:id
│   │   ├── Auth: JWT required
│   │   ├── Process: Get document + transactions
│   │   └── Output: {document, transactions[]}
│   ├── DELETE /api/documents/:id
│   │   ├── Auth: JWT required
│   │   ├── Process: Delete file from storage, Delete DB records
│   │   └── Output: {success: true}
│   └── POST /api/documents/:id/reprocess
│       ├── Auth: JWT required
│       ├── Process: Re-queue for extraction
│       └── Output: {status: 'queued'}
│
├── 👥 CLIENT SERVICE
│   ├── GET /api/clients
│   │   ├── Auth: JWT required
│   │   ├── Query: search, status, page, limit
│   │   ├── Process: List clients (RLS filtered)
│   │   └── Output: {clients[], total}
│   ├── GET /api/clients/:id
│   │   ├── Auth: JWT required
│   │   └── Output: {client, stats: {documents, pending}}
│   ├── POST /api/clients
│   │   ├── Auth: JWT required
│   │   ├── Input: name, vatNumber, email, fyStart
│   │   ├── Process: Create client
│   │   └── Output: {client}
│   ├── PUT /api/clients/:id
│   │   ├── Auth: JWT required
│   │   ├── Input: Updated fields
│   │   └── Output: {client}
│   └── DELETE /api/clients/:id
│       ├── Auth: JWT required (Admin only)
│       └── Output: {success: true}
│
├── ✅ REVIEW SERVICE
│   ├── GET /api/review/queue
│   │   ├── Auth: JWT required
│   │   ├── Query: clientId, confidence, category, sort
│   │   ├── Process: Get transactions needing review
│   │   └── Output: {items[], total}
│   ├── POST /api/review/:transactionId/approve
│   │   ├── Auth: JWT required
│   │   ├── Input: category (optional override), notes
│   │   ├── Process:
│   │   │   ├── Update transaction status = 'approved'
│   │   │   ├── Store category correction (if overridden)
│   │   │   └── Queue journal entry job
│   │   └── Output: {success: true}
│   ├── POST /api/review/:transactionId/reject
│   │   ├── Auth: JWT required
│   │   ├── Input: reason
│   │   ├── Process: Mark as rejected
│   │   └── Output: {success: true}
│   └── POST /api/review/bulk-approve
│       ├── Auth: JWT required
│       ├── Input: transactionIds[]
│       ├── Process: Approve all, Queue journal entries
│       └── Output: {approved: count}
│
├── 📈 REPORTS SERVICE
│   ├── GET /api/reports/income-statement
│   │   ├── Auth: JWT required
│   │   ├── Query: clientId, startDate, endDate
│   │   ├── Process: Calculate P&L from journal entries
│   │   └── Output: {revenue: {...}, cogs: {...}, expenses: {...}, grossProfit, netProfit, margins}
│   ├── GET /api/reports/balance-sheet
│   │   ├── Auth: JWT required
│   │   ├── Query: clientId, asOfDate
│   │   ├── Process: Calculate assets, liabilities, equity
│   │   ├── Validate: Assets = Liabilities + Equity
│   │   └── Output: {assets: {...}, liabilities: {...}, equity: {...}, balanced: true}
│   ├── GET /api/reports/trial-balance
│   │   ├── Auth: JWT required
│   │   ├── Query: clientId, asOfDate
│   │   ├── Process: Sum debits/credits per account
│   │   ├── Validate: Total Debits = Total Credits
│   │   └── Output: {accounts[], totalDebits, totalCredits, balanced: true}
│   ├── GET /api/reports/cash-flow
│   │   ├── Auth: JWT required
│   │   ├── Query: clientId, startDate, endDate
│   │   └── Output: {operating: {...}, investing: {...}, financing: {...}, netCashFlow}
│   ├── GET /api/reports/vat-return
│   │   ├── Auth: JWT required
│   │   ├── Query: clientId, startDate, endDate
│   │   └── Output: {box1-9: values, netVAT: amount}
│   └── GET /api/reports/comparison
│       ├── Auth: JWT required
│       ├── Query: clientId, period1Start, period1End, period2Start, period2End
│       └── Output: {period1: {...}, period2: {...}, variance: {...}}
│
├── 📤 EXPORT SERVICE
│   ├── GET /api/export
│   │   ├── Auth: JWT required
│   │   ├── Query: clientId, startDate, endDate, format, status
│   │   ├── Process:
│   │   │   ├── Get transactions
│   │   │   ├── Format according to format (IRIS, Xero, QB, etc.)
│   │   │   ├── Generate CSV/IIF file
│   │   │   └── Store export history
│   │   └── Output: File download
│   └── GET /api/export/history
│       ├── Auth: JWT required
│       └── Output: {exports[]}
│
├── ⚙️ ADMIN SERVICE
│   ├── GET /api/admin/users
│   │   ├── Auth: Admin only
│   │   └── Output: {users[]}
│   ├── POST /api/admin/users
│   │   ├── Auth: Admin only
│   │   ├── Input: email, name, role
│   │   └── Output: {user}
│   ├── PUT /api/admin/users/:id
│   │   ├── Auth: Admin only
│   │   └── Output: {user}
│   ├── DELETE /api/admin/users/:id
│   │   ├── Auth: Admin only
│   │   └── Output: {success: true}
│   ├── GET /api/admin/settings
│   │   ├── Auth: Admin only
│   │   └── Output: {organization, billing, accounts}
│   └── PUT /api/admin/settings
│       ├── Auth: Admin only
│       └── Output: {settings}
│
├── 🔔 NOTIFICATION SERVICE
│   ├── POST /api/notifications/send
│   │   └── Internal use (workers trigger)
│   └── GET /api/notifications
│       ├── Auth: JWT required
│       └── Output: {notifications[]}
│
└── 🏥 HEALTH SERVICE
    ├── GET /health
    │   └── Output: {status: 'ok', timestamp}
    └── GET /api/health/detailed
        └── Output: {status, database, redis, claude, version}
```

---

## 🤖 WORKER LAYER TREE (Background Jobs)

```
WORKER LAYER (BullMQ + Redis)
│
├── 📄 EXTRACTION WORKER
│   ├── Job Input
│   │   ├── documentId
│   │   ├── fileUrl
│   │   ├── fileType
│   │   └── clientId
│   ├── Processing Steps
│   │   ├── 1. Download file from Supabase Storage
│   │   ├── 2. Determine document type
│   │   │   ├── Bank statement (multi-page, table format)
│   │   │   ├── Receipt (single, OCR needed)
│   │   │   └── Invoice (structured)
│   │   ├── 3. Choose Claude model
│   │   │   ├── Haiku for clear receipts (80%)
│   │   │   └── Sonnet for complex/poor quality (20%)
│   │   ├── 4. Build prompt (from docs/03)
│   │   ├── 5. Call Claude API
│   │   ├── 6. Parse JSON response
│   │   ├── 7. Validate extracted data
│   │   │   ├── Date format
│   │   │   ├── Amount is number
│   │   │   ├── Merchant not empty
│   │   │   └── Type is credit/debit
│   │   ├── 8. Store transactions in DB
│   │   └── 9. Update document status = 'complete'
│   ├── Error Handling
│   │   ├── Retry logic (3 attempts)
│   │   ├── Error logging
│   │   └── Mark document status = 'error'
│   └── Completion
│       ├── Queue categorization job
│       └── Send notification
│
├── 🏷️ CATEGORIZATION WORKER
│   ├── Job Input
│   │   ├── transactionId
│   │   ├── merchant
│   │   ├── amount
│   │   └── description
│   ├── Processing Steps
│   │   ├── 1. Check learning rules
│   │   │   └── If merchant seen before, use learned category
│   │   ├── 2. If no rule, call Claude API
│   │   │   ├── Use Haiku (cheap)
│   │   │   ├── Provide UK category list
│   │   │   └── Ask for top 3 suggestions with confidence
│   │   ├── 3. Store suggestions in DB
│   │   │   ├── Suggested category (highest confidence)
│   │   │   ├── Alternative categories
│   │   │   └── Confidence scores
│   │   └── 4. If confidence > 90%, auto-categorize
│   │       └── Else, flag for manual review
│   └── Completion
│       └── Queue matching job
│
├── 🔗 MATCHING WORKER
│   ├── Job Input
│   │   ├── transactionId (from receipt/invoice)
│   │   ├── clientId
│   │   ├── amount
│   │   ├── date
│   │   └── merchant
│   ├── Processing Steps
│   │   ├── 1. Get bank transactions for client
│   │   │   └── Filter by date range (±7 days)
│   │   ├── 2. Fuzzy match algorithm
│   │   │   ├── Match on amount (exact or ±£0.01)
│   │   │   ├── Match on merchant name (fuzzy string match)
│   │   │   └── Match on date (within 7 days)
│   │   ├── 3. Calculate match confidence
│   │   │   ├── 100% = Amount exact + Merchant exact + Date exact
│   │   │   ├── 90%+ = Amount exact + Merchant similar + Date close
│   │   │   └── <90% = No match or low confidence
│   │   ├── 4. Store match if confidence > 80%
│   │   │   ├── Link receipt to bank transaction
│   │   │   └── Store confidence score
│   │   └── 5. Flag for review if confidence < 80%
│   └── Completion
│       └── Update transaction record
│
├── 📒 JOURNAL ENTRY WORKER
│   ├── Job Input
│   │   ├── transactionId (approved transaction)
│   │   ├── amount
│   │   ├── type (credit/debit)
│   │   ├── category
│   │   └── vatAmount
│   ├── Processing Steps (CRITICAL - 100% accuracy required)
│   │   ├── 1. Determine transaction type
│   │   │   ├── Income (credit to bank)
│   │   │   └── Expense (debit to bank)
│   │   ├── 2. Get account codes from category mapping
│   │   │   └── e.g., "Telephone" → 6200
│   │   ├── 3. Create double-entry journal entries
│   │   │   ├── FOR INCOME:
│   │   │   │   ├── Debit: Bank (1000) = amount
│   │   │   │   └── Credit: Revenue (4xxx) = amount
│   │   │   └── FOR EXPENSE:
│   │   │       ├── Debit: Expense (5xxx/6xxx) = amount - VAT
│   │   │       ├── Debit: VAT Reclaimable (2110) = VAT
│   │   │       └── Credit: Bank (1000) = amount
│   │   ├── 4. VALIDATE: Sum of debits = Sum of credits
│   │   │   └── If not balanced: ERROR + alert admin
│   │   ├── 5. Insert journal entries into DB
│   │   │   └── journal_entries table
│   │   └── 6. Update transaction status = 'journaled'
│   └── Completion
│       └── Transaction is now in accounting system
│
└── 📊 REPORT GENERATION WORKER (Optional - for async reports)
    ├── Job Input
    │   ├── reportType
    │   ├── clientId
    │   ├── dateRange
    │   └── format (PDF/Excel)
    ├── Processing Steps
    │   ├── 1. Query journal entries
    │   ├── 2. Calculate report
    │   ├── 3. Generate PDF/Excel
    │   └── 4. Store file
    └── Completion
        └── Send notification + download link
```

---

## 💾 DATABASE TREE (PostgreSQL - Supabase)

```
DATABASE (PostgreSQL with Row-Level Security)
│
├── 🏢 CORE TABLES
│   ├── organizations
│   │   ├── id (uuid, PK)
│   │   ├── name
│   │   ├── created_at
│   │   └── settings (jsonb)
│   ├── users
│   │   ├── id (uuid, PK)
│   │   ├── organization_id (FK → organizations)
│   │   ├── email (unique)
│   │   ├── password_hash
│   │   ├── name
│   │   ├── role (admin/accountant/viewer)
│   │   ├── created_at
│   │   └── last_login
│   └── clients
│       ├── id (uuid, PK)
│       ├── organization_id (FK → organizations)
│       ├── name
│       ├── company_number
│       ├── vat_number
│       ├── contact_email
│       ├── financial_year_start (date)
│       ├── status (active/archived)
│       └── created_at
│
├── 📄 DOCUMENT TABLES
│   ├── documents
│   │   ├── id (uuid, PK)
│   │   ├── organization_id (FK → organizations)
│   │   ├── client_id (FK → clients)
│   │   ├── filename
│   │   ├── file_url (Supabase Storage path)
│   │   ├── file_type (pdf/csv/xlsx/jpg/png)
│   │   ├── file_size (bytes)
│   │   ├── status (queued/processing/complete/error)
│   │   ├── error_message (text, nullable)
│   │   ├── uploaded_by (FK → users)
│   │   ├── uploaded_at
│   │   └── processed_at
│   └── transactions
│       ├── id (uuid, PK)
│       ├── organization_id (FK → organizations)
│       ├── client_id (FK → clients)
│       ├── document_id (FK → documents)
│       ├── date
│       ├── merchant
│       ├── description
│       ├── amount (decimal)
│       ├── type (credit/debit)
│       ├── vat_amount (decimal, nullable)
│       ├── vat_rate (decimal, nullable)
│       ├── suggested_category
│       ├── category_confidence (decimal)
│       ├── final_category (nullable - after approval)
│       ├── matched_transaction_id (FK → transactions, nullable)
│       ├── match_confidence (decimal, nullable)
│       ├── status (pending/approved/rejected/journaled)
│       ├── reviewed_by (FK → users, nullable)
│       ├── reviewed_at (timestamp, nullable)
│       └── created_at
│
├── 📒 ACCOUNTING TABLES
│   ├── chart_of_accounts
│   │   ├── id (uuid, PK)
│   │   ├── organization_id (FK → organizations)
│   │   ├── account_code (e.g., "1000", "4000")
│   │   ├── account_name (e.g., "Bank Current Account")
│   │   ├── account_type (asset/liability/equity/revenue/expense)
│   │   ├── parent_account_id (FK → chart_of_accounts, nullable)
│   │   ├── is_active (boolean)
│   │   └── created_at
│   ├── account_category_mappings
│   │   ├── id (uuid, PK)
│   │   ├── organization_id (FK → organizations)
│   │   ├── category_name (e.g., "Telephone")
│   │   ├── account_id (FK → chart_of_accounts)
│   │   └── created_at
│   └── journal_entries
│       ├── id (uuid, PK)
│       ├── organization_id (FK → organizations)
│       ├── client_id (FK → clients)
│       ├── transaction_id (FK → transactions)
│       ├── account_id (FK → chart_of_accounts)
│       ├── date
│       ├── description
│       ├── debit (decimal, nullable)
│       ├── credit (decimal, nullable)
│       ├── created_at
│       └── CHECK: (debit IS NULL OR credit IS NULL) AND NOT (debit IS NULL AND credit IS NULL)
│
├── ⚙️ CONFIGURATION TABLES
│   ├── learning_rules
│   │   ├── id (uuid, PK)
│   │   ├── organization_id (FK → organizations)
│   │   ├── client_id (FK → clients, nullable)
│   │   ├── merchant_pattern (text)
│   │   ├── category
│   │   ├── confidence (decimal)
│   │   ├── times_applied (integer)
│   │   └── created_at
│   ├── settings
│   │   ├── id (uuid, PK)
│   │   ├── organization_id (FK → organizations)
│   │   ├── key (text)
│   │   ├── value (jsonb)
│   │   └── updated_at
│   └── export_history
│       ├── id (uuid, PK)
│       ├── organization_id (FK → organizations)
│       ├── client_id (FK → clients)
│       ├── format (iris/xero/quickbooks/sage/generic)
│       ├── transaction_count (integer)
│       ├── date_range_start
│       ├── date_range_end
│       ├── exported_by (FK → users)
│       ├── exported_at
│       └── file_url (Supabase Storage path)
│
└── 📊 AUDIT TABLES
    ├── audit_log
    │   ├── id (uuid, PK)
    │   ├── organization_id (FK → organizations)
    │   ├── user_id (FK → users)
    │   ├── action (text)
    │   ├── entity_type (text)
    │   ├── entity_id (uuid)
    │   ├── changes (jsonb)
    │   └── created_at
    └── error_log
        ├── id (uuid, PK)
        ├── organization_id (FK → organizations)
        ├── worker_type (extraction/categorization/matching/journal)
        ├── job_id (text)
        ├── error_message (text)
        ├── stack_trace (text)
        ├── retry_count (integer)
        └── created_at
```

---

## 🔌 EXTERNAL INTEGRATIONS

```
EXTERNAL SERVICES
│
├── 🤖 CLAUDE API (Anthropic)
│   ├── Used By:
│   │   ├── Extraction Worker
│   │   └── Categorization Worker
│   ├── Models:
│   │   ├── Haiku (80% usage - receipts, simple statements)
│   │   └── Sonnet (20% usage - complex docs, poor quality)
│   ├── Cost Optimization:
│   │   ├── Batch processing (10 receipts at once)
│   │   ├── Prompt optimization (shorter prompts)
│   │   ├── Caching responses
│   │   └── Use Haiku by default
│   └── Monitoring:
│       ├── Track token usage
│       ├── Calculate cost per document
│       └── Alert if >£30/day
│
├── 📦 SUPABASE STORAGE
│   ├── Buckets:
│   │   ├── documents (uploaded files)
│   │   ├── exports (generated CSV/IIF files)
│   │   └── reports (generated PDF reports)
│   ├── Security:
│   │   ├── Row-Level Security
│   │   ├── Signed URLs (temporary access)
│   │   └── File type validation
│   └── Policies:
│       ├── Users can only access their org's files
│       └── 30-day retention on exports
│
├── 📧 EMAIL SERVICE (SendGrid/Resend)
│   ├── Transactional Emails:
│   │   ├── Welcome email (signup)
│   │   ├── Password reset
│   │   ├── Document processed notification
│   │   ├── Weekly summary report
│   │   └── Error notifications (admin)
│   └── Templates:
│       └── Branded HTML emails
│
├── 💳 STRIPE (Billing)
│   ├── Subscriptions:
│   │   ├── Starter (£800/month)
│   │   ├── Professional (£1,200/month)
│   │   └── Enterprise (custom)
│   ├── Webhooks:
│   │   ├── subscription.created
│   │   ├── subscription.updated
│   │   ├── subscription.deleted
│   │   └── invoice.payment_succeeded
│   └── Usage Tracking:
│       └── Metered billing (per document)
│
├── 📊 ACCOUNTING SOFTWARE APIs
│   ├── IRIS Kashflow
│   │   ├── CSV export only (no API)
│   │   └── Format: Date, Account, Description, Debit, Credit
│   ├── Xero
│   │   ├── API: POST /api.xro/2.0/BankTransactions
│   │   └── Fallback: CSV export
│   ├── QuickBooks
│   │   ├── API: POST /v3/company/{companyId}/bill
│   │   └── Fallback: IIF export
│   └── Sage
│       ├── CSV export only
│       └── Format: Date, Ref, Nominal, Details, Net, Tax, Gross
│
├── 💬 SLACK (Alerts)
│   ├── Channels:
│   │   ├── #alerts (errors, high costs)
│   │   ├── #deployments (release notifications)
│   │   └── #monitoring (uptime alerts)
│   └── Webhooks:
│       └── POST https://hooks.slack.com/services/...
│
└── 🔔 PUSH NOTIFICATIONS (Optional - Future)
    ├── Web Push (browser)
    └── Mobile Push (if mobile app built)
```

---

## 📊 DATA FLOW DIAGRAM

```
COMPLETE DATA FLOW (User Upload → Export)
│
START: User uploads document
│
├── [1] FRONTEND: Upload Screen
│   ├── User selects client
│   ├── User drops file (PDF/JPG)
│   ├── Frontend validates (type, size)
│   └── POST /api/documents/upload
│       └── Send: file + clientId
│
├── [2] BACKEND: Document Service
│   ├── Receive file
│   ├── Upload to Supabase Storage → Get URL
│   ├── Create document record (status: 'queued')
│   ├── Queue extraction job (BullMQ)
│   └── Return: {documentId, status: 'queued'}
│
├── [3] WORKER: Extraction Worker
│   ├── Pick job from queue
│   ├── Download file from storage
│   ├── Call Claude API (Haiku or Sonnet)
│   │   └── Send: file + prompt
│   │   └── Receive: JSON {transactions: [...]}
│   ├── Parse response
│   ├── Insert transactions into DB (status: 'pending')
│   ├── Update document (status: 'complete')
│   └── Queue categorization jobs (one per transaction)
│
├── [4] WORKER: Categorization Worker
│   ├── Pick job from queue
│   ├── Check learning rules (merchant → category)
│   ├── If no rule:
│   │   └── Call Claude API (Haiku)
│   │       └── Get: category suggestions + confidence
│   ├── Store suggestions in transaction record
│   ├── If confidence > 90%: Auto-categorize
│   ├── Else: Flag for manual review
│   └── Queue matching job
│
├── [5] WORKER: Matching Worker
│   ├── Pick job from queue
│   ├── Get receipt/invoice transaction
│   ├── Query bank transactions (same client, ±7 days)
│   ├── Fuzzy match on amount + merchant + date
│   ├── Calculate match confidence
│   ├── If confidence > 80%:
│   │   └── Link transactions (matched_transaction_id)
│   └── Store match confidence
│
├── [6] FRONTEND: Review Queue
│   ├── GET /api/review/queue
│   ├── Display transactions with:
│   │   ├── Document image (left)
│   │   └── Extracted data (right)
│   ├── User reviews:
│   │   ├── Correct category if needed
│   │   └── Click "Approve"
│   └── POST /api/review/:id/approve
│       └── Send: final category (if corrected)
│
├── [7] BACKEND: Review Service
│   ├── Receive approval
│   ├── Update transaction (status: 'approved', final_category)
│   ├── If category corrected:
│   │   └── Store learning rule (merchant → category)
│   └── Queue journal entry job
│
├── [8] WORKER: Journal Entry Worker (CRITICAL)
│   ├── Pick job from queue
│   ├── Get approved transaction
│   ├── Determine transaction type (income/expense)
│   ├── Get account codes from category mapping
│   ├── Create double-entry journal entries:
│   │   ├── FOR INCOME:
│   │   │   ├── Debit: Bank (1000)
│   │   │   └── Credit: Revenue (4xxx)
│   │   └── FOR EXPENSE:
│   │       ├── Debit: Expense (6xxx) - net
│   │       ├── Debit: VAT (2110) - vat
│   │       └── Credit: Bank (1000) - gross
│   ├── VALIDATE: Debits = Credits
│   ├── Insert journal_entries records
│   └── Update transaction (status: 'journaled')
│
├── [9] FRONTEND: Reports
│   ├── User selects report type (Income Statement)
│   ├── User selects client + date range
│   ├── GET /api/reports/income-statement?client=X&start=Y&end=Z
│   └── Display formatted report
│
├── [10] BACKEND: Reports Service
│   ├── Query journal_entries table
│   ├── Group by account type:
│   │   ├── Revenue accounts (4000-4999)
│   │   ├── COGS accounts (5000-5999)
│   │   └── Expense accounts (6000-7999)
│   ├── Calculate:
│   │   ├── Total Revenue
│   │   ├── Total COGS → Gross Profit
│   │   ├── Total Expenses → Net Profit
│   │   └── Margins (%)
│   ├── VALIDATE accounting equation
│   └── Return formatted report
│
└── [11] FRONTEND: Export
    ├── User selects format (IRIS Kashflow)
    ├── User selects client + date range
    ├── GET /api/export?client=X&format=iris&start=Y&end=Z
    ├── Backend generates CSV in IRIS format
    ├── File downloads to user's computer
    └── User imports CSV into IRIS Kashflow
│
END: Transactions are now in client's accounting software
```

---

## 🎯 KEY METRICS & MONITORING

```
MONITORING TREE
│
├── 📊 PERFORMANCE METRICS
│   ├── Frontend (RUM - Real User Monitoring)
│   │   ├── Page Load Time (<2s target)
│   │   ├── Time to Interactive (<3s target)
│   │   └── Largest Contentful Paint (<2.5s target)
│   ├── Backend API (APM - Application Performance Monitoring)
│   │   ├── Response time p50 (<200ms)
│   │   ├── Response time p95 (<500ms)
│   │   ├── Response time p99 (<2s)
│   │   └── Error rate (<1%)
│   ├── Workers (Job Processing)
│   │   ├── Queue depth (<1,000 jobs)
│   │   ├── Processing rate (>100 docs/hour)
│   │   ├── Job duration (avg <30s per document)
│   │   └── Retry rate (<5%)
│   └── Database
│       ├── Query time p95 (<100ms)
│       ├── Connection pool usage (<50%)
│       ├── Database size
│       └── Slow queries (>500ms)
│
├── 💰 COST METRICS
│   ├── Claude API
│   │   ├── Daily cost (<£30/day target)
│   │   ├── Cost per document (<£0.04 target)
│   │   ├── Haiku vs Sonnet ratio (80/20 target)
│   │   └── Token usage per request
│   ├── Infrastructure
│   │   ├── Railway (backend hosting): ~£100-200/month
│   │   ├── Supabase (database): £25-50/month
│   │   ├── Vercel (frontend): £0 (free tier)
│   │   └── Total: <£300/month dev, <£1,000/month production
│   └── Total Monthly Cost Target
│       ├── Development: £100-300/month
│       └── Production: £750-1,200/month (break-even)
│
├── 🎯 BUSINESS METRICS
│   ├── User Metrics
│   │   ├── Daily Active Users (DAU)
│   │   ├── Weekly Active Users (WAU)
│   │   ├── Monthly Active Users (MAU)
│   │   └── User retention (Day 1, Day 7, Day 30)
│   ├── Usage Metrics
│   │   ├── Documents uploaded per day
│   │   ├── Documents processed per day
│   │   ├── Transactions reviewed per day
│   │   ├── Reports generated per day
│   │   └── Exports performed per day
│   ├── Accuracy Metrics (CRITICAL)
│   │   ├── Extraction accuracy (>95% target)
│   │   ├── Categorization accuracy (>90% target)
│   │   ├── Matching accuracy (>85% target)
│   │   └── Accounting equation balanced (100% required)
│   └── Support Metrics
│       ├── Error rate per user
│       ├── Time to first value (setup → first export)
│       └── Customer satisfaction (NPS)
│
└── 🚨 ALERTS
    ├── Critical Alerts (Email + Slack)
    │   ├── API down (3 failed health checks)
    │   ├── Database down
    │   ├── Accounting equation unbalanced
    │   ├── Data breach detected
    │   └── Payment failed
    ├── Warning Alerts (Slack only)
    │   ├── API slow (p95 >2s)
    │   ├── High cost (>£30/day Claude API)
    │   ├── Queue backup (>5,000 jobs)
    │   ├── Low disk space (>80%)
    │   └── Error rate elevated (>5%)
    └── Info Alerts (Dashboard only)
        ├── New user signup
        ├── Document processed
        └── Export completed
```

---

## 📈 PRODUCT ROADMAP (Future Enhancements)

```
FUTURE FEATURES (Post-MVP)
│
├── Phase 2 (Months 6-12)
│   ├── Mobile App (React Native)
│   │   └── In-app camera for receipt scanning
│   ├── Bank API Integrations
│   │   ├── Plaid integration
│   │   ├── TrueLayer integration
│   │   └── Auto-fetch bank transactions
│   ├── Advanced Reporting
│   │   ├── Custom report builder
│   │   ├── Forecasting
│   │   └── Budget vs Actual
│   └── Email Integration
│       └── Forward receipts to email → auto-process
│
├── Phase 3 (Year 2)
│   ├── Multi-Currency Support
│   ├── Payroll Integration
│   ├── Expense Management
│   │   ├── Employee expense claims
│   │   └── Mileage tracking
│   ├── White-Label Solution
│   │   └── Rebrand for accounting firms
│   └── API for Third-Party Integrations
│
└── Phase 4 (Year 3+)
    ├── AI Bookkeeper (Fully Automated)
    │   └── Zero manual review needed
    ├── Tax Filing Automation
    │   ├── Corporation Tax (CT600)
    │   ├── Self-Assessment
    │   └── VAT MTD submission
    ├── Advisory Dashboard
    │   ├── Cash flow forecasting
    │   ├── Profitability analysis
    │   └── Recommendations
    └── Enterprise Features
        ├── Multi-org management
        ├── Advanced permissions
        └── SSO (Single Sign-On)
```

---

## ✅ SUMMARY

**Your product has:**
- **10 frontend modules** (30+ screens)
- **9 backend services** (15+ API endpoints)
- **5 background workers** (processing pipeline)
- **12+ database tables** (structured data)
- **5 external integrations** (Claude, Supabase, Stripe, etc.)
- **Comprehensive monitoring** (errors, performance, costs)

**Data flows through:**
Upload → Extract → Categorize → Match → Review → Journal → Report → Export

**Monitored by:**
Sentry (errors) + PostHog (analytics) + Custom dashboard (costs)

**You have the complete product tree!** 🌳

---

**Created:** February 2, 2026  
**Status:** Complete ✅  
**Purpose:** Visual reference for entire system architecture
