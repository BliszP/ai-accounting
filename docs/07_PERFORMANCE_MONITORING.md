# AI ACCOUNTING AUTOMATION
## Performance Optimization & Monitoring Strategy

**Version:** 1.0  
**Date:** February 1, 2026  
**Purpose:** Performance optimization, monitoring, alerting, and observability strategy

---

## OVERVIEW

**Why Performance & Monitoring Matter:**
- ⚡ **Speed** = User satisfaction (slow = users leave)
- 💰 **Cost** = Profitability (unoptimized = £1,556/month vs £750/month target)
- 🚨 **Alerts** = Prevent disasters (know problems before clients do)
- 📊 **Data** = Make informed decisions (what's slow? what's expensive?)
- 🔍 **Debugging** = Fix issues fast (logs show what went wrong)

**Philosophy:** "You can't improve what you don't measure"

---

## PERFORMANCE TARGETS

### **User-Facing Performance (SLAs)**

| Metric | Target | Critical Threshold | Monitoring |
|--------|--------|-------------------|------------|
| **Page Load (Dashboard)** | <2 seconds | >3 seconds | Real User Monitoring |
| **API Response (p95)** | <500ms | >2 seconds | APM |
| **Document Upload** | <5 seconds | >10 seconds | Custom metric |
| **Document Processing** | <24 hours | >48 hours | Queue monitoring |
| **Report Generation** | <3 seconds | >5 seconds | Custom metric |
| **Database Queries (p95)** | <100ms | >500ms | Query monitoring |

### **Backend Performance (Targets)**

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| **Claude API Latency (p95)** | <3 seconds | >10 seconds |
| **Worker Processing Rate** | 100 docs/hour | <50 docs/hour |
| **Memory Usage** | <70% | >90% |
| **CPU Usage** | <60% | >80% |
| **Database Connections** | <50 | >100 |
| **Redis Queue Depth** | <1,000 | >5,000 |

### **Cost Performance (Targets)**

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| **Claude API Cost (Monthly)** | £750 | >£1,200 |
| **Infrastructure Cost** | £200/month | >£300/month |
| **Cost per Document** | £0.03 | >£0.10 |
| **Haiku Usage Rate** | 80% | <70% |

---

## MONITORING STACK

### **1. Application Performance Monitoring (APM)**

**Tool: Sentry**
- **What:** Error tracking + Performance monitoring
- **Why:** Best for Node.js/React, generous free tier
- **Cost:** Free (5K errors/month), then $26/month

```bash
npm install --save @sentry/react @sentry/node
```

**Setup:**

```typescript
// src/lib/sentry.ts
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  
  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Session Replay (see what user did before error)
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  
  integrations: [
    new Sentry.BrowserTracing({
      routingInstrumentation: Sentry.reactRouterV6Instrumentation(
        React.useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes
      ),
    }),
    new Sentry.Replay(),
  ],
});
```

**Backend:**

```typescript
// server/lib/sentry.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  
  tracesSampleRate: 0.1,
  
  // Track slow database queries
  integrations: [
    new Sentry.Integrations.Postgres(),
  ],
});

// Middleware
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

// Error handler (must be last)
app.use(Sentry.Handlers.errorHandler());
```

**What to Track:**
- ✅ All unhandled errors
- ✅ API response times (p50, p75, p95, p99)
- ✅ Database query times
- ✅ Claude API call times
- ✅ User sessions (replay on error)

---

### **2. Product Analytics**

**Tool: PostHog**
- **What:** Product analytics + Feature flags + Session replay
- **Why:** Open-source, self-hostable, generous free tier
- **Cost:** Free (1M events/month), then $0.00031/event

```bash
npm install posthog-js posthog-node
```

**Setup:**

```typescript
// src/lib/posthog.ts
import posthog from 'posthog-js';

posthog.init(process.env.REACT_APP_POSTHOG_KEY, {
  api_host: 'https://app.posthog.com',
  autocapture: true,
  capture_pageview: true,
  capture_pageleave: true,
});

export default posthog;
```

**Track Key Events:**

