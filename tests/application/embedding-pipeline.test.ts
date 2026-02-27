import { describe, it, expect, beforeEach } from 'vitest';
import { EmbeddingPipeline } from '@/application/embedding-pipeline.js';
import { InMemoryCodeUnitRepository } from '../helpers/fakes/index.js';
import { InMemoryVectorSearch } from '@/adapters/vector-search/in-memory-vector-search.js';
import { LocalEmbeddingProvider } from '@/adapters/embedding/local-embedding-provider.js';
import {
  createCodeUnit,
  CodeUnitType,
  PatternType,
  createCodeUnitPattern,
} from '@/domain/models/index.js';

function makeSampleUnit(id: string, name: string, filePath: string) {
  return createCodeUnit({
    id,
    filePath,
    name,
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 10,
    isAsync: false,
    isExported: true,
    language: 'typescript',
    complexityScore: 5,
    patterns: [
      createCodeUnitPattern({
        codeUnitId: id,
        patternType: PatternType.API_ENDPOINT,
        patternValue: `/api/${name}`,
      }),
    ],
    children: [],
  });
}

describe('EmbeddingPipeline', () => {
  let pipeline: EmbeddingPipeline;
  let codeUnitRepo: InMemoryCodeUnitRepository;
  let vectorSearch: InMemoryVectorSearch;
  let embeddingProvider: LocalEmbeddingProvider;

  beforeEach(() => {
    codeUnitRepo = new InMemoryCodeUnitRepository();
    vectorSearch = new InMemoryVectorSearch();
    embeddingProvider = new LocalEmbeddingProvider(64);
    pipeline = new EmbeddingPipeline({
      codeUnitRepo,
      embeddingProvider,
      vectorSearch,
    });
  });

  it('indexAll indexes all code units', async () => {
    codeUnitRepo.save(makeSampleUnit('u1', 'getUsers', 'src/users.ts'));
    codeUnitRepo.save(makeSampleUnit('u2', 'getPosts', 'src/posts.ts'));

    await pipeline.indexAll();

    // Verify vectors were indexed by searching
    const embedding = await embeddingProvider.generateEmbedding('getUsers');
    const results = await vectorSearch.search(embedding, 10);
    expect(results.length).toBe(2);
  });

  it('indexAll returns correct count', async () => {
    codeUnitRepo.save(makeSampleUnit('u1', 'getUsers', 'src/users.ts'));
    codeUnitRepo.save(makeSampleUnit('u2', 'getPosts', 'src/posts.ts'));
    codeUnitRepo.save(makeSampleUnit('u3', 'getComments', 'src/comments.ts'));

    const result = await pipeline.indexAll();
    expect(result.indexed).toBe(3);
    expect(result.errors).toBe(0);
  });

  it('search returns units with scores', async () => {
    codeUnitRepo.save(makeSampleUnit('u1', 'getUsers', 'src/users.ts'));
    codeUnitRepo.save(makeSampleUnit('u2', 'getPosts', 'src/posts.ts'));

    await pipeline.indexAll();

    const results = await pipeline.search('getUsers');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].unit).toBeDefined();
    expect(typeof results[0].score).toBe('number');
    expect(results[0].unit.name).toBeDefined();
  });

  it('search returns empty for no matches when no units indexed', async () => {
    const results = await pipeline.search('anything');
    expect(results).toHaveLength(0);
  });

  it('reindex updates specific units', async () => {
    codeUnitRepo.save(makeSampleUnit('u1', 'getUsers', 'src/users.ts'));
    codeUnitRepo.save(makeSampleUnit('u2', 'getPosts', 'src/posts.ts'));

    await pipeline.indexAll();

    // Now reindex just u1
    const result = await pipeline.reindex(['u1']);
    expect(result.indexed).toBe(1);
    expect(result.errors).toBe(0);
  });
});
