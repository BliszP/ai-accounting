/**
 * Claude AI Service
 *
 * Handles document extraction using Anthropic's Claude API
 */

import Anthropic from '@anthropic-ai/sdk';
import Decimal from 'decimal.js';
import { env } from '../config/environment.js';
import { logger } from './logger.js';
import { isLargeDocument, detectStatementDateRange } from './pdfProcessor.js';
import { detectDateRangeFromText, splitTextByMonth } from './pdfTextExtractor.js';
import { pdfToBase64Images } from './pdfImageExtractor.js';

// Configure Decimal.js for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Initialize Anthropic client
 */
const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

/**
 * Transaction extracted from a document
 */
export interface ExtractedTransaction {
  date: string;
  merchant: string;
  description: string | null;
  amount: number;
  type: 'debit' | 'credit';
  category: string | null;
  categoryConfidence: number | null;
  vatAmount: number | null;
  vatRate: number | null;
  extractionConfidence: number;
  balance: number | null;
}

/**
 * Extraction result
 */
export interface ExtractionResult {
  success: boolean;
  transactions: ExtractedTransaction[];
  error?: string;
  metadata?: {
    documentType: string;
    totalTransactions: number;
    processingTime: number;
  };
}

/**
 * Result of a single balance chain link verification
 */
interface BalanceChainLink {
  index: number;
  date: string;
  merchant: string;
  amount: number;
  type: 'debit' | 'credit';
  expectedBalance: number;
  actualBalance: number;
  discrepancy: number;
  isValid: boolean;
  correctedAmount: number | null;
}

/**
 * Full balance chain verification result for a month
 */
interface BalanceVerificationResult {
  monthLabel: string;
  openingBalance: number | null;
  closingBalance: number | null;
  chainLength: number;
  validLinks: number;
  brokenLinks: BalanceChainLink[];
  autoCorrections: number;
  isFullyVerified: boolean;
  balanceCoverage: number;
}


/**
 * Verify the balance chain for a set of transactions.
 * Walks through each transaction checking: previous_balance ± amount = current_balance.
 * Returns verification results with broken links identified.
 */
function verifyBalanceChain(
  transactions: ExtractedTransaction[],
  openingBalance: number | null,
  closingBalance: number | null,
  monthLabel: string
): BalanceVerificationResult {
  const result: BalanceVerificationResult = {
    monthLabel,
    openingBalance,
    closingBalance,
    chainLength: transactions.length,
    validLinks: 0,
    brokenLinks: [],
    autoCorrections: 0,
    isFullyVerified: false,
    balanceCoverage: 0,
  };

  const withBalance = transactions.filter(t => t.balance !== null && t.balance !== undefined);
  result.balanceCoverage = transactions.length > 0
    ? withBalance.length / transactions.length
    : 0;

  if (withBalance.length === 0) {
    return result;
  }

  let previousBalance = openingBalance;

  for (let i = 0; i < transactions.length; i++) {
    const txn = transactions[i];

    if (txn.balance === null || txn.balance === undefined) {
      previousBalance = null;
      continue;
    }

    if (previousBalance !== null) {
      const prevDec = new Decimal(previousBalance);
      const amtDec = new Decimal(txn.amount);
      const delta = txn.type === 'credit' ? amtDec : amtDec.neg();
      const expectedBalance = prevDec.add(delta).toDecimalPlaces(2).toNumber();
      const discrepancy = new Decimal(txn.balance).minus(expectedBalance).toDecimalPlaces(2).toNumber();

      if (new Decimal(discrepancy).abs().toNumber() < 0.015) {
        result.validLinks++;
      } else {
        const correctDelta = new Decimal(txn.balance).minus(previousBalance).toDecimalPlaces(2).toNumber();
        const correctedAmount = new Decimal(correctDelta).abs().toDecimalPlaces(2).toNumber();

        result.brokenLinks.push({
          index: i,
          date: txn.date,
          merchant: txn.merchant,
          amount: txn.amount,
          type: txn.type,
          expectedBalance,
          actualBalance: txn.balance,
          discrepancy,
          isValid: false,
          correctedAmount,
        });
      }
    } else {
      result.validLinks++;
    }

    previousBalance = txn.balance;
  }

  if (closingBalance !== null && previousBalance !== null) {
    const closingDiff = new Decimal(previousBalance).minus(closingBalance).abs().toNumber();
    if (closingDiff > 0.015) {
      logger.warn(`${monthLabel}: Chain ending balance £${previousBalance.toFixed(2)} != closing balance £${closingBalance.toFixed(2)} (diff: £${closingDiff.toFixed(2)})`);
    }
  }

  result.isFullyVerified = result.brokenLinks.length === 0 && result.balanceCoverage > 0.9;

  return result;
}

/**
 * Apply auto-corrections based on balance chain verification.
 * When the chain breaks, derives the correct amount from balance values.
 */
function applyBalanceCorrections(
  transactions: ExtractedTransaction[],
  verification: BalanceVerificationResult,
  openingBalance: number | null
): {
  corrected: ExtractedTransaction[];
  corrections: Array<{
    index: number;
    date: string;
    merchant: string;
    originalAmount: number;
    correctedAmount: number;
    reason: string;
  }>;
} {
  const corrected = [...transactions];
  const corrections: Array<{
    index: number;
    date: string;
    merchant: string;
    originalAmount: number;
    correctedAmount: number;
    reason: string;
  }> = [];

  for (const broken of verification.brokenLinks) {
    if (broken.correctedAmount === null) continue;

    const txn = corrected[broken.index];

    const previousBalance = broken.index === 0
      ? openingBalance
      : corrected[broken.index - 1]?.balance ?? null;

    if (previousBalance === null || txn.balance === null) continue;

    const delta = new Decimal(txn.balance).minus(previousBalance).toNumber();
    const inferredType: 'debit' | 'credit' = delta >= 0 ? 'credit' : 'debit';
    const inferredAmount = new Decimal(delta).abs().toDecimalPlaces(2).toNumber();

    if (inferredType === txn.type) {
      const diff = new Decimal(inferredAmount).minus(txn.amount).abs().toDecimalPlaces(2).toNumber();

      if (diff < 10) {
        corrected[broken.index] = {
          ...txn,
          amount: inferredAmount,
          extractionConfidence: 0.70,
        };
        corrections.push({
          index: broken.index,
          date: txn.date,
          merchant: txn.merchant,
          originalAmount: txn.amount,
          correctedAmount: inferredAmount,
          reason: `Balance chain correction: £${txn.amount} -> £${inferredAmount} (diff: £${diff.toFixed(2)})`,
        });
      } else {
        corrected[broken.index] = {
          ...txn,
          amount: inferredAmount,
          extractionConfidence: 0.40,
        };
        corrections.push({
          index: broken.index,
          date: txn.date,
          merchant: txn.merchant,
          originalAmount: txn.amount,
          correctedAmount: inferredAmount,
          reason: `Balance chain correction (LARGE): £${txn.amount} -> £${inferredAmount} (diff: £${diff.toFixed(2)}) - FLAGGED`,
        });
      }
    } else {
      corrected[broken.index] = {
        ...txn,
        extractionConfidence: 0.30,
      };
      corrections.push({
        index: broken.index,
        date: txn.date,
        merchant: txn.merchant,
        originalAmount: txn.amount,
        correctedAmount: inferredAmount,
        reason: `Possible type error: extracted as ${txn.type} but balance implies ${inferredType} - NEEDS REVIEW`,
      });
    }
  }

  return { corrected, corrections };
}

/**
 * Remove only transactions that are EXACT SAME-CALL duplicates —
 * i.e. the LLM returned the same transaction object more than once in a
 * single API response (a model bug, not a financial reality).
 *
 * Key includes row position (index) so two genuinely identical transactions
 * on the same day (e.g. two Tesco shops for £45.00) are NOT collapsed.
 *
 * We intentionally do NOT deduplicate across months or across API calls
 * because bank statements are authoritative: every row is a unique transaction.
 * The month-by-month prompts have strict date ranges, making cross-call
 * duplicates impossible in the text pipeline and extremely unlikely in the
 * Sonnet PDF pipeline.
 */
function deduplicateTransactions(transactions: ExtractedTransaction[]): {
  deduplicated: ExtractedTransaction[];
  removedCount: number;
  removedDetails: string[];
} {
  // No deduplication across pipelines — return as-is.
  // This function is retained so call sites don't need changing.
  return { deduplicated: transactions, removedCount: 0, removedDetails: [] };
}

/**
 * Extract transactions from a bank statement
 */
export async function extractBankStatement(
  fileContent: string,
  fileType: string,
  fileSizeBytes?: number,
  extractedText?: string
): Promise<ExtractionResult> {
  const startTime = Date.now();

  try {
    logger.info('Starting bank statement extraction', { fileType, fileSizeBytes, hasExtractedText: !!extractedText });

    // OPTIMIZED PATH: If we have locally-extracted text, use Haiku text pipeline (99% cheaper)
    if (extractedText && extractedText.length > 100) {
      logger.info('Using optimized text-based pipeline (Haiku)', {
        textLength: extractedText.length,
        estimatedTokens: Math.ceil(extractedText.length / 4),
      });
      return await extractBankStatementOptimized(extractedText, fileContent, startTime);
    }

    // FALLBACK: No extracted text available (image-based PDF or non-PDF)
    const isLargePDF = fileType === 'application/pdf' && fileSizeBytes && isLargeDocument(fileSizeBytes);

    if (isLargePDF) {
      logger.info('Large document (image-based or no text), using Sonnet PDF pipeline', { fileSizeBytes });
      return await extractLargeBankStatementByMonth(fileContent, startTime);
    }

    // Normal single-pass extraction for small documents
    return await extractBankStatementSinglePass(fileContent, fileType, startTime);
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logger.error('Bank statement extraction failed', {
      error: error.message || error,
      processingTime,
    });

    return {
      success: false,
      transactions: [],
      error: error instanceof Error ? error.message : 'Unknown error occurred during extraction',
      metadata: {
        documentType: 'bank_statement',
        totalTransactions: 0,
        processingTime,
      },
    };
  }
}

/**
 * Repair truncated JSON from Claude responses
 */