```typescript
import posthog from '@/lib/posthog';

// Document uploaded
posthog.capture('document_uploaded', {
  file_type: file.type,
  file_size: file.size,
  client_id: clientId,
});

// Document processed
posthog.capture('document_processed', {
  document_id: documentId,
  extraction_time: processingTime,
  transaction_count: transactions.length,
  confidence_avg: avgConfidence,
});

// Transaction approved
posthog.capture('transaction_approved', {
  transaction_id: transactionId,
  category: category,
  amount: amount,
});

// Report generated
posthog.capture('report_generated', {
  report_type: 'income_statement',
  client_id: clientId,
  generation_time: generationTime,
});

// Export completed
posthog.capture('export_completed', {
  format: 'iris-kashflow',
  transaction_count: count,
  client_id: clientId,
});
```

**What to Track:**
- ✅ User actions (uploads, approvals, exports)
- ✅ Feature usage (which reports used most?)
- ✅ User flows (drop-off points)
- ✅ Time spent per feature
- ✅ Daily/weekly active users

---

### **3. Infrastructure Monitoring**

**Tool: Railway Built-in + Uptime Robot**

**Railway Metrics (Built-in):**
- CPU usage
- Memory usage
- Network I/O
- Deployment status
- Logs

**Uptime Robot (External Monitoring):**
- **What:** Uptime monitoring (ping website every 5 minutes)
- **Why:** Know if site is down before clients do
- **Cost:** Free (50 monitors)

```
Setup:
1. Go to uptimerobot.com
2. Add HTTP(s) monitor: https://your-app.railway.app
3. Set check interval: 5 minutes
4. Add alert contacts (email, SMS, Slack)
```

**What to Monitor:**
- ✅ API uptime (https://api.yourapp.com/health)
- ✅ Frontend uptime (https://yourapp.com)
- ✅ Database uptime (via health check endpoint)

---

### **4. Database Monitoring**

**Tool: Supabase Built-in Dashboard**

**Metrics to Watch:**
- Database size (GB used)
- Connection pool usage
- Slow queries (>100ms)
- Row-Level Security performance
- Index usage

**Setup Query Monitoring:**

```sql
-- Enable pg_stat_statements (slow query tracking)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slow queries
SELECT 
  query,
  calls,
  mean_exec_time,
  total_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- >100ms
ORDER BY mean_exec_time DESC
LIMIT 20;
```

**Add Custom Metrics:**

```typescript
// Track database query times
import { performance } from 'perf_hooks';

async function queryWithMetrics(query: string, params: any[]) {
  const start = performance.now();
  
  try {
    const result = await supabase.from('table').select(query);
    const duration = performance.now() - start;
    
    // Send to Sentry
    Sentry.metrics.distribution('database.query.duration', duration, {
      tags: { query: query.substring(0, 50) }
    });
    
    // Alert if slow
    if (duration > 500) {
      Sentry.captureMessage('Slow database query', {
        level: 'warning',
        extra: { query, duration }
      });
    }
    
    return result;
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
}
```

---

### **5. Cost Monitoring**

**Tool: Custom Dashboard + Alerts**

**Track Claude API Costs:**

```typescript
// server/lib/claude-metrics.ts
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function trackClaudeUsage(model: string, inputTokens: number, outputTokens: number) {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Pricing (as of Feb 2026)
  const pricing = {
    'claude-sonnet-4': {
      input: 0.003 / 1000,   // $0.003 per 1K input tokens
      output: 0.015 / 1000,  // $0.015 per 1K output tokens
    },
    'claude-haiku-3.5': {
      input: 0.0003 / 1000,  // $0.0003 per 1K input tokens
      output: 0.0012 / 1000, // $0.0012 per 1K output tokens
    }
  };
  
  const cost = 
    (inputTokens * pricing[model].input) + 
    (outputTokens * pricing[model].output);
  
  // Store in Redis (daily totals)
  await redis.hincrby(`claude:cost:${date}`, 'total_usd', Math.round(cost * 100)); // Store as cents
  await redis.hincrby(`claude:cost:${date}`, `${model}_calls`, 1);
  await redis.hincrby(`claude:cost:${date}`, `${model}_tokens`, inputTokens + outputTokens);
  
  // Store monthly total
  const month = date.substring(0, 7); // YYYY-MM
  await redis.hincrby(`claude:cost:month:${month}`, 'total_usd', Math.round(cost * 100));
  
  // Check if over budget
  const monthlyTotal = await redis.hget(`claude:cost:month:${month}`, 'total_usd');
  const monthlyUSD = parseInt(monthlyTotal || '0') / 100;
  
  if (monthlyUSD > 900) { // £750 ≈ $900
    // ALERT: Over budget!
    await sendAlert('Claude API cost over budget', {
      monthly_total: monthlyUSD,
      budget: 900,
      over_by: monthlyUSD - 900
    });
  }
  
  return cost;
}

// Use in Claude API calls
async function callClaude(prompt: string, useHaiku: boolean = true) {
  const model = useHaiku ? 'claude-haiku-3.5' : 'claude-sonnet-4';
  
  const response = await anthropic.messages.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1000,
  });
  
  // Track usage
  await trackClaudeUsage(
    model,
    response.usage.input_tokens,
    response.usage.output_tokens
  );
  
  return response;
}
```

**Daily Cost Report:**

```typescript
// server/jobs/daily-cost-report.ts
import { schedule } from 'node-cron';

// Run at 9am daily
schedule('0 9 * * *', async () => {
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  const costs = await redis.hgetall(`claude:cost:${yesterday}`);
  const totalUSD = parseInt(costs.total_usd || '0') / 100;
  
  // Send to Slack
  await sendSlackMessage({
    channel: '#alerts',
    text: `💰 Daily Cost Report (${yesterday})`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Claude API Costs*\nTotal: $${totalUSD.toFixed(2)}\nSonnet calls: ${costs['claude-sonnet-4_calls'] || 0}\nHaiku calls: ${costs['claude-haiku-3.5_calls'] || 0}`
        }
      }
    ]
  });
});
```

---

### **6. Logging**

**Tool: Winston (structured logging) + Railway Logs**

```bash
npm install winston
```

**Setup:**

```typescript
// server/lib/logger.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ai-accounting' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // Send errors to Sentry
    new winston.transports.Stream({
      stream: {
        write: (message: string) => {
          const log = JSON.parse(message);
          if (log.level === 'error') {
            Sentry.captureException(new Error(log.message), {
              extra: log
            });
          }
        }
      }
    })
  ]
});

