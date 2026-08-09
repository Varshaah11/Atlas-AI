import { EmbeddingProvider } from '@/documents/embedding.provider';
import { writeFile, rm } from 'fs/promises';
import { join } from 'path';

// Simple mock logger that discards messages
const mockLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as any;

describe('EmbeddingProvider (fallback)', () => {
  const provider = new EmbeddingProvider(mockLogger);

  beforeAll(async () => {
    await provider.onModuleInit(); // should trigger fallback
  });

  it('should have a dimension property (fallback default)', () => {
    expect(provider.dimension).toBeGreaterThan(0);
  });

  it('embedBatch returns vectors of correct dimension for single text', async () => {
    const result = await provider.embedBatch(['hello world']);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(provider.dimension);
  });

  it('embedBatch handles empty string safely', async () => {
    const result = await provider.embedBatch(['']);
    expect(result).toHaveLength(1);
    const vec = result[0];
    expect(vec.reduce((a, b) => a + b, 0)).toBe(0);
    expect(vec).toHaveLength(provider.dimension);
  });

  it('identical inputs produce identical vectors', async () => {
    const a = await provider.embedBatch(['test identical']);
    const b = await provider.embedBatch(['test identical']);
    expect(a[0]).toEqual(b[0]);
  });

  it('different inputs produce different vectors', async () => {
    const a = await provider.embedBatch(['apple']);
    const b = await provider.embedBatch(['banana']);
    expect(a[0]).not.toEqual(b[0]);
  });

  it('batch embedding returns vectors for each input', async () => {
    const texts = ['first', 'second', 'third'];
    const result = await provider.embedBatch(texts);
    expect(result).toHaveLength(texts.length);
    for (const vec of result) {
      expect(vec).toHaveLength(provider.dimension);
    }
  });
});
