import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '@/adapters/storage/database.js';
import { SqliteEventFlowRepository } from '@/adapters/storage/sqlite-event-flow-repository.js';
import { SqliteCodeUnitRepository } from '@/adapters/storage/sqlite-code-unit-repository.js';
import { createEventFlow } from '@/domain/models/index.js';
import { CodeUnitType, createCodeUnit } from '@/domain/models/index.js';

function makeCodeUnit(id: string) {
  return createCodeUnit({
    id,
    filePath: 'src/index.ts',
    name: `unit-${id}`,
    unitType: CodeUnitType.FUNCTION,
    lineStart: 1,
    lineEnd: 10,
    isAsync: false,
    isExported: true,
    language: 'typescript',
  });
}

describe('SqliteEventFlowRepository', () => {
  let dbManager: DatabaseManager;
  let repo: SqliteEventFlowRepository;
  let codeUnitRepo: SqliteCodeUnitRepository;

  beforeEach(() => {
    dbManager = new DatabaseManager({ path: ':memory:', inMemory: true });
    dbManager.initialize();
    repo = new SqliteEventFlowRepository(dbManager.getDatabase());
    codeUnitRepo = new SqliteCodeUnitRepository(dbManager.getDatabase());
    codeUnitRepo.save(makeCodeUnit('unit-1'));
    codeUnitRepo.save(makeCodeUnit('unit-2'));
  });

  afterEach(() => {
    dbManager.close();
  });

  it('should save and find event flows by code unit id', () => {
    const flow = createEventFlow({
      id: 'ef-1',
      codeUnitId: 'unit-1',
      eventName: 'user.created',
      direction: 'emit',
      framework: 'EventEmitter',
      lineNumber: 15,
    });
    repo.save(flow);

    const found = repo.findByCodeUnitId('unit-1');
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe('ef-1');
    expect(found[0].codeUnitId).toBe('unit-1');
    expect(found[0].eventName).toBe('user.created');
    expect(found[0].direction).toBe('emit');
    expect(found[0].framework).toBe('EventEmitter');
    expect(found[0].lineNumber).toBe(15);
  });

  it('should find by event name', () => {
    repo.save(createEventFlow({ id: 'ef-1', codeUnitId: 'unit-1', eventName: 'order.placed', direction: 'emit', framework: 'EventEmitter', lineNumber: 5 }));
    repo.save(createEventFlow({ id: 'ef-2', codeUnitId: 'unit-2', eventName: 'order.placed', direction: 'subscribe', framework: 'EventEmitter', lineNumber: 10 }));

    const found = repo.findByEventName('order.placed');
    expect(found).toHaveLength(2);
  });

  it('should return empty array for non-existent event name', () => {
    expect(repo.findByEventName('non-existent')).toHaveLength(0);
  });

  it('should correctly store emit and subscribe directions', () => {
    repo.save(createEventFlow({ id: 'ef-1', codeUnitId: 'unit-1', eventName: 'data.updated', direction: 'emit', framework: 'RxJS', lineNumber: 5 }));
    repo.save(createEventFlow({ id: 'ef-2', codeUnitId: 'unit-2', eventName: 'data.updated', direction: 'subscribe', framework: 'RxJS', lineNumber: 10 }));

    const all = repo.findAll();
    const emitter = all.find(f => f.id === 'ef-1');
    const subscriber = all.find(f => f.id === 'ef-2');
    expect(emitter!.direction).toBe('emit');
    expect(subscriber!.direction).toBe('subscribe');
  });

  it('should save batch in transaction', () => {
    const flows = [
      createEventFlow({ id: 'ef-1', codeUnitId: 'unit-1', eventName: 'a', direction: 'emit', framework: 'EventEmitter', lineNumber: 1 }),
      createEventFlow({ id: 'ef-2', codeUnitId: 'unit-1', eventName: 'b', direction: 'subscribe', framework: 'Redis', lineNumber: 2 }),
      createEventFlow({ id: 'ef-3', codeUnitId: 'unit-2', eventName: 'c', direction: 'emit', framework: 'Kafka', lineNumber: 3 }),
    ];
    repo.saveBatch(flows);
    expect(repo.findAll()).toHaveLength(3);
  });

  it('should delete by code unit id', () => {
    repo.save(createEventFlow({ id: 'ef-1', codeUnitId: 'unit-1', eventName: 'a', direction: 'emit', framework: 'EventEmitter', lineNumber: 1 }));
    repo.save(createEventFlow({ id: 'ef-2', codeUnitId: 'unit-1', eventName: 'b', direction: 'subscribe', framework: 'EventEmitter', lineNumber: 2 }));
    repo.save(createEventFlow({ id: 'ef-3', codeUnitId: 'unit-2', eventName: 'c', direction: 'emit', framework: 'EventEmitter', lineNumber: 3 }));

    repo.deleteByCodeUnitId('unit-1');
    expect(repo.findAll()).toHaveLength(1);
    expect(repo.findByCodeUnitId('unit-1')).toHaveLength(0);
  });

  it('should clear all event flows', () => {
    repo.save(createEventFlow({ id: 'ef-1', codeUnitId: 'unit-1', eventName: 'a', direction: 'emit', framework: 'EventEmitter', lineNumber: 1 }));
    repo.save(createEventFlow({ id: 'ef-2', codeUnitId: 'unit-2', eventName: 'b', direction: 'subscribe', framework: 'EventEmitter', lineNumber: 2 }));

    repo.clear();
    expect(repo.findAll()).toHaveLength(0);
  });

  it('should overwrite existing flow on save with same id', () => {
    repo.save(createEventFlow({ id: 'ef-1', codeUnitId: 'unit-1', eventName: 'original', direction: 'emit', framework: 'EventEmitter', lineNumber: 1 }));
    repo.save(createEventFlow({ id: 'ef-1', codeUnitId: 'unit-1', eventName: 'updated', direction: 'subscribe', framework: 'Redis', lineNumber: 1 }));

    const all = repo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].eventName).toBe('updated');
    expect(all[0].direction).toBe('subscribe');
    expect(all[0].framework).toBe('Redis');
  });
});