export default logger;
```

**Use in Code:**

```typescript
import logger from '@/lib/logger';

// Info
logger.info('Document uploaded', {
  document_id: doc.id,
  client_id: doc.client_id,
  file_size: doc.file_size
});

// Warning
logger.warn('Low confidence extraction', {
  document_id: doc.id,
  confidence: 0.65,
  merchant: 'Unknown'
});

// Error
logger.error('Failed to process document', {
  document_id: doc.id,
  error: error.message,
  stack: error.stack
});

// Critical
logger.error('Database connection lost', {
  error: error.message,
  connections_active: poolStatus.active
});
```

---

## PERFORMANCE OPTIMIZATION

### **Frontend Optimization**

**1. Code Splitting**

```typescript
// Lazy load heavy components
import { lazy, Suspense } from 'react';

const ReportScreen = lazy(() => import('./pages/ReportScreen'));
const DocumentViewer = lazy(() => import('./components/DocumentViewer'));

function App() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <Routes>
        <Route path="/reports" element={<ReportScreen />} />
        <Route path="/documents/:id" element={<DocumentViewer />} />
      </Routes>
    </Suspense>
  );
}
```

**2. Image Optimization**

```typescript
// Lazy load images
<img 
  src={document.thumbnailUrl} 
  loading="lazy"
  decoding="async"
  alt={document.filename}
/>

// Use appropriate sizes
<img 
  srcSet={`
    ${document.thumbnail_small} 300w,
    ${document.thumbnail_medium} 600w,
    ${document.thumbnail_large} 1200w
  `}
  sizes="(max-width: 600px) 300px, (max-width: 1200px) 600px, 1200px"
/>
```

**3. Data Fetching Optimization**

```typescript
// Use React Query for caching
import { useQuery } from '@tanstack/react-query';

