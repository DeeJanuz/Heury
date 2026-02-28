import { describe, it, expect, vi } from 'vitest';
import { createVectorSearchTool } from '@/adapters/mcp/tools/vector-search.js';
import type { IVectorSearchService, VectorSearchResult, IEmbeddingProvider, ICodeUnitRepository, IFileClusterRepository } from '@/domain/ports/index.js';
import { CodeUnitType, createCodeUnit } from '@/domain/models/code-unit.js';
import { PatternType, createCodeUnitPattern } from '@/domain/models/code-unit-pattern.js';
import { createFileCluster, createFileClusterMember } from '@/domain/models/file-cluster.js';

function createMockEmbeddingProvider(): IEmbeddingProvider {
  return {
    generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    generateEmbeddings: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
    getDimensions: vi.fn().mockReturnValue(3),
  };
}

function createMockVectorSearch(results: VectorSearchResult[]): IVectorSearchService {
  return {
    search: vi.fn().mockResolvedValue(results),
    index: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  };
}

const UNIT_A_ID = 'unit-a';
const UNIT_B_ID = 'unit-b';
const UNIT_C_ID = 'unit-c';

function createTestCodeUnits() {
  const unitA = createCodeUnit({
    id: UNIT_A_ID,
    filePath: 'src/api/auth.ts',
    name: 'authenticate',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 20,
    isAsync: true,
    isExported: true,
    language: 'typescript',
    complexityScore: 8,
    patterns: [
      createCodeUnitPattern({
        codeUnitId: UNIT_A_ID,
        patternType: PatternType.API_ENDPOINT,
        patternValue: 'POST /auth/login',
      }),
    ],
  });

  const unitB = createCodeUnit({
    id: UNIT_B_ID,
    filePath: 'src/services/user.ts',
    name: 'getUser',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 15,
    isAsync: true,
    isExported: true,
    language: 'typescript',
    complexityScore: 3,
    patterns: [
      createCodeUnitPattern({
        codeUnitId: UNIT_B_ID,
        patternType: PatternType.DATABASE_READ,
        patternValue: 'SELECT * FROM users',
      }),
    ],
  });

  const unitC = createCodeUnit({
    id: UNIT_C_ID,
    filePath: 'src/api/users.ts',
    name: 'listUsers',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 30,
    isAsync: true,
    isExported: true,
    language: 'typescript',
    complexityScore: 5,
    patterns: [
      createCodeUnitPattern({
        codeUnitId: UNIT_C_ID,
        patternType: PatternType.API_ENDPOINT,
        patternValue: 'GET /api/users',
      }),
      createCodeUnitPattern({
        codeUnitId: UNIT_C_ID,
        patternType: PatternType.DATABASE_READ,
        patternValue: 'SELECT * FROM users',
      }),
    ],
  });

  return { unitA, unitB, unitC };
}

function createMockCodeUnitRepo(units: ReturnType<typeof createCodeUnit>[]): ICodeUnitRepository {
  const unitMap = new Map(units.map((u) => [u.id, u]));
  return {
    findById: vi.fn((id: string) => unitMap.get(id)),
    findByFilePath: vi.fn(() => []),
    findByType: vi.fn(() => []),
    findByLanguage: vi.fn(() => []),
    findAll: vi.fn(() => units),
    save: vi.fn(),
    saveBatch: vi.fn(),
    deleteByFilePath: vi.fn(),
    clear: vi.fn(),
  };
}

function createMockFileClusterRepo(
  mappings: Map<string, { cluster: ReturnType<typeof createFileCluster>; members: ReturnType<typeof createFileClusterMember>[] }>,
): IFileClusterRepository {
  return {
    findByFilePath: vi.fn((filePath: string) => mappings.get(filePath)),
    findById: vi.fn(() => undefined),
    findByName: vi.fn(() => []),
    findAll: vi.fn(() => []),
    save: vi.fn(),
    saveBatch: vi.fn(),
    clear: vi.fn(),
  };
}

function createSearchResults(): VectorSearchResult[] {
  return [
    { id: 'vec-1', score: 0.95, metadata: { unitId: UNIT_A_ID, name: 'authenticate', filePath: 'src/api/auth.ts', unitType: 'FUNCTION' } },
    { id: 'vec-2', score: 0.85, metadata: { unitId: UNIT_B_ID, name: 'getUser', filePath: 'src/services/user.ts', unitType: 'FUNCTION' } },
    { id: 'vec-3', score: 0.75, metadata: { unitId: UNIT_C_ID, name: 'listUsers', filePath: 'src/api/users.ts', unitType: 'FUNCTION' } },
  ];
}

function parseResponse(result: { content: Array<{ type: string; text: string }> }) {
  return JSON.parse(result.content[0].text);
}

