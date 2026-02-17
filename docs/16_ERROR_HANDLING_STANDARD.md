# ERROR HANDLING STANDARD
## Consistent Error Management Across Frontend & Backend

**Version:** 1.0  
**Date:** February 3, 2026  
**Purpose:** Standardize error handling for consistent UX and debugging

---

## 🎯 **ERROR HANDLING PHILOSOPHY**

### **Principles:**

1. **User-Friendly Messages** - Never expose technical details to users
2. **Consistent Format** - Same structure across all errors
3. **Detailed Logging** - Full context for debugging
4. **Actionable Feedback** - Tell users what to do next
5. **Graceful Degradation** - App continues working when possible

---

## 📋 **STANDARD ERROR RESPONSE FORMAT**

### **Backend API Error Response:**

```typescript
interface APIErrorResponse {
  error: {
    code: string              // Machine-readable error code
    message: string           // User-friendly message
    details?: any            // Additional context (dev mode only)
    timestamp: string        // ISO 8601 timestamp
    requestId: string        // Unique request identifier
    path?: string            // API endpoint path
  }
}

// Example:
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid VAT number format. UK VAT numbers should be in format GB123456789",
    "timestamp": "2026-02-03T14:32:00Z",
    "requestId": "req_abc123xyz",
    "path": "/api/clients"
  }
}
```

---

## 🔴 **ERROR CODE TAXONOMY**

### **HTTP Status Code Mapping:**

```typescript
// backend/src/lib/errors.ts

export enum ErrorCode {
  // 400 - Bad Request
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // 401 - Unauthorized
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  MFA_REQUIRED = 'MFA_REQUIRED',
  
  // 403 - Forbidden
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  ORGANIZATION_MISMATCH = 'ORGANIZATION_MISMATCH',
  
  // 404 - Not Found
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  
  // 409 - Conflict
  CONFLICT = 'CONFLICT',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION',
  
  // 422 - Unprocessable Entity
  UNPROCESSABLE = 'UNPROCESSABLE',
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  ACCOUNTING_ERROR = 'ACCOUNTING_ERROR',
  TRANSACTION_UNBALANCED = 'TRANSACTION_UNBALANCED',
  
  // 429 - Too Many Requests
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // 500 - Internal Server Error
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  
  // 502 - Bad Gateway
  CLAUDE_API_ERROR = 'CLAUDE_API_ERROR',
  
  // 503 - Service Unavailable
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  MAINTENANCE_MODE = 'MAINTENANCE_MODE'
}

export const HTTP_STATUS_CODES: Record<ErrorCode, number> = {
  // 400s
  VALIDATION_ERROR: 400,
  INVALID_INPUT: 400,
  MISSING_REQUIRED_FIELD: 400,
  
  // 401s
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  TOKEN_EXPIRED: 401,
  TOKEN_INVALID: 401,
  MFA_REQUIRED: 401,
  
  // 403s
  FORBIDDEN: 403,
  INSUFFICIENT_PERMISSIONS: 403,
  ORGANIZATION_MISMATCH: 403,
  
  // 404s
  NOT_FOUND: 404,
  RESOURCE_NOT_FOUND: 404,
  
  // 409s
  CONFLICT: 409,
  DUPLICATE_ENTRY: 409,
  CONCURRENT_MODIFICATION: 409,
  
  // 422s
  UNPROCESSABLE: 422,
  BUSINESS_RULE_VIOLATION: 422,
  ACCOUNTING_ERROR: 422,
  TRANSACTION_UNBALANCED: 422,
  
  // 429s
  RATE_LIMIT_EXCEEDED: 429,
  
  // 500s
  INTERNAL_ERROR: 500,
  DATABASE_ERROR: 500,
  EXTERNAL_API_ERROR: 500,
  CLAUDE_API_ERROR: 502,
  SERVICE_UNAVAILABLE: 503,
  MAINTENANCE_MODE: 503
}
```

---

## 🛠️ **BACKEND IMPLEMENTATION**

### **1. Custom Error Class:**

