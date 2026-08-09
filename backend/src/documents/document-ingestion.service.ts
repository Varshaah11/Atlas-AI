import * as fs from 'fs';
import { Injectable, Logger } from '@nestjs/common';
import { chunkDocument } from './chunking.util';
import { DocumentIngestionError } from './document-ingestion.error';
import { DocumentDto } from './document.dto';
import { DocumentService } from './document.service';
import { EmbeddingProvider } from './embedding.provider';
import { PdfExtractorProvider } from './pdf-extractor.provider';
import { PrismaService } from '@/database/prisma.service';

/**
 * Service that orchestrates the full PDF ingestion pipeline.
 *
 * Lifecycle:
 *   UPLOADED → PROCESSING → READY (or FAILED on any error)
 *
 * The caller supplies the absolute filePath of the uploaded PDF and a userId.
 * The service does **not** delete the supplied file – ownership remains with the caller.
 */
@Injectable()
export class DocumentIngestionService {
  private readonly logger = new Logger(DocumentIngestionService.name);

  // Max file size in bytes (default 10 MB) – can be overridden via env var.
  private readonly maxFileSizeBytes =
    Number(process.env.DOCUMENT_MAX_FILE_SIZE_MB ?? '10') * 1024 * 1024;

  constructor(
    private readonly prisma: PrismaService,
    private readonly documentService: DocumentService,
    private readonly pdfExtractor: PdfExtractorProvider,
    private readonly embeddingProvider: EmbeddingProvider,
  ) {}

  /**
   * Ingest a PDF for a given user.
   * Returns the freshly populated DocumentDto.
   */
  async ingest(userId: string, filePath: string, originalFilename: string): Promise<DocumentDto> {
    // ---------- Validation ----------
    let stats: fs.Stats;
    try {
      stats = await fs.promises.stat(filePath);
    } catch (e) {
      throw new DocumentIngestionError('File does not exist');
    }
    if (!stats.isFile()) {
      throw new DocumentIngestionError('Provided path is not a file');
    }
    if (stats.size > this.maxFileSizeBytes) {
      throw new DocumentIngestionError('File exceeds maximum allowed size');
    }
    if (!/\.pdf$/i.test(originalFilename)) {
      throw new DocumentIngestionError('Only PDF files are supported');
    }
    // Simple PDF sanity check – verify the file starts with %PDF‑
    const header = await fs.promises
      .readFile(filePath, { encoding: 'utf8', flag: 'r' })
      .catch(() => '');
    if (!header.startsWith('%PDF-')) {
      // Not a valid PDF; we let the extractor handle it, but we can pre‑reject to avoid wasted work.
      this.logger.warn('File header does not look like a PDF');
    }

    // ---------- Create Document (UPLOADED) ----------
    const createdDoc = await this.prisma.document.create({
      data: {
        userId,
        filename: originalFilename,
        mimeType: 'application/pdf',
        fileSize: stats.size,
        status: 'UPLOADED',
      },
    });

    const docId = createdDoc.id;

    // ---------- Process ----------
    try {
      // set to PROCESSING
      await this.prisma.document.update({
        where: { id: docId },
        data: { status: 'PROCESSING' },
      });

      // Extract PDF
      const extracted = await this.pdfExtractor.extract(filePath);

      // Normalise each page
      const normalizedPages = extracted.pages
        .map((p) => ({ pageNumber: p.pageNumber, text: this.normalize(p.text) }))
        .filter((p) => p.text.length > 0);

      // If after normalisation there is no extractable text, fail fast.
      if (normalizedPages.length === 0) {
        throw new DocumentIngestionError('PDF contains no extractable text');
      }

      // Chunk per page
      const chunks = chunkDocument(normalizedPages, 1000, 200);

      // Prepare texts for embedding
      const texts = chunks.map((c) => c.content);

      // Embed
      const embeddings = await this.embeddingProvider.embedBatch(texts);
      const expectedDim = this.embeddingProvider.dimension;
      for (const vec of embeddings) {
        if (vec.length !== expectedDim) {
          throw new DocumentIngestionError(
            `Embedding dimension mismatch (expected ${expectedDim}, got ${vec.length})`,
          );
        }
      }

      // Persist chunks in a transaction
      await this.prisma.$transaction(
        chunks.map((chunk, idx) =>
          this.prisma.documentChunk.create({
            data: {
              documentId: docId,
              chunkIndex: chunk.chunkIndex,
              pageNumber: chunk.pageNumber,
              content: chunk.content,
              embedding: embeddings[idx] as any, // JSON column
            },
          }),
        ),
      );

      // Update Document with title, pageCount, status READY
      await this.prisma.document.update({
        where: { id: docId },
        data: {
          title: extracted.title ?? undefined,
          pageCount: extracted.pageCount,
          status: 'READY',
        },
      });

      // Return DTO
      return this.documentService.getDocument(userId, docId);
    } catch (err) {
      // Ensure status becomes FAILED if the document row exists
      try {
        await this.prisma.document.update({
          where: { id: docId },
          data: { status: 'FAILED' },
        });
      } catch (e) {
        this.logger.error('Failed to update document status to FAILED', e);
      }
      this.logger.error('Document ingestion failed', err);
      if (err instanceof DocumentIngestionError) {
        throw err;
      }
      throw new DocumentIngestionError('Unexpected ingestion error', err);
    }
  }

  /**
   * Normalise raw extracted text.
   * Removes control characters, collapses whitespace, trims.
   */
  private normalize(text: string): string {
    return text
      .replace(/[\x00-\x1F\x7F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