function repairTruncatedJson(text: string): string {
  // Find the start of JSON
  const jsonStart = text.indexOf('{"transactions"');
  if (jsonStart === -1) {
    const altStart = text.indexOf('{');
    if (altStart === -1) return '{"transactions":[]}';
    text = text.substring(altStart);
  } else {
    text = text.substring(jsonStart);
  }

  // Remove markdown code fences
  text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');

  // Try parsing as-is first
  try {
    JSON.parse(text);
    return text;
  } catch (_) {
    // Continue with repair
  }

  // Count open/close braces and brackets
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (escaped) { escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
    if (char === '[') bracketCount++;
    if (char === ']') bracketCount--;
  }

  // Remove any trailing incomplete object (truncated mid-transaction)
  // Find the last complete }, in the array
  const lastCompleteObj = text.lastIndexOf('},');
  const lastCompleteObjEnd = text.lastIndexOf('}]');

  if (lastCompleteObjEnd === -1 && lastCompleteObj > 0) {
    // Truncated mid-transaction, cut to last complete one
    text = text.substring(0, lastCompleteObj + 1);
    // Recount
    braceCount = 0;
    bracketCount = 0;
    inString = false;
    escaped = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      if (char === '[') bracketCount++;
      if (char === ']') bracketCount--;
    }
  }

  // Close unclosed brackets and braces
  while (bracketCount > 0) { text += ']'; bracketCount--; }
  while (braceCount > 0) { text += '}'; braceCount--; }

  return text;
}

/**
 * Parse transactions from Claude response text with robust error handling
 */
function parseTransactionsFromResponse(responseText: string): ExtractedTransaction[] {
  let rawTxns: any[] = [];

  // Try standard JSON parse first
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const result = JSON.parse(jsonMatch[0]);
      rawTxns = result.transactions || [];
    } catch (_) {
      // Try repair
      logger.warn('JSON parse failed, attempting repair...');
      try {
        const repaired = repairTruncatedJson(responseText);
        const result = JSON.parse(repaired);
        rawTxns = result.transactions || [];
        logger.info(`JSON repair successful, recovered ${rawTxns.length} transactions`);
      } catch (e: any) {
        logger.error('JSON repair also failed', { error: e.message, responsePreview: responseText.substring(0, 500) });
        return [];
      }
    }
  }

  // Normalize each transaction to ensure financial data integrity
  return rawTxns.map((t: any): ExtractedTransaction => {
    // Parse amount — always store as a positive number
    let amount = parseFloat(t.amount);
    if (isNaN(amount)) amount = 0;

    let type: 'debit' | 'credit' = (t.type === 'credit') ? 'credit' : 'debit';

    // If the model returned a negative amount, it's a debit regardless of stated type.
    // This handles CSVs where Amount column is negative for outgoings.
    if (amount < 0) {
      amount = Math.abs(amount);
      type = 'debit';
    }

    // Parse balance — must be a number or null
    let balance: number | null = null;
    if (t.balance !== null && t.balance !== undefined && t.balance !== '') {
      const parsed = parseFloat(t.balance);
      if (!isNaN(parsed)) balance = parsed;
    }

    const rawDate: string = t.date || '';

    // Merchant: use dedicated merchant field, fall back to description, never null
    const merchant: string = (t.merchant && String(t.merchant).trim()) || 'Unknown';
    // Description: only include if it's different from merchant (avoids exact duplication)
    const desc: string | null = (t.description && String(t.description).trim() && t.description !== t.merchant)
      ? String(t.description).trim()
      : null;

    return {
      date: rawDate,
      merchant,
      description: desc,
      amount,
      type,
      category: t.category || null,
      categoryConfidence: t.categoryConfidence != null ? parseFloat(t.categoryConfidence) || null : null,
      vatAmount: t.vatAmount != null ? parseFloat(t.vatAmount) || null : null,
      vatRate: t.vatRate != null ? parseFloat(t.vatRate) || null : null,
      extractionConfidence: t.extractionConfidence != null ? parseFloat(t.extractionConfidence) || 0.8 : 0.8,
      balance,
    };
  }).filter(t =>
    t.amount > 0      // no zero-value rows
    && t.date         // must have a date
    && /^\d{4}-\d{2}-\d{2}$/.test(t.date) // must be valid ISO date
  );
}

/**
 * Single-pass extraction for small/normal documents (1-2 months)
 */
async function extractBankStatementSinglePass(
  fileContent: string,
  fileType: string,
  startTime: number
): Promise<ExtractionResult> {
  const prompt = `You are extracting bank statement transactions for professional accounting software. ACCURACY IS CRITICAL - every transaction and every penny must be captured correctly.

TASK: Extract EVERY SINGLE transaction from this bank statement.

RULES:
1. Extract EVERY transaction row. Do NOT skip any rows. Go through page by page, line by line.
2. Amounts must be EXACTLY as shown on the statement - do not round or estimate.
3. Type: "debit" = money OUT (payments, purchases, direct debits, standing orders). "credit" = money IN (deposits, income, transfers in, refunds).
4. If a transaction description spans multiple lines, combine into one transaction.
5. For EACH transaction, include the RUNNING BALANCE shown on the statement after that transaction. Bank statements show a balance column - extract the exact balance figure shown on the same row.
6. Also extract the OPENING BALANCE shown at the top of the statement (the balance before the first transaction).

For each transaction provide: date (YYYY-MM-DD), merchant (exactly as shown), description (or null), amount (positive number exactly as shown), type ("debit"/"credit"), balance (running balance after this transaction as shown on the statement, or null if not visible), category (from: "Office Supplies","Travel","Meals & Entertainment","Professional Fees","Utilities","Rent","Salaries","Marketing","Software","Other", or null), categoryConfidence (0-1), vatAmount (or null), vatRate (or null), extractionConfidence (0-1).

After extracting, VERIFY by counting transactions and summing debits/credits separately.

Return ONLY valid JSON:
{
  "openingBalance": 5167.17,
  "transactions": [{...}],
  "verification": {
    "transactionCount": 85,
    "totalDebits": "1234.56",
    "totalCredits": "5678.90",
    "closingBalance": 5206.95
  }
}
No markdown. No explanation. Do NOT skip any transactions.`;

  const stream = anthropic.messages.stream({
    model: env.CLAUDE_MODEL_SONNET || 'claude-sonnet-4-20250514',
    max_tokens: 32000,
    messages: [{
      role: 'user',
      content: fileType === 'application/pdf'
        ? [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileContent } },
            { type: 'text' as const, text: prompt },
          ]
        : [{ type: 'text' as const, text: `${prompt}\n\nDocument content:\n${fileContent}` }],
    }],
  });

  const message = await stream.finalMessage();
  const responseText = message.content
    .filter((block) => block.type === 'text')
    .map((block) => 'text' in block ? block.text : '')
    .join('');

  logger.info('Claude response received', {
    responseLength: responseText.length,
    stopReason: message.stop_reason,
  });

  if (message.stop_reason === 'max_tokens') {
    logger.warn('Response TRUNCATED (max_tokens hit). Some transactions may be missing.');
  }

  const transactions = parseTransactionsFromResponse(responseText);
  const processingTime = Date.now() - startTime;

  logger.info('Bank statement extraction complete', {
    transactionCount: transactions.length,
    processingTime,
  });

  return {
    success: transactions.length > 0,
    transactions,
    error: transactions.length === 0 ? 'No transactions extracted' : undefined,
    metadata: { documentType: 'bank_statement', totalTransactions: transactions.length, processingTime },
  };
}

/**
 * Build the accuracy-focused extraction prompt for a specific month
 */
function buildMonthExtractionPrompt(
  month: { startDate: string; endDate: string; label: string },
  index: number,
  totalMonths: number
): string {
  return `You are extracting bank statement transactions for professional accounting software. Every penny must be correct.

TASK: Extract EVERY individual transaction from this bank statement PDF for ${month.startDate} to ${month.endDate} (${month.label}).

═══ AMOUNT AND TYPE RULES ═══
- Amount with "-" sign (e.g. -£45.99) → type="debit", amount=45.99
- Amount with "+" sign or no sign (e.g. +£123.45 or £123.45 in a credit column) → type="credit", amount=123.45
- "Debit", "DR", "Payment", "Purchase", "Direct Debit", "Standing Order" keywords → type="debit"
- "Credit", "CR", "Deposit", "Transfer In", "Refund" keywords → type="credit"
- Always output amount as a POSITIVE number.

═══ DO NOT EXTRACT THESE AS TRANSACTIONS ═══
- "Opening Balance" / "Balance Brought Forward" lines
- "Closing Balance" / "Balance Carried Forward" lines
- "Total Credits", "Total Debits", "Total Money In", "Total Money Out" summary lines
- Page headers, account number lines, statement date range lines

═══ FIELD EXTRACTION ═══
- date: YYYY-MM-DD (convert DD/MM/YYYY, DD Mon YYYY, etc.)
- merchant: payee name exactly as printed on the statement
- description: reference/additional notes on the same row (null if same as merchant or empty)
- amount: POSITIVE, exact to the penny as shown
- type: "debit" or "credit"
- balance: running balance on the SAME ROW as this transaction (exact figure, or null)
- openingBalance: balance figure shown BEFORE the first transaction in this date range

Go through every page, every line. If a description wraps to a second line, merge it — do not create two transactions for one row.

Return ONLY valid JSON (no markdown):
{
  "openingBalance": 5167.17,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "merchant": "TESCO SUPERSTORE",
      "description": "CARD PAYMENT",
      "amount": 45.99,
      "type": "debit",
      "balance": 5121.18,
      "category": "Travel",
      "categoryConfidence": 0.7,
      "vatAmount": null,
      "vatRate": null,
      "extractionConfidence": 0.95
    }
  ],
  "verification": {
    "transactionCount": 85,
    "totalDebits": "1234.56",
    "totalCredits": "5678.90",
    "closingBalance": 5121.18,
    "monthLabel": "${month.label}"
  }
}

Month ${index + 1} of ${totalMonths}. Only transactions dated ${month.startDate} to ${month.endDate}. Do NOT skip any row.`;
}

/**
 * Extract a single month with verification - reusable by both initial extraction and re-extraction
 */
