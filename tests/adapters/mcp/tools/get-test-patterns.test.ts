import { describe, it, expect, beforeEach } from 'vitest';
import { createGetTestPatternsTool } from '@/adapters/mcp/tools/get-test-patterns.js';
import {
  InMemoryCodeUnitRepository,
  InMemoryFileSystem,
  InMemoryFileClusterRepository,
  InMemoryPatternTemplateRepository,
} from '../../../../tests/helpers/fakes/index.js';
import { createCodeUnit, CodeUnitType } from '@/domain/models/code-unit.js';
import { createCodeUnitPattern, PatternType } from '@/domain/models/code-unit-pattern.js';
import { createFileCluster, createFileClusterMember } from '@/domain/models/file-cluster.js';

describe('get-test-patterns tool', () => {
  let codeUnitRepo: InMemoryCodeUnitRepository;
  let fileSystem: InMemoryFileSystem;
  let fileClusterRepo: InMemoryFileClusterRepository;
  let patternTemplateRepo: InMemoryPatternTemplateRepository;
  let handler: ReturnType<typeof createGetTestPatternsTool>['handler'];
  let definition: ReturnType<typeof createGetTestPatternsTool>['definition'];

  // Target unit: the unit we want to find test patterns for
  const targetUnit = createCodeUnit({
    id: 'target-1',
    filePath: 'src/services/payment.ts',
    name: 'processPayment',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 10,
    lineEnd: 50,
    signature: 'function processPayment(amount: number): Promise<Receipt>',
    isAsync: true,
    isExported: true,
    language: 'typescript',
    patterns: [
      createCodeUnitPattern({
        id: 'pat-1',
        codeUnitId: 'target-1',
        patternType: PatternType.DATABASE_WRITE,
        patternValue: 'INSERT INTO payments',
      }),
      createCodeUnitPattern({
        id: 'pat-2',
        codeUnitId: 'target-1',
        patternType: PatternType.EXTERNAL_SERVICE,
        patternValue: 'stripe.charges.create',
      }),
    ],
  });

  // Similar unit 1: same type + shared pattern (DATABASE_WRITE)
  const similarUnit1 = createCodeUnit({
    id: 'similar-1',
    filePath: 'src/services/order.ts',
    name: 'createOrder',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 5,
    lineEnd: 40,
    signature: 'function createOrder(items: Item[]): Promise<Order>',
    isAsync: true,
    isExported: true,
    language: 'typescript',
    patterns: [
      createCodeUnitPattern({
        id: 'pat-3',
        codeUnitId: 'similar-1',
        patternType: PatternType.DATABASE_WRITE,
        patternValue: 'INSERT INTO orders',
      }),
    ],
  });

  // Similar unit 2: same type + shared pattern (EXTERNAL_SERVICE)
  const similarUnit2 = createCodeUnit({
    id: 'similar-2',
    filePath: 'src/services/notification.ts',
    name: 'sendNotification',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 30,
    signature: 'function sendNotification(msg: string): Promise<void>',
    isAsync: true,
    isExported: true,
    language: 'typescript',
    patterns: [
      createCodeUnitPattern({
        id: 'pat-4',
        codeUnitId: 'similar-2',
        patternType: PatternType.EXTERNAL_SERVICE,
        patternValue: 'twilio.messages.create',
      }),
    ],
  });

  // Dissimilar unit: different type, no shared patterns
  const dissimilarUnit = createCodeUnit({
    id: 'dissimilar-1',
    filePath: 'src/models/user.ts',
    name: 'User',
    unitType: CodeUnitType.CLASS,
    lineStart: 1,
    lineEnd: 20,
    isAsync: false,
    isExported: true,
    language: 'typescript',
  });

  // Test file content for similar unit's test
  const orderTestContent = `import { describe, it, expect, beforeEach } from 'vitest';
import { createOrder } from '../../src/services/order.js';
import { InMemoryOrderRepo } from '../helpers/fakes.js';

describe('createOrder', () => {
  let orderRepo: InMemoryOrderRepo;

  beforeEach(() => {
    orderRepo = new InMemoryOrderRepo();
  });

  it('should create an order with valid items', async () => {
    const result = await createOrder([{ id: '1', qty: 2 }]);
    expect(result).toBeDefined();
  });

  it('should reject empty items', async () => {
    await expect(createOrder([])).rejects.toThrow();
  });

  it('should persist the order', async () => {
    await createOrder([{ id: '1', qty: 1 }]);
    expect(orderRepo.findAll()).toHaveLength(1);
  });
});
`;

  beforeEach(async () => {
    codeUnitRepo = new InMemoryCodeUnitRepository();
    fileSystem = new InMemoryFileSystem();
    fileClusterRepo = new InMemoryFileClusterRepository();
    patternTemplateRepo = new InMemoryPatternTemplateRepository();

    const tool = createGetTestPatternsTool({
      fileSystem,
      codeUnitRepo,
      fileClusterRepo,
      patternTemplateRepo,
    });
    handler = tool.handler;
    definition = tool.definition;

    // Seed code units
    codeUnitRepo.save(targetUnit);
    codeUnitRepo.save(similarUnit1);
    codeUnitRepo.save(similarUnit2);
    codeUnitRepo.save(dissimilarUnit);

    // Seed test file in fake file system
    await fileSystem.writeFile('tests/services/order.test.ts', orderTestContent);
  });

  describe('error handling', () => {
    it('should return error when neither file_path nor unit_name provided', async () => {
      const result = await handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('at least one');
    });

    it('should return error when target unit not found by file_path', async () => {
      const result = await handler({ file_path: 'src/nonexistent/file.ts' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });

    it('should return error when target unit not found by unit_name', async () => {
      const result = await handler({ unit_name: 'nonExistentFunction' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });
  });

  describe('target unit resolution', () => {
    it('should return target unit info when found by file_path', async () => {
      const result = await handler({ file_path: 'src/services/payment.ts' });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.data.targetUnit).toMatchObject({
        name: 'processPayment',
        filePath: 'src/services/payment.ts',
        unitType: 'FUNCTION',
        signature: 'function processPayment(amount: number): Promise<Receipt>',
      });
    });

    it('should return target unit info when found by unit_name', async () => {
      const result = await handler({ unit_name: 'processPayment' });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.data.targetUnit).toMatchObject({
        name: 'processPayment',
        filePath: 'src/services/payment.ts',
        unitType: 'FUNCTION',
      });
    });
  });

  describe('similar units', () => {
    it('should find similar units by unitType and patterns', async () => {
      const result = await handler({ file_path: 'src/services/payment.ts' });

      const parsed = JSON.parse(result.content[0].text);
      const similarNames = parsed.data.similarUnits.map((u: { name: string }) => u.name);

      // similarUnit1 (createOrder) has same type + DATABASE_WRITE pattern = score 3
      // similarUnit2 (sendNotification) has same type + EXTERNAL_SERVICE pattern = score 3
      // dissimilarUnit (User) has different type + no shared patterns = score 0
      expect(similarNames).toContain('createOrder');
      expect(similarNames).toContain('sendNotification');
      expect(similarNames).not.toContain('User');
    });

    it('should not include the target unit in similar units', async () => {
      const result = await handler({ file_path: 'src/services/payment.ts' });

      const parsed = JSON.parse(result.content[0].text);
      const similarNames = parsed.data.similarUnits.map((u: { name: string }) => u.name);
      expect(similarNames).not.toContain('processPayment');
    });

    it('should include signature in similar units when available', async () => {
      const result = await handler({ file_path: 'src/services/payment.ts' });

      const parsed = JSON.parse(result.content[0].text);
      const orderUnit = parsed.data.similarUnits.find(
        (u: { name: string }) => u.name === 'createOrder',
      );
      expect(orderUnit.signature).toBe('function createOrder(items: Item[]): Promise<Order>');
    });

    it('should boost score for units in the same file cluster', async () => {
      // Put target and a unit in the same cluster
      const cluster = createFileCluster({
        id: 'cluster-1',
        name: 'payments',
        cohesion: 0.9,
        internalEdges: 2,
        externalEdges: 1,
      });
      fileClusterRepo.save(cluster, [
        createFileClusterMember({
          clusterId: 'cluster-1',
          filePath: 'src/services/payment.ts',
          isEntryPoint: true,
        }),
        createFileClusterMember({
          clusterId: 'cluster-1',
          filePath: 'src/services/notification.ts',
          isEntryPoint: false,
        }),
      ]);

      const result = await handler({ file_path: 'src/services/payment.ts' });

      const parsed = JSON.parse(result.content[0].text);
      const similarNames = parsed.data.similarUnits.map((u: { name: string }) => u.name);
      // sendNotification gets +1 for same cluster, so should rank higher
      expect(similarNames[0]).toBe('sendNotification');
    });
  });

  describe('test file discovery', () => {
    it('should discover test files that exist for similar units', async () => {
      const result = await handler({ file_path: 'src/services/payment.ts' });

      const parsed = JSON.parse(result.content[0].text);
      const testFilePaths = parsed.data.testFiles.map(
        (tf: { testFilePath: string }) => tf.testFilePath,
      );
      expect(testFilePaths).toContain('tests/services/order.test.ts');
    });

    it('should return empty testFiles when no test files found', async () => {
      // Clear the file system so no test files exist
      fileSystem = new InMemoryFileSystem();
      const tool = createGetTestPatternsTool({
        fileSystem,
        codeUnitRepo,
      });

      const result = await tool.handler({ file_path: 'src/services/payment.ts' });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.data.testFiles).toHaveLength(0);
    });

    it('should include testedFilePath for discovered test files', async () => {
      const result = await handler({ file_path: 'src/services/payment.ts' });

      const parsed = JSON.parse(result.content[0].text);
      const orderTestFile = parsed.data.testFiles.find(
        (tf: { testFilePath: string }) => tf.testFilePath === 'tests/services/order.test.ts',
      );
      expect(orderTestFile).toBeDefined();
      expect(orderTestFile.testedFilePath).toBe('src/services/order.ts');
    });

    it('should also check for target unit test files', async () => {
      // Add a test file for the target unit itself
      await fileSystem.writeFile(
        'tests/services/payment.test.ts',
        'describe("processPayment", () => { it("works", () => {}); });',
      );

      const result = await handler({ file_path: 'src/services/payment.ts' });

      const parsed = JSON.parse(result.content[0].text);
      const testFilePaths = parsed.data.testFiles.map(
        (tf: { testFilePath: string }) => tf.testFilePath,
      );
      expect(testFilePaths).toContain('tests/services/payment.test.ts');
    });
  });

  describe('test structure extraction', () => {
    it('should read test file source and extract structure', async () => {
      const result = await handler({ file_path: 'src/services/payment.ts' });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.data.testStructure).not.toBeNull();
      expect(parsed.data.testStructure.testCount).toBe(3);
    });

    it('should extract import lines from test files', async () => {
      const result = await handler({ file_path: 'src/services/payment.ts' });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.data.testStructure.imports).toEqual(
        expect.arrayContaining([
          expect.stringContaining('vitest'),
          expect.stringContaining('order'),
          expect.stringContaining('fakes'),
        ]),
      );
    });

    it('should extract setup pattern from test files', async () => {
      const result = await handler({ file_path: 'src/services/payment.ts' });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.data.testStructure.setupPattern).not.toBeNull();
      expect(parsed.data.testStructure.setupPattern).toContain('beforeEach');
    });

    it('should return null testStructure when no test files found', async () => {
      fileSystem = new InMemoryFileSystem();
      const tool = createGetTestPatternsTool({
        fileSystem,
        codeUnitRepo,
      });

      const result = await tool.handler({ file_path: 'src/services/payment.ts' });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.data.testStructure).toBeNull();
    });
  });

  describe('conventions', () => {
    it('should determine test file location convention as tests/ mirror', async () => {
      const result = await handler({ file_path: 'src/services/payment.ts' });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.data.conventions.testFileLocation).toBe('tests/ mirror');
    });

    it('should determine naming convention', async () => {
      const result = await handler({ file_path: 'src/services/payment.ts' });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.data.conventions.namingPattern).toBe('.test.ts');
    });

    it('should detect .spec.ts naming convention', async () => {
      // Replace test file with .spec.ts variant
      fileSystem = new InMemoryFileSystem();
      await fileSystem.writeFile(
        'tests/services/order.spec.ts',
        'describe("createOrder", () => { it("works", () => {}); });',
      );
      const tool = createGetTestPatternsTool({
        fileSystem,
        codeUnitRepo,
      });

      const result = await tool.handler({ file_path: 'src/services/payment.ts' });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.data.conventions.namingPattern).toBe('.spec.ts');
    });

    it('should detect co-located __tests__ convention', async () => {
      fileSystem = new InMemoryFileSystem();
      await fileSystem.writeFile(
        'src/services/__tests__/order.test.ts',
        'describe("createOrder", () => { it("works", () => {}); });',
      );
      const tool = createGetTestPatternsTool({
        fileSystem,
        codeUnitRepo,
      });

      const result = await tool.handler({ file_path: 'src/services/payment.ts' });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.data.conventions.testFileLocation).toBe('co-located __tests__');
    });

    it('should detect co-located convention', async () => {
      fileSystem = new InMemoryFileSystem();
      await fileSystem.writeFile(
        'src/services/order.test.ts',
        'describe("createOrder", () => { it("works", () => {}); });',
      );
      const tool = createGetTestPatternsTool({
        fileSystem,
        codeUnitRepo,
      });

      const result = await tool.handler({ file_path: 'src/services/payment.ts' });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.data.conventions.testFileLocation).toBe('co-located');
    });
  });

  describe('optional dependencies', () => {
    it('should work without optional deps (fileClusterRepo, patternTemplateRepo)', async () => {
      const tool = createGetTestPatternsTool({
        fileSystem,
        codeUnitRepo,
      });

      const result = await tool.handler({ file_path: 'src/services/payment.ts' });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.data.targetUnit.name).toBe('processPayment');
      expect(parsed.data.similarUnits.length).toBeGreaterThan(0);
    });
  });

  describe('test file source in response', () => {
    it('should include source content for discovered test files', async () => {
      const result = await handler({ file_path: 'src/services/payment.ts' });

      const parsed = JSON.parse(result.content[0].text);
      const orderTestFile = parsed.data.testFiles.find(
        (tf: { testFilePath: string }) => tf.testFilePath === 'tests/services/order.test.ts',
      );
      expect(orderTestFile).toBeDefined();
      expect(orderTestFile.source).toContain('describe');
      expect(orderTestFile.source).toContain('createOrder');
    });
  });

  describe('tool definition', () => {
    it('should have correct tool name', () => {
      expect(definition.name).toBe('get-test-patterns');
    });

    it('should have a description mentioning test patterns', () => {
      expect(definition.description).toContain('test');
    });

    it('should define file_path and unit_name input properties', () => {
      const props = definition.inputSchema.properties as Record<string, unknown>;
      expect(props).toHaveProperty('file_path');
      expect(props).toHaveProperty('unit_name');
    });
  });
});