function DocumentList() {
  const { data, isLoading } = useQuery({
    queryKey: ['documents', clientId, filters],
    queryFn: () => fetchDocuments(clientId, filters),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}
```

**4. Virtual Scrolling**

```typescript
// For long lists (1000+ items)
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={transactions.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <TransactionRow 
      transaction={transactions[index]} 
      style={style}
    />
  )}
</FixedSizeList>
```

---

### **Backend Optimization**

**1. Database Query Optimization**

```typescript
// BAD: N+1 queries
for (const client of clients) {
  const documents = await getDocuments(client.id);
  // Makes 100 queries if 100 clients!
}

// GOOD: Single query with join
const clientsWithDocuments = await supabase
  .from('clients')
  .select(`
    *,
    documents (*)
  `);
```

**2. Add Database Indexes**

```sql
-- Index on frequently queried columns
CREATE INDEX idx_documents_client_id ON documents(client_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_transactions_document_id ON transactions(document_id);
CREATE INDEX idx_transactions_date ON transactions(date);

-- Composite index for common queries
CREATE INDEX idx_documents_client_status 
  ON documents(client_id, status);

-- Partial index (only index what you need)
CREATE INDEX idx_documents_pending 
  ON documents(id) 
  WHERE status = 'pending';
```

**3. Caching Strategy**

```typescript
// Use Redis for caching
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function getCachedData<T>(
  key: string, 
  fetchFn: () => Promise<T>,
  ttl: number = 300 // 5 minutes default
): Promise<T> {
  // Try cache first
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Fetch from database
  const data = await fetchFn();
  
  // Store in cache
  await redis.setex(key, ttl, JSON.stringify(data));
  
  return data;
}

// Use it
const client = await getCachedData(
  `client:${clientId}`,
  () => supabase.from('clients').select('*').eq('id', clientId).single(),
  600 // Cache for 10 minutes
);
```

**4. Claude API Optimization**

```typescript
// Batch receipts (process 10 at once)
async function extractReceiptsBatch(receipts: Receipt[]) {
  const prompt = `Extract transaction data from these ${receipts.length} receipts:
  
${receipts.map((r, i) => `
Receipt ${i + 1}:
[Image ${i + 1}]
`).join('\n')}

Return JSON array with one object per receipt.`;

  const response = await callClaude(prompt, true); // Use Haiku
  
  // Parse response
  const transactions = JSON.parse(response.content[0].text);
  
  // Cost: 1 API call instead of 10!
  return transactions;
}

// Use Haiku by default, Sonnet for complex
function shouldUseHaiku(document: Document): boolean {
  // Use Haiku for:
  // - Clear receipts
  // - Standard bank statements
  // Use Sonnet for:
  // - Poor quality images
  // - Complex invoices
  // - Handwritten receipts
  
  if (document.type === 'receipt' && document.quality > 0.7) {
    return true; // Haiku (10x cheaper)
  }
  
  return false; // Sonnet
}
```

**5. Worker Optimization**

```typescript
// Process in parallel (but with concurrency limit)
import pLimit from 'p-limit';

const limit = pLimit(5); // Max 5 concurrent

async function processDocuments(documents: Document[]) {
  const promises = documents.map(doc => 
    limit(() => processDocument(doc))
  );
  
  await Promise.all(promises);
}
```

---

## ALERTING & INCIDENT RESPONSE

### **Alert Channels**

**1. Slack Integration**

```typescript
// server/lib/alerts.ts
import { WebClient } from '@slack/web-api';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function sendAlert(
  severity: 'info' | 'warning' | 'critical',
  title: string,
  details: Record<string, any>
) {
  const emoji = {
    info: ':information_source:',
    warning: ':warning:',
    critical: ':rotating_light:'
  };
  
  await slack.chat.postMessage({
    channel: '#alerts',
    text: `${emoji[severity]} ${title}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji[severity]} ${title}`
        }
      },
      {
        type: 'section',
        fields: Object.entries(details).map(([key, value]) => ({
          type: 'mrkdwn',
          text: `*${key}:*\n${value}`
        }))
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `<!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`
          }
        ]
      }
    ]
  });
}
```

**2. Email Alerts (Critical Only)**

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.ALERT_EMAIL,
    pass: process.env.ALERT_EMAIL_PASSWORD
  }
});

async function sendCriticalAlert(title: string, details: string) {
  await transporter.sendMail({
    from: process.env.ALERT_EMAIL,
    to: process.env.ADMIN_EMAIL,
    subject: `🚨 CRITICAL: ${title}`,
    html: `
      <h2>Critical Alert</h2>
      <h3>${title}</h3>
      <pre>${details}</pre>
      <p>Time: ${new Date().toISOString()}</p>
    `
  });
}
```

