import { Test, TestingModule } from '@nestjs/testing';
import { DocumentSearchService } from '@/documents/document-search.service';
import { EmbeddingProvider } from '@/documents/embedding.provider';
import { PrismaService } from '@/database/prisma.service';
import { AppLogger } from '@/common/logger/logger.service';

describe('DocumentSearchService', () => {
  let searchService: DocumentSearchService;
  let embeddingProvider: EmbeddingProvider;
  let prisma: PrismaService;
  let userAId: string;
  let userBId: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentSearchService,
        EmbeddingProvider,
        PrismaService,
        {
          provide: AppLogger,
          useValue: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {}, log: () => {} },
        },
      ],
    }).compile();

    searchService = module.get<DocumentSearchService>(DocumentSearchService);
    embeddingProvider = module.get<EmbeddingProvider>(EmbeddingProvider);
    prisma = module.get<PrismaService>(PrismaService);

    // Create User A and User B
    const userA = await prisma.user.create({
      data: { telegramId: `user-a-${Date.now()}`, username: 'user_a' },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: { telegramId: `user-b-${Date.now()}`, username: 'user_b' },
    });
    userBId = userB.id;
  });

  afterEach(async () => {
    if (prisma) {
      if (userAId) {
        await prisma.documentChunk.deleteMany({ where: { document: { userId: userAId } } });
        await prisma.document.deleteMany({ where: { userId: userAId } });
        await prisma.user.delete({ where: { id: userAId } }).catch(() => {});
      }
      if (userBId) {
        await prisma.documentChunk.deleteMany({ where: { document: { userId: userBId } } });
        await prisma.document.deleteMany({ where: { userId: userBId } });
        await prisma.user.delete({ where: { id: userBId } }).catch(() => {});
      }
    }
  });

  it('relevant chunk ranks highest', async () => {
    const doc = await prisma.document.create({
      data: {
        userId: userAId,
        filename: 'tech.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        status: 'READY',
      },
    });

    // Mock embeddingProvider to return known vector for query
    jest.spyOn(embeddingProvider, 'embedBatch').mockResolvedValue([[1, 0, 0]]);

    // Chunk 1: [1, 0, 0] (exact match, cos sim 1.0)
    await prisma.documentChunk.create({
      data: {
        documentId: doc.id,
        chunkIndex: 0,
        pageNumber: 1,
        content: 'Artificial Intelligence and machine learning',
        embedding: [1, 0, 0],
      },
    });

    // Chunk 2: [0, 1, 0] (orthogonal, cos sim 0.0)
    await prisma.documentChunk.create({
      data: {
        documentId: doc.id,
        chunkIndex: 1,
        pageNumber: 1,
        content: 'Baking bread recipe instructions',
        embedding: [0, 1, 0],
      },
    });

    const results = await searchService.search(userAId, 'machine learning', 5);

    expect(results).toHaveLength(2);
    expect(results[0].content).toContain('Artificial Intelligence');
    expect(results[0].score).toBeCloseTo(1.0, 4);
    expect(results[1].content).toContain('Baking bread');
    expect(results[1].score).toBeCloseTo(0.0, 4);
  });

  it('respects topK parameter', async () => {
    const doc = await prisma.document.create({
      data: {
        userId: userAId,
        filename: 'many.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
        status: 'READY',
      },
    });

    jest.spyOn(embeddingProvider, 'embedBatch').mockResolvedValue([[1, 0, 0]]);

    for (let i = 0; i < 5; i++) {
      await prisma.documentChunk.create({
        data: {
          documentId: doc.id,
          chunkIndex: i,
          pageNumber: 1,
          content: `Chunk number ${i}`,
          embedding: [1, i * 0.1, 0],
        },
      });
    }

    const results = await searchService.search(userAId, 'test query', 2);
    expect(results).toHaveLength(2);
  });

  it('enforces user isolation (never exposes chunks belonging to another user)', async () => {
    const docA = await prisma.document.create({
      data: {
        userId: userAId,
        filename: 'userA.pdf',
        mimeType: 'application/pdf',
        fileSize: 100,
        status: 'READY',
      },
    });

    const docB = await prisma.document.create({
      data: {
        userId: userBId,
        filename: 'userB.pdf',
        mimeType: 'application/pdf',
        fileSize: 100,
        status: 'READY',
      },
    });

    jest.spyOn(embeddingProvider, 'embedBatch').mockResolvedValue([[1, 1, 1]]);

    await prisma.documentChunk.create({
      data: {
        documentId: docA.id,
        chunkIndex: 0,
        content: 'User A confidential content',
        embedding: [1, 1, 1],
      },
    });

    await prisma.documentChunk.create({
      data: {
        documentId: docB.id,
        chunkIndex: 0,
        content: 'User B secret content',
        embedding: [1, 1, 1],
      },
    });

    const resultsA = await searchService.search(userAId, 'confidential', 5);
    expect(resultsA).toHaveLength(1);
    expect(resultsA[0].documentId).toBe(docA.id);
    expect(resultsA[0].content).toContain('User A');

    const resultsB = await searchService.search(userBId, 'secret', 5);
    expect(resultsB).toHaveLength(1);
    expect(resultsB[0].documentId).toBe(docB.id);
    expect(resultsB[0].content).toContain('User B');
  });

  it('filters by documentId when supplied', async () => {
    const doc1 = await prisma.document.create({
      data: {
        userId: userAId,
        filename: 'doc1.pdf',
        mimeType: 'application/pdf',
        fileSize: 100,
        status: 'READY',
      },
    });

    const doc2 = await prisma.document.create({
      data: {
        userId: userAId,
        filename: 'doc2.pdf',
        mimeType: 'application/pdf',
        fileSize: 100,
        status: 'READY',
      },
    });

    jest.spyOn(embeddingProvider, 'embedBatch').mockResolvedValue([[1, 0, 0]]);

    await prisma.documentChunk.create({
      data: {
        documentId: doc1.id,
        chunkIndex: 0,
        content: 'Content in doc1',
        embedding: [1, 0, 0],
      },
    });

    await prisma.documentChunk.create({
      data: {
        documentId: doc2.id,
        chunkIndex: 0,
        content: 'Content in doc2',
        embedding: [1, 0, 0],
      },
    });

    const results = await searchService.search(userAId, 'query', 5, doc1.id);
    expect(results).toHaveLength(1);
    expect(results[0].documentId).toBe(doc1.id);
    expect(results[0].content).toBe('Content in doc1');
  });

  it('returns empty array for empty or whitespace query or invalid topK', async () => {
    const emptyResults = await searchService.search(userAId, '   ', 5);
    expect(emptyResults).toEqual([]);

    const invalidTopK = await searchService.search(userAId, 'valid query', 0);
    expect(invalidTopK).toEqual([]);
  });

  it('handles malformed/missing embeddings gracefully', async () => {
    const doc = await prisma.document.create({
      data: {
        userId: userAId,
        filename: 'malformed.pdf',
        mimeType: 'application/pdf',
        fileSize: 100,
        status: 'READY',
      },
    });

    jest.spyOn(embeddingProvider, 'embedBatch').mockResolvedValue([[1, 0, 0]]);

    // Chunk with non-matching vector length
    await prisma.documentChunk.create({
      data: {
        documentId: doc.id,
        chunkIndex: 0,
        content: 'Wrong dimension chunk',
        embedding: [1, 0],
      },
    });

    // Chunk with invalid non-numeric values
    await prisma.documentChunk.create({
      data: {
        documentId: doc.id,
        chunkIndex: 1,
        content: 'NaN values chunk',
        embedding: ['invalid', null] as any,
      },
    });

    const results = await searchService.search(userAId, 'query', 5);
    expect(results).toHaveLength(2);
    expect(results[0].score).toBe(0);
    expect(results[1].score).toBe(0);
  });

  it('handles zero-vector embedding safely without division by zero', async () => {
    const doc = await prisma.document.create({
      data: {
        userId: userAId,
        filename: 'zero.pdf',
        mimeType: 'application/pdf',
        fileSize: 100,
        status: 'READY',
      },
    });

    jest.spyOn(embeddingProvider, 'embedBatch').mockResolvedValue([[0, 0, 0]]);

    await prisma.documentChunk.create({
      data: {
        documentId: doc.id,
        chunkIndex: 0,
        content: 'Zero vector content',
        embedding: [0, 0, 0],
      },
    });

    const results = await searchService.search(userAId, 'query', 5);
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(0);
  });

  it('maintains deterministic ranking for identical scores', async () => {
    const doc = await prisma.document.create({
      data: {
        userId: userAId,
        filename: 'ties.pdf',
        mimeType: 'application/pdf',
        fileSize: 100,
        status: 'READY',
      },
    });

    jest.spyOn(embeddingProvider, 'embedBatch').mockResolvedValue([[1, 0, 0]]);

    await prisma.documentChunk.create({
      data: {
        documentId: doc.id,
        chunkIndex: 2,
        content: 'Chunk 2',
        embedding: [1, 0, 0],
      },
    });

    await prisma.documentChunk.create({
      data: {
        documentId: doc.id,
        chunkIndex: 0,
        content: 'Chunk 0',
        embedding: [1, 0, 0],
      },
    });

    await prisma.documentChunk.create({
      data: {
        documentId: doc.id,
        chunkIndex: 1,
        content: 'Chunk 1',
        embedding: [1, 0, 0],
      },
    });

    const results = await searchService.search(userAId, 'query', 5);
    expect(results).toHaveLength(3);
    // All scores are 1.0, tie-broken by chunkIndex ascending: 0, 1, 2
    expect(results[0].chunkIndex).toBe(0);
    expect(results[1].chunkIndex).toBe(1);
    expect(results[2].chunkIndex).toBe(2);
  });
});
