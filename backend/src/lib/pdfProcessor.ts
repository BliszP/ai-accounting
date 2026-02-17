/**
 * PDF Processing Utilities
 *
 * Handles splitting and processing large PDF documents
 */

import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/environment.js';
import { logger } from './logger.js';

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

/**
 * Get page count from PDF using Claude
 */
export async function getPDFPageCount(base64Content: string): Promise<number> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Content,
              },
            },
            {
              type: 'text',
              text: 'How many pages does this PDF document have? Return ONLY a number.',
            },
          ],
        },
      ],
    });

    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => 'text' in block ? block.text : '')
      .join('');

    const pageCount = parseInt(responseText.trim(), 10);
    return isNaN(pageCount) ? 1 : pageCount;
  } catch (error) {
    logger.warn('Failed to get PDF page count, defaulting to 1', { error });
    return 1;
  }
}

/**
 * Estimate if a document is large based on file size
 */
export function isLargeDocument(fileSizeBytes: number): boolean {
  // Consider documents over 100KB as large (likely 2+ pages / multi-month statement)
  // Lowered from 500KB to ensure all multi-month statements use chunking
  const LARGE_DOC_THRESHOLD = 100 * 1024; // 100KB

  logger.info('Checking if document is large', {
    fileSizeBytes,
    fileSizeKB: (fileSizeBytes / 1024).toFixed(2) + 'KB',
    threshold: (LARGE_DOC_THRESHOLD / 1024) + 'KB',
    isLarge: fileSizeBytes > LARGE_DOC_THRESHOLD,
  });

  return fileSizeBytes > LARGE_DOC_THRESHOLD;
}

/**
 * Split date range for chunked processing
 * For 6-month statements, we'll process in 1-month chunks
 */
export function splitDateRange(startMonth: number, endMonth: number, year: number): Array<{ start: string; end: string }> {
  const ranges: Array<{ start: string; end: string }> = [];

  for (let month = startMonth; month <= endMonth; month++) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month

    ranges.push({
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    });
  }

  return ranges;
}

/**
 * Detect date range from bank statement
 */
export async function detectStatementDateRange(base64Content: string): Promise<{ startDate: string; endDate: string } | null> {
  try {
    logger.info('Attempting to detect statement date range...');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Content,
              },
            },
            {
              type: 'text',
              text: `Look at this bank statement and find the statement period dates.

The statement period is usually shown at the top of the document, like:
- "Statement Period: 01/09/2023 to 28/02/2024"
- "From 1 September 2023 to 28 February 2024"
- "Period: 09/01/2023 - 02/28/2024"

Find these dates and return ONLY a JSON object:
{
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD"
}

Examples:
- "01/09/2023 to 28/02/2024" → {"startDate": "2023-09-01", "endDate": "2024-02-28"}
- "Sep 1 2023 - Feb 28 2024" → {"startDate": "2023-09-01", "endDate": "2024-02-28"}

Return ONLY the JSON, no other text.`,
            },
          ],
        },
      ],
    });

    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => 'text' in block ? block.text : '')
      .join('');

    logger.info('Date range detection response', { responseText: responseText.substring(0, 200) });

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('No JSON found in date range response');
      return null;
    }

    const result = JSON.parse(jsonMatch[0]);

    if (!result.startDate || !result.endDate) {
      logger.warn('Missing dates in response', { result });
      return null;
    }

    logger.info('Successfully detected date range', result);

    return {
      startDate: result.startDate,
      endDate: result.endDate,
    };
  } catch (error) {
    logger.error('Failed to detect statement date range', { error });
    return null;
  }
}

/**
 * Extract transactions for a specific date range
 */
export async function extractTransactionsForDateRange(
  base64Content: string,
  startDate: string,
  endDate: string,
  chunkIndex: number,
  totalChunks: number
): Promise<any[]> {
  try {
    logger.info('Extracting transactions for date range', {
      startDate,
      endDate,
      chunkIndex,
      totalChunks,
    });

    const prompt = `You are an expert accounting assistant. Extract ONLY the transactions from this bank statement that fall between ${startDate} and ${endDate} (inclusive).

For each transaction in this date range, provide:
- date (ISO 8601 format: YYYY-MM-DD, must be between ${startDate} and ${endDate})
- merchant (the business or person)
- description (additional details, or null if none)
- amount (positive number)
- type ("debit" or "credit")
- category (best guess: "Office Supplies", "Travel", "Meals & Entertainment", "Professional Fees", "Utilities", "Rent", "Salaries", "Marketing", "Software", "Other", or null if uncertain)
- categoryConfidence (0.0 to 1.0)
- vatAmount (VAT/tax amount if mentioned, or null)
- vatRate (VAT rate as decimal, e.g., 0.20 for 20%, or null)
- extractionConfidence (0.0 to 1.0)

Return ONLY a valid JSON object with this structure:
{
  "transactions": [
    {
      "date": "2024-01-15",
      "merchant": "Acme Corp",
      "description": "Monthly subscription",
      "amount": 99.99,
      "type": "debit",
      "category": "Software",
      "categoryConfidence": 0.95,
      "vatAmount": 20.00,
      "vatRate": 0.20,
      "extractionConfidence": 0.98
    }
  ]
}

CRITICAL:
- Extract ONLY transactions with dates between ${startDate} and ${endDate}
- Do not include transactions outside this date range
- If no transactions found in this range, return empty array
- This is chunk ${chunkIndex + 1} of ${totalChunks}
- Return ONLY valid JSON, no markdown formatting`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Content,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => 'text' in block ? block.text : '')
      .join('');

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }

    const result = JSON.parse(jsonMatch[0]);
    const transactions = result.transactions || [];

    logger.info('Chunk extraction complete', {
      chunkIndex,
      transactionCount: transactions.length,
      dateRange: `${startDate} to ${endDate}`,
    });

    return transactions;
  } catch (error) {
    logger.error('Chunk extraction failed', {
      chunkIndex,
      startDate,
      endDate,
      error,
    });
    throw error;
  }
}