```typescript
// backend/src/lib/errors.ts

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public statusCode: number = 500,
    public details?: any,
    public isOperational: boolean = true
  ) {
    super(message)
    this.name = 'AppError'
    Error.captureStackTrace(this, this.constructor)
  }
  
  static validation(message: string, details?: any): AppError {
    return new AppError(ErrorCode.VALIDATION_ERROR, message, 400, details)
  }
  
  static unauthorized(message: string = 'Unauthorized'): AppError {
    return new AppError(ErrorCode.UNAUTHORIZED, message, 401)
  }
  
  static forbidden(message: string = 'Forbidden'): AppError {
    return new AppError(ErrorCode.FORBIDDEN, message, 403)
  }
  
  static notFound(resource: string): AppError {
    return new AppError(
      ErrorCode.RESOURCE_NOT_FOUND, 
      `${resource} not found`, 
      404
    )
  }
  
  static accountingError(message: string, details?: any): AppError {
    return new AppError(ErrorCode.ACCOUNTING_ERROR, message, 422, details)
  }
  
  static internal(message: string = 'Internal server error'): AppError {
    return new AppError(ErrorCode.INTERNAL_ERROR, message, 500, null, false)
  }
}
```

---

### **2. Global Error Handler Middleware:**

```typescript
// backend/src/middleware/errorHandler.ts

import { Context } from 'hono'
import { AppError, ErrorCode } from '../lib/errors'
import { logger } from '../lib/logger'
import { nanoid } from 'nanoid'

export async function errorHandler(error: Error, c: Context) {
  const requestId = nanoid()
  
  // Log error with full context
  logger.error('Request error', {
    requestId,
    error: error.message,
    stack: error.stack,
    path: c.req.path,
    method: c.req.method,
    userId: c.get('userId'),
    ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
  })
  
  // Send to Sentry if non-operational
  if (error instanceof AppError && !error.isOperational) {
    // Sentry.captureException(error)
  }
  
  // Handle known errors
  if (error instanceof AppError) {
    return c.json({
      error: {
        code: error.code,
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.details : undefined,
        timestamp: new Date().toISOString(),
        requestId,
        path: c.req.path
      }
    }, error.statusCode)
  }
  
  // Handle Zod validation errors
  if (error.name === 'ZodError') {
    return c.json({
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details: process.env.NODE_ENV === 'development' ? error : undefined,
        timestamp: new Date().toISOString(),
        requestId,
        path: c.req.path
      }
    }, 400)
  }
  
  // Handle Supabase errors
  if (error.message?.includes('duplicate key')) {
    return c.json({
      error: {
        code: ErrorCode.DUPLICATE_ENTRY,
        message: 'This record already exists',
        timestamp: new Date().toISOString(),
        requestId,
        path: c.req.path
      }
    }, 409)
  }
  
  // Unknown errors - hide details from user
  return c.json({
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred. Please try again later.',
      timestamp: new Date().toISOString(),
      requestId,
      path: c.req.path
    }
  }, 500)
}

// Register in Hono app
app.onError(errorHandler)
```

---

### **3. Usage in Routes:**

```typescript
// backend/src/routes/clients.ts

import { AppError } from '../lib/errors'

app.post('/api/clients', async (c) => {
  try {
    const body = await c.req.json()
    
    // Validate input
    const validated = ClientSchema.parse(body)
    
    // Check permissions
    if (!c.get('user').canCreateClients) {
      throw AppError.forbidden('You do not have permission to create clients')
    }
    
    // Check for duplicates
    const existing = await findClientByVAT(validated.vatNumber)
    if (existing) {
      throw AppError.validation(
        'A client with this VAT number already exists',
        { existingId: existing.id }
      )
    }
    
    // Create client
    const client = await createClient(validated)
    
    return c.json(client, 201)
    
  } catch (error) {
    // Re-throw AppErrors (will be caught by global handler)
    if (error instanceof AppError) {
      throw error
    }
    
    // Wrap unknown errors
    throw AppError.internal('Failed to create client')
  }
})
```

---

## 🎨 **FRONTEND IMPLEMENTATION**

### **1. Error Types:**

