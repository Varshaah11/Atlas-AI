import { Test, TestingModule } from '@nestjs/testing';
import { AppLogger } from '@/common/logger/logger.service';
import { DocumentIngestionService } from '@/documents/document-ingestion.service';
import { DocumentService } from '@/documents/document.service';
import { PdfExtractorProvider } from '@/documents/pdf-extractor.provider';
import { EmbeddingProvider } from '@/documents/embedding.provider';
import { PrismaService } from '@/database/prisma.service';
import { generateSamplePdf } from './utils/pdf-generator';
import * as path from 'path';
import * as fs from 'fs';
import { DocumentIngestionError } from '@/documents/document-ingestion.error';

describe('DocumentIngestionService', () => {
  let service: DocumentIngestionService;
  let prisma: PrismaService;
  const fixturesDir = path.join(__dirname, 'fixtures');
  let testUserId: string | undefined;

  beforeAll(async () => {
    await fs.promises.mkdir(fixturesDir, { recursive: true });
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentIngestionService,
        DocumentService,
        PdfExtractorProvider,
        EmbeddingProvider,
        PrismaService,
        { provide: AppLogger, useValue: { error: () => { }, warn: () => { }, info: () => { }, debug: () => { }, log: () => { } } },
      ],
    }).compile();
    service = module.get<DocumentIngestionService>(DocumentIngestionService);
    prisma = module.get<PrismaService>(PrismaService);
    // Create test user for this prisma instance
    const user = await prisma.user.create({
      data: {
        telegramId: 'test-telegram',
        username: 'testuser',
      },
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    if (prisma && testUserId) {
      await prisma.documentChunk.deleteMany({ where: { document: { userId: testUserId } } });
      await prisma.document.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      testUserId = undefined;
    }
  });

  afterAll(async () => {
    if (prisma && testUserId) {
      await prisma.documentChunk.deleteMany({ where: { document: { userId: testUserId } } });
      await prisma.document.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
  });

  it('processes a valid two‑page PDF and creates chunks', async () => {
    const pdfPath = path.join(fixturesDir, 'two-page.pdf');
    await generateSamplePdf(pdfPath, 'Test Title', ['Page one text content.', 'Page two distinct content.']);

    const result = await service.ingest(testUserId!, pdfPath, 'two-page.pdf');
    expect(result.status).toBe('READY');
    expect(result.title).toBe('Test Title');
    expect(result.pageCount).toBe(2);

    const chunks = await prisma.documentChunk.findMany({ where: { documentId: result.id } });
    expect(chunks.length).toBeGreaterThan(0);
    const pageNumbers = new Set(chunks.map(c => c.pageNumber));
    expect(pageNumbers).toEqual(new Set([1, 2]));

    // Verify embedding dimensions match provider dimension
    const dim = (await service['embeddingProvider'].embedBatch(['test']))[0].length;
    for (const c of chunks) {
      expect(Array.isArray(c.embedding)).toBe(true);
      expect((c.embedding as number[]).length).toBe(dim);
    }
  });

  it('creates multiple chunks from a long page and respects overlap', async () => {
    const longText = 'word '.repeat(300); // ~1500 chars > chunkSize
    const pdfPath = path.join(fixturesDir, 'long-page.pdf');
    await generateSamplePdf(pdfPath, 'Long Page', [longText]);

    const result = await service.ingest(testUserId!, pdfPath, 'long-page.pdf');
    expect(result.status).toBe('READY');
    const chunks = await prisma.documentChunk.findMany({
      where: { documentId: result.id },
      orderBy: { chunkIndex: 'asc' },
    });
    expect(chunks.length).toBeGreaterThan(1);
    const first = chunks[0].content;
    const second = chunks[1].content;
    const overlap = first.slice(-200).trim();
    expect(second.startsWith(overlap)).toBe(true);
  });

  it('fails on empty PDF and marks document FAILED', async () => {
    const emptyPdfPath = path.join(fixturesDir, 'empty.pdf');
    await generateSamplePdf(emptyPdfPath, 'Empty', []);
    await expect(service.ingest(testUserId!, emptyPdfPath, 'empty.pdf')).rejects.toThrow(DocumentIngestionError);
    const docs = await prisma.document.findMany({ where: { userId: testUserId } });
    expect(docs.length).toBe(1);
    expect(docs[0].status).toBe('FAILED');
    const chunks = await prisma.documentChunk.findMany({ where: { documentId: docs[0].id } });
    expect(chunks.length).toBe(0);
  });

  it('fails on malformed PDF', async () => {
    const badPath = path.join(fixturesDir, 'bad.pdf');
    await fs.promises.writeFile(badPath, 'this is not a pdf');
    await expect(service.ingest(testUserId!, badPath, 'bad.pdf')).rejects.toThrow(DocumentIngestionError);
    const docs = await prisma.document.findMany({ where: { userId: testUserId } });
    expect(docs.length).toBe(1);
    expect(docs[0].status).toBe('FAILED');
  });

  it('fails and rolls back when embedding throws', async () => {
    const pdfPath = path.join(fixturesDir, 'two-page.pdf');
    await generateSamplePdf(pdfPath, 'Title', ['Page one', 'Page two']);

    const failingProvider = {
      embedBatch: jest.fn().mockRejectedValue(new Error('embed error')),
      dimension: 256,
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentIngestionService,
        DocumentService,
        PdfExtractorProvider,
        { provide: EmbeddingProvider, useValue: failingProvider },
        PrismaService,
        { provide: AppLogger, useValue: { error: () => { }, warn: () => { }, info: () => { }, debug: () => { }, log: () => { } } },
      ],
    }).compile();
    const failingService = module.get<DocumentIngestionService>(DocumentIngestionService);

    await expect(failingService.ingest(testUserId!, pdfPath, 'two-page.pdf')).rejects.toThrow(DocumentIngestionError);
    const docs = await prisma.document.findMany({ where: { userId: testUserId } });
    expect(docs[0].status).toBe('FAILED');
    const chunks = await prisma.documentChunk.findMany({ where: { documentId: docs[0].id } });
    expect(chunks.length).toBe(0);
  });
});
