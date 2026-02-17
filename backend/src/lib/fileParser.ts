/**
 * File Parser
 *
 * Converts CSV and Excel files to structured text for Claude AI extraction.
 * Claude cannot interpret raw binary data from these formats, so we parse
 * them into readable tabular text first.
 */

import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { logger } from './logger.js';

/**
 * Parse a CSV file from base64 content into structured text
 */
export function parseCSV(base64Content: string): string {
  try {
    const csvText = Buffer.from(base64Content, 'base64').toString('utf-8');

    const result = Papa.parse(csvText, {
      header: false,
      skipEmptyLines: true,
      dynamicTyping: false,
    });

    if (result.errors.length > 0) {
      logger.warn('CSV parsing had errors', {
        errorCount: result.errors.length,
        errors: result.errors.slice(0, 5),
      });
    }

    const rows = result.data as string[][];
    if (rows.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Detect if first row is a header
    const firstRow = rows[0];
    const looksLikeHeader = firstRow.some(cell =>
      /^(date|transaction|description|amount|debit|credit|balance|reference|type|merchant|details|particulars|money\s*(in|out))/i.test(cell.trim())
    );

    // Build structured text representation
    const lines: string[] = [];
    lines.push('=== BANK STATEMENT DATA (CSV) ===');
    lines.push('');

    if (looksLikeHeader) {
      // Use header row as column names
      const headers = firstRow.map(h => h.trim());
      lines.push(`Columns: ${headers.join(' | ')}`);
      lines.push('---');

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowParts: string[] = [];
        for (let j = 0; j < headers.length; j++) {
          const val = (row[j] || '').trim();
          if (val) {
            rowParts.push(`${headers[j]}: ${val}`);
          }
        }
        if (rowParts.length > 0) {
          lines.push(`Row ${i}: ${rowParts.join(' | ')}`);
        }
      }
    } else {
      // No header detected - output as raw table
      lines.push(`Detected ${rows.length} rows, ${firstRow.length} columns`);
      lines.push('---');

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const vals = row.map(v => v.trim()).filter(v => v);
        if (vals.length > 0) {
          lines.push(`Row ${i + 1}: ${vals.join(' | ')}`);
        }
      }
    }

    lines.push('');
    lines.push(`Total rows: ${looksLikeHeader ? rows.length - 1 : rows.length}`);

    const structured = lines.join('\n');
    logger.info('CSV parsed successfully', {
      rows: rows.length,
      columns: firstRow.length,
      hasHeader: looksLikeHeader,
      outputLength: structured.length,
    });

    return structured;
  } catch (error: any) {
    logger.error('CSV parsing failed', { error: error.message });
    throw new Error(`Failed to parse CSV file: ${error.message}`);
  }
}

/**
 * Parse an Excel file from base64 content into structured text
 */
export async function parseExcel(base64Content: string): Promise<string> {
  try {
    const buffer = Buffer.from(base64Content, 'base64');
    const workbook = new ExcelJS.Workbook();

    // Detect format - .xlsx uses zip-based format, .xls uses different format
    try {
      await workbook.xlsx.load(buffer as any);
    } catch (_) {
      // If xlsx load fails, try csv (some .xls files are actually CSV)
      logger.warn('XLSX load failed, attempting CSV fallback');
      return parseCSV(base64Content);
    }

    const lines: string[] = [];
    lines.push('=== BANK STATEMENT DATA (EXCEL) ===');
    lines.push('');

    let totalRows = 0;

    for (const worksheet of workbook.worksheets) {
      lines.push(`--- Sheet: ${worksheet.name} ---`);

      const rowCount = worksheet.rowCount;
      const colCount = worksheet.columnCount;

      if (rowCount === 0) {
        lines.push('(empty sheet)');
        continue;
      }

      // Read first row to check for headers
      const firstRow = worksheet.getRow(1);
      const headers: string[] = [];
      let looksLikeHeader = false;

      for (let col = 1; col <= colCount; col++) {
        const cell = firstRow.getCell(col);
        const val = getCellText(cell);
        headers.push(val);
        if (/^(date|transaction|description|amount|debit|credit|balance|reference|type|merchant|details|particulars|money\s*(in|out))/i.test(val)) {
          looksLikeHeader = true;
        }
      }

      if (looksLikeHeader) {
        lines.push(`Columns: ${headers.filter(h => h).join(' | ')}`);
        lines.push('');

        for (let rowNum = 2; rowNum <= rowCount; rowNum++) {
          const row = worksheet.getRow(rowNum);
          const rowParts: string[] = [];

          for (let col = 1; col <= colCount; col++) {
            const cell = row.getCell(col);
            const val = getCellText(cell);
            if (val && headers[col - 1]) {
              rowParts.push(`${headers[col - 1]}: ${val}`);
            }
          }

          if (rowParts.length > 0) {
            lines.push(`Row ${rowNum - 1}: ${rowParts.join(' | ')}`);
            totalRows++;
          }
        }
      } else {
        lines.push(`Detected ${rowCount} rows, ${colCount} columns`);
        lines.push('');

        for (let rowNum = 1; rowNum <= rowCount; rowNum++) {
          const row = worksheet.getRow(rowNum);
          const vals: string[] = [];

          for (let col = 1; col <= colCount; col++) {
            const cell = row.getCell(col);
            const val = getCellText(cell);
            if (val) {
              vals.push(val);
            }
          }

          if (vals.length > 0) {
            lines.push(`Row ${rowNum}: ${vals.join(' | ')}`);
            totalRows++;
          }
        }
      }

      lines.push('');
    }

    lines.push(`Total data rows: ${totalRows}`);

    const structured = lines.join('\n');
    logger.info('Excel parsed successfully', {
      sheets: workbook.worksheets.length,
      totalRows,
      outputLength: structured.length,
    });

    return structured;
  } catch (error: any) {
    logger.error('Excel parsing failed', { error: error.message });
    throw new Error(`Failed to parse Excel file: ${error.message}`);
  }
}

/**
 * Get text value from an ExcelJS cell, handling dates, numbers, and formulas
 */
function getCellText(cell: ExcelJS.Cell): string {
  if (cell.value === null || cell.value === undefined) {
    return '';
  }

  // Handle date cells
  if (cell.value instanceof Date) {
    const d = cell.value;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Handle formula results
  if (typeof cell.value === 'object' && 'result' in cell.value) {
    const result = (cell.value as any).result;
    if (result instanceof Date) {
      const d = result;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return String(result ?? '');
  }

  // Handle rich text
  if (typeof cell.value === 'object' && 'richText' in cell.value) {
    return (cell.value as any).richText.map((r: any) => r.text).join('');
  }

  return String(cell.value).trim();
}

/**
 * Check if a mime type requires pre-parsing before Claude extraction
 */
export function requiresPreParsing(mimeType: string): boolean {
  return [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ].includes(mimeType);
}

/**
 * Parse a file based on its mime type, returning structured text
 */
export async function parseFileToText(base64Content: string, mimeType: string): Promise<string> {
  switch (mimeType) {
    case 'text/csv':
      return parseCSV(base64Content);
    case 'application/vnd.ms-excel':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return await parseExcel(base64Content);
    default:
      throw new Error(`Unsupported file type for text parsing: ${mimeType}`);
  }
}