async function extractMonthWithVerification(
  fileContent: string,
  month: { startDate: string; endDate: string; label: string },
  index: number,
  totalMonths: number,
  retries = 3
): Promise<{
  transactions: ExtractedTransaction[];
  verification: any;
  balanceVerification: BalanceVerificationResult | null;
  corrections: Array<{ index: number; date: string; merchant: string; originalAmount: number; correctedAmount: number; reason: string }>;
}> {
  const prompt = buildMonthExtractionPrompt(month, index, totalMonths);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info(`Extracting ${month.label} (${index + 1}/${totalMonths}), attempt ${attempt}`);
      const callStart = Date.now();

      const stream = anthropic.messages.stream({
        model: env.CLAUDE_MODEL_SONNET || 'claude-sonnet-4-20250514',
        max_tokens: 32000,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileContent } },
            { type: 'text' as const, text: prompt },
          ],
        }],
      });

      const msg = await stream.finalMessage();
      const text = msg.content
        .filter((b) => b.type === 'text')
        .map((b) => 'text' in b ? b.text : '')
        .join('');

      const duration = ((Date.now() - callStart) / 1000).toFixed(1);
      logger.info(`${month.label} response received`, {
        responseLength: text.length,
        stopReason: msg.stop_reason,
        duration: `${duration}s`,
      });

      if (msg.stop_reason === 'max_tokens') {
        logger.warn(`${month.label}: Response TRUNCATED (max_tokens). Some transactions may be missing.`);
      }

      // Parse the full response including verification
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      let parsed: any = {};
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (_) {
          try {
            const repaired = repairTruncatedJson(text);
            parsed = JSON.parse(repaired);
          } catch (_2) {
            logger.warn(`${month.label}: Could not parse JSON response`);
          }
        }
      }

      // Use parseTransactionsFromResponse for consistent amount normalisation
      // (ensures positive amounts, correct debit/credit type, valid balances)
      const transactions = parseTransactionsFromResponse(
        JSON.stringify({ transactions: parsed.transactions || [] })
      );
      const verification = parsed.verification || null;
      const openingBalance = parsed.openingBalance != null ? parseFloat(parsed.openingBalance) : null;
      const closingBalance = verification?.closingBalance != null ? parseFloat(verification.closingBalance) : null;

      logger.info(`${month.label}: ${transactions.length} transactions extracted`, {
        verification,
        openingBalance,
      });

      // Run balance chain verification (zero API cost - pure arithmetic)
      const balanceVerification = verifyBalanceChain(
        transactions,
        openingBalance,
        closingBalance,
        month.label
      );

      logger.info(`${month.label} balance verification`, {
        coverage: `${(balanceVerification.balanceCoverage * 100).toFixed(0)}%`,
        validLinks: balanceVerification.validLinks,
        brokenLinks: balanceVerification.brokenLinks.length,
        isFullyVerified: balanceVerification.isFullyVerified,
      });

      // Apply auto-corrections if there are broken links
      let finalTransactions = transactions;
      let corrections: Array<{ index: number; date: string; merchant: string; originalAmount: number; correctedAmount: number; reason: string }> = [];

      if (balanceVerification.brokenLinks.length > 0) {
        const correctionResult = applyBalanceCorrections(
          transactions,
          balanceVerification,
          openingBalance
        );
        finalTransactions = correctionResult.corrected;
        corrections = correctionResult.corrections;

        if (corrections.length > 0) {
          logger.info(`${month.label}: Applied ${corrections.length} balance-based corrections`, {
            corrections: corrections.map(c => `${c.date} ${c.merchant}: £${c.originalAmount} -> £${c.correctedAmount}`),
          });
        }
      }

      return { transactions: finalTransactions, verification, balanceVerification, corrections };
    } catch (err: any) {
      const isRateLimit = err?.status === 429 || err?.error?.type === 'rate_limit_error';
      if (isRateLimit && attempt < retries) {
        const waitTime = attempt * 30;
        logger.warn(`Rate limit hit for ${month.label}, waiting ${waitTime}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      } else {
        throw err;
      }
    }
  }
  return { transactions: [], verification: null, balanceVerification: null, corrections: [] };
}

/**
 * Build prompt for text-based extraction (sent to Haiku with plain text, not PDF)
 */
function buildTextExtractionPrompt(
  month: { startDate: string; endDate: string; label: string },
  index: number,
  totalMonths: number
): string {
  return `You are extracting bank statement transactions for professional accounting software. Every penny must be correct.

TASK: Extract EVERY individual transaction from the bank statement text below for ${month.startDate} to ${month.endDate} (${month.label}).

═══ AMOUNT AND TYPE RULES (follow in strict priority order) ═══

A. If statement has separate "Money Out" and "Money In" columns (CSV format):
   - "Money Out" value present → type="debit", amount=that value (positive)
   - "Money In" value present  → type="credit", amount=that value (positive)

B. If statement has a single Amount column or amounts with +/- signs (PDF format):
   - Amount starts with "-" or "−" (e.g. -45.99, −45.99) → type="debit", amount=45.99
   - Amount starts with "+" or no sign  (e.g. +123.45, 123.45) → type="credit", amount=123.45
   - EXCEPTION: if the line is clearly labeled as a debit/payment, force type="debit"

C. Always output amount as a POSITIVE number regardless of the sign in the source.

═══ DO NOT EXTRACT THESE AS TRANSACTIONS ═══
- "Opening Balance", "Closing Balance", "Balance Brought Forward" lines
- "Total Money In", "Total Money Out", "Total Outgoings", "Total Deposits" summary lines
- Page headers, account number lines, statement period lines
- Running balance figures on their own lines (balance is a field ON a transaction row)

═══ FIELD EXTRACTION ═══
- date: YYYY-MM-DD (convert any format: DD/MM/YYYY, DD Mon YYYY, etc.)
- merchant: payee/merchant name exactly as shown on statement
- description: additional reference/notes on same transaction (or null if same as merchant)
- amount: POSITIVE number, exact to the penny
- type: "debit" (money OUT) or "credit" (money IN)
- balance: running account balance SHOWN ON THE SAME ROW as the transaction (or null if not shown)
- category: one of "Office Supplies","Travel","Meals & Entertainment","Professional Fees","Utilities","Rent","Salaries","Marketing","Software","Other" (or null)
- categoryConfidence: 0.0–1.0
- vatAmount: VAT amount if shown (or null)
- vatRate: 0.20 / 0.05 / 0.00 (or null)
- extractionConfidence: 0.0–1.0

═══ MULTI-LINE DESCRIPTIONS ═══
If a transaction description wraps to a second line, merge it into one transaction. Do not create a separate entry for continuation lines.

═══ DATE RANGE ═══
Only include transactions dated ${month.startDate} to ${month.endDate} inclusive. Ignore any rows outside this range.

Return ONLY valid JSON (no markdown, no explanation):
{
  "openingBalance": 5167.17,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "merchant": "TESCO SUPERSTORE",
      "description": "CARD PAYMENT",
      "amount": 45.99,
      "type": "debit",
      "balance": 5121.18,
      "category": "Travel",
      "categoryConfidence": 0.7,
      "vatAmount": null,
      "vatRate": null,
      "extractionConfidence": 0.95
    }
  ],
  "verification": {
    "transactionCount": 85,
    "totalDebits": "1234.56",
    "totalCredits": "5678.90",
    "closingBalance": 5121.18,
    "monthLabel": "${month.label}"
  }
}

This is month ${index + 1} of ${totalMonths}. Do NOT skip any transaction rows. Every row with a date and amount is a transaction.`;
}

/**
 * Extract transactions from a text chunk using Haiku (much cheaper than sending PDF to Sonnet).
 * Includes balance chain verification and auto-correction.
 */
async function extractMonthFromText(
  textChunk: string,
  month: { startDate: string; endDate: string; label: string },
  index: number,
  totalMonths: number,
  retries = 3
): Promise<{
  transactions: ExtractedTransaction[];
  verification: any;
  balanceVerification: BalanceVerificationResult | null;
  corrections: Array<{ index: number; date: string; merchant: string; originalAmount: number; correctedAmount: number; reason: string }>;
}> {
  const prompt = buildTextExtractionPrompt(month, index, totalMonths);
  const fullPrompt = `${prompt}\n\n--- BANK STATEMENT TEXT ---\n${textChunk}\n--- END ---`;

  // If the chunk is large (likely many transactions), use Sonnet to avoid Haiku 8K output cap.
  // Threshold: ~12K chars ≈ ~3K input tokens ≈ month with 80+ transactions in PDF format.
  const useSonnet = textChunk.length > 12000;
  const modelToUse = useSonnet
    ? (env.CLAUDE_MODEL_SONNET || 'claude-sonnet-4-20250514')
    : (env.CLAUDE_MODEL_HAIKU || 'claude-haiku-3-5-20241022');

  if (useSonnet) {
    logger.info(`[TEXT] ${month.label}: large chunk (${textChunk.length} chars) — upgrading to Sonnet for accuracy`);
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info(`[TEXT] Extracting ${month.label} (${index + 1}/${totalMonths}), attempt ${attempt}, using ${useSonnet ? 'Sonnet' : 'Haiku'}`);
      const callStart = Date.now();

      const msg = await anthropic.messages.create({
        model: modelToUse,
        max_tokens: 16000,
        messages: [{
          role: 'user',
          content: [{ type: 'text', text: fullPrompt }],
        }],
      });

      const text = msg.content
        .filter((b) => b.type === 'text')
        .map((b) => 'text' in b ? b.text : '')
        .join('');

      const duration = ((Date.now() - callStart) / 1000).toFixed(1);
      logger.info(`[TEXT] ${month.label} response received`, {
        responseLength: text.length,
        stopReason: msg.stop_reason,
        duration: `${duration}s`,
        model: useSonnet ? 'sonnet' : 'haiku',
      });

      if (msg.stop_reason === 'max_tokens') {
        logger.warn(`[TEXT] ${month.label}: Response TRUNCATED`);
      }

      // Parse response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      let parsed: any = {};
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (_) {
          const repaired = repairTruncatedJson(text);
          parsed = JSON.parse(repaired);
        }
      }

      // Use parseTransactionsFromResponse for consistent normalisation
      const transactions = parseTransactionsFromResponse(
        JSON.stringify({ transactions: parsed.transactions || [] })
      );
      const verification = parsed.verification || null;
      const openingBalance = parsed.openingBalance != null ? parseFloat(parsed.openingBalance) : null;
      const closingBalance = verification?.closingBalance != null ? parseFloat(verification.closingBalance) : null;

      logger.info(`[TEXT] ${month.label}: ${transactions.length} transactions extracted`, {
        verification,
        openingBalance,
      });

      // Balance chain verification (zero API cost)
      const balanceVerification = verifyBalanceChain(
        transactions,
        isNaN(openingBalance as number) ? null : openingBalance,
        isNaN(closingBalance as number) ? null : closingBalance,
        month.label
      );

      logger.info(`[TEXT] ${month.label} balance verification`, {
        coverage: `${(balanceVerification.balanceCoverage * 100).toFixed(0)}%`,
        validLinks: balanceVerification.validLinks,
        brokenLinks: balanceVerification.brokenLinks.length,
        isFullyVerified: balanceVerification.isFullyVerified,
      });

      // Apply auto-corrections
      let finalTransactions = transactions;
      let corrections: Array<{ index: number; date: string; merchant: string; originalAmount: number; correctedAmount: number; reason: string }> = [];

      if (balanceVerification.brokenLinks.length > 0) {
        const correctionResult = applyBalanceCorrections(transactions, balanceVerification, openingBalance);
        finalTransactions = correctionResult.corrected;
        corrections = correctionResult.corrections;

        if (corrections.length > 0) {
          logger.info(`[TEXT] ${month.label}: Applied ${corrections.length} balance-based corrections`);
        }
      }

      return { transactions: finalTransactions, verification, balanceVerification, corrections };
    } catch (err: any) {
      const isRateLimit = err?.status === 429 || err?.error?.type === 'rate_limit_error';
      if (isRateLimit && attempt < retries) {
        const waitTime = useSonnet ? attempt * 30 : attempt * 15;
        logger.warn(`[TEXT] Rate limit hit for ${month.label}, waiting ${waitTime}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      } else {
        throw err;
      }
    }
  }
  return { transactions: [], verification: null, balanceVerification: null, corrections: [] };
}

