# DEPLOYMENT & CI/CD GUIDE
## Production Deployment Strategy

**Version:** 1.0  
**Date:** February 3, 2026  
**Purpose:** Complete deployment pipeline from development to production

---

## 🎯 **DEPLOYMENT STRATEGY OVERVIEW**

### **Environments:**

```
Development → Staging → Production

DEVELOPMENT:
- Local machine
- Hot reload
- Debug mode
- Mock services
- Local database

STAGING:
- Railway (backend)
- Vercel (frontend)
- Test database
- Real services
- Beta testing

PRODUCTION:
- Railway (backend)
- Vercel (frontend)
- Production database
- All services live
- Public access
```

---

## 🔧 **CI/CD PIPELINE**

### **GitHub Actions Workflow:**

```yaml
# .github/workflows/ci-cd.yml

name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20.x'

jobs:
  # ============================================
  # LINT & TYPE CHECK
  # ============================================
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          cd backend && npm ci
          cd ../frontend && npm ci
      
      - name: Lint backend
        run: cd backend && npm run lint
      
      - name: Lint frontend
        run: cd frontend && npm run lint
      
      - name: Type check backend
        run: cd backend && npm run typecheck
      
      - name: Type check frontend
        run: cd frontend && npm run typecheck

  # ============================================
  # UNIT TESTS
  # ============================================
  test-backend:
    name: Backend Tests
    runs-on: ubuntu-latest
    needs: lint
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      
      - name: Install dependencies
        run: cd backend && npm ci
      
      - name: Run tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379
        run: cd backend && npm test -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info
          flags: backend

  test-frontend:
    name: Frontend Tests
    runs-on: ubuntu-latest
    needs: lint
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      
      - name: Install dependencies
        run: cd frontend && npm ci
      
      - name: Run tests
        run: cd frontend && npm test -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./frontend/coverage/lcov.info
          flags: frontend

  # ============================================
  # E2E TESTS
  # ============================================
  test-e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [test-backend, test-frontend]
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      
      - name: Install Playwright
        run: cd frontend && npx playwright install --with-deps
      
      - name: Run E2E tests
        run: cd frontend && npm run test:e2e
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: frontend/playwright-report/

  # ============================================
  # BUILD
  # ============================================
  build:
    name: Build Application
    runs-on: ubuntu-latest
    needs: [test-backend, test-frontend]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      
      - name: Build backend
        run: |
          cd backend
          npm ci
          npm run build
      
      - name: Build frontend
        env:
          REACT_APP_API_URL: ${{ secrets.API_URL }}
        run: |
          cd frontend
          npm ci
          npm run build
      
      - name: Upload backend artifact
        uses: actions/upload-artifact@v3
        with:
          name: backend-build
          path: backend/dist/
      
      - name: Upload frontend artifact
        uses: actions/upload-artifact@v3
        with:
          name: frontend-build
          path: frontend/build/

  # ============================================
  # DEPLOY TO STAGING
  # ============================================
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/develop'
    environment:
      name: staging
      url: https://staging-app.yourcompany.com
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy backend to Railway (Staging)
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_STAGING_TOKEN }}
        run: |
          npm install -g @railway/cli
          cd backend
          railway up --service backend-staging
      
      - name: Deploy frontend to Vercel (Staging)
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        run: |
          cd frontend
          npx vercel --token=$VERCEL_TOKEN --yes

  # ============================================
  # DEPLOY TO PRODUCTION
  # ============================================
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [build, test-e2e]
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://app.yourcompany.com
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy backend to Railway (Production)
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_PRODUCTION_TOKEN }}
        run: |
          npm install -g @railway/cli
          cd backend
          railway up --service backend-production
      
      - name: Deploy frontend to Vercel (Production)
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        run: |
          cd frontend
          npx vercel --prod --token=$VERCEL_TOKEN --yes
      
      - name: Run smoke tests
        run: |
          curl -f https://api.yourcompany.com/health || exit 1
          curl -f https://app.yourcompany.com || exit 1
      
      - name: Notify Sentry of deployment
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: your-org
          SENTRY_PROJECT: ai-accounting
        run: |
          npx @sentry/cli releases new ${{ github.sha }}
          npx @sentry/cli releases set-commits ${{ github.sha }} --auto
          npx @sentry/cli releases finalize ${{ github.sha }}
```

---

## 🚀 **RAILWAY DEPLOYMENT (Backend)**

### **Setup:**

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Create project
railway init

# 4. Link to repository
railway link