---

### **Alert Rules**

| Alert | Condition | Severity | Channel | Action |
|-------|-----------|----------|---------|--------|
| **API Down** | Health check fails 3x | CRITICAL | Slack + Email | Investigate immediately |
| **Database Down** | Connection fails | CRITICAL | Slack + Email | Check Supabase status |
| **High Error Rate** | >10 errors/minute | CRITICAL | Slack | Check Sentry |
| **Slow API** | p95 >2 seconds | WARNING | Slack | Optimize queries |
| **High Cost** | >£30/day Claude API | WARNING | Slack | Review usage |
| **Queue Backup** | >5,000 jobs pending | WARNING | Slack | Scale workers |
| **Low Disk Space** | >80% used | WARNING | Slack | Clean up old files |
| **Failed Deployment** | Deploy errors | CRITICAL | Slack | Rollback |

---

## DASHBOARDS

### **1. Operations Dashboard (Daily Use)**

**Tool:** Custom React dashboard + PostHog

**Metrics to Display:**
```
┌─────────────────────────────────────────────┐
│ AI Accounting - Operations Dashboard       │
├─────────────────────────────────────────────┤
│                                             │
│ Today's Stats (Feb 1, 2026)                │
│ ┌────────────┬────────────┬────────────┐  │
│ │ Documents  │ Processed  │ Pending    │  │
│ │ Uploaded   │            │ Review     │  │
│ │   247      │    239     │    23      │  │
│ └────────────┴────────────┴────────────┘  │
│                                             │
│ System Health                               │
│ ┌────────────────────────────────────────┐ │
│ │ API Uptime:       99.95% ✅            │ │
│ │ Avg Response:     245ms ✅             │ │
│ │ Error Rate:       0.02% ✅             │ │
│ │ Queue Depth:      134 ✅               │ │
│ └────────────────────────────────────────┘ │
│                                             │
│ Costs (This Month)                          │
│ ┌────────────────────────────────────────┐ │
│ │ Claude API:       £245 / £750 ✅       │ │
│ │ Infrastructure:   £67 / £200 ✅        │ │
│ │ Total:            £312 / £950 ✅       │ │
│ │ Per Document:     £0.04 ✅             │ │
│ └────────────────────────────────────────┘ │
│                                             │
│ Extraction Accuracy (Last 100 docs)        │
│ ┌────────────────────────────────────────┐ │
│ │ Overall:          97.2% ✅             │ │
│ │ Bank Statements:  99.1% ✅             │ │
│ │ Receipts:         95.8% ✅             │ │
│ │ Invoices:         96.4% ✅             │ │
│ └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// src/pages/OperationsDashboard.tsx
import { useQuery } from '@tanstack/react-query';

function OperationsDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['ops-stats'],
    queryFn: fetchOperationalStats,
    refetchInterval: 30000, // Refresh every 30s
  });
  
  return (
    <div className="p-6">
      <h1>Operations Dashboard</h1>
      
      {/* Today's Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Documents Uploaded" value={stats.uploaded} />
        <StatCard title="Processed" value={stats.processed} />
        <StatCard title="Pending Review" value={stats.pending} />
      </div>
      
      {/* System Health */}
      <HealthPanel 
        uptime={stats.uptime}
        avgResponse={stats.avgResponse}
        errorRate={stats.errorRate}
      />
      
      {/* Costs */}
      <CostPanel costs={stats.costs} />
      
      {/* Accuracy */}
      <AccuracyPanel accuracy={stats.accuracy} />
    </div>
  );
}
```

---

### **2. Business Dashboard (Weekly Review)**