describe('vector-search tool', () => {
  it('should return not configured when no vector search service', async () => {
    const tool = createVectorSearchTool({});
    const result = await tool.handler({ query: 'test query' });
    const parsed = parseResponse(result);

    expect(parsed.meta.context.reason).toBe('not_configured');
    expect(parsed.meta.context.detail).toContain('not yet configured');
  });

  it('should accept query parameter', async () => {
    const tool = createVectorSearchTool({});
    const result = await tool.handler({ query: 'authentication flow' });

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
  });

  it('should return all results when no filters are applied', async () => {
    const results = createSearchResults();
    const { unitA, unitB, unitC } = createTestCodeUnits();
    const tool = createVectorSearchTool({
      vectorSearch: createMockVectorSearch(results),
      embeddingProvider: createMockEmbeddingProvider(),
      codeUnitRepo: createMockCodeUnitRepo([unitA, unitB, unitC]),
    });

    const result = await tool.handler({ query: 'test' });
    const parsed = parseResponse(result);

    expect(parsed.data).toHaveLength(3);
  });

  describe('file_path_prefix filter', () => {
    it('should filter results by file path prefix', async () => {
      const results = createSearchResults();
      const { unitA, unitB, unitC } = createTestCodeUnits();
      const tool = createVectorSearchTool({
        vectorSearch: createMockVectorSearch(results),
        embeddingProvider: createMockEmbeddingProvider(),
        codeUnitRepo: createMockCodeUnitRepo([unitA, unitB, unitC]),
      });

      const result = await tool.handler({ query: 'test', file_path_prefix: 'src/api/' });
      const parsed = parseResponse(result);

      expect(parsed.data).toHaveLength(2);
      expect(parsed.data.every((d: { filePath: string }) => d.filePath.startsWith('src/api/'))).toBe(true);
    });

    it('should work using enriched filePath even without codeUnitRepo', async () => {
      const results = createSearchResults();
      const tool = createVectorSearchTool({
        vectorSearch: createMockVectorSearch(results),
        embeddingProvider: createMockEmbeddingProvider(),
      });

      const result = await tool.handler({ query: 'test', file_path_prefix: 'src/api/' });
      const parsed = parseResponse(result);

      expect(parsed.data).toHaveLength(2);
      expect(parsed.data.every((d: { filePath: string }) => d.filePath.startsWith('src/api/'))).toBe(true);
    });
  });

  describe('pattern_type filter', () => {
    it('should filter results by pattern type', async () => {
      const results = createSearchResults();
      const { unitA, unitB, unitC } = createTestCodeUnits();
      const tool = createVectorSearchTool({
        vectorSearch: createMockVectorSearch(results),
        embeddingProvider: createMockEmbeddingProvider(),
        codeUnitRepo: createMockCodeUnitRepo([unitA, unitB, unitC]),
      });

      const result = await tool.handler({ query: 'test', pattern_type: 'API_ENDPOINT' });
      const parsed = parseResponse(result);

      expect(parsed.data).toHaveLength(2);
      expect(parsed.data.map((d: { name: string }) => d.name)).toEqual(['authenticate', 'listUsers']);
    });

    it('should skip pattern_type filter when codeUnitRepo is not provided', async () => {
      const results = createSearchResults();
      const tool = createVectorSearchTool({
        vectorSearch: createMockVectorSearch(results),
        embeddingProvider: createMockEmbeddingProvider(),
      });

      const result = await tool.handler({ query: 'test', pattern_type: 'API_ENDPOINT' });
      const parsed = parseResponse(result);

      // Without codeUnitRepo, pattern_type filter cannot be applied, so all results returned
      expect(parsed.data).toHaveLength(3);
    });
  });

  describe('min_complexity filter', () => {
    it('should filter results by minimum complexity score', async () => {
      const results = createSearchResults();
      const { unitA, unitB, unitC } = createTestCodeUnits();
      const tool = createVectorSearchTool({
        vectorSearch: createMockVectorSearch(results),
        embeddingProvider: createMockEmbeddingProvider(),
        codeUnitRepo: createMockCodeUnitRepo([unitA, unitB, unitC]),
      });

      const result = await tool.handler({ query: 'test', min_complexity: 5 });
      const parsed = parseResponse(result);

      expect(parsed.data).toHaveLength(2);
      expect(parsed.data.map((d: { name: string }) => d.name)).toEqual(['authenticate', 'listUsers']);
    });

    it('should skip min_complexity filter when codeUnitRepo is not provided', async () => {
      const results = createSearchResults();
      const tool = createVectorSearchTool({
        vectorSearch: createMockVectorSearch(results),
        embeddingProvider: createMockEmbeddingProvider(),
      });

      const result = await tool.handler({ query: 'test', min_complexity: 5 });
      const parsed = parseResponse(result);

      expect(parsed.data).toHaveLength(3);
    });
  });

  describe('cluster_name filter', () => {
    it('should filter results by cluster name', async () => {
      const results = createSearchResults();
      const { unitA, unitB, unitC } = createTestCodeUnits();

      const apiCluster = createFileCluster({
        id: 'cluster-api',
        name: 'API Layer',
        cohesion: 0.8,
        internalEdges: 5,
        externalEdges: 2,
      });

      const clusterMappings = new Map<string, { cluster: ReturnType<typeof createFileCluster>; members: ReturnType<typeof createFileClusterMember>[] }>();
      clusterMappings.set('src/api/auth.ts', {
        cluster: apiCluster,
        members: [createFileClusterMember({ clusterId: apiCluster.id, filePath: 'src/api/auth.ts', isEntryPoint: true })],
      });
      clusterMappings.set('src/api/users.ts', {
        cluster: apiCluster,
        members: [createFileClusterMember({ clusterId: apiCluster.id, filePath: 'src/api/users.ts', isEntryPoint: false })],
      });

      const tool = createVectorSearchTool({
        vectorSearch: createMockVectorSearch(results),
        embeddingProvider: createMockEmbeddingProvider(),
        codeUnitRepo: createMockCodeUnitRepo([unitA, unitB, unitC]),
        fileClusterRepo: createMockFileClusterRepo(clusterMappings),
      });

      const result = await tool.handler({ query: 'test', cluster_name: 'API Layer' });
      const parsed = parseResponse(result);

      expect(parsed.data).toHaveLength(2);
      expect(parsed.data.map((d: { name: string }) => d.name)).toEqual(['authenticate', 'listUsers']);
    });

    it('should skip cluster_name filter when fileClusterRepo is not provided', async () => {
      const results = createSearchResults();
      const { unitA, unitB, unitC } = createTestCodeUnits();
      const tool = createVectorSearchTool({
        vectorSearch: createMockVectorSearch(results),
        embeddingProvider: createMockEmbeddingProvider(),
        codeUnitRepo: createMockCodeUnitRepo([unitA, unitB, unitC]),
      });

      const result = await tool.handler({ query: 'test', cluster_name: 'API Layer' });
      const parsed = parseResponse(result);

      expect(parsed.data).toHaveLength(3);
    });
  });

  describe('combined filters', () => {
    it('should apply multiple filters with AND logic', async () => {
      const results = createSearchResults();
      const { unitA, unitB, unitC } = createTestCodeUnits();
      const tool = createVectorSearchTool({
        vectorSearch: createMockVectorSearch(results),
        embeddingProvider: createMockEmbeddingProvider(),
        codeUnitRepo: createMockCodeUnitRepo([unitA, unitB, unitC]),
      });

      // src/api/ prefix AND API_ENDPOINT pattern AND min_complexity 6
      // unitA: src/api/auth.ts, API_ENDPOINT, complexity 8 -> PASS
      // unitC: src/api/users.ts, API_ENDPOINT, complexity 5 -> FAIL (complexity < 6)
      const result = await tool.handler({
        query: 'test',
        file_path_prefix: 'src/api/',
        pattern_type: 'API_ENDPOINT',
        min_complexity: 6,
      });
      const parsed = parseResponse(result);

      expect(parsed.data).toHaveLength(1);
      expect(parsed.data[0].name).toBe('authenticate');
    });
  });

  describe('no results after filtering', () => {
    it('should return empty array when all results are filtered out', async () => {
      const results = createSearchResults();
      const { unitA, unitB, unitC } = createTestCodeUnits();
      const tool = createVectorSearchTool({
        vectorSearch: createMockVectorSearch(results),
        embeddingProvider: createMockEmbeddingProvider(),
        codeUnitRepo: createMockCodeUnitRepo([unitA, unitB, unitC]),
      });

      const result = await tool.handler({ query: 'test', file_path_prefix: 'src/nonexistent/' });
      const parsed = parseResponse(result);

      expect(parsed.data).toHaveLength(0);
      expect(parsed.meta.result_count).toBe(0);
    });
  });

  describe('input schema', () => {
    it('should include filter parameters in the input schema', () => {
      const tool = createVectorSearchTool({});
      const props = tool.definition.inputSchema.properties as Record<string, unknown>;

      expect(props).toHaveProperty('file_path_prefix');
      expect(props).toHaveProperty('pattern_type');
      expect(props).toHaveProperty('min_complexity');
      expect(props).toHaveProperty('cluster_name');
    });

    it('should not require filter parameters', () => {
      const tool = createVectorSearchTool({});
      const required = tool.definition.inputSchema.required as string[];

      expect(required).toContain('query');
      expect(required).not.toContain('file_path_prefix');
      expect(required).not.toContain('pattern_type');
      expect(required).not.toContain('min_complexity');
      expect(required).not.toContain('cluster_name');
    });
  });
});
