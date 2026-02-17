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
 * Deduplicate extracted transactions.
 * Removes exact duplicates (same date + amount + normalized merchant)
 * and cross-month boundary duplicates (same amount + merchant, 1-2 days apart crossing month boundary).
 */
function deduplicateTransactions(transactions: ExtractedTransaction[]): {
  deduplicated: ExtractedTransaction[];
  removedCount: number;
  removedDetails: string[];
} {
  const removedDetails: string[] = [];

  // Step 1: Remove exact same-day duplicates (same date + amount + normalized merchant)
  const uniqueMap = new Map<string, ExtractedTransaction>();
  for (const txn of transactions) {
    const normMerchant = txn.merchant.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
    const key = `${txn.date}|${txn.amount.toFixed(2)}|${txn.type}|${normMerchant}`;

    if (uniqueMap.has(key)) {
      removedDetails.push(`Same-day dup: ${txn.date} | £${txn.amount.toFixed(2)} | ${txn.merchant}`);
    } else {
      uniqueMap.set(key, txn);
    }
  }

  let result = [...uniqueMap.values()];

  // Step 2: Remove cross-month boundary duplicates
  // (same merchant + amount, 1-2 days apart, crossing a month boundary)
  result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const toRemove = new Set<number>();

  for (let i = 0; i < result.length; i++) {
    if (toRemove.has(i)) continue;

    for (let j = i + 1; j < result.length; j++) {
      if (toRemove.has(j)) continue;

      const t1 = result[i];
      const t2 = result[j];

      const d1 = new Date(t1.date);
      const d2 = new Date(t2.date);
      const dayDiff = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);

      // Only check transactions within 2 days of each other
      if (dayDiff > 2) break;
      if (dayDiff < 1) continue;

      // Must cross a month boundary
      const month1 = t1.date.substring(0, 7);
      const month2 = t2.date.substring(0, 7);
      if (month1 === month2) continue;

      // Same amount and similar merchant
      if (Math.abs(t1.amount - t2.amount) < 0.01 && t1.type === t2.type) {
        const m1 = t1.merchant.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15);
        const m2 = t2.merchant.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15);

        if (m1 === m2) {
          toRemove.add(j); // Remove the later one
          removedDetails.push(`Cross-month dup: ${t1.date} & ${t2.date} | £${t1.amount.toFixed(2)} | ${t1.merchant}`);
        }
      }
    }
  }

  const deduplicated = result.filter((_, idx) => !toRemove.has(idx));
  const removedCount = transactions.length - deduplicated.length;

  if (removedCount > 0) {
    logger.info(`Deduplication removed ${removedCount} transactions`, { removedDetails });
  }

  return { deduplicated, removedCount, removedDetails };
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
  // Try standard JSON parse first
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const result = JSON.parse(jsonMatch[0]);
      return result.transactions || [];
    } catch (_) {
      // Try repair
      logger.warn('JSON parse failed, attempting repair...');
    }
  }

  // Try repairing truncated JSON
  try {
    const repaired = repairTruncatedJson(responseText);
    const result = JSON.parse(repaired);
    const txns = result.transactions || [];
    logger.info(`JSON repair successful, recovered ${txns.length} transactions`);
    return txns;
  } catch (e: any) {
    logger.error('JSON repair also failed', { error: e.message, responsePreview: responseText.substring(0, 500) });
    return [];
  }
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
  return `You are extracting bank statement transactions for professional accounting software. ACCURACY IS CRITICAL - every transaction and every penny must be captured correctly.

TASK: Extract EVERY SINGLE transaction from this bank statement for the period ${month.startDate} to ${month.endDate} (${month.label}).

RULES:
1. Extract EVERY transaction row visible on the statement for this date range. Do NOT skip any rows.
2. Amounts must be EXACTLY as shown on the statement - do not round, estimate, or modify any values.
3. Type classification:
   - "debit" = money OUT (payments, purchases, direct debits, standing orders, transfers out, card payments)
   - "credit" = money IN (deposits, income, transfers in, refunds, interest)
4. Go through the statement page by page, line by line. Count as you go to ensure none are missed.
5. If a transaction description spans multiple lines on the statement, combine them into one transaction.
6. For EACH transaction, include the RUNNING BALANCE shown on the statement after that transaction. Bank statements show a balance column on each row - extract the exact balance figure.
7. Extract the OPENING BALANCE for this period (the balance shown before the first transaction in this date range).

For each transaction provide: date (YYYY-MM-DD), merchant (exactly as shown on statement), description (additional details or null), amount (positive number exactly as on statement), type ("debit"/"credit"), balance (running balance after this transaction as shown on statement, or null if not visible), category (from: "Office Supplies","Travel","Meals & Entertainment","Professional Fees","Utilities","Rent","Salaries","Marketing","Software","Other", or null), categoryConfidence (0-1), vatAmount (or null), vatRate (or null), extractionConfidence (0-1).

After extracting ALL transactions for ${month.startDate} to ${month.endDate}, you MUST verify your work:
- Count the total number of transactions you extracted
- Sum all debit amounts separately
- Sum all credit amounts separately
- Note the closing balance (balance after the last transaction)

Return ONLY this JSON structure:
{
  "openingBalance": 5167.17,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "merchant": "Name exactly as shown",
      "description": "Details or null",
      "amount": 123.45,
      "type": "debit",
      "balance": 5043.72,
      "category": "Category or null",
      "categoryConfidence": 0.85,
      "vatAmount": null,
      "vatRate": null,
      "extractionConfidence": 0.95
    }
  ],
  "verification": {
    "transactionCount": 85,
    "totalDebits": "1234.56",
    "totalCredits": "5678.90",
    "closingBalance": 5206.95,
    "monthLabel": "${month.label}"
  }
}

CRITICAL: This is month ${index + 1} of ${totalMonths}. Only include transactions dated ${month.startDate} to ${month.endDate}.
Do NOT skip any transactions. Missing even one transaction makes the entire extraction useless for accounting.
BALANCE FIELD: Every row on a bank statement shows the running balance. Extract this EXACT figure for each transaction. If not visible for a row, set balance to null.
Return ONLY valid JSON. No markdown. No explanation.`;
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
          const repaired = repairTruncatedJson(text);
          parsed = JSON.parse(repaired);
        }
      }

      const transactions = (parsed.transactions || []).map((t: any) => ({
        ...t,
        balance: t.balance ?? null,
      })) as ExtractedTransaction[];
      const verification = parsed.verification || null;
      const openingBalance = parsed.openingBalance ?? null;
      const closingBalance = verification?.closingBalance ?? null;

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
  return `You are extracting bank statement transactions for professional accounting software. ACCURACY IS CRITICAL.

TASK: Extract EVERY transaction from the following bank statement text for the period ${month.startDate} to ${month.endDate} (${month.label}).

RULES:
1. Extract EVERY transaction row. Do NOT skip any.
2. Amounts must be EXACTLY as shown - do not round or estimate.
3. Type: "debit" = money OUT, "credit" = money IN.
4. Multi-line descriptions: combine into one transaction.
5. Include the RUNNING BALANCE shown after each transaction (if visible in the text).
6. Include the OPENING BALANCE (balance before first transaction).

For each transaction: date (YYYY-MM-DD), merchant (exactly as shown), description (or null), amount (positive number), type ("debit"/"credit"), balance (running balance or null), category (from: "Office Supplies","Travel","Meals & Entertainment","Professional Fees","Utilities","Rent","Salaries","Marketing","Software","Other", or null), categoryConfidence (0-1), vatAmount (or null), vatRate (or null), extractionConfidence (0-1).

After extracting, verify: count transactions, sum debits, sum credits.

Return ONLY valid JSON:
{
  "openingBalance": 5167.17,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "merchant": "Name",
      "description": "Details or null",
      "amount": 123.45,
      "type": "debit",
      "balance": 5043.72,
      "category": "Category or null",
      "categoryConfidence": 0.85,
      "vatAmount": null,
      "vatRate": null,
      "extractionConfidence": 0.95
    }
  ],
  "verification": {
    "transactionCount": 85,
    "totalDebits": "1234.56",
    "totalCredits": "5678.90",
    "closingBalance": 5206.95,
    "monthLabel": "${month.label}"
  }
}

CRITICAL: Month ${index + 1} of ${totalMonths}. Only transactions dated ${month.startDate} to ${month.endDate}.
Return ONLY valid JSON. No markdown.`;
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

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info(`[TEXT] Extracting ${month.label} (${index + 1}/${totalMonths}), attempt ${attempt}, using Haiku`);
      const callStart = Date.now();

      const msg = await anthropic.messages.create({
        model: env.CLAUDE_MODEL_HAIKU || 'claude-haiku-3-5-20241022',
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
        model: 'haiku',
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

      const transactions = (parsed.transactions || []).map((t: any) => ({
        ...t,
        balance: t.balance ?? null,
      })) as ExtractedTransaction[];
      const verification = parsed.verification || null;
      const openingBalance = parsed.openingBalance ?? null;
      const closingBalance = verification?.closingBalance ?? null;

      logger.info(`[TEXT] ${month.label}: ${transactions.length} transactions extracted`, {
        verification,
        openingBalance,
      });

      // Balance chain verification (zero API cost)
      const balanceVerification = verifyBalanceChain(
        transactions,
        openingBalance,
        closingBalance,
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
        const waitTime = attempt * 15; // Shorter waits for Haiku (higher rate limits)
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
 * Optimized text-based extraction pipeline for bank statements.
 * Uses local PDF text extraction + Haiku = ~99% cheaper than sending PDF to Sonnet.
 */
async function extractBankStatementOptimized(
  extractedText: string,
  base64Content: string,
  startTime: number
): Promise<ExtractionResult> {
  try {
    logger.info('=== USING OPTIMIZED TEXT-BASED PIPELINE (Haiku) ===');

    // Step 1: Detect date range from text (zero API calls)
    let dateRange = detectDateRangeFromText(extractedText);

    if (!dateRange) {
      // Fallback to LLM date detection (1 Sonnet call)
      logger.info('Regex date detection failed, falling back to LLM detection');
      dateRange = await detectStatementDateRange(base64Content);
    }

    if (!dateRange) {
      logger.warn('Could not detect date range, falling back to Sonnet PDF pipeline');
      return await extractLargeBankStatementByMonth(base64Content, startTime);
    }

    logger.info('Statement period detected', { ...dateRange, method: dateRange ? 'regex' : 'llm' });

    // Step 2: Build monthly ranges (same logic as before, zero API calls)
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

    // Step 3: Split text into monthly chunks (zero API calls)
    const textChunks = splitTextByMonth(extractedText, months);

    // Step 4: Extract each month using Haiku (text only, ~3K tokens per call)
    const allTransactions: ExtractedTransaction[] = [];
    const allBalanceVerifications: BalanceVerificationResult[] = [];
    const allCorrections: Array<{ month: string; index: number; date: string; merchant: string; originalAmount: number; correctedAmount: number; reason: string }> = [];

    for (let i = 0; i < months.length; i++) {
      const month = months[i];
      const chunk = textChunks.get(month.label) || '';

      if (i > 0) {
        // Short delay for Haiku (much higher rate limits than Sonnet)
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      if (!chunk.trim()) {
        logger.warn(`No text found for ${month.label}, skipping`);
        continue;
      }

      try {
        const result = await extractMonthFromText(chunk, month, i, months.length);
        allTransactions.push(...result.transactions);

        if (result.balanceVerification) {
          allBalanceVerifications.push(result.balanceVerification);
        }
        if (result.corrections.length > 0) {
          allCorrections.push(...result.corrections.map(c => ({ ...c, month: month.label })));
        }
      } catch (error) {
        logger.error(`[TEXT] Failed to extract ${month.label}, trying Sonnet fallback`, { error });
        // Fallback: try with Sonnet PDF pipeline for this month
        try {
          const fallbackResult = await extractMonthWithVerification(base64Content, month, i, months.length);
          allTransactions.push(...fallbackResult.transactions);
          logger.info(`[TEXT] Sonnet fallback succeeded for ${month.label}: ${fallbackResult.transactions.length} txns`);
        } catch (fallbackErr) {
          logger.error(`[TEXT] Sonnet fallback also failed for ${month.label}`, { error: fallbackErr });
        }
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

    logger.info('=== TEXT PIPELINE COMPLETE ===', {
      monthsProcessed: months.length,
      rawCount: allTransactions.length,
      afterDedup: deduplicated.length,
      duplicatesRemoved: removedCount,
      processingTime: `${(processingTime / 1000).toFixed(1)}s`,
      apiCalls: `${months.length} Haiku calls (text only)`,
    });

    return {
      success: deduplicated.length > 0,
      transactions: deduplicated,
      error: deduplicated.length === 0 ? 'No transactions extracted' : undefined,
      metadata: {
        documentType: 'bank_statement',
        totalTransactions: deduplicated.length,
        processingTime,
        pipeline: 'text-haiku',
        duplicatesRemoved: removedCount,
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
    logger.error('Text pipeline failed, falling back to Sonnet PDF pipeline', { error });
    return await extractLargeBankStatementByMonth(base64Content, startTime);
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

  logger.info('Waiting 5s before extraction to avoid rate limits...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  for (let i = 0; i < months.length; i++) {
    const month = months[i];

    if (i > 0) {
      logger.info('Waiting 10s between months to avoid rate limits...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    const result = await extractMonthWithVerification(fileContent, month, i, months.length);
    allTransactions.push(...result.transactions);

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
