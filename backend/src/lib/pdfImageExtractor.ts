/**
 * PDF to Image Converter
 *
 * Converts PDF pages to base64 JPEG images for Claude vision API.
 * Preserves table structure and column layout that text extraction destroys.
 */

import * as pdfjsLib from 'pdfjs-dist';
import { createCanvas } from 'canvas';
import { logger } from './logger.js';

// Disable worker (not needed in Node.js)
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

/**
 * Convert a single PDF page to base64 JPEG image
 */
export async function pdfPageToBase64(
  pdfBuffer: Buffer,
  pageNum: number,
  quality: number = 0.85
): Promise<string> {
  try {
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
    const page = await pdfDoc.getPage(pageNum);

    // Scale 2.0 = higher quality, readable text in images
    const scale = 2.0;
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    await page.render({
      canvasContext: context as any,
      viewport,
      canvas: canvas as any,
    }).promise;

    // Convert canvas to JPEG base64
    const buffer = canvas.toBuffer('image/jpeg', { quality });
    return buffer.toString('base64');
  } catch (error) {
    logger.error(`Failed to convert page ${pageNum} to image`, { error });
    throw new Error(`Failed to convert page ${pageNum}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get total page count from PDF
 */
export async function getPDFPageCount(pdfBuffer: Buffer): Promise<number> {
  try {
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
    return pdfDoc.numPages;
  } catch (error) {
    logger.error('Failed to get PDF page count', { error });
    throw new Error(`Failed to read PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert all pages of a PDF to base64 images
 */
export async function pdfToBase64Images(pdfBuffer: Buffer): Promise<string[]> {
  const pageCount = await getPDFPageCount(pdfBuffer);
  logger.info(`Converting PDF to images: ${pageCount} pages`);

  const images: string[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const base64 = await pdfPageToBase64(pdfBuffer, i);
    images.push(base64);
    logger.info(`Converted page ${i}/${pageCount} to image (${Math.round(base64.length / 1024)}KB)`);
  }

  return images;
}
