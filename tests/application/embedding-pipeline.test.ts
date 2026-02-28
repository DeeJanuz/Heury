import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmbeddingPipeline } from '@/application/embedding-pipeline.js';
import {
  InMemoryCodeUnitRepository,
  InMemoryUnitSummaryRepository,
  InMemoryFunctionCallRepository,
  InMemoryEventFlowRepository,
  InMemoryFileClusterRepository,
} from '../helpers/fakes/index.js';
import { InMemoryVectorSearch } from '@/adapters/vector-search/in-memory-vector-search.js';
import { LocalEmbeddingProvider } from '@/adapters/embedding/local-embedding-provider.js';
import {
  createCodeUnit,
  CodeUnitType,
  PatternType,
  createCodeUnitPattern,
  createUnitSummary,
  createFunctionCall,
  createEventFlow,
  createFileCluster,
  createFileClusterMember,
} from '@/domain/models/index.js';
import * as textBuilder from '@/adapters/embedding/embedding-text-builder.js';

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
  let codeUnitRepo: InMemoryCodeUnitRepository;
  let vectorSearch: InMemoryVectorSearch;
  let embeddingProvider: LocalEmbeddingProvider;

  beforeEach(() => {
    codeUnitRepo = new InMemoryCodeUnitRepository();
    vectorSearch = new InMemoryVectorSearch();
    embeddingProvider = new LocalEmbeddingProvider(64);
  });

  function createPipeline(enrichmentRepos: {
    unitSummaryRepo?: InMemoryUnitSummaryRepository;
    functionCallRepo?: InMemoryFunctionCallRepository;
    eventFlowRepo?: InMemoryEventFlowRepository;
    fileClusterRepo?: InMemoryFileClusterRepository;
  } = {}) {
    return new EmbeddingPipeline({
      codeUnitRepo,
      embeddingProvider,
      vectorSearch,
      ...enrichmentRepos,
    });
  }

  describe('core functionality (backward compatibility)', () => {
    let pipeline: EmbeddingPipeline;

    beforeEach(() => {
      pipeline = createPipeline();
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

  describe('enrichment integration', () => {
    it('should work without enrichment repos (backward compat)', async () => {
      const pipeline = createPipeline();
      codeUnitRepo.save(makeSampleUnit('u1', 'getUsers', 'src/users.ts'));

      const spy = vi.spyOn(textBuilder, 'buildEmbeddingText');
      await pipeline.indexAll();

      expect(spy).toHaveBeenCalled();
      // The call should still work and produce results
      const embedding = await embeddingProvider.generateEmbedding('getUsers');
      const results = await vectorSearch.search(embedding, 10);
      expect(results).toHaveLength(1);
      spy.mockRestore();
    });

    it('should enrich text with summary from unitSummaryRepo', async () => {
      const unitSummaryRepo = new InMemoryUnitSummaryRepository();
      const pipeline = createPipeline({ unitSummaryRepo });

      codeUnitRepo.save(makeSampleUnit('u1', 'getUsers', 'src/users.ts'));
      unitSummaryRepo.save(
        createUnitSummary({
          codeUnitId: 'u1',
          summary: 'Retrieves all users from the database',
          providerModel: 'test-model',
          generatedAt: '2026-01-01T00:00:00Z',
        }),
      );

      const spy = vi.spyOn(textBuilder, 'buildEmbeddingText');
      await pipeline.indexAll();

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          unit: expect.objectContaining({ id: 'u1' }),
          summary: 'Retrieves all users from the database',
        }),
      );
      spy.mockRestore();
    });

    it('should enrich text with callers and callees from functionCallRepo', async () => {
      const functionCallRepo = new InMemoryFunctionCallRepository();
      const pipeline = createPipeline({ functionCallRepo });

      codeUnitRepo.save(makeSampleUnit('u1', 'getUsers', 'src/users.ts'));
      codeUnitRepo.save(makeSampleUnit('u2', 'handleRequest', 'src/handler.ts'));

      // u2 calls u1 (u1 is callee, u2 is caller)
      functionCallRepo.save(
        createFunctionCall({
          callerUnitId: 'u2',
          calleeName: 'getUsers',
          calleeUnitId: 'u1',
          lineNumber: 5,
          isAsync: false,
        }),
      );

      // u1 calls some function named 'findAll'
      functionCallRepo.save(
        createFunctionCall({
          callerUnitId: 'u1',
          calleeName: 'findAll',
          lineNumber: 15,
          isAsync: false,
        }),
      );

      const spy = vi.spyOn(textBuilder, 'buildEmbeddingText');
      await pipeline.indexAll();

      // Find the call for u1
      const u1Call = spy.mock.calls.find((call) => {
        const arg = call[0];
        return typeof arg === 'object' && 'unit' in arg && arg.unit.id === 'u1';
      });

      expect(u1Call).toBeDefined();
      const u1Context = u1Call![0] as textBuilder.EmbeddingTextContext;
      expect(u1Context.callers).toContain('handleRequest');
      expect(u1Context.callees).toContain('findAll');

      spy.mockRestore();
    });

    it('should enrich text with events from eventFlowRepo', async () => {
      const eventFlowRepo = new InMemoryEventFlowRepository();
      const pipeline = createPipeline({ eventFlowRepo });

      codeUnitRepo.save(makeSampleUnit('u1', 'getUsers', 'src/users.ts'));

      eventFlowRepo.save(
        createEventFlow({
          codeUnitId: 'u1',
          eventName: 'user.created',
          direction: 'emit',
          framework: 'EventEmitter',
          lineNumber: 20,
        }),
      );

      eventFlowRepo.save(
        createEventFlow({
          codeUnitId: 'u1',
          eventName: 'user.updated',
          direction: 'subscribe',
          framework: 'EventEmitter',
          lineNumber: 25,
        }),
      );

      const spy = vi.spyOn(textBuilder, 'buildEmbeddingText');
      await pipeline.indexAll();

      const u1Call = spy.mock.calls.find((call) => {
        const arg = call[0];
        return typeof arg === 'object' && 'unit' in arg && arg.unit.id === 'u1';
      });

      expect(u1Call).toBeDefined();
      const u1Context = u1Call![0] as textBuilder.EmbeddingTextContext;
      expect(u1Context.events).toContain('user.created');
      expect(u1Context.events).toContain('user.updated');

      spy.mockRestore();
    });

    it('should enrich text with cluster name from fileClusterRepo', async () => {
      const fileClusterRepo = new InMemoryFileClusterRepository();
      const pipeline = createPipeline({ fileClusterRepo });

      codeUnitRepo.save(makeSampleUnit('u1', 'getUsers', 'src/users.ts'));

      const cluster = createFileCluster({
        id: 'cluster-1',
        name: 'user-management',
        cohesion: 0.8,
        internalEdges: 5,
        externalEdges: 2,
      });

      const member = createFileClusterMember({
        clusterId: 'cluster-1',
        filePath: 'src/users.ts',
        isEntryPoint: true,
      });

      fileClusterRepo.save(cluster, [member]);

      const spy = vi.spyOn(textBuilder, 'buildEmbeddingText');
      await pipeline.indexAll();

      const u1Call = spy.mock.calls.find((call) => {
        const arg = call[0];
        return typeof arg === 'object' && 'unit' in arg && arg.unit.id === 'u1';
      });

      expect(u1Call).toBeDefined();
      const u1Context = u1Call![0] as textBuilder.EmbeddingTextContext;
      expect(u1Context.clusterName).toBe('user-management');

      spy.mockRestore();
    });

    it('should combine all enrichment sources together', async () => {
      const unitSummaryRepo = new InMemoryUnitSummaryRepository();
      const functionCallRepo = new InMemoryFunctionCallRepository();
      const eventFlowRepo = new InMemoryEventFlowRepository();
      const fileClusterRepo = new InMemoryFileClusterRepository();

      const pipeline = createPipeline({
        unitSummaryRepo,
        functionCallRepo,
        eventFlowRepo,
        fileClusterRepo,
      });

      codeUnitRepo.save(makeSampleUnit('u1', 'getUsers', 'src/users.ts'));

      unitSummaryRepo.save(
        createUnitSummary({
          codeUnitId: 'u1',
          summary: 'Retrieves users',
          providerModel: 'test-model',
          generatedAt: '2026-01-01T00:00:00Z',
        }),
      );

      functionCallRepo.save(
        createFunctionCall({
          callerUnitId: 'u1',
          calleeName: 'findAll',
          lineNumber: 15,
          isAsync: false,
        }),
      );

      eventFlowRepo.save(
        createEventFlow({
          codeUnitId: 'u1',
          eventName: 'user.created',
          direction: 'emit',
          framework: 'EventEmitter',
          lineNumber: 20,
        }),
      );

      const cluster = createFileCluster({
        id: 'cluster-1',
        name: 'user-management',
        cohesion: 0.8,
        internalEdges: 5,
        externalEdges: 2,
      });
      fileClusterRepo.save(cluster, [
        createFileClusterMember({
          clusterId: 'cluster-1',
          filePath: 'src/users.ts',
          isEntryPoint: true,
        }),
      ]);

      const spy = vi.spyOn(textBuilder, 'buildEmbeddingText');
      await pipeline.indexAll();

      const u1Call = spy.mock.calls.find((call) => {
        const arg = call[0];
        return typeof arg === 'object' && 'unit' in arg && arg.unit.id === 'u1';
      });

      expect(u1Call).toBeDefined();
      const u1Context = u1Call![0] as textBuilder.EmbeddingTextContext;
      expect(u1Context.summary).toBe('Retrieves users');
      expect(u1Context.callees).toContain('findAll');
      expect(u1Context.events).toContain('user.created');
      expect(u1Context.clusterName).toBe('user-management');

      spy.mockRestore();
    });

    it('should handle indexUnit with enrichment data', async () => {
      const unitSummaryRepo = new InMemoryUnitSummaryRepository();
      const pipeline = createPipeline({ unitSummaryRepo });

      codeUnitRepo.save(makeSampleUnit('u1', 'getUsers', 'src/users.ts'));
      unitSummaryRepo.save(
        createUnitSummary({
          codeUnitId: 'u1',
          summary: 'Retrieves all users',
          providerModel: 'test-model',
          generatedAt: '2026-01-01T00:00:00Z',
        }),
      );

      const spy = vi.spyOn(textBuilder, 'buildEmbeddingText');
      await pipeline.indexUnit('u1');

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          unit: expect.objectContaining({ id: 'u1' }),
          summary: 'Retrieves all users',
        }),
      );
      spy.mockRestore();
    });

    it('should handle reindex with enrichment data', async () => {
      const unitSummaryRepo = new InMemoryUnitSummaryRepository();
      const pipeline = createPipeline({ unitSummaryRepo });

      codeUnitRepo.save(makeSampleUnit('u1', 'getUsers', 'src/users.ts'));
      unitSummaryRepo.save(
        createUnitSummary({
          codeUnitId: 'u1',
          summary: 'Retrieves all users',
          providerModel: 'test-model',
          generatedAt: '2026-01-01T00:00:00Z',
        }),
      );

      await pipeline.indexAll();

      const spy = vi.spyOn(textBuilder, 'buildEmbeddingText');
      await pipeline.reindex(['u1']);

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          unit: expect.objectContaining({ id: 'u1' }),
          summary: 'Retrieves all users',
        }),
      );
      spy.mockRestore();
    });
  });
});
