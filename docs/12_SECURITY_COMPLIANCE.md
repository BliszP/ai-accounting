# SECURITY & COMPLIANCE GUIDE
## AI Accounting Automation - Production Security Requirements

**Version:** 2.0  
**Last Updated:** February 3, 2026  
**Status:** CRITICAL - Must Implement Before Production

---

## 🔒 **SECURITY REQUIREMENTS**

### **1. AUTHENTICATION & AUTHORIZATION**

#### **Password Requirements**
```typescript
// Enforce strong passwords
const PASSWORD_REQUIREMENTS = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  preventUserInfo: true // No name, email in password
}

// Validation schema
import { z } from 'zod'

const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character')
  .refine(
    (password) => !COMMON_PASSWORDS.includes(password.toLowerCase()),
    'Password is too common'
  )
```

#### **Multi-Factor Authentication (MFA)**
```typescript
// REQUIRED for production
// Implement using:
// - TOTP (Time-based One-Time Password)
// - SMS backup
// - Recovery codes

import speakeasy from 'speakeasy'

// Generate secret for user
const secret = speakeasy.generateSecret({
  name: 'AI Accounting',
  issuer: 'YourCompany'
})

// Verify token
const verified = speakeasy.totp.verify({
  secret: user.mfaSecret,
  encoding: 'base32',
  token: userProvidedToken,
  window: 1
})
```

#### **Session Management**
```typescript
// Secure session configuration
const SESSION_CONFIG = {
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  httpOnly: true,
  secure: true, // HTTPS only
  sameSite: 'strict',
  rolling: true // Extend on activity
}

// Implement session timeout
const IDLE_TIMEOUT = 30 * 60 * 1000 // 30 minutes
const ABSOLUTE_TIMEOUT = 12 * 60 * 60 * 1000 // 12 hours
```

---

### **2. DATA ENCRYPTION**

#### **Encryption at Rest**
```typescript
// Encrypt sensitive fields in database
import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY! // 32 bytes
const ALGORITHM = 'aes-256-gcm'

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  return JSON.stringify({
    iv: iv.toString('hex'),
    encryptedData: encrypted,
    authTag: authTag.toString('hex')
  })
}

function decrypt(encryptedText: string): string {
  const { iv, encryptedData, authTag } = JSON.parse(encryptedText)
  
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    ENCRYPTION_KEY,
    Buffer.from(iv, 'hex')
  )
  
  decipher.setAuthTag(Buffer.from(authTag, 'hex'))
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

// Use for:
// - Bank account numbers
// - VAT numbers
// - Client sensitive data
```

#### **Encryption in Transit**
```
REQUIRED:
- TLS 1.3 minimum
- HTTPS only (no HTTP)
- HSTS headers
- Secure WebSocket (WSS) if using real-time features

Configure in backend:
```typescript
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  next()
})
```

---

### **3. INPUT VALIDATION & SANITIZATION**

#### **Server-Side Validation (CRITICAL)**
```typescript
import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'

// NEVER trust client input!

// Client schema
const ClientSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(200, 'Name too long')
    .regex(/^[a-zA-Z0-9\s\-&.,()]+$/, 'Invalid characters in name'),
  
  vatNumber: z.string()
    .regex(/^GB\d{9}$/, 'Invalid UK VAT number format')
    .optional(),
  
  email: z.string()
    .email('Invalid email')
    .max(255),
  
  phone: z.string()
    .regex(/^(\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}$/, 'Invalid UK phone')
    .optional()
})

// Sanitize HTML content
function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: []
  })
}

// Use in API routes
app.post('/api/clients', async (req, res) => {
  try {
    // Validate
    const validated = ClientSchema.parse(req.body)
    
    // Sanitize
    const sanitized = {
      ...validated,
      name: sanitizeInput(validated.name)
    }
    
    // Process
    const client = await createClient(sanitized)
    res.json(client)
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors })
    }
    throw error
  }
})
```

#### **SQL Injection Prevention**
```typescript
// ALWAYS use parameterized queries
// Supabase protects against this, but be aware:

// ❌ NEVER DO THIS:
const query = `SELECT * FROM clients WHERE name = '${userInput}'`

// ✅ ALWAYS DO THIS:
const { data } = await supabase
  .from('clients')
  .select('*')
  .eq('name', userInput) // Parameterized automatically
```

---

### **4. RATE LIMITING**

```typescript
import rateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'
import { redis } from './lib/redis'

// General API rate limit
const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
})

// Strict rate limit for auth endpoints
const authLimiter = rateLimit({
  store: new RedisStore({ client: redis, prefix: 'rl:auth:' }),
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 attempts per 15 minutes
  message: 'Too many login attempts, please try again later'
})

