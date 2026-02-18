/**
 * Local PDF Text Extraction
 *
 * Extracts text from PDFs locally using pdf-parse (no API calls).
 * Also provides regex-based date range detection and monthly text chunking.
 * This eliminates the need to send full PDFs to Claude for text-based statements.
 */

// pdf-parse v3 uses named export PDFParse class
import { PDFParse } from 'pdf-parse';
import { logger } from './logger.js';

export interface PDFTextResult {
  text: string;
  pageCount: number;
  isImageBased: boolean;
}

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

/**
 * Extract text from a PDF using pdf-parse (local, zero API calls).
 * Detects whether the PDF is text-based or image-based (scanned).
 */
export async function extractTextFromPDF(base64Content: string): Promise<PDFTextResult> {
  try {
    const buffer = Buffer.from(base64Content, 'base64');
    const parser = new PDFParse({ verbosity: 0, data: buffer });
    const result = await parser.getText();

    const text = result.text || '';
    const pageCount = result.total || 1;

    // Heuristic: if less than 50 chars per page, likely scanned/image-based
    const isImageBased = text.trim().length < 50 * pageCount;

    logger.info('Local PDF text extraction complete', {
      textLength: text.length,
      pageCount,
      isImageBased,
      charsPerPage: pageCount > 0 ? Math.round(text.length / pageCount) : 0,
    });

    return { text, pageCount, isImageBased };
  } catch (error) {
    logger.error('PDF text extraction failed', { error });
    return { text: '', pageCount: 0, isImageBased: true };
  }
}

// Month name lookups
const MONTH_NAMES: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Parse a date string into YYYY-MM-DD format.
 * Handles DD/MM/YYYY, DD-MM-YYYY, DD Month YYYY, MM/DD/YYYY patterns.
 * Assumes UK date format (DD/MM/YYYY) by default.
 */
function parseDate(dateStr: string): string | null {
  // Pattern 1: DD/MM/YYYY or DD-MM-YYYY
  let match = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (match) {
    const [, d, m, y] = match;
    const day = parseInt(d, 10);
    const month = parseInt(m, 10);
    // UK format: DD/MM/YYYY (day first)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Pattern 2: DD Month YYYY or DD MonthName YYYY
  match = dateStr.match(/(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})/i);
  if (match) {
    const [, d, monthName, y] = match;
    const month = MONTH_NAMES[monthName.toLowerCase()];
    if (month) {
      return `${y}-${String(month).padStart(2, '0')}-${String(parseInt(d, 10)).padStart(2, '0')}`;
    }
  }

  // Pattern 3: Month DD, YYYY
  match = dateStr.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (match) {
    const [, monthName, d, y] = match;
    const month = MONTH_NAMES[monthName.toLowerCase()];
    if (month) {
      return `${y}-${String(month).padStart(2, '0')}-${String(parseInt(d, 10)).padStart(2, '0')}`;
    }
  }

  // Pattern 4: YYYY-MM-DD (already ISO)
  match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return match[0];
  }

  return null;
}

/**
 * Detect statement date range from extracted text using regex (zero API calls).
 * Looks for common bank statement period indicators.
 */
export function detectDateRangeFromText(text: string): DateRange | null {
  try {
    // Normalize whitespace for easier matching
    const normalized = text.replace(/\s+/g, ' ');

    // Pattern group 1: "Statement Period: DATE to DATE" / "Statement Period DATE - DATE"
    const periodPatterns = [
      /statement\s*period[:\s]+(.+?)\s+to\s+(.+?)(?:\s|$|\n)/i,
      /statement\s*period[:\s]+(.+?)\s*[-–]\s*(.+?)(?:\s|$|\n)/i,
      /period[:\s]+(.+?)\s+to\s+(.+?)(?:\s|$|\n)/i,
      /from\s+(.+?)\s+to\s+(.+?)(?:\s|$|\n)/i,
      /between\s+(.+?)\s+and\s+(.+?)(?:\s|$|\n)/i,
    ];

    for (const pattern of periodPatterns) {
      const match = normalized.match(pattern);
      if (match) {
        const startDate = parseDate(match[1].trim());
        const endDate = parseDate(match[2].trim());

        if (startDate && endDate) {
          logger.info('Date range detected via regex', { startDate, endDate, pattern: pattern.source });
          return { startDate, endDate };
        }
      }
    }

    // Pattern group 2: Look for two dates near period-related keywords
    // Search for dates near "statement", "period", "from" keywords
    const datePattern = /(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+\d{4})/gi;

    const allDates: string[] = [];
    let dateMatch;
    while ((dateMatch = datePattern.exec(normalized)) !== null) {
      const parsed = parseDate(dateMatch[1]);
      if (parsed) allDates.push(parsed);
    }

    // If we found dates, use first and last as the range
    if (allDates.length >= 2) {
      allDates.sort();
      const startDate = allDates[0];
      const endDate = allDates[allDates.length - 1];

      // Sanity check: range should be at most 24 months
      const start = new Date(startDate);
      const end = new Date(endDate);
      const monthDiff = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();

      if (monthDiff > 0 && monthDiff <= 24) {
        logger.info('Date range detected from all dates in text', { startDate, endDate, totalDatesFound: allDates.length });
        return { startDate, endDate };
      }
    }

    logger.warn('Could not detect date range from text via regex');
    return null;
  } catch (error) {
    logger.error('Date range detection failed', { error });
    return null;
  }
}