/**
 * Fallback: Extract all transactions and auto-group by month
 * Used when date range detection fails
 */
async function extractAndAutoGroup(
  base64Content: string,
  fileSizeBytes: number
): Promise<{ transactions: any[]; metadata: any }> {
  logger.info('Using fallback strategy: extract all transactions');

  try {
    const prompt = `You are an expert accounting assistant. Extract ALL transactions from this bank statement.

For each transaction, provide:
- date (ISO 8601 format: YYYY-MM-DD)
- merchant (the business or person)
- description (additional details, or null if none)
- amount (positive number)
- type ("debit" or "credit")
- category (best guess from: "Office Supplies", "Travel", "Meals & Entertainment", "Professional Fees", "Utilities", "Rent", "Salaries", "Marketing", "Software", "Other", or null)
- categoryConfidence (0.0 to 1.0)
- vatAmount (VAT/tax amount if mentioned, or null)
- vatRate (VAT rate as decimal, e.g., 0.20 for 20%, or null)
- extractionConfidence (0.0 to 1.0)

Return ONLY a valid JSON object with this structure:
{
  "transactions": [
    {
      "date": "2024-01-15",
      "merchant": "Acme Corp",
      "description": "Monthly subscription",
      "amount": 99.99,
      "type": "debit",
      "category": "Software",
      "categoryConfidence": 0.95,
      "vatAmount": 20.00,
      "vatRate": 0.20,
      "extractionConfidence": 0.98
    }
  ]
}

IMPORTANT:
- Extract ALL transactions you can find
- Be thorough - don't skip any transactions
- Use higher max_tokens to capture everything
- Return ONLY valid JSON, no markdown formatting`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 32000, // Doubled from 16000 to capture more transactions
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Content,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => 'text' in block ? block.text : '')
      .join('');

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }

    const result = JSON.parse(jsonMatch[0]);
    const transactions = result.transactions || [];

    // Sort by date
    transactions.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Detect date range from extracted transactions
    const dates = transactions.map((t: any) => t.date).filter((d: any) => d);
    const startDate = dates.length > 0 ? dates[0] : null;
    const endDate = dates.length > 0 ? dates[dates.length - 1] : null;

    logger.info('Fallback extraction complete', {
      transactionCount: transactions.length,
      startDate,
      endDate,
    });

    return {
      transactions,
      metadata: {
        chunkedProcessing: false,
        fallbackMode: true,
        totalChunks: 1,
        dateRange: { startDate, endDate } as any,
        fileSizeBytes,
      } as any,
    };
  } catch (error) {
    logger.error('Fallback extraction failed', { error });
    throw error;
  }
}

/**
 * Process large bank statement in chunks
 */
export async function processLargeBankStatement(
  base64Content: string,
  fileSizeBytes: number
): Promise<{ transactions: any[]; metadata: any }> {
  try {
    logger.info('Starting chunked processing for large bank statement', {
      fileSizeBytes,
    });

    // Step 1: Detect statement date range
    const dateRange = await detectStatementDateRange(base64Content);

    if (!dateRange) {
      logger.warn('Could not detect statement date range, using fallback: extract all and auto-group');

      // Fallback: Extract all transactions without date filtering
      // Then group by month automatically
      return await extractAndAutoGroup(base64Content, fileSizeBytes);
    }

    logger.info('Detected statement period', dateRange);

    // Step 2: Calculate month chunks
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);

    // Generate monthly chunks
    const chunks: Array<{ start: string; end: string }> = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const chunkStart = new Date(current);
      const chunkEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);

      // Don't go past the statement end date
      if (chunkEnd > endDate) {
        chunks.push({
          start: chunkStart.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
        });
        break;
      } else {
        chunks.push({
          start: chunkStart.toISOString().split('T')[0],
          end: chunkEnd.toISOString().split('T')[0],
        });
      }

      // Move to next month
      current.setMonth(current.getMonth() + 1);
    }

    logger.info(`Split into ${chunks.length} monthly chunks`, { chunks });

    // Step 3: Process each chunk with rate limiting
    const allTransactions: any[] = [];
    const DELAY_BETWEEN_CHUNKS = 2000; // 2 seconds to avoid rate limits

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // Add delay between chunks (except first one)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CHUNKS));
      }

      try {
        const chunkTransactions = await extractTransactionsForDateRange(
          base64Content,
          chunk.start,
          chunk.end,
          i,
          chunks.length
        );

        allTransactions.push(...chunkTransactions);
      } catch (error) {
        logger.error(`Failed to process chunk ${i + 1}/${chunks.length}`, {
          chunk,
          error,
        });
        // Continue with other chunks even if one fails
      }
    }

    // Step 4: Sort transactions by date
    allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    logger.info('Chunked processing complete', {
      totalChunks: chunks.length,
      totalTransactions: allTransactions.length,
      dateRange: `${dateRange.startDate} to ${dateRange.endDate}`,
    });

    return {
      transactions: allTransactions,
      metadata: {
        chunkedProcessing: true,
        totalChunks: chunks.length,
        dateRange,
        fileSizeBytes,
      } as any,
    };
  } catch (error) {
    logger.error('Chunked processing failed', { error });
    throw error;
  }
}
