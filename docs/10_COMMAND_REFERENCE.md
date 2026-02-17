# QUICK COMMAND REFERENCE CARD
## All Commands for AI Accounting Build

**Version:** 1.0  
**Purpose:** Quick reference for all terminal commands, git commands, npm commands

---

## SETUP COMMANDS (Day 0-1)

### **Verify Installations**
```bash
# Check Node.js
node --version          # Should show: v20.x.x
npm --version           # Should show: 10.x.x

# Check Git
git --version           # Should show: git version 2.x.x

# Check Cursor
cursor --version        # Should work if installed correctly
```

### **Configure Git**
```bash
# Set your name and email (do this once)
git config --global user.name "Your Full Name"
git config --global user.email "your-email@gmail.com"

# Verify it worked
git config --global user.name
git config --global user.email
```

### **Clone Repository**
```bash
# Navigate to where you want the project
cd Desktop
mkdir Projects
cd Projects

# Clone your GitHub repo
git clone https://github.com/YOUR-USERNAME/ai-accounting.git
cd ai-accounting

# Verify files
ls -la        # Mac/Linux
dir           # Windows
```

---

## PROJECT STRUCTURE COMMANDS (Day 1)

### **Create React Frontend**
```bash
# Create React app with TypeScript
npx create-react-app frontend --template typescript

# Go into frontend folder
cd frontend

# Install Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Install other dependencies
npm install react-router-dom @tanstack/react-query axios
npm install react-hook-form zod
npm install lucide-react date-fns
npm install @sentry/react posthog-js

# Install dev dependencies
npm install -D vitest @testing-library/react @testing-library/user-event
npm install -D @playwright/test

# Start dev server
npm start               # Opens browser to localhost:3000

# Stop server
Ctrl+C or Cmd+C
```

### **Create Backend**
```bash
# Go back to project root
cd ..

# Create backend folder
mkdir backend
cd backend

# Initialize Node.js project
npm init -y

# Install production dependencies
npm install hono @hono/node-server
npm install @supabase/supabase-js
npm install @anthropic-ai/sdk
npm install bullmq ioredis
npm install winston bcrypt jsonwebtoken dotenv cors

# Install dev dependencies
npm install -D typescript @types/node
npm install -D ts-node nodemon
npm install -D vitest supertest @types/supertest
npm install -D @types/bcrypt @types/jsonwebtoken

# Setup TypeScript
npx tsc --init

# Create folder structure
mkdir src
mkdir src/routes
mkdir src/lib
mkdir src/workers
mkdir tests

# Start dev server
npm run dev             # Server runs on localhost:3001

# Stop server
Ctrl+C or Cmd+C
```

---

## GIT COMMANDS (Daily Use)

### **Basic Git Workflow**
```bash
# Check what changed
git status

# Add all changes
git add .

# Add specific file
git add path/to/file.ts

# Commit with message
git commit -m "Add login feature"

# Push to GitHub
git push

# Pull latest changes
git pull

# See commit history
git log

# See recent commits (short)
git log --oneline -10
```

### **Branch Commands**
```bash
# Create new branch
git checkout -b feature/new-feature

# Switch to existing branch
git checkout main

# List all branches
git branch

# Delete branch
git branch -d feature/old-feature
```

### **Undo Changes**
```bash
# Undo changes to a file (not committed yet)
git checkout -- filename.ts

# Unstage file (remove from git add)
git reset HEAD filename.ts

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes) ⚠️ DANGEROUS
git reset --hard HEAD~1
```

---

## NPM COMMANDS (Daily Use)

### **Install Packages**
```bash
# Install a package
npm install package-name

# Install as dev dependency
npm install -D package-name

# Install specific version
npm install package-name@1.2.3

# Install all packages (from package.json)
npm install

# Update packages
npm update
```

### **Run Scripts**
```bash
# Frontend (from frontend folder)
npm start               # Start dev server (port 3000)
npm test                # Run tests
npm run build           # Build for production

# Backend (from backend folder)
npm run dev             # Start dev server with hot reload
npm run build           # Compile TypeScript to JavaScript
npm start               # Run compiled JavaScript
npm test                # Run tests
```

---

## CURSOR AI COMMANDS (In Editor)

### **Keyboard Shortcuts**
```
Cmd+K or Ctrl+K        = Open AI chat
Cmd+L or Ctrl+L        = Select code for editing
Tab                    = Accept AI suggestion
Esc                    = Reject suggestion
Cmd+/ or Ctrl+/        = Toggle comment
Cmd+P or Ctrl+P        = Quick file open
Cmd+Shift+P or Ctrl+Shift+P = Command palette
Cmd+S or Ctrl+S        = Save file
Cmd+F or Ctrl+F        = Find in file
Cmd+Shift+F or Ctrl+Shift+F = Find in all files
```

### **Terminal in Cursor**
```
Ctrl+` or Cmd+`        = Toggle terminal
Cmd+Shift+` or Ctrl+Shift+` = New terminal
```

---

## SUPABASE COMMANDS (SQL Editor)

### **Create Tables**
```sql
-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row-Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Users can only see their org"
  ON organizations
  FOR SELECT
  USING (auth.uid() IN (
    SELECT user_id FROM users WHERE organization_id = id
  ));
```

### **Query Data**
```sql
-- Select all
SELECT * FROM organizations;

-- Select with filter
SELECT * FROM users WHERE email = 'test@example.com';

-- Count rows
SELECT COUNT(*) FROM documents;

-- Join tables
SELECT 
  d.filename,
  c.name as client_name
FROM documents d
JOIN clients c ON d.client_id = c.id
LIMIT 10;
```

