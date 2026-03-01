import { describe, it, expect, beforeEach } from 'vitest';
import { createGetImplementationContextTool } from '@/adapters/mcp/tools/get-implementation-context.js';
import {
  InMemoryCodeUnitRepository,
  InMemoryFileSystem,
  InMemoryFileDependencyRepository,
  InMemoryFileClusterRepository,
  InMemoryPatternTemplateRepository,
} from '../../../../tests/helpers/fakes/index.js';
import {
  createCodeUnit,
  CodeUnitType,
  createCodeUnitPattern,
  PatternType,
  createFileDependency,
  ImportType,
  createFileCluster,
  createFileClusterMember,
  createPatternTemplate,
  createPatternTemplateFollower,
} from '@/domain/models/index.js';

describe('get-implementation-context tool', () => {
  let codeUnitRepo: InMemoryCodeUnitRepository;
  let fileSystem: InMemoryFileSystem;
  let dependencyRepo: InMemoryFileDependencyRepository;
  let fileClusterRepo: InMemoryFileClusterRepository;
  let patternTemplateRepo: InMemoryPatternTemplateRepository;
  let handler: ReturnType<typeof createGetImplementationContextTool>['handler'];

  const unit1 = createCodeUnit({
    id: 'unit-1',
    filePath: 'src/auth/login.ts',
    name: 'login',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 20,
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
    filePath: 'src/auth/login.ts',
    name: 'validateCredentials',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 22,
    lineEnd: 40,
    signature: 'function validateCredentials(user: string, pass: string): boolean',
    isAsync: false,
    isExported: false,
    language: 'typescript',
    complexityScore: 3,
    patterns: [
      createCodeUnitPattern({
        id: 'pat-2',
        codeUnitId: 'unit-2',
        patternType: PatternType.DATABASE_READ,
        patternValue: 'SELECT * FROM users',
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

  const dep1 = createFileDependency({
    id: 'dep-1',
    sourceFile: 'src/auth/login.ts',
    targetFile: 'src/auth/token.ts',
    importType: ImportType.NAMED,
    importedNames: ['generateToken'],
  });

  const dep2 = createFileDependency({
    id: 'dep-2',
    sourceFile: 'src/routes/auth.ts',
    targetFile: 'src/auth/login.ts',
    importType: ImportType.NAMED,
    importedNames: ['login'],
  });

  const loginSource = [
    'export async function login(user: string, pass: string): Promise<Token> {',
    '  const valid = validateCredentials(user, pass);',
    '  if (!valid) throw new Error("Invalid");',
    '  return generateToken(user);',
    '}',
    '',
    '// gap',
    '// gap',
    '// gap',
    '// gap',
    '// gap',
    '// gap',
    '// gap',
    '// gap',
    '// gap',
    '// gap',
    '// gap',
    '// gap',
    '// gap',
    '// gap',
    '',
    'function validateCredentials(user: string, pass: string): boolean {',
    '  const result = db.query("SELECT * FROM users WHERE name = ?", user);',
    '  return result.password === pass;',
    '  // more lines',
    '  // more lines',
    '  // more lines',
    '  // more lines',
    '  // more lines',
    '  // more lines',
    '  // more lines',
    '  // more lines',
    '  // more lines',
    '  // more lines',
    '  // more lines',
    '  // more lines',
    '  // more lines',
    '  // more lines',
    '  // more lines',
    '}',
  ].join('\n');

  function setupAllDeps(): void {
    const tool = createGetImplementationContextTool({
      codeUnitRepo,
      fileSystem,
      dependencyRepo,
      fileClusterRepo,
      patternTemplateRepo,
    });
    handler = tool.handler;
  }

  function setupMinimalDeps(): void {
    const tool = createGetImplementationContextTool({
      codeUnitRepo,
      fileSystem,
      dependencyRepo,
    });
    handler = tool.handler;
  }

  beforeEach(() => {
    codeUnitRepo = new InMemoryCodeUnitRepository();
    fileSystem = new InMemoryFileSystem();
    dependencyRepo = new InMemoryFileDependencyRepository();
    fileClusterRepo = new InMemoryFileClusterRepository();
    patternTemplateRepo = new InMemoryPatternTemplateRepository();

    codeUnitRepo.save(unit1);
    codeUnitRepo.save(unit2);
    codeUnitRepo.save(unit3);
    dependencyRepo.save(dep1);
    dependencyRepo.save(dep2);
  });

  describe('error handling', () => {
    it('should return error when no input provided', async () => {
      setupAllDeps();
      const result = await handler({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('At least one');
    });
  });

  describe('resolving primary units by unit_name', () => {
    it('should return primary units when searching by unit_name', async () => {
      setupAllDeps();
      const result = await handler({ unit_name: 'login' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.primaryUnits).toHaveLength(1);
      expect(parsed.data.primaryUnits[0]).toMatchObject({
        name: 'login',
        filePath: 'src/auth/login.ts',
        unitType: 'FUNCTION',
        lineStart: 1,
        lineEnd: 20,
        signature: 'function login(user: string, pass: string): Promise<Token>',
      });
    });

    it('should include patterns on primary units', async () => {
      setupAllDeps();
      const result = await handler({ unit_name: 'login' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.primaryUnits[0].patterns).toEqual([
        { patternType: 'API_ENDPOINT', patternValue: 'POST /login' },
      ]);
    });
  });

  describe('resolving primary units by file_path', () => {
    it('should return primary units when searching by file_path', async () => {
      setupAllDeps();
      const result = await handler({ file_path: 'src/auth/login.ts' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.primaryUnits).toHaveLength(2);
      const names = parsed.data.primaryUnits.map((u: { name: string }) => u.name);
      expect(names).toContain('login');
      expect(names).toContain('validateCredentials');
    });
  });

  describe('resolving primary units by query', () => {
    it('should return primary units when searching by query (text match on name)', async () => {
      setupAllDeps();
      const result = await handler({ query: 'generateToken' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.primaryUnits).toHaveLength(1);
      expect(parsed.data.primaryUnits[0].name).toBe('generateToken');
    });

    it('should return primary units when searching by query (text match on filePath)', async () => {
      setupAllDeps();
      const result = await handler({ query: 'token' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.primaryUnits).toHaveLength(1);
      expect(parsed.data.primaryUnits[0].name).toBe('generateToken');
    });
  });

  describe('source code extraction', () => {
    it('should include source code when include_source is true (default)', async () => {
      await fileSystem.writeFile('src/auth/login.ts', loginSource);
      setupAllDeps();

      const result = await handler({ unit_name: 'login' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.primaryUnits[0].source).toBeDefined();
      expect(parsed.data.primaryUnits[0].source).toContain('function login');
    });

    it('should omit source code when include_source is false', async () => {
      await fileSystem.writeFile('src/auth/login.ts', loginSource);
      setupAllDeps();

      const result = await handler({ unit_name: 'login', include_source: false });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.primaryUnits[0]).not.toHaveProperty('source');
    });
  });

  describe('dependencies', () => {
    it('should return import dependencies for primary units files', async () => {
      setupAllDeps();
      const result = await handler({ unit_name: 'login' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.dependencies.imports).toHaveLength(1);
      expect(parsed.data.dependencies.imports[0]).toMatchObject({
        sourceFile: 'src/auth/login.ts',
        targetFile: 'src/auth/token.ts',
        importedNames: ['generateToken'],
      });
    });

    it('should return importedBy dependencies', async () => {
      setupAllDeps();
      const result = await handler({ unit_name: 'login' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.dependencies.importedBy).toHaveLength(1);
      expect(parsed.data.dependencies.importedBy[0]).toMatchObject({
        sourceFile: 'src/routes/auth.ts',
        targetFile: 'src/auth/login.ts',
        importedNames: ['login'],
      });
    });
  });

  describe('test file discovery', () => {
    it('should discover test files that exist', async () => {
      await fileSystem.writeFile('tests/auth/login.test.ts', '// test');
      setupAllDeps();

      const result = await handler({ unit_name: 'login' });
      const parsed = JSON.parse(result.content[0].text);

      const existingTests = parsed.data.testFiles.filter(
        (t: { exists: boolean }) => t.exists,
      );
      expect(existingTests.length).toBeGreaterThanOrEqual(1);
      expect(existingTests[0].path).toBe('tests/auth/login.test.ts');
    });

    it('should return testFiles with exists: false for missing test files', async () => {
      setupAllDeps();

      const result = await handler({ unit_name: 'login' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.testFiles.length).toBeGreaterThan(0);
      const allMissing = parsed.data.testFiles.every(
        (t: { exists: boolean }) => !t.exists,
      );
      expect(allMissing).toBe(true);
    });
  });

  describe('feature area', () => {
    it('should return feature area when fileClusterRepo is provided', async () => {
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
        filePath: 'src/auth/token.ts',
        isEntryPoint: false,
      });
      fileClusterRepo.save(cluster, [member1, member2]);
      setupAllDeps();

      const result = await handler({ unit_name: 'login' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.featureArea).toMatchObject({
        name: 'auth',
        files: ['src/auth/login.ts', 'src/auth/token.ts'],
        entryPoints: ['src/auth/login.ts'],
      });
    });

    it('should return null featureArea when repo not provided', async () => {
      setupMinimalDeps();
      const result = await handler({ unit_name: 'login' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.featureArea).toBeNull();
    });

    it('should return null featureArea when file not in any cluster', async () => {
      setupAllDeps();
      const result = await handler({ unit_name: 'login' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.featureArea).toBeNull();
    });
  });

  describe('related patterns', () => {
    it('should return matching patterns when patternTemplateRepo is provided', async () => {
      const template = createPatternTemplate({
        id: 'tmpl-1',
        name: 'API Endpoint Handler',
        description: 'Standard API endpoint implementation',
        patternTypes: ['API_ENDPOINT'],
        templateUnitId: 'unit-1',
        templateFilePath: 'src/auth/login.ts',
        followerCount: 5,
        conventions: ['Use express router', 'Validate input'],
      });
      const follower = createPatternTemplateFollower({
        templateId: 'tmpl-1',
        filePath: 'src/users/create.ts',
        unitName: 'createUser',
      });
      patternTemplateRepo.save(template, [follower]);
      setupAllDeps();

      const result = await handler({ unit_name: 'login' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.relatedPatterns).toHaveLength(1);
      expect(parsed.data.relatedPatterns[0]).toMatchObject({
        name: 'API Endpoint Handler',
        conventions: ['Use express router', 'Validate input'],
        templateFilePath: 'src/auth/login.ts',
      });
    });

    it('should return null relatedPatterns when repo not provided', async () => {
      setupMinimalDeps();
      const result = await handler({ unit_name: 'login' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.relatedPatterns).toBeNull();
    });
  });

  describe('minimal dependencies', () => {
    it('should work with only required deps (codeUnitRepo + fileSystem + dependencyRepo)', async () => {
      setupMinimalDeps();
      const result = await handler({ unit_name: 'login' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.primaryUnits).toHaveLength(1);
      expect(parsed.data.primaryUnits[0].name).toBe('login');
      expect(parsed.data.dependencies.imports).toHaveLength(1);
      expect(parsed.data.dependencies.importedBy).toHaveLength(1);
      expect(parsed.data.relatedPatterns).toBeNull();
      expect(parsed.data.featureArea).toBeNull();
    });
  });
});
