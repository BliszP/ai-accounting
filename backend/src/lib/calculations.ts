/**
 * Financial Calculations Library
 *
 * CRITICAL: All financial calculations MUST use Decimal.js to avoid
 * JavaScript floating-point errors (e.g., 0.1 + 0.2 !== 0.3)
 *
 * This is especially important for:
 * - VAT calculations
 * - Journal entry balancing (debits = credits)
 * - Trial balance calculations
 * - Financial report totals
 */

import Decimal from 'decimal.js';

/**
 * Calculate VAT amount
 * @param amount - Net amount (before VAT)
 * @param rate - VAT rate as decimal (e.g., 0.20 for 20%)
 * @returns VAT amount rounded to 2 decimal places
 */
export function calculateVAT(amount: number, rate: number): number {
  const amt = new Decimal(amount);
  const vatRate = new Decimal(rate);
  return amt.times(vatRate).toDecimalPlaces(2).toNumber();
}

/**
 * Add multiple amounts with precision
 * @param amounts - Array of numbers to add
 * @returns Sum rounded to 2 decimal places
 */
export function addAmounts(...amounts: number[]): number {
  return amounts
    .reduce((sum, amt) => sum.plus(new Decimal(amt)), new Decimal(0))
    .toDecimalPlaces(2)
    .toNumber();
}

/**
 * Subtract one amount from another
 * @param a - Amount to subtract from
 * @param b - Amount to subtract
 * @returns Difference rounded to 2 decimal places
 */
export function subtractAmounts(a: number, b: number): number {
  return new Decimal(a).minus(new Decimal(b)).toDecimalPlaces(2).toNumber();
}

/**
 * Multiply amount by a factor
 * @param amount - Base amount
 * @param factor - Multiplication factor
 * @returns Product rounded to 2 decimal places
 */
export function multiplyAmount(amount: number, factor: number): number {
  return new Decimal(amount).times(new Decimal(factor)).toDecimalPlaces(2).toNumber();
}

/**
 * Divide amount by a divisor
 * @param amount - Amount to divide
 * @param divisor - Division factor
 * @returns Quotient rounded to 2 decimal places
 */
export function divideAmount(amount: number, divisor: number): number {
  if (divisor === 0) {
    throw new Error('Division by zero is not allowed');
  }
  return new Decimal(amount).dividedBy(new Decimal(divisor)).toDecimalPlaces(2).toNumber();
}

/**
 * Calculate gross amount (net + VAT)
 * @param net - Net amount (before VAT)
 * @param vatRate - VAT rate as decimal (e.g., 0.20)
 * @returns Gross amount (net + VAT) rounded to 2 decimal places
 */
export function calculateGross(net: number, vatRate: number): number {
  const netDecimal = new Decimal(net);
  const vat = calculateVAT(net, vatRate);
  return netDecimal.plus(new Decimal(vat)).toDecimalPlaces(2).toNumber();
}

/**
 * Calculate net amount from gross (gross / (1 + VAT rate))
 * @param gross - Gross amount (including VAT)
 * @param vatRate - VAT rate as decimal (e.g., 0.20)
 * @returns Net amount (before VAT) rounded to 2 decimal places
 */
export function calculateNet(gross: number, vatRate: number): number {
  const grossDecimal = new Decimal(gross);
  const divisor = new Decimal(1).plus(new Decimal(vatRate));
  return grossDecimal.dividedBy(divisor).toDecimalPlaces(2).toNumber();
}

/**
 * Validate that journal entries balance (debits = credits)
 * @param entries - Array of journal entries with debit and credit amounts
 * @returns true if balanced, false otherwise
 */
export function validateBalance(entries: Array<{ debit: number | null; credit: number | null }>): boolean {
  const totalDebits = entries
    .filter(e => e.debit !== null)
    .reduce((sum, e) => sum.plus(new Decimal(e.debit!)), new Decimal(0));

  const totalCredits = entries
    .filter(e => e.credit !== null)
    .reduce((sum, e) => sum.plus(new Decimal(e.credit!)), new Decimal(0));

  // Allow 0.01 difference for rounding (1 penny)
  const difference = totalDebits.minus(totalCredits).abs();
  return difference.lessThanOrEqualTo(new Decimal(0.01));
}

/**
 * Calculate percentage of a total
 * @param part - Part amount
 * @param total - Total amount
 * @returns Percentage (0-100) rounded to 2 decimal places
 */
export function calculatePercentage(part: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  const partDecimal = new Decimal(part);
  const totalDecimal = new Decimal(total);
  return partDecimal.dividedBy(totalDecimal).times(100).toDecimalPlaces(2).toNumber();
}

/**
 * Round amount to 2 decimal places
 * @param amount - Amount to round
 * @returns Rounded amount
 */
export function roundAmount(amount: number): number {
  return new Decimal(amount).toDecimalPlaces(2).toNumber();
}

/**
 * Compare two amounts for equality (accounting for precision)
 * @param a - First amount
 * @param b - Second amount
 * @returns true if amounts are equal within 0.01 tolerance
 */
export function amountsEqual(a: number, b: number): boolean {
  const diff = new Decimal(a).minus(new Decimal(b)).abs();
  return diff.lessThanOrEqualTo(new Decimal(0.01));
}

/**
 * UK VAT rates (as of 2026)
 */
export const VAT_RATES = {
  STANDARD: 0.20,   // 20% - Most goods and services
  REDUCED: 0.05,    // 5% - Energy, children's car seats, etc.
  ZERO: 0.00,       // 0% - Food, books, children's clothes, etc.
} as const;

/**
 * Convert amount to pence (for integer arithmetic in some cases)
 * @param pounds - Amount in pounds
 * @returns Amount in pence
 */
export function toPence(pounds: number): number {
  return new Decimal(pounds).times(100).toDecimalPlaces(0).toNumber();
}

/**
 * Convert pence to pounds
 * @param pence - Amount in pence
 * @returns Amount in pounds
 */
export function toPounds(pence: number): number {
  return new Decimal(pence).dividedBy(100).toDecimalPlaces(2).toNumber();
}