# 5. Add services
railway add --database postgres
railway add --database redis
```

### **Railway Configuration:**

```json
// railway.json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### **Environment Variables (Railway):**

```bash
# Set via Railway dashboard or CLI
railway variables set NODE_ENV=production
railway variables set PORT=3001
railway variables set DATABASE_URL=${{Postgres.DATABASE_URL}}
railway variables set REDIS_URL=${{Redis.REDIS_URL}}
railway variables set JWT_SECRET=your-production-secret
railway variables set ANTHROPIC_API_KEY=sk-ant-xxx
railway variables set SUPABASE_URL=https://xxx.supabase.co
railway variables set SUPABASE_SERVICE_KEY=xxx
```

---

## 🎨 **VERCEL DEPLOYMENT (Frontend)**

### **Setup:**

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Login
vercel login

# 3. Link project
cd frontend
vercel link

# 4. Deploy
vercel --prod
```

### **Vercel Configuration:**

```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "build"
      }
    }
  ],
  "routes": [
    {
      "src": "/static/(.*)",
      "headers": {
        "cache-control": "public, max-age=31536000, immutable"
      }
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "env": {
    "REACT_APP_API_URL": "@api-url"
  }
}
```

### **Environment Variables (Vercel):**

```bash
# Set via Vercel dashboard or CLI
vercel env add REACT_APP_API_URL production
vercel env add REACT_APP_SUPABASE_URL production
vercel env add REACT_APP_SUPABASE_ANON_KEY production
vercel env add REACT_APP_SENTRY_DSN production
vercel env add REACT_APP_POSTHOG_KEY production
```

---

## 🗄️ **DATABASE MIGRATIONS**

### **Migration Strategy:**

```bash
# Create migration
npm run migration:create add_audit_log_table

# Run migrations
npm run migration:run

# Rollback migration
npm run migration:rollback
```

### **Migration Script:**

```typescript
// backend/src/migrations/001_initial_schema.sql

-- migrations are run in order by filename
-- each migration should be idempotent

-- Add audit_log table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_org 
ON audit_log(organization_id, created_at DESC);

-- Insert migration record
INSERT INTO schema_migrations (version) 
VALUES ('001_initial_schema')
ON CONFLICT DO NOTHING;
```

### **Supabase Migrations:**

```bash
# Initialize Supabase CLI
npx supabase init

# Create migration
npx supabase migration new add_audit_log

# Push to production
npx supabase db push

# Or run via SQL editor in Supabase dashboard
```

---

## 🔐 **SECRETS MANAGEMENT**

### **GitHub Secrets (Required):**

```
RAILWAY_STAGING_TOKEN
RAILWAY_PRODUCTION_TOKEN
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
SENTRY_AUTH_TOKEN
CODECOV_TOKEN
```

### **Railway Secrets:**

```
JWT_SECRET (generate: openssl rand -hex 32)
ENCRYPTION_KEY (generate: openssl rand -hex 32)
ANTHROPIC_API_KEY
SUPABASE_SERVICE_KEY
SENDGRID_API_KEY (or RESEND_API_KEY)
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

### **Vercel Secrets:**

```
REACT_APP_API_URL
REACT_APP_SUPABASE_URL
REACT_APP_SUPABASE_ANON_KEY
REACT_APP_SENTRY_DSN
REACT_APP_POSTHOG_KEY
```

---

## 📊 **HEALTH CHECKS**

### **Backend Health Endpoint:**

```typescript
// backend/src/routes/health.ts

app.get('/health', async (c) => {
  try {
    // Check database
    const { data: dbHealth } = await supabase
      .from('organizations')
      .select('count')
      .limit(1)
    
    // Check Redis
    await redis.ping()
    
    // Check Claude API (optional - don't want to hit rate limits)
    // const claudeHealth = await testClaudeConnection()
    
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version,
      services: {
        database: dbHealth ? 'healthy' : 'unhealthy',
        redis: 'healthy',
        // claude: claudeHealth
      }
    })
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    }, 503)
  }
})
```

---

## 🔄 **ZERO-DOWNTIME DEPLOYMENT**

### **Strategy:**

```
1. Deploy new version (Railway creates new instance)
2. Run health checks on new instance
3. If healthy, route traffic to new instance
4. Keep old instance running for 5 minutes
5. If no errors, shut down old instance
6. If errors, rollback to old instance

Railway handles this automatically!
```

### **Database Migrations (Critical):**

```
SAFE MIGRATIONS:
✅ Adding new table
✅ Adding new column (with default)
✅ Adding index
✅ Adding constraint (not null with default)

RISKY MIGRATIONS:
⚠️ Dropping column (use feature flags first)
⚠️ Renaming column (use view first)
⚠️ Changing data type (migrate data first)
⚠️ Adding NOT NULL without default (fails for existing rows)

STRATEGY:
1. Deploy code that works with OLD and NEW schema
2. Run migration
3. Deploy code that uses NEW schema only
4. Remove old schema (if needed)
```

---

## 📦 **ROLLBACK STRATEGY**

### **Automatic Rollback:**

```yaml
# Railway automatically rolls back if:
- Health check fails
- Instance crashes repeatedly
- Deployment fails

# Manual rollback:
railway rollback
```

### **Database Rollback:**

```sql
-- Each migration should have a rollback script

-- migrations/001_add_audit_log_up.sql
CREATE TABLE audit_log (...);

-- migrations/001_add_audit_log_down.sql
DROP TABLE IF EXISTS audit_log;

-- Run rollback
npx supabase migration revert
```

---

## 🧪 **PRE-DEPLOYMENT CHECKLIST**

### **Before Pushing to Main:**

```
CODE QUALITY:
□ All tests passing
□ Linting clean
□ TypeScript compiles
□ No console.logs
□ No commented code
□ No hardcoded secrets

FUNCTIONALITY:
□ Feature works in development
□ Feature tested manually
□ Edge cases handled
□ Error handling in place
□ Loading states added

DATABASE:
□ Migrations tested locally
□ Migrations are reversible
□ No breaking schema changes
□ Indexes added for new queries

SECURITY:
□ Input validation added
□ Authentication required
□ Authorization checked
□ Rate limiting in place
□ No exposed secrets

MONITORING:
□ Logging added
□ Error tracking configured
□ Performance metrics added
□ Alerts configured
```

---

## 🚨 **POST-DEPLOYMENT MONITORING**

### **Monitor These Metrics:**

```
APPLICATION:
- Response times (p50, p95, p99)
- Error rates
- Request volume
- Active users

DATABASE:
- Query performance
- Connection pool usage
- Slow queries
- Disk usage

INFRASTRUCTURE:
- CPU usage
- Memory usage
- Network I/O
- Disk I/O

BUSINESS:
- Document uploads
- AI processing success rate
- User signups
- Revenue
```

### **Alerting:**

```yaml
# Set up alerts for:

CRITICAL (PagerDuty):
- Site down (5xx > 1% for 5 minutes)
- Database connection failed
- Payment processing failed
- Data loss detected

WARNING (Slack):
- Response time > 3s (p95)
- Error rate > 0.5%
- Claude API errors > 5%
- Disk usage > 80%

INFO (Email):
- Deployment completed
- Weekly metrics report
- Monthly revenue report
```

---

## 📝 **DEPLOYMENT RUNBOOK**

### **Standard Deployment (Main Branch):**

```bash
# 1. Ensure all tests pass locally
npm run test

# 2. Push to main
git push origin main

# 3. GitHub Actions runs automatically:
#    - Lint
#    - Tests
#    - Build
#    - Deploy to Railway
#    - Deploy to Vercel
#    - Run smoke tests

# 4. Monitor deployment
#    - Watch GitHub Actions
#    - Check Railway logs
#    - Check Vercel logs

# 5. Verify deployment
curl https://api.yourcompany.com/health
curl https://app.yourcompany.com

# 6. Monitor for 30 minutes
#    - Watch Sentry for errors
#    - Check response times
#    - Monitor user activity

# 7. If issues, rollback
railway rollback
vercel rollback
```

### **Hotfix Deployment:**

```bash
# 1. Create hotfix branch from main
git checkout -b hotfix/critical-bug main

# 2. Fix and test
npm run test

# 3. Push directly to main (skip PR for critical issues)
git checkout main
git merge hotfix/critical-bug
git push origin main

# 4. Monitor closely
# 5. Create PR retroactively for documentation
```

---

## 🔧 **TROUBLESHOOTING**

### **Common Issues:**

**Deployment Fails:**
```bash
# Check Railway logs
railway logs

# Check build logs
railway logs --build

# Test locally
npm run build
npm start
```

**Database Migration Fails:**
```bash
# Check migration status
npx supabase migration list

# Rollback last migration
npx supabase migration revert

# Test migration locally first
npx supabase db reset
npx supabase migration up
```

**Environment Variables Missing:**
```bash
# List all variables
railway variables

# Add missing variable
railway variables set KEY=value

# Restart service
railway restart
```

---

**This deployment guide ensures smooth, automated, zero-downtime deployments to production!**
