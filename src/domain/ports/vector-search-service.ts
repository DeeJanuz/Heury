export interface VectorSearchResult {
  readonly id: string;
  readonly score: number;
  readonly metadata: Record<string, unknown>;
}

export interface IVectorSearchService {
  index(id: string, embedding: number[], metadata: Record<string, unknown>): Promise<void>;
  search(queryEmbedding: number[], limit: number): Promise<VectorSearchResult[]>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}