// Apply to routes
app.use('/api/', apiLimiter)
app.use('/api/auth/', authLimiter)
```

---

### **5. CSRF PROTECTION**

```typescript
import csrf from 'csurf'
import cookieParser from 'cookie-parser'

app.use(cookieParser())

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict'
  }
})

// Apply to state-changing routes
app.post('/api/clients', csrfProtection, async (req, res) => {
  // Request must include valid CSRF token
})

// Frontend: Include token in requests
// Token sent in cookie: 'XSRF-TOKEN'
// Include in header: 'X-XSRF-TOKEN'
```

---

### **6. AUDIT LOGGING**

```sql
-- Audit log table
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_org ON audit_log(organization_id, created_at DESC);
CREATE INDEX idx_audit_log_table ON audit_log(table_name, created_at DESC);
```

```typescript
// Audit logging function
async function logAudit(params: {
  userId: string
  organizationId: string
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  tableName: string
  recordId: string
  oldValues?: any
  newValues?: any
  ipAddress: string
  userAgent: string
}) {
  await supabase.from('audit_log').insert({
    user_id: params.userId,
    organization_id: params.organizationId,
    action: params.action,
    table_name: params.tableName,
    record_id: params.recordId,
    old_values: params.oldValues,
    new_values: params.newValues,
    ip_address: params.ipAddress,
    user_agent: params.userAgent
  })
}

// Use in API routes
app.put('/api/clients/:id', async (req, res) => {
  const oldClient = await getClient(req.params.id)
  const newClient = await updateClient(req.params.id, req.body)
  
  await logAudit({
    userId: req.user.id,
    organizationId: req.user.organizationId,
    action: 'UPDATE',
    tableName: 'clients',
    recordId: req.params.id,
    oldValues: oldClient,
    newValues: newClient,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  })
  
  res.json(newClient)
})
```

---

### **7. FILE UPLOAD SECURITY**

```typescript
import fileType from 'file-type'
import crypto from 'crypto'

// Validate file uploads
async function validateFileUpload(file: Buffer, filename: string) {
  // 1. Check file size
  const MAX_SIZE = 10 * 1024 * 1024 // 10MB
  if (file.length > MAX_SIZE) {
    throw new Error('File too large')
  }
  
  // 2. Validate file type (don't trust extension!)
  const type = await fileType.fromBuffer(file)
  const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'text/csv']
  
  if (!type || !ALLOWED_TYPES.includes(type.mime)) {
    throw new Error('Invalid file type')
  }
  
  // 3. Scan for viruses (in production, use ClamAV or similar)
  // await scanForViruses(file)
  
  // 4. Generate safe filename
  const hash = crypto.createHash('sha256').update(file).digest('hex')
  const ext = type.ext
  const safeFilename = `${hash}.${ext}`
  
  return {
    buffer: file,
    filename: safeFilename,
    mimeType: type.mime,
    size: file.length
  }
}
```

---

## 🔐 **COMPLIANCE REQUIREMENTS**

### **GDPR Compliance**

#### **1. Data Processing Agreement (DPA)**
```markdown
REQUIRED CLAUSES:
- Purpose of data processing
- Types of personal data processed
- Categories of data subjects
- Duration of processing
- Rights and obligations of parties
- Sub-processors (Claude API, Supabase, etc.)
- Data security measures
- Breach notification procedures
```

#### **2. Privacy Policy**
```markdown
MUST INCLUDE:
- What data is collected
- Why it's collected
- How it's used
- How long it's kept
- Who it's shared with
- User rights (access, deletion, portability)
- Contact details of Data Protection Officer
- Cookie policy
- Children's privacy (if applicable)
```

#### **3. User Rights Implementation**

**Right to Access:**
```typescript
// Export all user data
app.get('/api/gdpr/export', async (req, res) => {
  const userId = req.user.id
  
  const userData = {
    profile: await getUser(userId),
    clients: await getClientsByUser(userId),
    documents: await getDocumentsByUser(userId),
    transactions: await getTransactionsByUser(userId),
    auditLog: await getAuditLogByUser(userId)
  }
  
  // Return as JSON download
  res.setHeader('Content-Disposition', 'attachment; filename=my-data.json')
  res.json(userData)
})
```

**Right to be Forgotten:**
```typescript
// Delete all user data
app.delete('/api/gdpr/delete-account', async (req, res) => {
  const userId = req.user.id
  
  // Soft delete (recommended for audit trail)
  await supabase
    .from('users')
    .update({
      deleted_at: new Date(),
      email: `deleted_${userId}@deleted.com`,
      name: 'Deleted User',
      // Null out all personal data
    })
    .eq('id', userId)
  
  // Or hard delete (if legally required)
  // await deleteAllUserData(userId)
  
  res.json({ message: 'Account deleted successfully' })
})
```

#### **4. Cookie Consent**
```typescript
// Cookie categories
const COOKIE_CATEGORIES = {
  necessary: true, // Always on
  analytics: false, // Requires consent
  marketing: false // Requires consent
}