/**
 * Extract a date from a text line.
 * Handles dates at the start of a line (PDF bank statements) and
 * mid-line date fields (CSV parsed format: "... | Date: 2026-01-15 | ...").
 * Returns YYYY-MM-DD or null.
 */
function extractDateFromLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // CSV parsed format: "Row N: ... | Date: <value> | ..."
  // Check this first because CSV rows start with "Row N:" which won't match
  // any start-of-line date pattern.

  // ISO format: Date: 2026-01-15 (also matches Date: 2026-01-15T09:44:56Z)
  const csvISOMatch = trimmed.match(/\bDate:\s*(\d{4}-\d{2}-\d{2})/);
  if (csvISOMatch) {
    return csvISOMatch[1];
  }

  // UK format: Date: 15/01/2026 or Date: 15-01-2026 (day first, as used by Monzo UK)
  const csvDMYMatch = trimmed.match(/\bDate:\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (csvDMYMatch) {
    const day = parseInt(csvDMYMatch[1], 10);
    const month = parseInt(csvDMYMatch[2], 10);
    const year = parseInt(csvDMYMatch[3], 10);
    // UK banks use DD/MM/YYYY (day first)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Common PDF bank statement line formats (dates at start of line):
  // "01 Sep 2023  TESCO STORES  DEB  45.50  5121.67"
  // "01/09/2023  TESCO STORES  45.50  5121.67"
  // "2023-09-01  TESCO STORES  45.50"

  // Try DD/MM/YYYY or DD-MM-YYYY at start of line
  let match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Try DD Mon YYYY or DD Month YYYY at start
  match = trimmed.match(/^(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\s+(\d{4})/i);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = MONTH_NAMES[match[2].toLowerCase()];
    const year = parseInt(match[3], 10);
    if (month && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Try YYYY-MM-DD at start of line
  match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return match[0];
  }

  return null;
}

/**
 * Split extracted PDF text into monthly chunks based on transaction dates.
 * Returns a Map of month label → text chunk for that month.
 * Each chunk contains all lines with transaction dates in that month,
 * plus any header/context lines.
 */
export function splitTextByMonth(
  fullText: string,
  months: Array<{ startDate: string; endDate: string; label: string }>
): Map<string, string> {
  const chunks = new Map<string, string>();
  const lines = fullText.split('\n');

  // Initialize empty chunks for each month
  for (const month of months) {
    chunks.set(month.label, '');
  }

  // Collect header lines (lines before any transaction date - usually column headers, account info, etc.)
  const headerLines: string[] = [];
  let foundFirstDate = false;

  for (const line of lines) {
    if (!foundFirstDate) {
      const date = extractDateFromLine(line);
      if (date) {
        foundFirstDate = true;
      } else if (line.trim()) {
        headerLines.push(line);
      }
    }
    if (foundFirstDate) break;
  }

  const headerText = headerLines.slice(-5).join('\n'); // Keep last 5 header lines (column headers etc.)

  // Group lines into monthly buckets
  let currentMonthLabel: string | null = null;
  let unassignedLines: string[] = [];

  for (const line of lines) {
    const date = extractDateFromLine(line);

    if (date) {
      // Find which month this date belongs to
      const dateObj = new Date(date);
      let assigned = false;

      for (const month of months) {
        const start = new Date(month.startDate);
        const end = new Date(month.endDate);

        if (dateObj >= start && dateObj <= end) {
          // Append any unassigned lines to this month (continuation from previous transactions)
          if (unassignedLines.length > 0 && currentMonthLabel) {
            const existing = chunks.get(currentMonthLabel) || '';
            chunks.set(currentMonthLabel, existing + unassignedLines.join('\n') + '\n');
            unassignedLines = [];
          }

          currentMonthLabel = month.label;
          const existing = chunks.get(month.label) || '';
          chunks.set(month.label, existing + line + '\n');
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        // Date outside all months - could be header/footer
        unassignedLines.push(line);
      }
    } else if (line.trim() && currentMonthLabel) {
      // Non-date line (continuation of previous transaction description)
      const existing = chunks.get(currentMonthLabel) || '';
      chunks.set(currentMonthLabel, existing + line + '\n');
    } else {
      unassignedLines.push(line);
    }
  }

  // Prepend header to each chunk for context
  for (const month of months) {
    const chunk = chunks.get(month.label) || '';
    if (chunk.trim()) {
      chunks.set(month.label, headerText + '\n\n' + chunk);
    }
  }

  // Log chunk sizes
  for (const month of months) {
    const chunk = chunks.get(month.label) || '';
    logger.info(`Text chunk for ${month.label}`, {
      lines: chunk.split('\n').length,
      chars: chunk.length,
      estimatedTokens: Math.ceil(chunk.length / 4), // Rough estimate: 1 token ≈ 4 chars
    });
  }

  return chunks;
}
