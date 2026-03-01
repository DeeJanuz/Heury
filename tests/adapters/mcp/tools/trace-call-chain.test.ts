import { describe, it, expect, beforeEach } from 'vitest';
import { createTraceCallChainTool } from '@/adapters/mcp/tools/trace-call-chain.js';
import { InMemoryCodeUnitRepository, InMemoryFunctionCallRepository, InMemoryFileSystem } from '../../../../tests/helpers/fakes/index.js';
import { createCodeUnit, CodeUnitType, createFunctionCall } from '@/domain/models/index.js';

describe('trace-call-chain tool', () => {
  let codeUnitRepo: InMemoryCodeUnitRepository;
  let functionCallRepo: InMemoryFunctionCallRepository;
  let handler: ReturnType<typeof createTraceCallChainTool>['handler'];

  const unitA = createCodeUnit({
    id: 'unit-a',
    filePath: 'src/services/order.ts',
    name: 'processOrder',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 10,
    lineEnd: 30,
    isAsync: true,
    isExported: true,
    language: 'typescript',
    signature: 'async function processOrder(order: Order): Promise<void>',
  });

  const unitB = createCodeUnit({
    id: 'unit-b',
    filePath: 'src/services/validation.ts',
    name: 'validateOrder',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 5,
    lineEnd: 20,
    isAsync: false,
    isExported: true,
    language: 'typescript',
    signature: 'function validateOrder(order: Order): boolean',
  });

  const unitC = createCodeUnit({
    id: 'unit-c',
    filePath: 'src/services/inventory.ts',
    name: 'checkStock',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 15,
    isAsync: true,
    isExported: true,
    language: 'typescript',
    signature: 'async function checkStock(itemId: string): Promise<boolean>',
  });

  const unitD = createCodeUnit({
    id: 'unit-d',
    filePath: 'src/handlers/api.ts',
    name: 'handleRequest',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 40,
    isAsync: true,
    isExported: true,
    language: 'typescript',
  });

  beforeEach(() => {
    codeUnitRepo = new InMemoryCodeUnitRepository();
    functionCallRepo = new InMemoryFunctionCallRepository();
    const tool = createTraceCallChainTool({ codeUnitRepo, functionCallRepo });
    handler = tool.handler;

    codeUnitRepo.save(unitA);
    codeUnitRepo.save(unitB);
    codeUnitRepo.save(unitC);
    codeUnitRepo.save(unitD);

    // processOrder calls validateOrder
    functionCallRepo.save(createFunctionCall({
      callerUnitId: 'unit-a',
      calleeName: 'validateOrder',
      calleeUnitId: 'unit-b',
      lineNumber: 12,
      isAsync: false,
    }));

    // validateOrder calls checkStock
    functionCallRepo.save(createFunctionCall({
      callerUnitId: 'unit-b',
      calleeName: 'checkStock',
      calleeUnitId: 'unit-c',
      lineNumber: 8,
      isAsync: true,
    }));

    // handleRequest calls processOrder
    functionCallRepo.save(createFunctionCall({
      callerUnitId: 'unit-d',
      calleeName: 'processOrder',
      calleeUnitId: 'unit-a',
      lineNumber: 15,
      isAsync: true,
    }));
  });

  it('should have correct tool definition', () => {
    const tool = createTraceCallChainTool({ codeUnitRepo, functionCallRepo });
    expect(tool.definition.name).toBe('trace-call-chain');
    expect(tool.definition.inputSchema).toBeDefined();
  });

  it('should trace callees from a unit_id', async () => {
    const result = await handler({ unit_id: 'unit-a' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data.root.name).toBe('processOrder');
    expect(parsed.data.root.filePath).toBe('src/services/order.ts');
    expect(parsed.data.root.unitId).toBe('unit-a');
    expect(parsed.data.chain).toHaveLength(1);
    expect(parsed.data.chain[0].name).toBe('validateOrder');
    expect(parsed.data.chain[0].depth).toBe(1);
    expect(parsed.data.chain[0].children).toHaveLength(1);
    expect(parsed.data.chain[0].children[0].name).toBe('checkStock');
    expect(parsed.data.chain[0].children[0].depth).toBe(2);
  });

  it('should trace callees from a function_name', async () => {
    const result = await handler({ function_name: 'processOrder' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data.root.name).toBe('processOrder');
    expect(parsed.data.chain).toHaveLength(1);
    expect(parsed.data.chain[0].name).toBe('validateOrder');
  });

  it('should trace callers direction', async () => {
    const result = await handler({ unit_id: 'unit-a', direction: 'callers' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data.root.name).toBe('processOrder');
    expect(parsed.data.chain).toHaveLength(1);
    expect(parsed.data.chain[0].name).toBe('handleRequest');
    expect(parsed.data.chain[0].depth).toBe(1);
  });

  it('should respect depth limit', async () => {
    const result = await handler({ unit_id: 'unit-a', depth: 1 });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data.chain).toHaveLength(1);
    expect(parsed.data.chain[0].name).toBe('validateOrder');
    // Should NOT recurse deeper — children empty at depth 1
    expect(parsed.data.chain[0].children).toHaveLength(0);
  });

  it('should default direction to callees', async () => {
    const result = await handler({ unit_id: 'unit-b' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data.root.name).toBe('validateOrder');
    expect(parsed.data.chain).toHaveLength(1);
    expect(parsed.data.chain[0].name).toBe('checkStock');
  });

  it('should cap depth at 10', async () => {
    const result = await handler({ unit_id: 'unit-a', depth: 50 });
    const parsed = JSON.parse(result.content[0].text);

    // Should not error; just traces as deep as graph allows
    expect(parsed.data).toBeDefined();
  });

  it('should return empty chain when no calls exist', async () => {
    const result = await handler({ unit_id: 'unit-c' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data.root.name).toBe('checkStock');
    expect(parsed.data.chain).toHaveLength(0);
  });

  it('should return error when neither unit_id nor function_name provided', async () => {
    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('unit_id');
  });

  it('should return error when unit_id not found', async () => {
    const result = await handler({ unit_id: 'nonexistent' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });

  it('should return error when function_name not found', async () => {
    const result = await handler({ function_name: 'nonexistent' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });

  it('should include isAsync in chain nodes', async () => {
    const result = await handler({ unit_id: 'unit-a' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data.chain[0].isAsync).toBe(false);
    expect(parsed.data.chain[0].children[0].isAsync).toBe(true);
  });

  describe('include_source', () => {
    let fileSystem: InMemoryFileSystem;

    beforeEach(async () => {
      fileSystem = new InMemoryFileSystem();
      const orderLines = Array.from({ length: 30 }, (_, i) => `order-line-${i + 1}`);
      await fileSystem.writeFile('src/services/order.ts', orderLines.join('\n'));

      const validationLines = Array.from({ length: 20 }, (_, i) => `validation-line-${i + 1}`);
      await fileSystem.writeFile('src/services/validation.ts', validationLines.join('\n'));

      const inventoryLines = Array.from({ length: 15 }, (_, i) => `inventory-line-${i + 1}`);
      await fileSystem.writeFile('src/services/inventory.ts', inventoryLines.join('\n'));

      const apiLines = Array.from({ length: 40 }, (_, i) => `api-line-${i + 1}`);
      await fileSystem.writeFile('src/handlers/api.ts', apiLines.join('\n'));

      const tool = createTraceCallChainTool({ codeUnitRepo, functionCallRepo, fileSystem });
      handler = tool.handler;
    });

    it('should include source for chain nodes when include_source is true', async () => {
      const result = await handler({ unit_id: 'unit-a', include_source: true });
      const parsed = JSON.parse(result.content[0].text);

      // Callee validateOrder
      expect(parsed.data.chain[0].source).toBeDefined();
      expect(parsed.data.chain[0].source).toContain('validation-line-5');

      // Nested callee checkStock
      expect(parsed.data.chain[0].children[0].source).toBeDefined();
      expect(parsed.data.chain[0].children[0].source).toContain('inventory-line-1');
    });

    it('should include source for caller chain nodes', async () => {
      const result = await handler({ unit_id: 'unit-a', direction: 'callers', include_source: true });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.chain[0].source).toBeDefined();
      expect(parsed.data.chain[0].source).toContain('api-line-1');
    });

    it('should not include source when include_source is false', async () => {
      const result = await handler({ unit_id: 'unit-a', include_source: false });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.chain[0]).not.toHaveProperty('source');
    });

    it('should not include source when include_source is omitted', async () => {
      const result = await handler({ unit_id: 'unit-a' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.chain[0]).not.toHaveProperty('source');
    });
  });
});
