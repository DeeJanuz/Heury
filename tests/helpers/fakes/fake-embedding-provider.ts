import type { IEmbeddingProvider } from '@/domain/ports/index.js';

export class FakeEmbeddingProvider implements IEmbeddingProvider {
  private readonly dimensions: number;

  constructor(dimensions: number = 384) {
    this.dimensions = dimensions;
  }

  async generateEmbedding(_text: string): Promise<number[]> {
    return new Array(this.dimensions).fill(0);
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return texts.map(() => new Array(this.dimensions).fill(0));
  }

  getDimensions(): number {
    return this.dimensions;
  }
}
