import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryVectorSearch } from '@/adapters/vector-search/in-memory-vector-search.js';

describe('InMemoryVectorSearch', () => {
  let search: InMemoryVectorSearch;

  beforeEach(() => {
    search = new InMemoryVectorSearch();
  });

  it('index and search returns results', async () => {
    await search.index('a', [1, 0, 0], { name: 'alpha' });
    await search.index('b', [0, 1, 0], { name: 'beta' });

    const results = await search.search([1, 0, 0], 10);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('a');
    expect(results[0].score).toBeCloseTo(1.0, 5);
  });

  it('results sorted by similarity score descending', async () => {
    await search.index('a', [1, 0, 0], {});
    await search.index('b', [0.7, 0.7, 0], {});
    await search.index('c', [0, 1, 0], {});

    const results = await search.search([1, 0, 0], 10);
    expect(results[0].id).toBe('a');
    // b should be more similar to [1,0,0] than c
    expect(results[1].id).toBe('b');
    expect(results[2].id).toBe('c');
    // Scores descending
    expect(results[0].score).toBeGreaterThan(results[1].score);
    expect(results[1].score).toBeGreaterThan(results[2].score);
  });

  it('limit parameter works', async () => {
    await search.index('a', [1, 0], {});
    await search.index('b', [0, 1], {});
    await search.index('c', [1, 1], {});

    const results = await search.search([1, 0], 2);
    expect(results).toHaveLength(2);
  });

  it('delete removes from index', async () => {
    await search.index('a', [1, 0], { name: 'alpha' });
    await search.index('b', [0, 1], { name: 'beta' });

    await search.delete('a');

    const results = await search.search([1, 0], 10);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('b');
  });

  it('clear empties everything', async () => {
    await search.index('a', [1, 0], {});
    await search.index('b', [0, 1], {});

    await search.clear();

    const results = await search.search([1, 0], 10);
    expect(results).toHaveLength(0);
  });
});