---

## TESTING COMMANDS

### **Run Tests**
```bash
# Run all tests
npm test

# Run specific test file
npm test auth.test.ts

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run E2E tests (Playwright)
npx playwright test

# Run E2E tests in UI mode
npx playwright test --ui
```

---

## RAILWAY DEPLOYMENT

### **Railway CLI Commands**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Link to existing project
railway link

# Set environment variable
railway variables set KEY=value

# Deploy
railway up

# View logs
railway logs

# Open in browser
railway open
```

---

## VERCEL DEPLOYMENT

### **Vercel CLI Commands**
```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod

# Add environment variable
vercel env add VARIABLE_NAME

# View logs
vercel logs
```

---

## DEBUGGING COMMANDS

### **Check Running Processes**
```bash
# See what's running on port 3000 (frontend)
lsof -i :3000         # Mac/Linux
netstat -ano | findstr :3000  # Windows

# See what's running on port 3001 (backend)
lsof -i :3001         # Mac/Linux
netstat -ano | findstr :3001  # Windows

# Kill process on port
kill -9 $(lsof -t -i:3000)  # Mac/Linux
# Windows: Find PID from netstat, then:
taskkill /PID [PID] /F
```

### **Clear Cache**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules
npm install

# Clear build folder
rm -rf build
rm -rf dist
```

---

## COMMON FIXES

### **"Command not found"**
```bash
# Make sure you're in the right folder
pwd                    # Shows current directory

# Navigate to project
cd ~/Desktop/Projects/ai-accounting

# Make sure package is installed
npm list package-name
```

### **"Port already in use"**
```bash
# Kill process on port 3000
kill -9 $(lsof -t -i:3000)

# Or use different port
PORT=3002 npm start
```

### **"Permission denied"**
```bash
# Mac/Linux: Use sudo (be careful!)
sudo npm install -g package-name

# Windows: Run Command Prompt as Administrator
# Right-click → "Run as administrator"
```

### **Git conflicts**
```bash
# See conflicts
git status

# Abort merge
git merge --abort

# Take their version
git checkout --theirs path/to/file

# Take your version
git checkout --ours path/to/file
```

---

## DAILY WORKFLOW COMMANDS

### **Start Work**
```bash
# Navigate to project
cd ~/Desktop/Projects/ai-accounting

# Pull latest changes
git pull

# Start frontend (Terminal 1)
cd frontend
npm start

# Start backend (Terminal 2)
cd backend
npm run dev
```

### **End Work**
```bash
# Stop servers (in each terminal)
Ctrl+C or Cmd+C

# Check what changed
git status

# Add and commit
git add .
git commit -m "Descriptive message of what you did"

# Push to GitHub
git push
```

---

## ENVIRONMENT VARIABLES

### **Backend .env**
```bash
NODE_ENV=development
PORT=3001
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_KEY=eyJhbGc...
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=your-secret-key
DATABASE_URL=postgresql://...
```

### **Frontend .env**
```bash
REACT_APP_API_URL=http://localhost:3001
REACT_APP_SUPABASE_URL=https://xxxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGc...
REACT_APP_SENTRY_DSN=https://...
REACT_APP_POSTHOG_KEY=phc_...
```

---

## PACKAGE.JSON SCRIPTS

### **Frontend package.json**
```json
{
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "vitest",
    "eject": "react-scripts eject"
  }
}
```

### **Backend package.json**
```json
{
  "scripts": {
    "dev": "nodemon --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest"
  }
}
```

---

## CURSOR AI PROMPTS (Copy These!)

### **Create Component**
```
Create a [ComponentName] component based on this specification:

[Paste spec from docs/05_UI_UX_SPECIFICATION.md]

Use:
- TypeScript + React
- Tailwind CSS
- React hooks
- Our design system colors

File: frontend/src/components/[ComponentName].tsx
```

### **Create API Endpoint**
```
Create [HTTP METHOD] [endpoint] according to our API specification.

From docs/03_TECHNICAL_ARCHITECTURE.md:
[Paste API spec]

Requirements:
- Use Hono for routing
- Validate input
- Handle errors
- Return proper status codes
- Add logging

File: backend/src/routes/[resource].ts
```

### **Fix Error**
```
Fix this error:

[Paste error message]

File: [filename]
Current code:
[Paste code section with error]
```

---

## USEFUL LINKS (Bookmark These!)

**Project:**
- GitHub Repo: https://github.com/YOUR-USERNAME/ai-accounting
- Railway Dashboard: https://railway.app/dashboard
- Supabase Dashboard: https://app.supabase.com
- Vercel Dashboard: https://vercel.com/dashboard

**Documentation:**
- React: https://react.dev
- TypeScript: https://www.typescriptlang.org/docs
- Tailwind: https://tailwindcss.com/docs
- Hono: https://hono.dev
- Supabase: https://supabase.com/docs
- Claude API: https://docs.anthropic.com

**Tools:**
- Cursor: https://cursor.sh
- GitHub: https://github.com
- Node.js: https://nodejs.org

---

## PRINT THIS PAGE!

Put it next to your laptop. You'll reference it 100+ times.

**Most used commands:**
1. `npm start` / `npm run dev`
2. `git add . && git commit -m "message" && git push`
3. `Cmd+K` in Cursor (AI chat)
4. `npm install package-name`
5. `git status`

---

**Created:** February 2, 2026  
**Status:** Complete Reference ✅  
**Use:** Daily coding reference
