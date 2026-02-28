import { describe, it, expect, beforeEach } from 'vitest';
import { createGetFeatureAreaTool } from '@/adapters/mcp/tools/get-feature-area.js';
import {
  InMemoryFileClusterRepository,
  InMemoryCodeUnitRepository,
  InMemoryFileDependencyRepository,
} from '../../../../tests/helpers/fakes/index.js';
import { createFileCluster, createFileClusterMember } from '@/domain/models/file-cluster.js';
import { createCodeUnit, CodeUnitType } from '@/domain/models/code-unit.js';
import { createFileDependency, ImportType } from '@/domain/models/file-dependency.js';
import { createCodeUnitPattern, PatternType } from '@/domain/models/code-unit-pattern.js';

describe('get-feature-area tool', () => {
  let fileClusterRepo: InMemoryFileClusterRepository;
  let codeUnitRepo: InMemoryCodeUnitRepository;
  let dependencyRepo: InMemoryFileDependencyRepository;
  let handler: ReturnType<typeof createGetFeatureAreaTool>['handler'];
  let definition: ReturnType<typeof createGetFeatureAreaTool>['definition'];

  const cluster = createFileCluster({
    id: 'cluster-1',
    name: 'auth',
    cohesion: 0.85,
    internalEdges: 3,
    externalEdges: 2,
  });

  const member1 = createFileClusterMember({
    clusterId: 'cluster-1',
    filePath: 'src/auth/login.ts',
    isEntryPoint: true,
  });

  const member2 = createFileClusterMember({
    clusterId: 'cluster-1',
    filePath: 'src/auth/validate.ts',
    isEntryPoint: false,
  });

  const member3 = createFileClusterMember({
    clusterId: 'cluster-1',
    filePath: 'src/auth/token.ts',
    isEntryPoint: true,
  });

  const unit1 = createCodeUnit({
    id: 'unit-1',
    filePath: 'src/auth/login.ts',
    name: 'login',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 30,
    signature: 'function login(user: string, pass: string): Promise<Token>',
    isAsync: true,
    isExported: true,
    language: 'typescript',
    complexityScore: 5,
    patterns: [
      createCodeUnitPattern({
        id: 'pat-1',
        codeUnitId: 'unit-1',
        patternType: PatternType.API_ENDPOINT,
        patternValue: 'POST /login',
      }),
    ],
  });

  const unit2 = createCodeUnit({
    id: 'unit-2',
    filePath: 'src/auth/validate.ts',
    name: 'validateToken',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 20,
    signature: 'function validateToken(token: string): boolean',
    isAsync: false,
    isExported: true,
    language: 'typescript',
    complexityScore: 3,
    patterns: [
      createCodeUnitPattern({
        id: 'pat-2',
        codeUnitId: 'unit-2',
        patternType: PatternType.DATABASE_READ,
        patternValue: 'SELECT * FROM tokens',
      }),
      createCodeUnitPattern({
        id: 'pat-3',
        codeUnitId: 'unit-2',
        patternType: PatternType.API_ENDPOINT,
        patternValue: 'GET /validate',
      }),
    ],
  });

  const unit3 = createCodeUnit({
    id: 'unit-3',
    filePath: 'src/auth/token.ts',
    name: 'generateToken',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 15,
    isAsync: false,
    isExported: true,
    language: 'typescript',
    complexityScore: 2,
  });

  // Internal dep: login.ts -> validate.ts (both in cluster)
  const internalDep = createFileDependency({
    id: 'dep-1',
    sourceFile: 'src/auth/login.ts',
    targetFile: 'src/auth/validate.ts',
    importType: ImportType.NAMED,
    importedNames: ['validateToken'],
  });

  // Internal dep: login.ts -> token.ts (both in cluster)
  const internalDep2 = createFileDependency({
    id: 'dep-2',
    sourceFile: 'src/auth/login.ts',
    targetFile: 'src/auth/token.ts',
    importType: ImportType.NAMED,
    importedNames: ['generateToken'],
  });

  // External dep outbound: login.ts -> utils/hash.ts (target outside cluster)
  const externalDepOutbound = createFileDependency({
    id: 'dep-3',
    sourceFile: 'src/auth/login.ts',
    targetFile: 'src/utils/hash.ts',
    importType: ImportType.NAMED,
    importedNames: ['hashPassword'],
  });

  // External dep inbound: routes/auth.ts -> login.ts (source outside cluster)
  const externalDepInbound = createFileDependency({
    id: 'dep-4',
    sourceFile: 'src/routes/auth.ts',
    targetFile: 'src/auth/login.ts',
    importType: ImportType.NAMED,
    importedNames: ['login'],
  });

  beforeEach(() => {
    fileClusterRepo = new InMemoryFileClusterRepository();
    codeUnitRepo = new InMemoryCodeUnitRepository();
    dependencyRepo = new InMemoryFileDependencyRepository();

    const tool = createGetFeatureAreaTool({
      fileClusterRepo,
      codeUnitRepo,
      dependencyRepo,
    });
    handler = tool.handler;
    definition = tool.definition;

    fileClusterRepo.save(cluster, [member1, member2, member3]);
    codeUnitRepo.save(unit1);
    codeUnitRepo.save(unit2);
    codeUnitRepo.save(unit3);
    dependencyRepo.save(internalDep);
    dependencyRepo.save(internalDep2);
    dependencyRepo.save(externalDepOutbound);
    dependencyRepo.save(externalDepInbound);
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(definition.name).toBe('get-feature-area');
    });

    it('should have a description mentioning feature area', () => {
      expect(definition.description).toContain('feature area');
    });

    it('should define optional input properties', () => {
      const props = definition.inputSchema.properties as Record<string, unknown>;
      expect(props).toHaveProperty('file_path');
      expect(props).toHaveProperty('cluster_name');
      expect(props).toHaveProperty('cluster_id');
    });

    it('should not require any input properties', () => {
      expect(definition.inputSchema).not.toHaveProperty('required');
    });
  });

  describe('error handling', () => {
    it('should return error when no inputs provided', async () => {
      const result = await handler({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('at least one');
    });

    it('should return error when cluster not found by ID', async () => {
      const result = await handler({ cluster_id: 'nonexistent' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });

    it('should return error when cluster not found by file_path', async () => {
      const result = await handler({ file_path: 'src/unknown/file.ts' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });

    it('should return error when cluster not found by cluster_name', async () => {
      const result = await handler({ cluster_name: 'nonexistent' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });
  });

  describe('find cluster by ID', () => {
    it('should return full composite response', async () => {
      const result = await handler({ cluster_id: 'cluster-1' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.cluster).toMatchObject({
        id: 'cluster-1',
        name: 'auth',
        cohesion: 0.85,
        internalEdges: 3,
        externalEdges: 2,
        files: ['src/auth/login.ts', 'src/auth/validate.ts', 'src/auth/token.ts'],
        entryPoints: ['src/auth/login.ts', 'src/auth/token.ts'],
      });
    });

    it('should return code units for cluster files', async () => {
      const result = await handler({ cluster_id: 'cluster-1' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.codeUnits).toHaveLength(3);
      expect(parsed.data.codeUnits[0]).toMatchObject({
        name: 'login',
        filePath: 'src/auth/login.ts',
        unitType: 'FUNCTION',
        lineStart: 1,
        lineEnd: 30,
        signature: 'function login(user: string, pass: string): Promise<Token>',
      });
    });

    it('should include complexity on code units when present', async () => {
      const result = await handler({ cluster_id: 'cluster-1' });
      const parsed = JSON.parse(result.content[0].text);

      const loginUnit = parsed.data.codeUnits.find(
        (u: { name: string }) => u.name === 'login',
      );
      expect(loginUnit.complexity).toBe(5);
    });

    it('should include patterns on code units', async () => {
      const result = await handler({ cluster_id: 'cluster-1' });
      const parsed = JSON.parse(result.content[0].text);

      const loginUnit = parsed.data.codeUnits.find(
        (u: { name: string }) => u.name === 'login',
      );
      expect(loginUnit.patterns).toEqual([
        { patternType: 'API_ENDPOINT', patternValue: 'POST /login' },
      ]);
    });
  });

  describe('find cluster by file_path', () => {
    it('should find cluster containing the specified file', async () => {
      const result = await handler({ file_path: 'src/auth/validate.ts' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.cluster.id).toBe('cluster-1');
      expect(parsed.data.cluster.name).toBe('auth');
    });
  });

  describe('find cluster by cluster_name', () => {
    it('should find cluster by name (takes first match)', async () => {
      const result = await handler({ cluster_name: 'auth' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.cluster.id).toBe('cluster-1');
      expect(parsed.data.cluster.name).toBe('auth');
    });
  });

  describe('internal vs external dependencies', () => {
    it('should classify internal deps correctly', async () => {
      const result = await handler({ cluster_id: 'cluster-1' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.internalDeps).toEqual(
        expect.arrayContaining([
          { source: 'src/auth/login.ts', target: 'src/auth/validate.ts' },
          { source: 'src/auth/login.ts', target: 'src/auth/token.ts' },
        ]),
      );
      expect(parsed.data.internalDeps).toHaveLength(2);
    });

    it('should classify outbound external deps correctly', async () => {
      const result = await handler({ cluster_id: 'cluster-1' });
      const parsed = JSON.parse(result.content[0].text);

      const outbound = parsed.data.externalDeps.filter(
        (d: { direction: string }) => d.direction === 'outbound',
      );
      expect(outbound).toEqual([
        { source: 'src/auth/login.ts', target: 'src/utils/hash.ts', direction: 'outbound' },
      ]);
    });

    it('should classify inbound external deps correctly', async () => {
      const result = await handler({ cluster_id: 'cluster-1' });
      const parsed = JSON.parse(result.content[0].text);

      const inbound = parsed.data.externalDeps.filter(
        (d: { direction: string }) => d.direction === 'inbound',
      );
      expect(inbound).toEqual([
        { source: 'src/routes/auth.ts', target: 'src/auth/login.ts', direction: 'inbound' },
      ]);
    });
  });

  describe('pattern aggregation', () => {
    it('should aggregate patterns across all code units by type', async () => {
      const result = await handler({ cluster_id: 'cluster-1' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.patternSummary).toEqual(
        expect.arrayContaining([
          { patternType: 'API_ENDPOINT', count: 2 },
          { patternType: 'DATABASE_READ', count: 1 },
        ]),
      );
    });
  });

  describe('entry points', () => {
    it('should list entry point file paths', async () => {
      const result = await handler({ cluster_id: 'cluster-1' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.cluster.entryPoints).toEqual([
        'src/auth/login.ts',
        'src/auth/token.ts',
      ]);
    });
  });

  describe('summary string', () => {
    it('should include cluster name, file count, and code unit count', async () => {
      const result = await handler({ cluster_id: 'cluster-1' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.summary).toContain("Feature area 'auth'");
      expect(parsed.data.summary).toContain('3 files');
      expect(parsed.data.summary).toContain('3 code units');
    });

    it('should include cohesion', async () => {
      const result = await handler({ cluster_id: 'cluster-1' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.summary).toContain('Cohesion: 0.85');
    });

    it('should include top patterns', async () => {
      const result = await handler({ cluster_id: 'cluster-1' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.summary).toContain('API_ENDPOINT (2)');
    });

    it('should include entry points', async () => {
      const result = await handler({ cluster_id: 'cluster-1' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.summary).toContain('login.ts');
      expect(parsed.data.summary).toContain('token.ts');
    });
  });

  describe('empty cluster', () => {
    it('should handle cluster with no code units', async () => {
      const emptyCluster = createFileCluster({
        id: 'cluster-empty',
        name: 'empty-area',
        cohesion: 0,
        internalEdges: 0,
        externalEdges: 0,
      });
      const emptyMember = createFileClusterMember({
        clusterId: 'cluster-empty',
        filePath: 'src/empty/file.ts',
        isEntryPoint: false,
      });
      fileClusterRepo.save(emptyCluster, [emptyMember]);

      const result = await handler({ cluster_id: 'cluster-empty' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.codeUnits).toHaveLength(0);
      expect(parsed.data.internalDeps).toHaveLength(0);
      expect(parsed.data.externalDeps).toHaveLength(0);
      expect(parsed.data.patternSummary).toHaveLength(0);
      expect(parsed.data.summary).toContain("Feature area 'empty-area'");
      expect(parsed.data.summary).toContain('0 code units');
    });
  });

  describe('response format', () => {
    it('should not return isError on successful responses', async () => {
      const result = await handler({ cluster_id: 'cluster-1' });
      expect(result.isError).toBeUndefined();
    });
  });
});
