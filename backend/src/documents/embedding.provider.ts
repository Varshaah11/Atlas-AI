import { Injectable, OnModuleInit } from '@nestjs/common';
import { AppLogger } from '@/common/logger/logger.service';

/**
 * EmbeddingProvider
 *
 * Tries to load a free local embedding model (Universal Sentence Encoder via TensorFlow.js).
 * If the model cannot be loaded, falls back to a deterministic hashing‑based vectorizer.
 *
 * Exposes:
 *   - embedBatch(texts: string[]): Promise<number[][]>
 *   - dimension: number (length of each returned vector)
 */
@Injectable()
export class EmbeddingProvider implements OnModuleInit {
  /** Vector dimension */
  public dimension: number;

  private logger: AppLogger;
  private model: any = null; // TensorFlow USE model when loaded
  private useFallback: boolean = false;

  constructor(logger: AppLogger) {
    this.logger = logger;
    // Default fallback dimension – used if we cannot load a real model
    this.dimension = 256;
  }

  /** Attempt to load the embedding model when the module initializes */
  async onModuleInit() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unused-vars
      const tf = require('@tensorflow/tfjs-node'); // may throw if not installed
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const use = require('@tensorflow-models/universal-sentence-encoder');
      this.model = await use.load();
      const dummy = await this.model.embed(['dummy']);
      const shape = dummy.shape; // [1, dim]
      this.dimension = shape[1];
      dummy.dispose();
      this.logger.log(`Embedding model loaded, dimension = ${this.dimension}`);
    } catch (err) {
      this.useFallback = true;
      this.logger.warn('Embedding model could not be loaded – using deterministic fallback', err);
    }
  }

  /** Embed a batch of texts */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (this.useFallback || !this.model) {
      return texts.map((t) => this.fallbackVector(t));
    }
    try {
      const embeddings = await this.model.embed(texts);
      const array = await embeddings.array(); // shape: [batch, dimension]
      embeddings.dispose();
      // sanity check dimension
      if (array.length && array[0].length !== this.dimension) {
        this.logger.warn(
          `Embedding dimension mismatch (model ${array[0].length} vs stored ${this.dimension})`,
        );
      }
      return array as number[][];
    } catch (err) {
      this.logger.error('Embedding failed – falling back to deterministic vectorizer', err);
      return texts.map((t) => this.fallbackVector(t));
    }
  }

  /** Deterministic hashing‑based TF‑IDF style vectorizer (fallback) */
  private fallbackVector(text: string): number[] {
    const vec = new Array(this.dimension).fill(0);
    if (!text) {
      return vec;
    }
    // simple tokenisation: words, lower‑cased
    const tokens = text.toLowerCase().match(/\b\w+\b/g) ?? [];
    for (const token of tokens) {
      // deterministic 32‑bit hash
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
      }
      const idx = hash % this.dimension;
      vec[idx] += 1; // term frequency count
    }
    return vec;
  }
}