**Metrics:**
- Revenue (MRR, ARR)
- Customer count
- Churn rate
- Documents processed per customer
- Average extraction accuracy
- Customer satisfaction (NPS)

---

## PERFORMANCE TESTING

### **Load Testing Script**

```typescript
// tests/performance/load-test.ts
import autocannon from 'autocannon';

async function runLoadTest() {
  const result = await autocannon({
    url: 'http://localhost:3000/api/documents',
    connections: 100, // 100 concurrent users
    duration: 60, // 60 seconds
    headers: {
      'Authorization': 'Bearer test-token'
    }
  });
  
  console.log(result);
  
  // Assert performance targets
  if (result.latency.p95 > 500) {
    console.error('❌ FAIL: p95 latency >500ms');
    process.exit(1);
  }
  
  console.log('✅ PASS: Performance targets met');
}

runLoadTest();
```

---

## DEPLOYMENT MONITORING

### **Health Check Endpoint**

```typescript
// server/routes/health.ts
import { Router } from 'express';

const router = Router();

router.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {}
  };
  
  // Check database
  try {
    await supabase.from('clients').select('count').limit(1);
    health.checks.database = 'ok';
  } catch (error) {
    health.checks.database = 'error';
    health.status = 'degraded';
  }
  
  // Check Redis
  try {
    await redis.ping();
    health.checks.redis = 'ok';
  } catch (error) {
    health.checks.redis = 'error';
    health.status = 'degraded';
  }
  
  // Check queue
  try {
    const queueLength = await redis.llen('bull:document-processing');
    health.checks.queue = {
      status: queueLength < 5000 ? 'ok' : 'warning',
      length: queueLength
    };
  } catch (error) {
    health.checks.queue = 'error';
  }
  
  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

export default router;
```

---

## COST OPTIMIZATION CHECKLIST

**Daily:**
- [ ] Check Claude API usage (should be <£30/day)
- [ ] Review Haiku vs Sonnet ratio (target: 80% Haiku)
- [ ] Check for failed jobs (wasted API calls)

**Weekly:**
- [ ] Review slow database queries (optimize)
- [ ] Check infrastructure costs (Railway, Supabase)
- [ ] Review error logs (fix bugs to reduce retries)

**Monthly:**
- [ ] Analyze cost per document trend
- [ ] Review caching effectiveness
- [ ] Optimize batch sizes
- [ ] Review feature usage (disable unused features)

---

## INCIDENT RESPONSE PLAYBOOK

### **Scenario 1: API is Down**

**Symptoms:** Health check fails, users can't access site

**Response:**
1. Check Railway dashboard (is app running?)
2. Check Sentry (what errors?)
3. Check database (Supabase status?)
4. If app crashed: Check logs, restart if needed
5. If database down: Wait for Supabase, or failover
6. Communicate to users (status page)

**Prevention:**
- Set up auto-restart on Railway
- Use health checks
- Have backup database ready

---

### **Scenario 2: High Claude API Costs**

**Symptoms:** Daily cost >£50 (should be <£30)

**Response:**
1. Check Redis metrics (what's using API?)
2. Check for infinite loops or retries
3. Temporarily disable processing
4. Review recent code changes
5. Increase Haiku usage percentage
6. Fix bug causing overuse

**Prevention:**
- Set daily cost alerts (>£30)
- Monitor Haiku/Sonnet ratio
- Rate limit API calls

---

### **Scenario 3: Slow Performance**

**Symptoms:** API response >2 seconds, users complaining

**Response:**
1. Check Sentry APM (which endpoints slow?)
2. Check database (slow queries?)
3. Check Redis (cache hit rate?)
4. Scale up workers if queue backed up
5. Optimize slow queries
6. Add caching

**Prevention:**
- Monitor p95 response times
- Add database indexes
- Use caching aggressively

---

## DOCUMENT METADATA

**Version:** 1.0  
**Last Updated:** February 1, 2026  
**Status:** Complete ✅  

**Cross-references:**
- Technical Architecture: 03_TECHNICAL_ARCHITECTURE.md
- Testing Strategy: 06_TESTING_STRATEGY.md

---

**END OF PERFORMANCE & MONITORING DOCUMENT**