/**
 * Single-pass text extraction using Haiku (for CSVs and short text documents).
 * Sends the full text in one call — no month-splitting needed for small files.
 */
async function extractBankStatementTextSinglePass(
  text: string,
  startTime: number
): Promise<ExtractionResult> {
  const prompt = `You are extracting bank statement transactions for professional accounting software. ACCURACY IS CRITICAL.

TASK: Extract EVERY SINGLE transaction from this bank statement data.

RULES:
1. Extract EVERY transaction row. Do NOT skip any rows.
2. Amounts must be EXACTLY as shown - do not round or estimate.
3. Type: "debit" = money OUT (payments, purchases, card payments, direct debits). "credit" = money IN (deposits, income, refunds, transfers in).
4. For CSV data: if Amount is negative (e.g. -12.99) that is a DEBIT. If positive, it is a CREDIT (unless context says otherwise).
5. Date format: output as YYYY-MM-DD.
6. Include balance if visible in the data, otherwise null.
7. Use the Description or merchant name column as the "merchant" field.

For each transaction: date (YYYY-MM-DD), merchant (payee/merchant name), description (additional details or null), amount (positive number), type ("debit"/"credit"), balance (or null), category (from: "Office Supplies","Travel","Meals & Entertainment","Professional Fees","Utilities","Rent","Salaries","Marketing","Software","Other", or null), categoryConfidence (0-1), vatAmount (or null), vatRate (or null), extractionConfidence (0-1).

Return ONLY valid JSON:
{
  "openingBalance": null,
  "transactions": [{"date":"YYYY-MM-DD","merchant":"Name","description":null,"amount":12.99,"type":"debit","balance":null,"category":null,"categoryConfidence":null,"vatAmount":null,"vatRate":null,"extractionConfidence":0.95}],
  "verification": {"transactionCount": 77, "totalDebits": "1234.56", "totalCredits": "567.89", "closingBalance": null}
}
No markdown. No explanation.`;

  logger.info('[TEXT SINGLE-PASS] Sending to Haiku', {
    textLength: text.length,
    estimatedTokens: Math.ceil(text.length / 4),
  });

  const msg = await anthropic.messages.create({
    model: env.CLAUDE_MODEL_HAIKU || 'claude-haiku-3-5-20241022',
    max_tokens: 16000,
    messages: [{
      role: 'user',
      content: [{ type: 'text', text: `${prompt}\n\n--- BANK STATEMENT DATA ---\n${text}\n--- END ---` }],
    }],
  });

  const responseText = msg.content
    .filter((b) => b.type === 'text')
    .map((b) => 'text' in b ? b.text : '')
    .join('');

  if (msg.stop_reason === 'max_tokens') {
    logger.warn('[TEXT SINGLE-PASS] Response truncated - some transactions may be missing');
  }

  const transactions = parseTransactionsFromResponse(responseText);
  const processingTime = Date.now() - startTime;

  logger.info('[TEXT SINGLE-PASS] Haiku extraction complete', {
    transactionCount: transactions.length,
    processingTime,
    model: 'haiku',
  });

  return {
    success: transactions.length > 0,
    transactions,
    error: transactions.length === 0 ? 'No transactions extracted' : undefined,
    metadata: {
      documentType: 'bank_statement',
      totalTransactions: transactions.length,
      processingTime,
      pipeline: 'text-haiku-single-pass',
    } as any,
  };
}

/**
 * Extract CSV-formatted bank statement text by splitting into row-based chunks.
 * Used for large CSVs where month-splitting fails due to date format issues.
 * Splits into batches of ~60 rows so each batch fits in Haiku's output limit.
 */