```typescript
// frontend/src/types/errors.ts

export interface APIError {
  code: string
  message: string
  details?: any
  timestamp: string
  requestId: string
  path?: string
}

export class FrontendError extends Error {
  constructor(
    public type: 'network' | 'validation' | 'auth' | 'unknown',
    message: string,
    public originalError?: any
  ) {
    super(message)
    this.name = 'FrontendError'
  }
}
```

---

### **2. Error Messages Map:**

```typescript
// frontend/src/lib/errorMessages.ts

export const ERROR_MESSAGES: Record<string, string> = {
  // Authentication
  UNAUTHORIZED: 'Please log in to continue',
  INVALID_CREDENTIALS: 'Invalid email or password',
  TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
  MFA_REQUIRED: 'Two-factor authentication required',
  
  // Authorization
  FORBIDDEN: 'You do not have permission to perform this action',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
  
  // Validation
  VALIDATION_ERROR: 'Please check your input and try again',
  INVALID_INPUT: 'Invalid input provided',
  MISSING_REQUIRED_FIELD: 'Required fields are missing',
  
  // Resources
  NOT_FOUND: 'The requested resource was not found',
  RESOURCE_NOT_FOUND: 'Resource not found',
  
  // Business Logic
  DUPLICATE_ENTRY: 'This entry already exists',
  TRANSACTION_UNBALANCED: 'Transaction does not balance. Debits must equal credits.',
  ACCOUNTING_ERROR: 'Accounting validation failed',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again in a few minutes.',
  
  // Server Errors
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again.',
  DATABASE_ERROR: 'Database error. Please try again later.',
  CLAUDE_API_ERROR: 'AI processing temporarily unavailable',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  
  // Network
  NETWORK_ERROR: 'Network error. Please check your connection.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.'
}

export function getErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES.INTERNAL_ERROR
}
```

---

### **3. API Client with Error Handling:**

```typescript
// frontend/src/lib/api.ts

import axios, { AxiosError } from 'axios'
import { toast } from 'sonner'

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor - Add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor - Handle errors
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<APIError>) => {
    // Network error
    if (!error.response) {
      toast.error('Network error. Please check your connection.')
      throw new FrontendError('network', 'Network error', error)
    }
    
    const apiError = error.response.data.error
    
    // Handle authentication errors
    if (error.response.status === 401) {
      if (apiError.code === 'TOKEN_EXPIRED') {
        // Try refresh token
        try {
          await refreshToken()
          return api.request(error.config!)
        } catch {
          // Redirect to login
          localStorage.clear()
          window.location.href = '/login'
          return Promise.reject(error)
        }
      }
      
      toast.error(getErrorMessage(apiError.code))
      localStorage.clear()
      window.location.href = '/login'
      return Promise.reject(error)
    }
    
    // Handle other errors
    const message = apiError.message || getErrorMessage(apiError.code)
    
    // Don't show toast for validation errors (form will handle)
    if (error.response.status !== 400) {
      toast.error(message)
    }
    
    throw new FrontendError(
      error.response.status < 500 ? 'validation' : 'unknown',
      message,
      apiError
    )
  }
)

async function refreshToken() {
  const refreshToken = localStorage.getItem('refreshToken')
  const { data } = await axios.post(`${process.env.REACT_APP_API_URL}/auth/refresh`, {
    refreshToken
  })
  localStorage.setItem('token', data.token)
  return data.token
}

export default api
```

---

### **4. React Query Error Handling:**

```typescript
// frontend/src/App.tsx

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false
        }
        // Retry up to 3 times on 5xx errors
        return failureCount < 3
      },
      onError: (error: any) => {
        // Global error handling for queries
        console.error('Query error:', error)
      }
    },
    mutations: {
      onError: (error: any) => {
        // Errors already handled by interceptor
        console.error('Mutation error:', error)
      }
    }
  }
})
```

---

### **5. Component-Level Error Handling:**

