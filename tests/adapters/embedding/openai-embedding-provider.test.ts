import { describe, it, expect } from 'vitest';
import { OpenAIEmbeddingProvider } from '@/adapters/embedding/openai-embedding-provider.js';

describe('OpenAIEmbeddingProvider', () => {
  it('constructor sets correct default model and dimensions', () => {
    const provider = new OpenAIEmbeddingProvider('fake-key');
    // Default model is text-embedding-3-small with 1536 dimensions
    expect(provider.getDimensions()).toBe(1536);
  });

  it('getDimensions returns custom value when specified', () => {
    const provider = new OpenAIEmbeddingProvider('fake-key', 'text-embedding-3-large', 3072);
    expect(provider.getDimensions()).toBe(3072);
  });
});