// Frontend: Implement cookie banner
// Only set analytics/marketing cookies after consent
```

---

### **Making Tax Digital (MTD) Compliance**

```typescript
// VAT Return format for HMRC submission
interface MTDVATReturn {
  periodKey: string
  vatDueSales: number // Box 1
  vatDueAcquisitions: number // Box 2
  totalVatDue: number // Box 3 (Box 1 + Box 2)
  vatReclaimedCurrPeriod: number // Box 4
  netVatDue: number // Box 5 (Box 3 - Box 4)
  totalValueSalesExVAT: number // Box 6
  totalValuePurchasesExVAT: number // Box 7
  totalValueGoodsSuppliedExVAT: number // Box 8
  totalAcquisitionsExVAT: number // Box 9
}

// Validate MTD submission
function validateMTDVATReturn(data: MTDVATReturn): boolean {
  // All values must be to 2 decimal places
  // Box 3 must equal Box 1 + Box 2
  // Box 5 must equal Box 3 - Box 4
  
  const box3 = data.vatDueSales + data.vatDueAcquisitions
  const box5 = data.totalVatDue - data.vatReclaimedCurrPeriod
  
  if (Math.abs(box3 - data.totalVatDue) > 0.01) {
    throw new Error('Box 3 must equal Box 1 + Box 2')
  }
  
  if (Math.abs(box5 - data.netVatDue) > 0.01) {
    throw new Error('Box 5 must equal Box 3 - Box 4')
  }
  
  return true
}
```

---

### **Data Retention Policy**

```typescript
const DATA_RETENTION = {
  // Financial data: 6 years (UK legal requirement)
  transactions: 6 * 365 * 24 * 60 * 60 * 1000,
  journalEntries: 6 * 365 * 24 * 60 * 60 * 1000,
  documents: 6 * 365 * 24 * 60 * 60 * 1000,
  
  // Audit logs: 7 years
  auditLog: 7 * 365 * 24 * 60 * 60 * 1000,
  
  // User sessions: 30 days
  sessions: 30 * 24 * 60 * 60 * 1000,
  
  // Deleted accounts: 30 days grace period
  deletedAccounts: 30 * 24 * 60 * 60 * 1000
}

// Automated cleanup job
async function cleanupExpiredData() {
  const cutoffDate = new Date()
  cutoffDate.setFullYear(cutoffDate.getFullYear() - 6)
  
  // Archive old data instead of deleting
  await supabase
    .from('transactions')
    .update({ archived: true })
    .lt('created_at', cutoffDate.toISOString())
}
```

---

## 🛡️ **SECURITY CHECKLIST**

### **Before Production Launch:**

```
AUTHENTICATION & AUTHORIZATION:
□ Strong password policy implemented
□ MFA enabled for all users
□ Session management configured
□ JWT tokens use secure settings
□ Password reset flow secure

ENCRYPTION:
□ All sensitive data encrypted at rest
□ TLS 1.3 enforced
□ HTTPS only (no HTTP)
□ HSTS headers configured
□ Encryption keys securely managed

INPUT VALIDATION:
□ All inputs validated server-side
□ SQL injection prevented (parameterized queries)
□ XSS prevented (input sanitization)
□ CSRF protection implemented
□ File upload validation

MONITORING:
□ Audit logging for all actions
□ Security event monitoring
□ Error tracking (Sentry)
□ Intrusion detection
□ Regular security audits

COMPLIANCE:
□ Privacy Policy published
□ Cookie consent implemented
□ GDPR rights implemented
□ Data retention policy
□ DPA with customers
□ MTD validation for VAT returns

INFRASTRUCTURE:
□ Rate limiting configured
□ Firewall rules set
□ Database backups automated
□ Disaster recovery plan
□ Incident response plan
□ Regular penetration testing
```

---

## ⚠️ **CRITICAL SECURITY WARNINGS**

```
1. NEVER commit .env files to Git
2. NEVER log sensitive data (passwords, tokens, API keys)
3. NEVER trust client-side validation alone
4. NEVER use weak encryption algorithms
5. NEVER store passwords in plain text
6. ALWAYS use HTTPS in production
7. ALWAYS validate and sanitize inputs
8. ALWAYS use parameterized queries
9. ALWAYS implement rate limiting
10. ALWAYS have audit logging
```

---

**This document must be reviewed by a security professional before production launch!**

**Compliance requirements vary by jurisdiction - consult legal counsel for your specific situation.**
