import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingProvider } from './embedding.provider';
import { PrismaService } from '@/database/prisma.service';

export interface DocumentSearchResult {
  documentId: string;
  filename: string;
  pageNumber: number;
  chunkIndex: number;
  content: string;
  score: number;
}

@Injectable()
export class DocumentSearchService {
  private readonly logger = new Logger(DocumentSearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingProvider: EmbeddingProvider,
  ) {}

  /**
   * Search for document chunks relevant to the given query for a user.
   *
   * @param userId User identifier to enforce user isolation.
   * @param query Search query text.
   * @param topK Max number of results to return (default 5).
   * @param documentId Optional document ID to restrict search to a specific document.
   */
  async search(
    userId: string,
    query: string,
    topK = 5,
    documentId?: string,
  ): Promise<DocumentSearchResult[]> {
    if (!userId || !query || query.trim().length === 0 || topK <= 0) {
      return [];
    }

    const trimmedQuery = query.trim();

    // 1. Generate query embedding
    let queryEmbedding: number[];
    try {
      const embeddings = await this.embeddingProvider.embedBatch([trimmedQuery]);
      queryEmbedding = embeddings[0];
    } catch (err) {
      this.logger.error(`Failed to generate embedding for query: ${err}`);
      return [];
    }

    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      return [];
    }

    // 2. Query document chunks belonging ONLY to the supplied userId (and optional documentId)
    const chunks = await this.prisma.documentChunk.findMany({
      where: {
        document: {
          userId,
          status: 'READY',
          ...(documentId ? { id: documentId } : {}),
        },
      },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
          },
        },
      },
    });

    if (chunks.length === 0) {
      return [];
    }

    // 3. Compute in-process cosine similarity for each chunk
    const results: DocumentSearchResult[] = [];

    for (const chunk of chunks) {
      let chunkEmbedding: number[];
      try {
        chunkEmbedding = Array.isArray(chunk.embedding)
          ? (chunk.embedding as unknown as number[])
          : typeof chunk.embedding === 'string'
            ? JSON.parse(chunk.embedding)
            : [];
      } catch {
        chunkEmbedding = [];
      }

      const cosineScore = this.computeCosineSimilarity(queryEmbedding, chunkEmbedding);
      const lexicalScore = this.computeLexicalScore(trimmedQuery, chunk.content);

      // Hybrid score: weighted combination of semantic vector similarity and lexical term/phrase matching
      const score = Math.max(cosineScore, cosineScore * 0.5 + lexicalScore * 0.5);

      results.push({
        documentId: chunk.documentId,
        filename: chunk.document.filename,
        pageNumber: chunk.pageNumber ?? 1,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        score,
      });
    }

    // 4. Sort results by score descending, then by chunkIndex ascending, then by documentId
    results.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.chunkIndex !== b.chunkIndex) {
        return a.chunkIndex - b.chunkIndex;
      }
      return a.documentId.localeCompare(b.documentId);
    });

    this.logger.debug(
      `Evaluated ${chunks.length} chunks for user ${userId}, returning top ${Math.min(results.length, topK)}`,
    );

    return results.slice(0, topK);
  }

  /**
   * Computes lexical keyword / phrase overlap score between query and chunk content.
   */
  private computeLexicalScore(query: string, content: string): number {
    if (!query || !content) return 0;

    const contentLower = content.toLowerCase();
    const queryLower = query.toLowerCase();

    // Key financial phrases to boost when present in both query and chunk
    const phrases = [
      'total assets',
      'balance sheet',
      'balance sheets',
      'total liabilities',
      'operating income',
      'net income',
      'cash and cash equivalents',
      'artificial intelligence',
      'business segments',
    ];

    let phraseScore = 0;
    for (const phrase of phrases) {
      if (queryLower.includes(phrase) && contentLower.includes(phrase)) {
        phraseScore += 0.5;
      }
    }

    const stopWords = new Set([
      'what',
      'is',
      'are',
      'was',
      'were',
      'the',
      'a',
      'an',
      'in',
      'on',
      'at',
      'of',
      'for',
      'to',
      'from',
      'by',
      'with',
      'about',
      'as',
      'its',
      'it',
      'tell',
      'me',
      'show',
      'does',
      'how',
      'which',
      'who',
      'this',
      'that',
      'these',
      'those',
    ]);

    const queryTokens = (queryLower.match(/\b[a-z0-9-]+\b/g) || []).filter(
      (t) => !stopWords.has(t) && t.length > 1,
    );

    if (queryTokens.length === 0) return Math.min(phraseScore, 1.0);

    let matchCount = 0;
    for (const token of queryTokens) {
      if (contentLower.includes(token)) {
        matchCount++;
      }
    }

    const tokenRatio = matchCount / queryTokens.length;
    return Math.min(tokenRatio * 0.5 + phraseScore, 1.0);
  }

  /**
   * Computes cosine similarity between two numeric vectors.
   * Returns 0 if vectors are empty, mismatched in dimension, zero-norm, or contain non-numeric values.
   */
  private computeCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!Array.isArray(vecA) || !Array.isArray(vecB)) {
      return 0;
    }

    if (vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      const a = vecA[i];
      const b = vecB[i];

      if (
        typeof a !== 'number' ||
        typeof b !== 'number' ||
        !Number.isFinite(a) ||
        !Number.isFinite(b)
      ) {
        return 0;
      }

      dotProduct += a * b;
      normA += a * a;
      normB += b * b;
    }

    if (normA <= 0 || normB <= 0) {
      return 0;
    }

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return Number.isFinite(similarity) ? similarity : 0;
  }
}
