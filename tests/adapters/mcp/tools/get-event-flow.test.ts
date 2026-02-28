import { describe, it, expect, beforeEach } from 'vitest';
import { createGetEventFlowTool } from '@/adapters/mcp/tools/get-event-flow.js';
import { InMemoryCodeUnitRepository, InMemoryEventFlowRepository } from '../../../../tests/helpers/fakes/index.js';
import { createCodeUnit, CodeUnitType, createEventFlow } from '@/domain/models/index.js';

describe('get-event-flow tool', () => {
  let codeUnitRepo: InMemoryCodeUnitRepository;
  let eventFlowRepo: InMemoryEventFlowRepository;
  let handler: ReturnType<typeof createGetEventFlowTool>['handler'];

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
  });

  const unitB = createCodeUnit({
    id: 'unit-b',
    filePath: 'src/handlers/notification.ts',
    name: 'onOrderPlaced',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 5,
    lineEnd: 20,
    isAsync: true,
    isExported: true,
    language: 'typescript',
  });

  const unitC = createCodeUnit({
    id: 'unit-c',
    filePath: 'src/services/socket.ts',
    name: 'handleConnection',
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 40,
    isAsync: true,
    isExported: true,
    language: 'typescript',
  });

  beforeEach(() => {
    codeUnitRepo = new InMemoryCodeUnitRepository();
    eventFlowRepo = new InMemoryEventFlowRepository();
    const tool = createGetEventFlowTool({ codeUnitRepo, eventFlowRepo });
    handler = tool.handler;

    codeUnitRepo.save(unitA);
    codeUnitRepo.save(unitB);
    codeUnitRepo.save(unitC);

    eventFlowRepo.save(createEventFlow({
      codeUnitId: 'unit-a',
      eventName: 'order-placed',
      direction: 'emit',
      framework: 'node-events',
      lineNumber: 15,
    }));

    eventFlowRepo.save(createEventFlow({
      codeUnitId: 'unit-b',
      eventName: 'order-placed',
      direction: 'subscribe',
      framework: 'node-events',
      lineNumber: 8,
    }));

    eventFlowRepo.save(createEventFlow({
      codeUnitId: 'unit-c',
      eventName: 'connection',
      direction: 'subscribe',
      framework: 'socket.io',
      lineNumber: 5,
    }));
  });

  it('should have correct tool definition', () => {
    const tool = createGetEventFlowTool({ codeUnitRepo, eventFlowRepo });
    expect(tool.definition.name).toBe('get-event-flow');
    expect(tool.definition.inputSchema).toBeDefined();
  });

  it('should return all event flows when no filters', async () => {
    const result = await handler({});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(3);
    expect(parsed.meta.result_count).toBe(3);
  });

  it('should filter by event_name', async () => {
    const result = await handler({ event_name: 'order-placed' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(2);
    expect(parsed.data.every((f: any) => f.eventName === 'order-placed')).toBe(true);
  });

  it('should filter by direction', async () => {
    const result = await handler({ direction: 'emit' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].direction).toBe('emit');
    expect(parsed.data[0].functionName).toBe('processOrder');
  });

  it('should filter by framework', async () => {
    const result = await handler({ framework: 'socket.io' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].framework).toBe('socket.io');
    expect(parsed.data[0].functionName).toBe('handleConnection');
  });

  it('should filter by unit_id', async () => {
    const result = await handler({ unit_id: 'unit-a' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].eventName).toBe('order-placed');
    expect(parsed.data[0].direction).toBe('emit');
  });

  it('should combine multiple filters', async () => {
    const result = await handler({ event_name: 'order-placed', direction: 'subscribe' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].functionName).toBe('onOrderPlaced');
  });

  it('should return empty array when no matches', async () => {
    const result = await handler({ event_name: 'nonexistent' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data).toHaveLength(0);
    expect(parsed.meta.result_count).toBe(0);
  });

  it('should enrich with code unit context', async () => {
    const result = await handler({ event_name: 'order-placed', direction: 'emit' });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.data[0].functionName).toBe('processOrder');
    expect(parsed.data[0].filePath).toBe('src/services/order.ts');
    expect(parsed.data[0].lineNumber).toBe(15);
  });
});