async function extractCSVByRowChunks(text: string, startTime: number): Promise<ExtractionResult> {
  const ROWS_PER_CHUNK = 60;

  // Separate header section (before first "Row N:") from data rows
  const lines = text.split('\n');
  const headerLines: string[] = [];
  const allDataLines: string[] = [];
  let inData = false;

  for (const line of lines) {
    if (!inData && /^Row \d+:/.test(line.trim())) {
      inData = true;
    }
    if (inData) {
      allDataLines.push(line);
    } else {
      headerLines.push(line);
    }
  }

  // Keep only actual transaction rows (Row N: ...) — strip summary/footer lines
  const dataLines = allDataLines.filter(line => /^Row \d+:/.test(line.trim()));

  const header = headerLines.join('\n');
  const totalChunks = Math.ceil(dataLines.length / ROWS_PER_CHUNK);

  logger.info('[CSV CHUNKS] Splitting CSV into row-based chunks', {
    totalRows: dataLines.length,
    rowsPerChunk: ROWS_PER_CHUNK,
    totalChunks,
  });

  const allTransactions: ExtractedTransaction[] = [];

  for (let i = 0; i < dataLines.length; i += ROWS_PER_CHUNK) {
    const chunkNum = Math.floor(i / ROWS_PER_CHUNK) + 1;
    const chunkRows = dataLines.slice(i, i + ROWS_PER_CHUNK);
    const expectedRows = chunkRows.length;
    const chunkText = header + '\n' + chunkRows.join('\n');

    if (chunkNum > 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    logger.info(`[CSV CHUNKS] Extracting chunk ${chunkNum}/${totalChunks}`, {
      rows: expectedRows,
      chars: chunkText.length,
    });

    // Build a chunk-specific prompt that tells the model the exact row count
    const csvPrompt = `You are extracting bank statement transactions for professional accounting software. ACCURACY IS CRITICAL.

TASK: This CSV data contains exactly ${expectedRows} rows (Row lines). You MUST extract exactly ${expectedRows} transactions — one per row, no skipping.

AMOUNT AND TYPE RULES (in priority order):
1. If "Money Out" column has a value → type="debit", amount=that value (already positive).
2. If "Money In" column has a value → type="credit", amount=that value (already positive).
3. If neither: use "Amount" column. Negative Amount → type="debit", amount=abs(value). Positive → type="credit".
4. Amount is ALWAYS output as a POSITIVE number.

DATE: Input may be DD/MM/YYYY (e.g. 15/01/2026 → output 2026-01-15) or YYYY-MM-DD.
MERCHANT: Use "Name" column. DESCRIPTION: Use "Notes and #tags" or "Description" column (or null).
INCLUDE ALL ROW TYPES: card_payment, pot_transfer, faster_payment, direct_debit, etc.
BALANCE: null (not available in CSV).

Return ONLY valid JSON with exactly ${expectedRows} transactions:
{"openingBalance":null,"transactions":[{"date":"YYYY-MM-DD","merchant":"Name","description":null,"amount":12.99,"type":"debit","balance":null,"category":null,"categoryConfidence":null,"vatAmount":null,"vatRate":null,"extractionConfidence":0.95}],"verification":{"transactionCount":${expectedRows},"totalDebits":"0.00","totalCredits":"0.00","closingBalance":null}}
No markdown. No explanation.`;

    let transactions: ExtractedTransaction[] = [];

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const msg = await anthropic.messages.create({
          model: env.CLAUDE_MODEL_HAIKU || 'claude-haiku-3-5-20241022',
          max_tokens: 8000,
          messages: [{
            role: 'user',
            content: [{ type: 'text', text: `${csvPrompt}\n\n--- CSV DATA (${expectedRows} rows) ---\n${chunkText}\n--- END ---` }],
          }],
        });

        const responseText = msg.content
          .filter((b) => b.type === 'text')
          .map((b) => 'text' in b ? b.text : '')
          .join('');

        if (msg.stop_reason === 'max_tokens') {
          logger.warn(`[CSV CHUNKS] Chunk ${chunkNum} response truncated`);
        }

        transactions = parseTransactionsFromResponse(responseText);

        // If significantly under-extracted, retry once
        if (transactions.length < expectedRows - 5 && attempt < 2) {
          logger.warn(`[CSV CHUNKS] Chunk ${chunkNum} under-extracted (${transactions.length}/${expectedRows}), retrying...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue;
        }
        break;
      } catch (err: any) {
        logger.error(`[CSV CHUNKS] Chunk ${chunkNum} attempt ${attempt} failed`, { error: err.message });
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    allTransactions.push(...transactions);
    logger.info(`[CSV CHUNKS] Chunk ${chunkNum}: extracted ${transactions.length}/${expectedRows} transactions`);
  }

  // IMPORTANT: Do NOT call deduplicateTransactions for CSV source data.
  // - Each CSV row has a unique Transaction ID (source is already deduplicated)
  // - Chunks are non-overlapping → no cross-chunk duplicates are possible
  // - Same merchant/amount/day transactions ARE legitimate (e.g., 4 vending machine uses)
  const processingTime = Date.now() - startTime;

  logger.info('[CSV CHUNKS] Complete', {
    totalChunks,
    totalTransactions: allTransactions.length,
    expectedTotal: dataLines.length,
    missingRows: dataLines.length - allTransactions.length,
    processingTime: `${(processingTime / 1000).toFixed(1)}s`,
  });

  return {
    success: allTransactions.length > 0,
    transactions: allTransactions,
    error: allTransactions.length === 0 ? 'No transactions extracted from CSV chunks' : undefined,
    metadata: {
      documentType: 'bank_statement',
      totalTransactions: allTransactions.length,
      processingTime,
      pipeline: 'csv-row-chunks-haiku',
    } as any,
  };
}

/**
 * Optimized text-based extraction pipeline for bank statements.
 * Uses local PDF text extraction + Haiku = ~99% cheaper than sending PDF to Sonnet.
 *
 * Pipeline selection logic:
 *  - CSV text (any size)         → row-chunk Haiku (no date-format assumptions)
 *  - Very short text (< 20K)     → single-pass Haiku (fits in one output window)
 *  - Multi-month text            → month-by-month Haiku (avoids 8K token output cap)
 *  - Single-month / no date range detected → single-pass Haiku
 *
 * The previous threshold was 100K chars for single-pass, which caused ALL
 * multi-month PDFs (typically 40-80K chars extracted) to be sent to a single
 * Haiku call, hitting the ~8192 output-token cap and silently truncating months.
 */
async function extractBankStatementOptimized(
  extractedText: string,
  base64Content: string,
  startTime: number
): Promise<ExtractionResult> {
  try {
    logger.info('=== USING OPTIMIZED TEXT-BASED PIPELINE (Haiku) ===');

    // Detect CSV/Excel formatted text (produced by fileParser.ts)
    const isCSVText = extractedText.trimStart().startsWith('=== BANK STATEMENT DATA');

    // CSV: always use row-based chunking (robust — no date-format assumptions needed)
    if (isCSVText) {
      logger.info('CSV text detected, using row-based chunking pipeline', {
        textLength: extractedText.length,
      });
      return await extractCSVByRowChunks(extractedText, startTime);
    }

    // Very short text (single page / < 20K chars): safe for single-pass
    const SINGLE_PASS_CHAR_LIMIT = 20000; // ~5K tokens — guaranteed to fit in one response
    if (extractedText.length < SINGLE_PASS_CHAR_LIMIT) {
      logger.info('Short text document, using single-pass Haiku extraction', {
        textLength: extractedText.length,
        estimatedTokens: Math.ceil(extractedText.length / 4),
      });
      return await extractBankStatementTextSinglePass(extractedText, startTime);
    }

    // Step 1: Detect date range from text (zero API calls)
    let dateRange = detectDateRangeFromText(extractedText);

    if (!dateRange) {
      // Only call LLM date detection if base64Content is actually PDF base64
      // (not plain text). For CSVs, base64Content === extractedText (both plain text).
      const isPdfBase64 = base64Content !== extractedText;
      if (isPdfBase64) {
        logger.info('Regex date detection failed, falling back to LLM detection');
        dateRange = await detectStatementDateRange(base64Content);
      }
    }

    if (!dateRange) {
      // No date range detected at all — use single-pass with a warning
      logger.warn('Could not detect date range — using single-pass Haiku. Multi-month statements may be truncated.', {
        textLength: extractedText.length,
      });
      return await extractBankStatementTextSinglePass(extractedText, startTime);
    }

    // Determine how many calendar months the statement spans
    const periodStart = new Date(dateRange.startDate);
    const periodEnd   = new Date(dateRange.endDate);
    const monthSpan   =
      (periodEnd.getFullYear() - periodStart.getFullYear()) * 12 +
      (periodEnd.getMonth() - periodStart.getMonth()) + 1;

    // Single-month statements: safe for single-pass even if text is large
    if (monthSpan <= 1) {
      logger.info('Single-month statement, using single-pass Haiku extraction', {
        dateRange,
        textLength: extractedText.length,
      });
      return await extractBankStatementTextSinglePass(extractedText, startTime);
    }

    // Multi-month statement: ALWAYS use month-by-month splitting.
    // PDFs use Sonnet+PDF so Claude can see the visual column layout (Money In / Money Out).
    // CSVs use Haiku+text (column structure preserved in text form).
    logger.info(`Multi-month statement (${monthSpan} months) — using month-by-month pipeline`, {
      dateRange,
      textLength: extractedText.length,
    });

    logger.info('Statement period detected', { ...dateRange });

    // Step 2: Build monthly ranges (reuse periodStart/periodEnd from above)
    const months: { startDate: string; endDate: string; label: string }[] = [];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    let current = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);
    while (current <= periodEnd) {
      const year = current.getFullYear();
      const month = current.getMonth();
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);

      const effectiveStart = monthStart < periodStart ? periodStart : monthStart;
      const effectiveEnd = monthEnd > periodEnd ? periodEnd : monthEnd;

      months.push({
        startDate: effectiveStart.toISOString().split('T')[0],
        endDate: effectiveEnd.toISOString().split('T')[0],
        label: `${monthNames[month]} ${year}`,
      });

      current.setMonth(current.getMonth() + 1);
    }

    logger.info(`Splitting into ${months.length} monthly extractions`, {
      months: months.map(m => m.label),
    });

    // Step 3: Split text into monthly chunks (zero API calls)
    const textChunks = splitTextByMonth(extractedText, months);

    // Safety check: if ALL chunks are empty, month-splitter failed (unrecognised date format).
    // Fall back to single-pass Haiku (better than nothing; user will see truncation warning).
    const nonEmptyChunks = months.filter(m => (textChunks.get(m.label) || '').trim().length > 0);
    if (nonEmptyChunks.length === 0) {
      logger.warn('Month-splitting produced all empty chunks — transaction date format not recognised in extracted text. Falling back to single-pass Haiku.', {
        months: months.map(m => m.label),
        hint: 'PDF may use an unusual date format or the text extraction did not preserve line structure.',
      });
      return await extractBankStatementTextSinglePass(extractedText, startTime);
    }

    const emptyMonths = months.filter(m => !(textChunks.get(m.label) || '').trim());
    if (emptyMonths.length > 0) {
      logger.warn(`${emptyMonths.length} month(s) produced no text lines. These months will be attempted via Sonnet PDF fallback.`, {
        emptyMonths: emptyMonths.map(m => m.label),
        filledMonths: nonEmptyChunks.map(m => m.label),
        hint: 'Transactions in these months may use a date format not recognised by the text splitter.',
      });
    }

    // Step 4: Extract each month.
    // PDFs: use Sonnet + PDF document so Claude can SEE the actual column layout
    //       (Money In vs Money Out columns). Plain-text extraction loses column
    //       structure and causes wrong debit/credit classification.
    // CSV/text: use Haiku + extracted text (column structure preserved in text).
    const isPdfBase64 = base64Content !== extractedText;

    const allTransactions: ExtractedTransaction[] = [];
    const allBalanceVerifications: BalanceVerificationResult[] = [];
    const allCorrections: Array<{ month: string; index: number; date: string; merchant: string; originalAmount: number; correctedAmount: number; reason: string }> = [];
    const monthResults: Array<{ label: string; count: number; status: 'ok' | 'failed' }> = [];

    for (let i = 0; i < months.length; i++) {
      const month = months[i];

      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, isPdfBase64 ? 5000 : 2000));
      }

      try {
        if (isPdfBase64) {
          // PDF: send the actual PDF to Sonnet so column layout (Money In / Money Out) is visible
          logger.info(`[PDF] Extracting ${month.label} via Sonnet+PDF (${i + 1}/${months.length})`);
          const result = await extractMonthWithVerification(base64Content, month, i, months.length);
          // Hard-filter to only transactions within this month's date range.
          // Claude sometimes includes adjacent-month transactions — filter them out server-side.
          const inRange = result.transactions.filter(t => t.date >= month.startDate && t.date <= month.endDate);
          const filtered = result.transactions.length - inRange.length;
          if (filtered > 0) {
            logger.warn(`[PDF] ${month.label}: filtered out ${filtered} out-of-range transactions (Claude bleed-through)`);
          }
          allTransactions.push(...inRange);
          monthResults.push({ label: month.label, count: inRange.length, status: 'ok' });
          if (result.balanceVerification) allBalanceVerifications.push(result.balanceVerification);
          if (result.corrections.length > 0) allCorrections.push(...result.corrections.map(c => ({ ...c, month: month.label })));
        } else {
          // CSV / pre-parsed text: Haiku is sufficient; column structure is preserved in text
          const chunk = textChunks.get(month.label) || '';
          if (!chunk.trim()) {
            logger.error(`[CSV] ${month.label}: no text chunk — month MISSING`);
            monthResults.push({ label: month.label, count: 0, status: 'failed' });
            continue;
          }
          logger.info(`[CSV] Extracting ${month.label} via Haiku+text (${i + 1}/${months.length})`);
          const result = await extractMonthFromText(chunk, month, i, months.length);
          // Filter CSV results to date range as well (safety net)
          const inRange = result.transactions.filter(t => t.date >= month.startDate && t.date <= month.endDate);
          const filtered = result.transactions.length - inRange.length;
          if (filtered > 0) {
            logger.warn(`[CSV] ${month.label}: filtered out ${filtered} out-of-range transactions`);
          }
          allTransactions.push(...inRange);
          monthResults.push({ label: month.label, count: inRange.length, status: 'ok' });
          if (result.balanceVerification) allBalanceVerifications.push(result.balanceVerification);
          if (result.corrections.length > 0) allCorrections.push(...result.corrections.map(c => ({ ...c, month: month.label })));
        }
      } catch (error) {
        logger.error(`[PIPELINE] Failed to extract ${month.label}`, { error });
        monthResults.push({ label: month.label, count: 0, status: 'failed' });
      }
    }

    // Sort by date
    allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Log balance chain summary
    if (allBalanceVerifications.length > 0) {
      const totalChainBreaks = allBalanceVerifications.reduce((s, v) => s + v.brokenLinks.length, 0);
      const avgCoverage = allBalanceVerifications.reduce((s, v) => s + v.balanceCoverage, 0) / allBalanceVerifications.length;

      logger.info('=== BALANCE CHAIN VERIFICATION SUMMARY (TEXT PIPELINE) ===', {
        totalChainBreaks,
        totalAutoCorrections: allCorrections.length,
        averageBalanceCoverage: `${(avgCoverage * 100).toFixed(0)}%`,
      });
    }

    // Deduplicate
    const { deduplicated, removedCount } = deduplicateTransactions(allTransactions);
    if (removedCount > 0) {
      logger.info(`Deduplication removed ${removedCount} duplicate transactions`);
    }

    const processingTime = Date.now() - startTime;

    const failedMonths = monthResults.filter(r => r.status === 'failed');

    logger.info('=== EXTRACTION PIPELINE COMPLETE ===', {
      pipeline: isPdfBase64 ? 'PDF-Sonnet-month-by-month' : 'CSV-Haiku-month-by-month',
      monthsProcessed: months.length,
      monthResults: monthResults.map(r => `${r.label}: ${r.count} txns [${r.status}]`),
      rawCount: allTransactions.length,
      afterDedup: deduplicated.length,
      processingTime: `${(processingTime / 1000).toFixed(1)}s`,
      ...(failedMonths.length > 0 && {
        WARNING: `${failedMonths.length} month(s) FAILED: ${failedMonths.map(r => r.label).join(', ')}`,
      }),
    });

    const hasFailedMonths = failedMonths.length > 0;

    return {
      success: deduplicated.length > 0,
      transactions: deduplicated,
      error: hasFailedMonths
        ? `Extraction incomplete: ${failedMonths.map(r => r.label).join(', ')} could not be extracted. Other months were processed successfully.`
        : (deduplicated.length === 0 ? 'No transactions extracted' : undefined),
      metadata: {
        documentType: 'bank_statement',
        totalTransactions: deduplicated.length,
        processingTime,
        pipeline: isPdfBase64 ? 'pdf-sonnet' : 'csv-haiku',
        monthResults: monthResults,
        failedMonths: failedMonths.map(r => r.label),
        balanceVerification: allBalanceVerifications.length > 0 ? {
          totalTransactions: deduplicated.length,
          transactionsWithBalance: deduplicated.filter(t => t.balance !== null).length,
          balanceCoverage: allBalanceVerifications.reduce((s, v) => s + v.balanceCoverage, 0) / allBalanceVerifications.length,
          chainBreaks: allBalanceVerifications.reduce((s, v) => s + v.brokenLinks.length, 0),
          autoCorrections: allCorrections.length,
          isFullyVerified: allBalanceVerifications.every(v => v.isFullyVerified),
        } : undefined,
      } as any,
    };
  } catch (error) {
    const isPdfBase64 = base64Content !== extractedText;
    if (isPdfBase64) {
      logger.error('Text pipeline failed, falling back to Sonnet PDF pipeline', { error });
      return await extractLargeBankStatementByMonth(base64Content, startTime);
    }
    logger.error('Text pipeline failed for non-PDF content, using single-pass Haiku', { error });
    return await extractBankStatementTextSinglePass(extractedText, startTime);
  }
}

/**
 * Per-month extraction for large multi-month bank statements
 * Extracts one month at a time for maximum accuracy with self-verification
 */
async function extractLargeBankStatementByMonth(
  fileContent: string,
  startTime: number
): Promise<ExtractionResult> {
  // Step 1: Detect the statement date range
  logger.info('Step 1: Detecting statement date range...');
  const dateRange = await detectStatementDateRange(fileContent);

  if (!dateRange) {
    logger.warn('Could not detect date range, falling back to single-pass');
    return await extractBankStatementSinglePass(fileContent, 'application/pdf', startTime);
  }

  logger.info('Statement period detected', dateRange);

  // Step 2: Build monthly ranges
  const months: { startDate: string; endDate: string; label: string }[] = [];
  const periodStart = new Date(dateRange.startDate);
  const periodEnd = new Date(dateRange.endDate);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  let current = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);
  while (current <= periodEnd) {
    const year = current.getFullYear();
    const month = current.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    const effectiveStart = monthStart < periodStart ? periodStart : monthStart;
    const effectiveEnd = monthEnd > periodEnd ? periodEnd : monthEnd;

    months.push({
      startDate: effectiveStart.toISOString().split('T')[0],
      endDate: effectiveEnd.toISOString().split('T')[0],
      label: `${monthNames[month]} ${year}`,
    });

    current.setMonth(current.getMonth() + 1);
  }

  logger.info(`Splitting into ${months.length} monthly extractions`, {
    months: months.map(m => m.label),
  });

  // Step 3: Extract each month with verification
  const allTransactions: ExtractedTransaction[] = [];
  const verificationResults: { month: string; reported: any; actual: any }[] = [];
  const allBalanceVerifications: BalanceVerificationResult[] = [];
  const allCorrections: Array<{ month: string; index: number; date: string; merchant: string; originalAmount: number; correctedAmount: number; reason: string }> = [];

  for (let i = 0; i < months.length; i++) {
    const month = months[i];

    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    const result = await extractMonthWithVerification(fileContent, month, i, months.length);
    // Hard-filter to only transactions within this month's date range
    const inRange = result.transactions.filter(t => t.date >= month.startDate && t.date <= month.endDate);
    const filtered = result.transactions.length - inRange.length;
    if (filtered > 0) {
      logger.warn(`[LARGE-PDF] ${month.label}: filtered out ${filtered} out-of-range transactions`);
    }
    allTransactions.push(...inRange);

    if (result.balanceVerification) {
      allBalanceVerifications.push(result.balanceVerification);
    }
    if (result.corrections.length > 0) {
      allCorrections.push(...result.corrections.map(c => ({ ...c, month: month.label })));
    }

    if (result.verification) {
      const actualDebits = result.transactions
        .filter(t => t.type === 'debit')
        .reduce((s, t) => s + t.amount, 0);
      const actualCredits = result.transactions
        .filter(t => t.type === 'credit')
        .reduce((s, t) => s + t.amount, 0);

      verificationResults.push({
        month: month.label,
        reported: result.verification,
        actual: {
          count: result.transactions.length,
          totalDebits: actualDebits.toFixed(2),
          totalCredits: actualCredits.toFixed(2),
        },
      });
    }
  }

  // Sort by date
  allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Log verification summary
  logger.info('=== EXTRACTION VERIFICATION SUMMARY ===');
  for (const v of verificationResults) {
    logger.info(`${v.month}: Reported ${v.reported.transactionCount} txns (debits: ${v.reported.totalDebits}, credits: ${v.reported.totalCredits}) | Parsed ${v.actual.count} txns (debits: ${v.actual.totalDebits}, credits: ${v.actual.totalCredits})`);
  }

  // Log balance chain verification summary
  if (allBalanceVerifications.length > 0) {
    const totalChainBreaks = allBalanceVerifications.reduce((s, v) => s + v.brokenLinks.length, 0);
    const avgCoverage = allBalanceVerifications.reduce((s, v) => s + v.balanceCoverage, 0) / allBalanceVerifications.length;

    logger.info('=== BALANCE CHAIN VERIFICATION SUMMARY ===', {
      totalChainBreaks,
      totalAutoCorrections: allCorrections.length,
      averageBalanceCoverage: `${(avgCoverage * 100).toFixed(0)}%`,
      monthResults: allBalanceVerifications.map(v => ({
        month: v.monthLabel,
        coverage: `${(v.balanceCoverage * 100).toFixed(0)}%`,
        valid: v.validLinks,
        broken: v.brokenLinks.length,
        verified: v.isFullyVerified,
      })),
    });

    // Cross-month balance continuity check
    for (let i = 1; i < allBalanceVerifications.length; i++) {
      const prev = allBalanceVerifications[i - 1];
      const curr = allBalanceVerifications[i];
      if (prev.closingBalance !== null && curr.openingBalance !== null) {
        const diff = Math.abs(prev.closingBalance - curr.openingBalance);
        if (diff > 0.015) {
          logger.warn(`Cross-month balance gap: ${prev.monthLabel} closing (£${prev.closingBalance.toFixed(2)}) != ${curr.monthLabel} opening (£${curr.openingBalance.toFixed(2)}), diff: £${diff.toFixed(2)}`);
        }
      }
    }
  }

  logger.info(`Raw extraction: ${allTransactions.length} transactions before deduplication`);

  // Step 4: Deduplicate transactions (removes same-day and cross-month boundary duplicates)
  const { deduplicated, removedCount, removedDetails } = deduplicateTransactions(allTransactions);

  if (removedCount > 0) {
    logger.info(`Deduplication removed ${removedCount} duplicate transactions`, { removedDetails });
  }

  // Step 5: Log extracted totals (balance chain verification replaces expensive PDF verification API call)
  const extractedDeposits = deduplicated.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
  const extractedOutgoings = deduplicated.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);

  logger.info('=== EXTRACTION TOTALS (Sonnet PDF pipeline) ===', {
    totalCredits: extractedDeposits.toFixed(2),
    totalDebits: extractedOutgoings.toFixed(2),
    creditCount: deduplicated.filter(t => t.type === 'credit').length,
    debitCount: deduplicated.filter(t => t.type === 'debit').length,
  });

  const processingTime = Date.now() - startTime;

  logger.info('Per-month extraction complete', {
    monthsProcessed: months.length,
    rawCount: allTransactions.length,
    afterDedup: deduplicated.length,
    duplicatesRemoved: removedCount,
    processingTime: `${(processingTime / 1000).toFixed(1)}s`,
    pipeline: 'pdf-sonnet',
  });

  return {
    success: deduplicated.length > 0,
    transactions: deduplicated,
    error: deduplicated.length === 0 ? 'No transactions extracted' : undefined,
    metadata: {
      documentType: 'bank_statement',
      totalTransactions: deduplicated.length,
      processingTime,
      pipeline: 'pdf-sonnet',
      duplicatesRemoved: removedCount,
      balanceVerification: allBalanceVerifications.length > 0 ? {
        totalTransactions: deduplicated.length,
        transactionsWithBalance: deduplicated.filter(t => t.balance !== null).length,
        balanceCoverage: allBalanceVerifications.reduce((s, v) => s + v.balanceCoverage, 0) / allBalanceVerifications.length,
        chainBreaks: allBalanceVerifications.reduce((s, v) => s + v.brokenLinks.length, 0),
        autoCorrections: allCorrections.length,
        isFullyVerified: allBalanceVerifications.every(v => v.isFullyVerified),
        correctedTransactions: allCorrections,
      } : undefined,
    } as any,
  };
}

/**
 * Extract transaction from a receipt
 */
export async function extractReceipt(
  fileContent: string,
  fileType: string
): Promise<ExtractionResult> {
  const startTime = Date.now();

  try {
    logger.info('Starting receipt extraction', { fileType });

    const prompt = `You are an expert accounting assistant. Extract the transaction details from this receipt.

Provide:
- date (ISO 8601 format: YYYY-MM-DD)
- merchant (business name)
- description (what was purchased, or null)
- amount (total amount paid)
- type (always "debit" for receipts)
- category (best guess: "Office Supplies", "Travel", "Meals & Entertainment", "Professional Fees", "Utilities", "Rent", "Marketing", "Software", "Other", or null)
- categoryConfidence (0.0 to 1.0)
- vatAmount (VAT/tax amount if shown, or null)
- vatRate (VAT rate as decimal, or null)
- extractionConfidence (0.0 to 1.0)

Return ONLY a valid JSON object:
{
  "transactions": [
    {
      "date": "2024-01-15",
      "merchant": "Coffee Shop",
      "description": "Client meeting refreshments",
      "amount": 45.50,
      "type": "debit",
      "category": "Meals & Entertainment",
      "categoryConfidence": 0.90,
      "vatAmount": 9.10,
      "vatRate": 0.20,
      "extractionConfidence": 0.95
    }
  ]
}

Return ONLY valid JSON, no markdown formatting.`;

    const message = await anthropic.messages.create({
      model: env.CLAUDE_MODEL_HAIKU || 'claude-3-haiku-20240307',  // Use Haiku for cost efficiency and higher rate limits
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: fileType === 'application/pdf'
            ? [
                {
                  type: 'document',
                  source: {
                    type: 'base64',
                    media_type: 'application/pdf',
                    data: fileContent,
                  },
                },
                {
                  type: 'text' as const,
                  text: prompt,
                },
              ]
            : fileType.startsWith('image/')
            ? [
                {
                  type: 'image' as const,
                  source: {
                    type: 'base64' as const,
                    media_type: fileType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                    data: fileContent,
                  },
                },
                {
                  type: 'text' as const,
                  text: prompt,
                },
              ]
            : [
                {
                  type: 'text' as const,
                  text: `${prompt}\n\nReceipt content:\n${fileContent}`,
                },
              ],
        },
      ],
    });

    // Extract text from Claude's response
    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => 'text' in block ? block.text : '')
      .join('');

    logger.info('Claude response received', { responseLength: responseText.length });

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }

    const result = JSON.parse(jsonMatch[0]);
    const transactions: ExtractedTransaction[] = result.transactions || [];

    const processingTime = Date.now() - startTime;

    logger.info('Receipt extraction complete', {
      transactionCount: transactions.length,
      processingTime,
    });

    return {
      success: true,
      transactions,
      metadata: {
        documentType: 'receipt',
        totalTransactions: transactions.length,
        processingTime,
      },
    };
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logger.error('Receipt extraction failed', { error, processingTime });

    // Handle Anthropic API errors with user-friendly messages
    let errorMessage = 'Unknown error occurred during extraction';

    if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
      errorMessage = 'Claude API rate limit exceeded. Please wait a few minutes and try again.';
    } else if (error?.status === 401) {
      errorMessage = 'API authentication failed. Please check API key configuration.';
    } else if (error?.status === 400) {
      errorMessage = 'Invalid request to Claude API. The document may be corrupted or unsupported.';
    } else if (error?.status === 500 || error?.status === 502 || error?.status === 503) {
      errorMessage = 'Claude API is temporarily unavailable. Please try again later.';
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      success: false,
      transactions: [],
      error: errorMessage,
      metadata: {
        documentType: 'receipt',
        totalTransactions: 0,
        processingTime,
      },
    };
  }
}

/**
 * Extract transaction from an invoice
 */
export async function extractInvoice(
  fileContent: string,
  fileType: string,
  invoiceType: 'sales' | 'purchase'
): Promise<ExtractionResult> {
  const startTime = Date.now();

  try {
    logger.info('Starting invoice extraction', { fileType, invoiceType });

    const transactionType = invoiceType === 'sales' ? 'credit' : 'debit';

    const prompt = `You are an expert accounting assistant. Extract the transaction details from this ${invoiceType} invoice.

Provide:
- date (invoice date in ISO 8601 format: YYYY-MM-DD)
- merchant (${invoiceType === 'sales' ? 'customer name' : 'supplier name'})
- description (invoice description or line items summary, or null)
- amount (total invoice amount including VAT)
- type ("${transactionType}")
- category (best guess based on invoice items, or null)
- categoryConfidence (0.0 to 1.0)
- vatAmount (VAT/tax amount, or null)
- vatRate (VAT rate as decimal, or null)
- extractionConfidence (0.0 to 1.0)

Return ONLY a valid JSON object:
{
  "transactions": [
    {
      "date": "2024-01-15",
      "merchant": "Client Name",
      "description": "Consulting services for January",
      "amount": 1200.00,
      "type": "${transactionType}",
      "category": "Professional Fees",
      "categoryConfidence": 0.95,
      "vatAmount": 240.00,
      "vatRate": 0.20,
      "extractionConfidence": 0.98
    }
  ]
}

Return ONLY valid JSON, no markdown formatting.`;

    const message = await anthropic.messages.create({
      model: env.CLAUDE_MODEL_HAIKU || 'claude-3-haiku-20240307',  // Use Haiku for cost efficiency and higher rate limits
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: fileType === 'application/pdf'
            ? [
                {
                  type: 'document',
                  source: {
                    type: 'base64',
                    media_type: 'application/pdf',
                    data: fileContent,
                  },
                },
                {
                  type: 'text' as const,
                  text: prompt,
                },
              ]
            : fileType.startsWith('image/')
            ? [
                {
                  type: 'image' as const,
                  source: {
                    type: 'base64' as const,
                    media_type: fileType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                    data: fileContent,
                  },
                },
                {
                  type: 'text' as const,
                  text: prompt,
                },
              ]
            : [
                {
                  type: 'text' as const,
                  text: `${prompt}\n\nInvoice content:\n${fileContent}`,
                },
              ],
        },
      ],
    });

    // Extract text from Claude's response
    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => 'text' in block ? block.text : '')
      .join('');

    logger.info('Claude response received', { responseLength: responseText.length });

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }

    const result = JSON.parse(jsonMatch[0]);
    const transactions: ExtractedTransaction[] = result.transactions || [];

    const processingTime = Date.now() - startTime;

    logger.info('Invoice extraction complete', {
      transactionCount: transactions.length,
      processingTime,
    });

    return {
      success: true,
      transactions,
      metadata: {
        documentType: `invoice_${invoiceType}`,
        totalTransactions: transactions.length,
        processingTime,
      },
    };
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logger.error('Invoice extraction failed', { error, processingTime });

    // Handle Anthropic API errors with user-friendly messages
    let errorMessage = 'Unknown error occurred during extraction';

    if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
      errorMessage = 'Claude API rate limit exceeded. Please wait a few minutes and try again.';
    } else if (error?.status === 401) {
      errorMessage = 'API authentication failed. Please check API key configuration.';
    } else if (error?.status === 500 || error?.status === 502 || error?.status === 503) {
      errorMessage = 'Claude API is temporarily unavailable. Please try again later.';
    } else if (error?.status === 400) {
      errorMessage = 'Invalid request to Claude API. The document may be corrupted or unsupported.';
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      success: false,
      transactions: [],
      error: errorMessage,
      metadata: {
        documentType: `invoice_${invoiceType}`,
        totalTransactions: 0,
        processingTime,
      },
    };
  }
}

/**
 * Extract transactions for specific months from an existing document
 * Uses the same accuracy-focused per-month extraction with verification
 */
export async function extractSpecificMonths(
  fileContent: string,
  missingMonths: { startDate: string; endDate: string; label: string }[],
  extractedText?: string
): Promise<ExtractionResult> {
  const startTime = Date.now();

  try {
    const useTextPipeline = extractedText && extractedText.length > 100;
    logger.info('Starting targeted extraction for months', {
      monthCount: missingMonths.length,
      months: missingMonths.map(m => m.label),
      pipeline: useTextPipeline ? 'text-haiku' : 'pdf-sonnet',
    });

    // If we have extracted text, split it into monthly chunks
    let textChunks: Map<string, string> | null = null;
    if (useTextPipeline) {
      textChunks = splitTextByMonth(extractedText!, missingMonths);
    }

    const allTransactions: ExtractedTransaction[] = [];

    for (let i = 0; i < missingMonths.length; i++) {
      const month = missingMonths[i];

      if (i > 0) {
        const delay = useTextPipeline ? 2000 : 10000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      try {
        let result;
        if (textChunks) {
          const chunk = textChunks.get(month.label) || '';
          if (chunk.trim()) {
            result = await extractMonthFromText(chunk, month, i, missingMonths.length);
          } else {
            // No text for this month, fall back to PDF
            result = await extractMonthWithVerification(fileContent, month, i, missingMonths.length);
          }
        } else {
          result = await extractMonthWithVerification(fileContent, month, i, missingMonths.length);
        }

        logger.info(`${month.label}: ${result.transactions.length} transactions extracted`);
        allTransactions.push(...result.transactions);
      } catch (error) {
        logger.error(`Failed to extract ${month.label}`, { error });
      }
    }

    // Sort by date
    allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Deduplicate
    const { deduplicated, removedCount, removedDetails } = deduplicateTransactions(allTransactions);
    if (removedCount > 0) {
      logger.info(`Targeted extraction deduplication removed ${removedCount} duplicates`, { removedDetails });
    }

    const processingTime = Date.now() - startTime;

    logger.info('Targeted extraction complete', {
      monthsProcessed: missingMonths.length,
      rawCount: allTransactions.length,
      afterDedup: deduplicated.length,
      duplicatesRemoved: removedCount,
      processingTime: `${(processingTime / 1000).toFixed(1)}s`,
    });

    return {
      success: deduplicated.length > 0,
      transactions: deduplicated,
      error: deduplicated.length === 0 ? 'No transactions found' : undefined,
      metadata: {
        documentType: 'bank_statement',
        totalTransactions: deduplicated.length,
        processingTime,
        duplicatesRemoved: removedCount,
      } as any,
    };
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logger.error('Targeted extraction failed', { error: error.message || error, processingTime });

    return {
      success: false,
      transactions: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: { documentType: 'bank_statement', totalTransactions: 0, processingTime },
    };
  }
}

/**
 * Main extraction function - routes to appropriate extractor based on document type
 */
export async function extractTransactions(
  fileContent: string,
  fileType: string,
  documentType: 'bank_statement' | 'receipt' | 'invoice_sales' | 'invoice_purchase',
  fileSizeBytes?: number,
  extractedText?: string
): Promise<ExtractionResult> {
  switch (documentType) {
    case 'bank_statement':
      return extractBankStatement(fileContent, fileType, fileSizeBytes, extractedText);
    case 'receipt':
      return extractReceipt(fileContent, fileType);
    case 'invoice_sales':
      return extractInvoice(fileContent, fileType, 'sales');
    case 'invoice_purchase':
      return extractInvoice(fileContent, fileType, 'purchase');
    default:
      return {
        success: false,
        transactions: [],
        error: `Unsupported document type: ${documentType}`,
      };
  }
}

// ============================================================================
// IMAGE-BASED PDF EXTRACTION PIPELINE (for multi-page bank statements)
// ============================================================================

const PAGE_EXTRACTION_PROMPT = `Extract transactions from this bank statement page.

RESPONSE FORMAT (REQUIRED - NO EXCEPTIONS):
Return ONLY a valid JSON array. Do NOT include explanations, markdown, or any text outside the JSON.

If the page has transactions, return them in this format:
[{"date":"YYYY-MM-DD","merchant":"name","description":"ref or null","debit":null,"credit":123.45,"balance":500.00,"category":null,"categoryConfidence":null,"extractionConfidence":0.9}]

If the page has NO transactions (cover page, index, terms, blank page), return:
[]

NEVER respond with text like "I don't see", "This page has", etc. ALWAYS return valid JSON.

EXTRACTION RULES:
- debit = money OUT (payments, withdrawals) - goes in "debit" field, "credit" is null
- credit = money IN (deposits, refunds) - goes in "credit" field, "debit" is null
- Do NOT extract: opening/closing balance lines, totals, headers
- Balance = running balance on the SAME ROW as the transaction
- Dates: convert to YYYY-MM-DD format

Return ONLY the JSON array. No markdown code fences. No explanations.`;

/**
 * Extract transactions from a single page image using Haiku vision (cheap, fast)
 */
async function extractPageWithHaiku(pageBase64: string, pageNum: number, totalPages: number): Promise<ExtractedTransaction[]> {
  logger.info(`Extracting page ${pageNum}/${totalPages} with Haiku vision`);

  try {
    const response = await anthropic.messages.create({
      model: env.CLAUDE_MODEL_HAIKU || 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: pageBase64,
            },
          },
          { type: 'text', text: PAGE_EXTRACTION_PROMPT }
        ]
      }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('No text response from Haiku');
    }

    // Remove markdown code fences if present
    const cleaned = content.text.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }

    // Convert to ExtractedTransaction format
    const transactions: ExtractedTransaction[] = parsed.map((txn: any) => ({
      date: txn.date,
      merchant: txn.merchant || 'Unknown',
      description: txn.description || null,
      amount: txn.debit || txn.credit || 0,
      type: txn.debit ? 'debit' : 'credit',
      category: txn.category || null,
      categoryConfidence: txn.categoryConfidence || null,
      vatAmount: null,
      vatRate: null,
      extractionConfidence: txn.extractionConfidence || 0.85,
      balance: txn.balance || null,
    }));

    logger.info(`Page ${pageNum}: ${transactions.length} transactions extracted (Haiku)`);
    return transactions;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error(`Haiku extraction failed for page ${pageNum}`, {
      error: errorMsg,
      stack: errorStack,
      errorType: error?.constructor?.name
    });
    throw error;
  }
}

/**
 * Retry page extraction with Sonnet (more powerful, for complex pages)
 */
async function retryPageWithSonnet(pageBase64: string, pageNum: number, totalPages: number): Promise<ExtractedTransaction[]> {
  logger.warn(`Retrying page ${pageNum}/${totalPages} with Sonnet (Haiku failed)`);

  try {
    const response = await anthropic.messages.create({
      model: env.CLAUDE_MODEL_SONNET || 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: pageBase64,
            },
          },
          {
            type: 'text',
            text: `Complex bank statement page. ${PAGE_EXTRACTION_PROMPT}`
          }
        ]
      }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('No text response from Sonnet');
    }

    const cleaned = content.text.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }

    const transactions: ExtractedTransaction[] = parsed.map((txn: any) => ({
      date: txn.date,
      merchant: txn.merchant || 'Unknown',
      description: txn.description || null,
      amount: txn.debit || txn.credit || 0,
      type: txn.debit ? 'debit' : 'credit',
      category: txn.category || null,
      categoryConfidence: txn.categoryConfidence || null,
      vatAmount: null,
      vatRate: null,
      extractionConfidence: txn.extractionConfidence || 0.9,
      balance: txn.balance || null,
    }));

    logger.info(`Page ${pageNum}: ${transactions.length} transactions extracted (Sonnet fallback)`);
    return transactions;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error(`Sonnet extraction also failed for page ${pageNum}`, {
      error: errorMsg,
      stack: errorStack,
      errorType: error?.constructor?.name
    });
    throw error;
  }
}

/**
 * Extract bank statement using image-based pipeline (bypasses text extraction issues)
 */
export async function extractBankStatementFromImages(pdfBuffer: Buffer, startTime: number): Promise<ExtractionResult> {
  try {
    logger.info('=== USING IMAGE-BASED EXTRACTION PIPELINE (Haiku Vision) ===');

    // Step 1: Convert all PDF pages to images
    const pageImages = await pdfToBase64Images(pdfBuffer);
    logger.info(`PDF converted to ${pageImages.length} page images`);

    // Step 2: Extract transactions from each page
    const allTransactions: ExtractedTransaction[] = [];
    const pageResults: { pageNum: number; count: number; model: 'haiku' | 'sonnet' | 'failed' }[] = [];

    for (let i = 0; i < pageImages.length; i++) {
      const pageNum = i + 1;

      // Rate limiting: wait 2s between pages (Haiku has high rate limits)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      try {
        // Try Haiku first (cheap + fast)
        const transactions = await extractPageWithHaiku(pageImages[i], pageNum, pageImages.length);
        allTransactions.push(...transactions);
        pageResults.push({ pageNum, count: transactions.length, model: 'haiku' });
      } catch (haikuError) {
        // Haiku failed, retry with Sonnet
        try {
          await new Promise(resolve => setTimeout(resolve, 3000)); // Extra delay before Sonnet
          const transactions = await retryPageWithSonnet(pageImages[i], pageNum, pageImages.length);
          allTransactions.push(...transactions);
          pageResults.push({ pageNum, count: transactions.length, model: 'sonnet' });
        } catch (sonnetError) {
          const haikuMsg = haikuError instanceof Error ? haikuError.message : String(haikuError);
          const sonnetMsg = sonnetError instanceof Error ? sonnetError.message : String(sonnetError);
          logger.error(`Both Haiku and Sonnet failed for page ${pageNum}, skipping`, {
            haikuError: haikuMsg,
            sonnetError: sonnetMsg
          });
          pageResults.push({ pageNum, count: 0, model: 'failed' });
        }
      }
    }

    // Sort by date
    allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Deduplication: remove exact duplicates (same date + merchant + amount)
    const uniqueTransactions: ExtractedTransaction[] = [];
    const seen = new Set<string>();

    for (const txn of allTransactions) {
      const key = `${txn.date}|${txn.merchant}|${txn.amount}|${txn.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueTransactions.push(txn);
      }
    }

    const duplicatesRemoved = allTransactions.length - uniqueTransactions.length;
    if (duplicatesRemoved > 0) {
      logger.info(`Deduplication removed ${duplicatesRemoved} duplicate transactions`);
    }

    const processingTime = Date.now() - startTime;
    const failedPages = pageResults.filter(p => p.model === 'failed').length;
    const haikuPages = pageResults.filter(p => p.model === 'haiku').length;
    const sonnetPages = pageResults.filter(p => p.model === 'sonnet').length;

    logger.info('=== IMAGE-BASED EXTRACTION COMPLETE ===', {
      totalPages: pageImages.length,
      haikuPages,
      sonnetPages,
      failedPages,
      rawTransactions: allTransactions.length,
      afterDedup: uniqueTransactions.length,
      duplicatesRemoved,
      processingTime: `${(processingTime / 1000).toFixed(1)}s`,
    });

    return {
      success: true,
      transactions: uniqueTransactions,
      metadata: {
        documentType: 'bank_statement',
        totalTransactions: uniqueTransactions.length,
        processingTime,
        pipeline: 'image-based-vision',
        pageResults,
        failedPages,
      } as any,
    };
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logger.error('Image-based extraction failed', { error: error.message || error, processingTime });

    return {
      success: false,
      transactions: [],
      error: error instanceof Error ? error.message : 'Image extraction failed',
      metadata: {
        documentType: 'bank_statement',
        totalTransactions: 0,
        processingTime,
      },
    };
  }
}
