import { describe, it, expect } from 'vitest';
import { LocalEmbeddingProvider } from '@/adapters/embedding/local-embedding-provider.js';

describe('LocalEmbeddingProvider', () => {
  it('returns vector of correct dimensions', async () => {
    const provider = new LocalEmbeddingProvider(384);
    const embedding = await provider.generateEmbedding('hello world');
    expect(embedding).toHaveLength(384);
  });

  it('same text produces same embedding', async () => {
    const provider = new LocalEmbeddingProvider();
    const a = await provider.generateEmbedding('hello world');
    const b = await provider.generateEmbedding('hello world');
    expect(a).toEqual(b);
  });

  it('different text produces different embeddings', async () => {
    const provider = new LocalEmbeddingProvider();
    const a = await provider.generateEmbedding('hello world');
    const b = await provider.generateEmbedding('goodbye world');
    expect(a).not.toEqual(b);
  });

  it('vector is normalized (magnitude approximately 1)', async () => {
    const provider = new LocalEmbeddingProvider();
    const embedding = await provider.generateEmbedding('test normalization');
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    expect(magnitude).toBeCloseTo(1.0, 2);
  });

  it('batch embedding works', async () => {
    const provider = new LocalEmbeddingProvider(128);
    const texts = ['alpha', 'beta', 'gamma'];
    const embeddings = await provider.generateEmbeddings(texts);
    expect(embeddings).toHaveLength(3);
    expect(embeddings[0]).toHaveLength(128);
    expect(embeddings[1]).toHaveLength(128);
    expect(embeddings[2]).toHaveLength(128);
    // Each should be different
    expect(embeddings[0]).not.toEqual(embeddings[1]);
  });

  it('getDimensions returns configured value', () => {
    const provider = new LocalEmbeddingProvider(256);
    expect(provider.getDimensions()).toBe(256);
  });

  it('defaults to 384 dimensions', () => {
    const provider = new LocalEmbeddingProvider();
    expect(provider.getDimensions()).toBe(384);
  });
});
