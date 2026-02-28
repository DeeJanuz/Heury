import { describe, it, expect, beforeEach } from 'vitest';
import { createGetFunctionContextTool } from '@/adapters/mcp/tools/get-function-context.js';
import {
  InMemoryCodeUnitRepository,
  InMemoryFunctionCallRepository,
  InMemoryTypeFieldRepository,
  InMemoryEventFlowRepository,
} from '../../../../tests/helpers/fakes/index.js';
import {
  createCodeUnit,
  CodeUnitType,
  createFunctionCall,
  createTypeField,
  createEventFlow,
  createUnitSummary,
} from '@/domain/models/index.js';
import type { IUnitSummaryRepository } from '@/domain/ports/index.js';

describe('get-function-context tool', () => {
  let codeUnitRepo: InMemoryCodeUnitRepository;
  let functionCallRepo: InMemoryFunctionCallRepository;
  let typeFieldRepo: InMemoryTypeFieldRepository;
  let eventFlowRepo: InMemoryEventFlowRepository;
  let handler: ReturnType<typeof createGetFunctionContextTool>['handler'];

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
    complexityScore: 25,
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
  });

  const unitC = createCodeUnit({
    id: 'unit-c',
    filePath: 'src/handlers/api.ts',
    name: 'handleRequest',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 40,
    isAsync: true,
    isExported: true,
    language: 'typescript',
  });

  const unitD = createCodeUnit({
    id: 'unit-d',
    filePath: 'src/models/order.ts',
    name: 'OrderInterface',
    unitType: CodeUnitType.INTERFACE,
    lineStart: 1,
    lineEnd: 15,
    isAsync: false,
    isExported: true,
    language: 'typescript',
  });

  beforeEach(() => {
    codeUnitRepo = new InMemoryCodeUnitRepository();
    functionCallRepo = new InMemoryFunctionCallRepository();
    typeFieldRepo = new InMemoryTypeFieldRepository();
    eventFlowRepo = new InMemoryEventFlowRepository();
    const tool = createGetFunctionContextTool({
      codeUnitRepo,
      functionCallRepo,
      typeFieldRepo,
      eventFlowRepo,
    });
    handler = tool.handler;

    codeUnitRepo.save(unitA);
    codeUnitRepo.save(unitB);
    codeUnitRepo.save(unitC);
    codeUnitRepo.save(unitD);

    // processOrder calls validateOrder (outgoing)
    functionCallRepo.save(createFunctionCall({
      callerUnitId: 'unit-a',
      calleeName: 'validateOrder',
      calleeUnitId: 'unit-b',
      lineNumber: 12,
      isAsync: false,
    }));

    // handleRequest calls processOrder (incoming to processOrder)
    functionCallRepo.save(createFunctionCall({
      callerUnitId: 'unit-c',
      calleeName: 'processOrder',
      calleeUnitId: 'unit-a',
      lineNumber: 15,
      isAsync: true,
    }));

    // processOrder emits an event
    eventFlowRepo.save(createEventFlow({
      codeUnitId: 'unit-a',
      eventName: 'order-placed',
      direction: 'emit',
      framework: 'node-events',
      lineNumber: 25,
    }));

    // OrderInterface has type fields
    typeFieldRepo.save(createTypeField({
      parentUnitId: 'unit-d',
      name: 'orderId',
      fieldType: 'string',
      isOptional: false,
      isReadonly: true,
      lineNumber: 3,
    }));
    typeFieldRepo.save(createTypeField({
      parentUnitId: 'unit-d',
      name: 'total',
      fieldType: 'number',
      isOptional: false,
      isReadonly: false,
      lineNumber: 4,
    }));
  });

  it('should have correct tool definition', () => {
    const tool = createGetFunctionContextTool({
      codeUnitRepo,
      functionCallRepo,
      typeFieldRepo,
      eventFlowRepo,
    });
    expect(tool.definition.name).toBe('get-function-context');
    expect(tool.definition.inputSchema).toBeDefined();
  });

  it('should return full context for a function by unit_id', async () => {
    const result = await handler({ unit_id: 'unit-a' });
    const parsed = JSON.parse(result.content[0].text);

    // Unit info
    expect(parsed.data.unit.name).toBe('processOrder');
    expect(parsed.data.unit.unitType).toBe('FUNCTION');
    expect(parsed.data.unit.filePath).toBe('src/services/order.ts');
    expect(parsed.data.unit.signature).toBe('async function processOrder(order: Order): Promise<void>');
    expect(parsed.data.unit.isAsync).toBe(true);
    expect(parsed.data.unit.isExported).toBe(true);
    expect(parsed.data.unit.complexityScore).toBe(25);

    // Outgoing calls
    expect(parsed.data.outgoingCalls).toHaveLength(1);
    expect(parsed.data.outgoingCalls[0].calleeName).toBe('validateOrder');
    expect(parsed.data.outgoingCalls[0].isAsync).toBe(false);

    // Incoming calls
    expect(parsed.data.incomingCalls).toHaveLength(1);
    expect(parsed.data.incomingCalls[0].callerName).toBe('handleRequest');
    expect(parsed.data.incomingCalls[0].callerFilePath).toBe('src/handlers/api.ts');

    // Event flows
    expect(parsed.data.eventFlows).toHaveLength(1);
    expect(parsed.data.eventFlows[0].eventName).toBe('order-placed');
    expect(parsed.data.eventFlows[0].direction).toBe('emit');

    // Type fields empty for a function
    expect(parsed.data.typeFields).toHaveLength(0);

    // No summary repo provided
    expect(parsed.data.summary).toBeNull();
  });

  it('should return full context for a function by function_name', async () => {
    const result = await handler({ function_name: 'processOrder' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data.unit.name).toBe('processOrder');
    expect(parsed.data.outgoingCalls).toHaveLength(1);
    expect(parsed.data.incomingCalls).toHaveLength(1);
  });

  it('should disambiguate function_name with file_path', async () => {
    // Add another function with the same name in a different file
    codeUnitRepo.save(createCodeUnit({
      id: 'unit-dup',
      filePath: 'src/other/order.ts',
      name: 'processOrder',
      unitType: CodeUnitType.FUNCTION,
      lineStart: 1,
      lineEnd: 10,
      isAsync: false,
      isExported: false,
      language: 'typescript',
    }));

    const result = await handler({ function_name: 'processOrder', file_path: 'src/services/order.ts' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data.unit.filePath).toBe('src/services/order.ts');
    expect(parsed.data.unit.isAsync).toBe(true);
  });

  it('should return type fields for interface/class', async () => {
    const result = await handler({ unit_id: 'unit-d' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data.unit.name).toBe('OrderInterface');
    expect(parsed.data.typeFields).toHaveLength(2);
    expect(parsed.data.typeFields[0].name).toBe('orderId');
    expect(parsed.data.typeFields[0].fieldType).toBe('string');
    expect(parsed.data.typeFields[1].name).toBe('total');
  });

  it('should include summary when unitSummaryRepo is provided', async () => {
    const summary = createUnitSummary({
      codeUnitId: 'unit-a',
      summary: 'Processes incoming orders and validates them.',
      keyBehaviors: ['validates order', 'emits order-placed event'],
      sideEffects: ['writes to database'],
      providerModel: 'gpt-4',
      generatedAt: '2024-01-01T00:00:00Z',
    });

    const fakeSummaryRepo: IUnitSummaryRepository = {
      save: () => {},
      saveBatch: () => {},
      findByCodeUnitId: (id: string) => id === 'unit-a' ? summary : undefined,
      findAll: () => [summary],
      deleteByCodeUnitId: () => {},
      clear: () => {},
    };

    const tool = createGetFunctionContextTool({
      codeUnitRepo,
      functionCallRepo,
      typeFieldRepo,
      eventFlowRepo,
      unitSummaryRepo: fakeSummaryRepo,
    });

    const result = await tool.handler({ unit_id: 'unit-a' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data.summary).toBeDefined();
    expect(parsed.data.summary.summary).toBe('Processes incoming orders and validates them.');
    expect(parsed.data.summary.keyBehaviors).toEqual(['validates order', 'emits order-placed event']);
    expect(parsed.data.summary.sideEffects).toEqual(['writes to database']);
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

  it('should return empty collections when function has no calls or events', async () => {
    const result = await handler({ unit_id: 'unit-b' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data.unit.name).toBe('validateOrder');
    expect(parsed.data.outgoingCalls).toHaveLength(0);
    // validateOrder is called by processOrder
    expect(parsed.data.incomingCalls).toHaveLength(1);
    expect(parsed.data.eventFlows).toHaveLength(0);
    expect(parsed.data.typeFields).toHaveLength(0);
  });
});
