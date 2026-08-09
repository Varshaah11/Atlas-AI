import { readFile, stat } from 'fs/promises';
import { Injectable } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { AppLogger } from '@/common/logger/logger.service';

/**
 * Custom error type for PDF extraction failures.
 */
export class PdfExtractionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PdfExtractionError';
  }
}

/**
 * Service that extracts textual content and metadata from a PDF file.
 *
 * The returned object matches the contract required by the Document pipeline:
 *   {
 *     title?: string;
 *     pageCount: number;
 *     pages: Array<{ pageNumber: number; text: string }>;
 *   }
 */
@Injectable()
export class PdfExtractorProvider {
  constructor(private readonly logger: AppLogger) {}

  /**
   * Extracts a PDF located at {@code filePath}.
   *
   * @param filePath absolute path to the PDF file.
   * @throws {PdfExtractionError} when the file cannot be read or parsed.
   */
  async extract(filePath: string): Promise<{
    title?: string;
    pageCount: number;
    pages: Array<{ pageNumber: number; text: string }>;
  }> {
    // Validate the file exists and is readable.
    try {
      const stats = await stat(filePath);
      if (stats.size === 0) {
        throw new PdfExtractionError('PDF file is empty');
      }
    } catch (err) {
      if (err instanceof PdfExtractionError) {
        throw err;
      }
      // Using AppLogger for technical errors only.
      this.logger.error(
        `Failed to read PDF file: ${err}`,
        err instanceof Error ? err.stack : undefined,
        'PdfExtractorProvider',
      );
      throw new PdfExtractionError('Unable to read PDF file', err);
    }

    let pageCount: number;
    let title: string | undefined;
    let pages: Array<{ pageNumber: number; text: string }> = [];

    try {
      const fileBuffer = await readFile(filePath);
      const parser = new PDFParse({ data: fileBuffer });

      const textResult = await parser.getText();
      const infoResult = await parser.getInfo();

      pageCount = textResult.total ?? textResult.pages?.length ?? 0;
      title = (infoResult.info?.Title as string | undefined)?.trim() || undefined;

      pages = (textResult.pages ?? []).map((p) => ({
        pageNumber: p.num,
        text: p.text ?? '',
      }));
    } catch (err) {
      this.logger.error(
        `PDF parsing failed: ${err}`,
        err instanceof Error ? err.stack : undefined,
        'PdfExtractorProvider',
      );
      throw new PdfExtractionError('Failed to parse PDF file', err);
    }

    // Guard against mismatched counts.
    while (pages.length < pageCount) {
      pages.push({ pageNumber: pages.length + 1, text: '' });
    }

    return { title, pageCount, pages };
  }
}
