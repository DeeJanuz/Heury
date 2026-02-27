import type { IEmbeddingProvider } from '@/domain/ports/index.js';
import OpenAI from 'openai';

/**
 * Embedding provider that uses OpenAI's embedding API.
 */
export class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly dims: number;

  constructor(apiKey: string, model: string = 'text-embedding-3-small', dimensions: number = 1536) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.dims = dimensions;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
      dimensions: this.dims,
    });
    return response.data[0].embedding;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
      dimensions: this.dims,
    });
    // OpenAI returns embeddings in the same order as input
    return response.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
  }

  getDimensions(): number {
    return this.dims;
  }
}
