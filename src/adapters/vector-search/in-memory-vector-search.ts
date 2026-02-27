import type { IVectorSearchService, VectorSearchResult } from '@/domain/ports/index.js';

interface StoredVector {
  readonly id: string;
  readonly embedding: number[];
  readonly metadata: Record<string, unknown>;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude === 0 ? 0 : dot / magnitude;
}

/**
 * Pure-JS in-memory vector search using cosine similarity.
 * No native dependencies required. Suitable for small-to-medium codebases.
 */
export class InMemoryVectorSearch implements IVectorSearchService {
  private readonly vectors = new Map<string, StoredVector>();

  async index(id: string, embedding: number[], metadata: Record<string, unknown>): Promise<void> {
    this.vectors.set(id, { id, embedding, metadata });
  }

  async search(queryEmbedding: number[], limit: number): Promise<VectorSearchResult[]> {
    const results: VectorSearchResult[] = [];
    for (const stored of this.vectors.values()) {
      results.push({
        id: stored.id,
        score: cosineSimilarity(queryEmbedding, stored.embedding),
        metadata: stored.metadata,
      });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    this.vectors.delete(id);
  }

  async clear(): Promise<void> {
    this.vectors.clear();
  }
}
