import { createHash } from 'node:crypto';
import type { IEmbeddingProvider } from '@/domain/ports/index.js';

/**
 * A deterministic hash-based embedding provider for local use.
 * Produces consistent embeddings without requiring ONNX or external APIs.
 * Suitable as a placeholder until a real model is integrated.
 */
export class LocalEmbeddingProvider implements IEmbeddingProvider {
  private readonly dims: number;

  constructor(dimensions: number = 384) {
    this.dims = dimensions;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return this.hashToVector(text);
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.hashToVector(t));
  }

  getDimensions(): number {
    return this.dims;
  }

  /**
   * Convert text to a deterministic unit-length vector using SHA-256 hash expansion.
   * Multiple hash rounds with different salts fill the requested dimensions.
   */
  private hashToVector(text: string): number[] {
    const raw = new Float64Array(this.dims);
    let offset = 0;
    let round = 0;

    while (offset < this.dims) {
      const hash = createHash('sha256')
        .update(`${round}:${text}`)
        .digest();

      // Each SHA-256 hash gives 32 bytes = 8 float-like values (4 bytes each)
      for (let i = 0; i < 32 && offset < this.dims; i += 4) {
        // Read 4 bytes as a signed 32-bit int, normalize to [-1, 1]
        const val = hash.readInt32LE(i);
        raw[offset] = val / 2147483647;
        offset++;
      }
      round++;
    }

    // Normalize to unit length
    let magnitude = 0;
    for (let i = 0; i < this.dims; i++) {
      magnitude += raw[i] * raw[i];
    }
    magnitude = Math.sqrt(magnitude);

    const result: number[] = new Array(this.dims);
    for (let i = 0; i < this.dims; i++) {
      result[i] = magnitude === 0 ? 0 : raw[i] / magnitude;
    }
    return result;
  }
}