```typescript
// frontend/src/pages/Clients/CreateClient.tsx

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

function CreateClientForm() {
  const createClientMutation = useMutation({
    mutationFn: (data: ClientInput) => api.post('/clients', data),
    onSuccess: () => {
      toast.success('Client created successfully')
      navigate('/clients')
    },
    onError: (error: FrontendError) => {
      // Error toast already shown by interceptor
      // Just handle form-specific logic
      if (error.originalError?.code === 'DUPLICATE_ENTRY') {
        setError('vatNumber', {
          message: 'A client with this VAT number already exists'
        })
      }
    }
  })
  
  return (
    <form onSubmit={handleSubmit(createClientMutation.mutate)}>
      {/* form fields */}
    </form>
  )
}
```

---

## 🔍 **ERROR LOGGING STRATEGY**

### **Backend Logging:**

```typescript
// backend/src/lib/logger.ts

import winston from 'winston'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'ai-accounting-api',
    environment: process.env.NODE_ENV
  },
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
})

// Console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }))
}

export { logger }
```

---

## 📋 **ERROR HANDLING CHECKLIST**

### **Backend:**

```
□ Custom AppError class created
□ Error codes enum defined
□ HTTP status mapping complete
□ Global error handler middleware added
□ Winston logger configured
□ Sentry integration (production)
□ Request ID generation
□ Error details hidden in production
□ Stack traces logged
□ Audit log for security errors
```

### **Frontend:**

```
□ Error messages map created
□ API client with interceptors
□ Automatic retry logic
□ Token refresh on 401
□ React Query error handling
□ Toast notifications (sonner)
□ Error boundaries for React errors
□ Form validation errors
□ Network error detection
□ Timeout handling
```

---

## 🎯 **TESTING ERROR SCENARIOS**

### **Test Cases:**

```typescript
// Test authentication errors
describe('Authentication Errors', () => {
  it('should redirect to login on 401', async () => {
    // Mock 401 response
    // Verify localStorage cleared
    // Verify redirect to /login
  })
  
  it('should refresh token on TOKEN_EXPIRED', async () => {
    // Mock TOKEN_EXPIRED
    // Verify refresh attempt
    // Verify request retry
  })
})

// Test validation errors
describe('Validation Errors', () => {
  it('should show field errors', async () => {
    // Submit invalid form
    // Verify error messages shown
    // Verify form not submitted
  })
})

// Test network errors
describe('Network Errors', () => {
  it('should show network error toast', async () => {
    // Simulate network failure
    // Verify toast shown
    // Verify retry attempted
  })
})
```

---

## 📖 **EXAMPLE ERROR FLOWS**

### **Scenario 1: Duplicate VAT Number**

```
USER ACTION:
Submits form to create client with existing VAT number

BACKEND:
1. Validates input ✓
2. Checks for duplicate
3. Throws AppError.validation('VAT number exists', { existingId })
4. Global handler catches
5. Returns 400 with error code DUPLICATE_ENTRY

FRONTEND:
1. API interceptor catches 400
2. Doesn't show toast (form will handle)
3. Returns error to mutation
4. Mutation onError sets field error
5. User sees: "A client with this VAT number already exists"

RESULT: Clear, actionable feedback
```

### **Scenario 2: Session Expired**

```
USER ACTION:
Clicks button after 30 minutes idle

BACKEND:
1. JWT validation fails
2. Throws AppError.unauthorized('Token expired')
3. Returns 401 with TOKEN_EXPIRED code

FRONTEND:
1. Interceptor catches 401
2. Sees TOKEN_EXPIRED code
3. Attempts token refresh
4. If refresh fails:
   - Shows toast: "Session expired. Please log in again."
   - Clears localStorage
   - Redirects to /login

RESULT: Automatic refresh or graceful re-login
```

### **Scenario 3: Unbalanced Transaction**

```
USER ACTION:
Approves transaction with unbalanced journal entries

BACKEND:
1. Validates debits = credits
2. Finds mismatch
3. Throws AppError.accountingError('Unbalanced', { debits, credits })
4. Returns 422 with TRANSACTION_UNBALANCED

FRONTEND:
1. Interceptor shows toast with accounting error
2. Mutation onError logs details
3. User sees: "Transaction does not balance. Debits: £100, Credits: £99"

RESULT: Clear accounting error with details
```

---

**This error handling standard ensures consistent, user-friendly error management across the entire application!**
