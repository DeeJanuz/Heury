import { describe, it, expect, beforeEach } from 'vitest';
import { createPlanChangeImpactTool } from '@/adapters/mcp/tools/plan-change-impact.js';
import {
  InMemoryCodeUnitRepository,
  InMemoryFileDependencyRepository,
  InMemoryFileClusterRepository,
  InMemoryFileSystem,
} from '../../../../tests/helpers/fakes/index.js';
import { createCodeUnit, CodeUnitType } from '@/domain/models/code-unit.js';
import { createFileDependency, ImportType } from '@/domain/models/file-dependency.js';
import { createCodeUnitPattern, PatternType } from '@/domain/models/code-unit-pattern.js';
import { createFileCluster, createFileClusterMember } from '@/domain/models/file-cluster.js';

describe('plan-change-impact tool', () => {
  let codeUnitRepo: InMemoryCodeUnitRepository;
  let dependencyRepo: InMemoryFileDependencyRepository;
  let fileClusterRepo: InMemoryFileClusterRepository;
  let handler: ReturnType<typeof createPlanChangeImpactTool>['handler'];
  let definition: ReturnType<typeof createPlanChangeImpactTool>['definition'];

  // Target file with an API endpoint
  const targetUnit = createCodeUnit({
    id: 'unit-target',
    filePath: 'src/services/auth.ts',
    name: 'authenticate',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 10,
    lineEnd: 50,
    signature: 'function authenticate(creds: Credentials): Promise<Token>',
    isAsync: true,
    isExported: true,
    language: 'typescript',
    complexityScore: 8,
    patterns: [
      createCodeUnitPattern({
        id: 'pat-target',
        codeUnitId: 'unit-target',
        patternType: PatternType.API_ENDPOINT,
        patternValue: 'POST /auth',
      }),
    ],
  });

  // Direct dependent file with an API endpoint
  const dep1Unit = createCodeUnit({
    id: 'unit-dep1',
    filePath: 'src/routes/login.ts',
    name: 'loginHandler',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 30,
    signature: 'function loginHandler(req, res): void',
    isAsync: false,
    isExported: true,
    language: 'typescript',
    complexityScore: 3,
    patterns: [
      createCodeUnitPattern({
        id: 'pat-dep1',
        codeUnitId: 'unit-dep1',
        patternType: PatternType.API_ENDPOINT,
        patternValue: 'POST /login',
      }),
    ],
  });

  // Another direct dependent with a database pattern
  const dep2Unit = createCodeUnit({
    id: 'unit-dep2',
    filePath: 'src/routes/register.ts',
    name: 'registerHandler',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 40,
    isAsync: true,
    isExported: true,
    language: 'typescript',
    complexityScore: 4,
    patterns: [
      createCodeUnitPattern({
        id: 'pat-dep2',
        codeUnitId: 'unit-dep2',
        patternType: PatternType.DATABASE_WRITE,
        patternValue: 'INSERT INTO users',
      }),
    ],
  });

  // Transitive dependent (depends on dep1)
  const transitiveUnit = createCodeUnit({
    id: 'unit-trans',
    filePath: 'src/app.ts',
    name: 'setupRoutes',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 20,
    isAsync: false,
    isExported: true,
    language: 'typescript',
    complexityScore: 2,
  });

  // Unrelated file
  const unrelatedUnit = createCodeUnit({
    id: 'unit-unrelated',
    filePath: 'src/utils/logger.ts',
    name: 'log',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 10,
    isAsync: false,
    isExported: true,
    language: 'typescript',
  });

  // Dependencies: login.ts -> auth.ts, register.ts -> auth.ts, app.ts -> login.ts
  const depLoginToAuth = createFileDependency({
    id: 'dep-1',
    sourceFile: 'src/routes/login.ts',
    targetFile: 'src/services/auth.ts',
    importType: ImportType.NAMED,
    importedNames: ['authenticate'],
  });

  const depRegisterToAuth = createFileDependency({
    id: 'dep-2',
    sourceFile: 'src/routes/register.ts',
    targetFile: 'src/services/auth.ts',
    importType: ImportType.NAMED,
    importedNames: ['authenticate'],
  });

  const depAppToLogin = createFileDependency({
    id: 'dep-3',
    sourceFile: 'src/app.ts',
    targetFile: 'src/routes/login.ts',
    importType: ImportType.NAMED,
    importedNames: ['loginHandler'],
  });

  // Circular dep: auth.ts -> validator.ts -> auth.ts
  const depAuthToValidator = createFileDependency({
    id: 'dep-4',
    sourceFile: 'src/services/auth.ts',
    targetFile: 'src/services/validator.ts',
    importType: ImportType.NAMED,
    importedNames: ['validate'],
  });

  const depValidatorToAuth = createFileDependency({
    id: 'dep-5',
    sourceFile: 'src/services/validator.ts',
    targetFile: 'src/services/auth.ts',
    importType: ImportType.NAMED,
    importedNames: ['getAuthContext'],
  });

  const cluster = createFileCluster({
    id: 'cluster-auth',
    name: 'authentication',
    cohesion: 0.9,
    internalEdges: 3,
    externalEdges: 1,
  });

  const clusterMember = createFileClusterMember({
    clusterId: 'cluster-auth',
    filePath: 'src/services/auth.ts',
    isEntryPoint: true,
  });

  function setupAllData(): void {
    codeUnitRepo.save(targetUnit);
    codeUnitRepo.save(dep1Unit);
    codeUnitRepo.save(dep2Unit);
    codeUnitRepo.save(transitiveUnit);
    codeUnitRepo.save(unrelatedUnit);

    dependencyRepo.save(depLoginToAuth);
    dependencyRepo.save(depRegisterToAuth);
    dependencyRepo.save(depAppToLogin);
    dependencyRepo.save(depAuthToValidator);
    dependencyRepo.save(depValidatorToAuth);

    fileClusterRepo.save(cluster, [clusterMember]);
  }

  beforeEach(() => {
    codeUnitRepo = new InMemoryCodeUnitRepository();
    dependencyRepo = new InMemoryFileDependencyRepository();
    fileClusterRepo = new InMemoryFileClusterRepository();

    const tool = createPlanChangeImpactTool({
      dependencyRepo,
      codeUnitRepo,
      fileClusterRepo,
    });
    handler = tool.handler;
    definition = tool.definition;

    setupAllData();
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(definition.name).toBe('plan-change-impact');
    });

    it('should have a description mentioning impact', () => {
      expect(definition.description.toLowerCase()).toContain('impact');
    });

    it('should define the input schema with optional properties', () => {
      const props = definition.inputSchema.properties as Record<string, unknown>;
      expect(props).toHaveProperty('file_path');
      expect(props).toHaveProperty('unit_id');
      expect(props).toHaveProperty('function_name');
      expect(props).toHaveProperty('depth');
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

    it('should return error when unit_id not found', async () => {
      const result = await handler({ unit_id: 'nonexistent' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });

    it('should return error when function_name not found', async () => {
      const result = await handler({ function_name: 'noSuchFunction' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });
  });

  describe('resolve target by file_path', () => {
    it('should resolve target from file_path', async () => {
      const result = await handler({ file_path: 'src/services/auth.ts' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.target.filePath).toBe('src/services/auth.ts');
    });

    it('should include unit info when code units exist in the file', async () => {
      const result = await handler({ file_path: 'src/services/auth.ts' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.target.unitName).toBe('authenticate');
      expect(parsed.data.target.unitType).toBe('FUNCTION');
      expect(parsed.data.target.signature).toBe(
        'function authenticate(creds: Credentials): Promise<Token>',
      );
    });
  });

  describe('resolve target by unit_id', () => {
    it('should resolve target from unit_id', async () => {
      const result = await handler({ unit_id: 'unit-target' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.target.filePath).toBe('src/services/auth.ts');
      expect(parsed.data.target.unitName).toBe('authenticate');
      expect(parsed.data.target.unitType).toBe('FUNCTION');
    });
  });

  describe('resolve target by function_name', () => {
    it('should resolve target from function_name (first match)', async () => {
      const result = await handler({ function_name: 'authenticate' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.target.filePath).toBe('src/services/auth.ts');
      expect(parsed.data.target.unitName).toBe('authenticate');
    });
  });

  describe('direct dependents', () => {
    it('should list direct dependents', async () => {
      const result = await handler({ file_path: 'src/services/auth.ts' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.directDependents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ file: 'src/routes/login.ts', depth: 1 }),
          expect.objectContaining({ file: 'src/routes/register.ts', depth: 1 }),
          expect.objectContaining({ file: 'src/services/validator.ts', depth: 1 }),
        ]),
      );
      expect(parsed.data.directDependents).toHaveLength(3);
    });
  });

  describe('transitive dependents', () => {
    it('should include transitive dependents with depth', async () => {
      const result = await handler({ file_path: 'src/services/auth.ts' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.transitiveDependents.count).toBeGreaterThanOrEqual(3);
      const files = parsed.data.transitiveDependents.files.map(
        (f: { file: string }) => f.file,
      );
      expect(files).toContain('src/routes/login.ts');
      expect(files).toContain('src/routes/register.ts');
      expect(files).toContain('src/app.ts');
    });

    it('should respect custom depth parameter', async () => {
      const result = await handler({ file_path: 'src/services/auth.ts', depth: 1 });
      const parsed = JSON.parse(result.content[0].text);

      // Depth 1 should only include direct dependents, not transitive
      const files = parsed.data.transitiveDependents.files;
      const maxDepth = Math.max(...files.map((f: { depth: number }) => f.depth));
      expect(maxDepth).toBe(1);
    });
  });

  describe('affected endpoints', () => {
    it('should find API endpoints in affected files', async () => {
      const result = await handler({ file_path: 'src/services/auth.ts' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.affectedEndpoints).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'POST /login',
            filePath: 'src/routes/login.ts',
          }),
        ]),
      );
    });
  });

  describe('affected patterns', () => {
    it('should aggregate patterns in affected files', async () => {
      const result = await handler({ file_path: 'src/services/auth.ts' });
      const parsed = JSON.parse(result.content[0].text);

      const patternTypes = parsed.data.affectedPatterns.map(
        (p: { patternType: string }) => p.patternType,
      );
      expect(patternTypes).toContain('API_ENDPOINT');
      expect(patternTypes).toContain('DATABASE_WRITE');
    });
  });

  describe('circular deps', () => {
    it('should include circular deps involving the target file', async () => {
      const result = await handler({ file_path: 'src/services/auth.ts' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.circularDeps.length).toBeGreaterThanOrEqual(1);
      const involvedFiles = parsed.data.circularDeps[0].cycle;
      expect(involvedFiles).toContain('src/services/auth.ts');
      expect(involvedFiles).toContain('src/services/validator.ts');
    });

    it('should not include circular deps that do not involve the target file', async () => {
      // Add an unrelated circular dep
      dependencyRepo.save(
        createFileDependency({
          id: 'dep-unrelated-1',
          sourceFile: 'src/utils/a.ts',
          targetFile: 'src/utils/b.ts',
          importType: ImportType.NAMED,
        }),
      );
      dependencyRepo.save(
        createFileDependency({
          id: 'dep-unrelated-2',
          sourceFile: 'src/utils/b.ts',
          targetFile: 'src/utils/a.ts',
          importType: ImportType.NAMED,
        }),
      );

      const result = await handler({ file_path: 'src/services/auth.ts' });
      const parsed = JSON.parse(result.content[0].text);

      // Only circular deps involving auth.ts should appear
      for (const cd of parsed.data.circularDeps) {
        expect(cd.cycle).toContain('src/services/auth.ts');
      }
    });
  });

  describe('cluster membership', () => {
    it('should include cluster membership when fileClusterRepo is provided', async () => {
      const result = await handler({ file_path: 'src/services/auth.ts' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.clusterMembership).toMatchObject({
        clusterId: 'cluster-auth',
        clusterName: 'authentication',
        cohesion: 0.9,
      });
    });

    it('should return null cluster membership when file is not in a cluster', async () => {
      const result = await handler({ file_path: 'src/utils/logger.ts' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.clusterMembership).toBeNull();
    });
  });

  describe('no cluster repo', () => {
    it('should return null cluster membership when fileClusterRepo is not provided', async () => {
      const tool = createPlanChangeImpactTool({
        dependencyRepo,
        codeUnitRepo,
      });

      const result = await tool.handler({ file_path: 'src/services/auth.ts' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.clusterMembership).toBeNull();
    });
  });

  describe('risk assessment', () => {
    it('should assess low risk for file with few dependents and no endpoints', async () => {
      // app.ts has no dependents pointing to it
      const result = await handler({ file_path: 'src/app.ts' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.riskAssessment.toLowerCase()).toContain('low');
    });

    it('should assess high risk for file with many dependents or circular deps', async () => {
      const result = await handler({ file_path: 'src/services/auth.ts' });
      const parsed = JSON.parse(result.content[0].text);

      // auth.ts has 2 direct dependents + circular deps -> should be high
      expect(parsed.data.riskAssessment.toLowerCase()).toContain('high');
    });
  });

  describe('response format', () => {
    it('should not return isError on successful responses', async () => {
      const result = await handler({ file_path: 'src/services/auth.ts' });
      expect(result.isError).toBeUndefined();
    });

    it('should include meta in response', async () => {
      const result = await handler({ file_path: 'src/services/auth.ts' });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.meta).toBeDefined();
    });
  });

  describe('include_source', () => {
    let fileSystem: InMemoryFileSystem;

    beforeEach(async () => {
      fileSystem = new InMemoryFileSystem();
      const authLines = Array.from({ length: 50 }, (_, i) => `auth-line-${i + 1}`);
      await fileSystem.writeFile('src/services/auth.ts', authLines.join('\n'));

      const loginLines = Array.from({ length: 30 }, (_, i) => `login-line-${i + 1}`);
      await fileSystem.writeFile('src/routes/login.ts', loginLines.join('\n'));

      const registerLines = Array.from({ length: 40 }, (_, i) => `register-line-${i + 1}`);
      await fileSystem.writeFile('src/routes/register.ts', registerLines.join('\n'));

      const tool = createPlanChangeImpactTool({
        dependencyRepo,
        codeUnitRepo,
        fileClusterRepo,
        fileSystem,
      });
      handler = tool.handler;
    });

    it('should include source for the target unit when include_source is true', async () => {
      const result = await handler({ unit_id: 'unit-target', include_source: true });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.target.source).toBeDefined();
      expect(parsed.data.target.source).toContain('auth-line-10');
      expect(parsed.data.target.source).toContain('auth-line-50');
    });

    it('should include source for affected endpoint handler units', async () => {
      const result = await handler({ file_path: 'src/services/auth.ts', include_source: true });
      const parsed = JSON.parse(result.content[0].text);

      // The login endpoint is an affected endpoint
      const loginEndpoint = parsed.data.affectedEndpoints.find(
        (e: Record<string, unknown>) => e.name === 'POST /login',
      );
      expect(loginEndpoint).toBeDefined();
      expect(loginEndpoint.source).toBeDefined();
      expect(loginEndpoint.source).toContain('login-line-1');
    });

    it('should not include source when include_source is false', async () => {
      const result = await handler({ unit_id: 'unit-target', include_source: false });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.target).not.toHaveProperty('source');
    });

    it('should not include source when include_source is omitted', async () => {
      const result = await handler({ unit_id: 'unit-target' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.target).not.toHaveProperty('source');
    });

    it('should include target source when resolving by file_path', async () => {
      const result = await handler({ file_path: 'src/services/auth.ts', include_source: true });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.target.source).toBeDefined();
      expect(parsed.data.target.source).toContain('auth-line-10');
    });
  });
});
