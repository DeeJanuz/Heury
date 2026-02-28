import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '@/adapters/storage/database.js';
import { SqliteFunctionCallRepository } from '@/adapters/storage/sqlite-function-call-repository.js';
import { SqliteCodeUnitRepository } from '@/adapters/storage/sqlite-code-unit-repository.js';
import { createFunctionCall } from '@/domain/models/index.js';
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

describe('SqliteFunctionCallRepository', () => {
  let dbManager: DatabaseManager;
  let repo: SqliteFunctionCallRepository;
  let codeUnitRepo: SqliteCodeUnitRepository;

  beforeEach(() => {
    dbManager = new DatabaseManager({ path: ':memory:', inMemory: true });
    dbManager.initialize();
    repo = new SqliteFunctionCallRepository(dbManager.getDatabase());
    codeUnitRepo = new SqliteCodeUnitRepository(dbManager.getDatabase());
    // Insert code units for foreign key references
    codeUnitRepo.save(makeCodeUnit('caller-1'));
    codeUnitRepo.save(makeCodeUnit('caller-2'));
    codeUnitRepo.save(makeCodeUnit('callee-1'));
  });

  afterEach(() => {
    dbManager.close();
  });

  it('should save and find a function call by caller unit id', () => {
    const call = createFunctionCall({
      id: 'fc-1',
      callerUnitId: 'caller-1',
      calleeName: 'doSomething',
      lineNumber: 5,
      isAsync: false,
    });
    repo.save(call);

    const found = repo.findByCallerUnitId('caller-1');
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe('fc-1');
    expect(found[0].callerUnitId).toBe('caller-1');
    expect(found[0].calleeName).toBe('doSomething');
    expect(found[0].lineNumber).toBe(5);
    expect(found[0].isAsync).toBe(false);
  });

  it('should find by callee name', () => {
    repo.save(createFunctionCall({
      id: 'fc-1',
      callerUnitId: 'caller-1',
      calleeName: 'fetchData',
      lineNumber: 10,
      isAsync: true,
    }));
    repo.save(createFunctionCall({
      id: 'fc-2',
      callerUnitId: 'caller-2',
      calleeName: 'fetchData',
      lineNumber: 20,
      isAsync: false,
    }));

    const found = repo.findByCalleeName('fetchData');
    expect(found).toHaveLength(2);
  });

  it('should find by callee unit id', () => {
    repo.save(createFunctionCall({
      id: 'fc-1',
      callerUnitId: 'caller-1',
      calleeName: 'helper',
      calleeUnitId: 'callee-1',
      lineNumber: 3,
      isAsync: false,
    }));

    const found = repo.findByCalleeUnitId('callee-1');
    expect(found).toHaveLength(1);
    expect(found[0].calleeUnitId).toBe('callee-1');
  });

  it('should return empty array for non-existent callee unit id', () => {
    expect(repo.findByCalleeUnitId('non-existent')).toHaveLength(0);
  });

  it('should store and retrieve optional fields', () => {
    repo.save(createFunctionCall({
      id: 'fc-1',
      callerUnitId: 'caller-1',
      calleeName: 'helper',
      calleeFilePath: 'src/utils.ts',
      calleeUnitId: 'callee-1',
      lineNumber: 7,
      isAsync: true,
    }));

    const found = repo.findByCallerUnitId('caller-1');
    expect(found[0].calleeFilePath).toBe('src/utils.ts');
    expect(found[0].calleeUnitId).toBe('callee-1');
    expect(found[0].isAsync).toBe(true);
  });

  it('should handle undefined optional fields', () => {
    repo.save(createFunctionCall({
      id: 'fc-1',
      callerUnitId: 'caller-1',
      calleeName: 'helper',
      lineNumber: 7,
      isAsync: false,
    }));

    const found = repo.findByCallerUnitId('caller-1');
    expect(found[0].calleeFilePath).toBeUndefined();
    expect(found[0].calleeUnitId).toBeUndefined();
  });

  it('should save batch in transaction', () => {
    const calls = [
      createFunctionCall({ id: 'fc-1', callerUnitId: 'caller-1', calleeName: 'a', lineNumber: 1, isAsync: false }),
      createFunctionCall({ id: 'fc-2', callerUnitId: 'caller-1', calleeName: 'b', lineNumber: 2, isAsync: false }),
      createFunctionCall({ id: 'fc-3', callerUnitId: 'caller-2', calleeName: 'c', lineNumber: 3, isAsync: true }),
    ];
    repo.saveBatch(calls);
    expect(repo.findAll()).toHaveLength(3);
  });

  it('should delete by caller unit id', () => {
    repo.save(createFunctionCall({ id: 'fc-1', callerUnitId: 'caller-1', calleeName: 'a', lineNumber: 1, isAsync: false }));
    repo.save(createFunctionCall({ id: 'fc-2', callerUnitId: 'caller-1', calleeName: 'b', lineNumber: 2, isAsync: false }));
    repo.save(createFunctionCall({ id: 'fc-3', callerUnitId: 'caller-2', calleeName: 'c', lineNumber: 3, isAsync: false }));

    repo.deleteByCallerUnitId('caller-1');
    expect(repo.findAll()).toHaveLength(1);
    expect(repo.findByCallerUnitId('caller-1')).toHaveLength(0);
  });

  it('should clear all function calls', () => {
    repo.save(createFunctionCall({ id: 'fc-1', callerUnitId: 'caller-1', calleeName: 'a', lineNumber: 1, isAsync: false }));
    repo.save(createFunctionCall({ id: 'fc-2', callerUnitId: 'caller-2', calleeName: 'b', lineNumber: 2, isAsync: false }));

    repo.clear();
    expect(repo.findAll()).toHaveLength(0);
  });

  it('should overwrite existing call on save with same id', () => {
    repo.save(createFunctionCall({ id: 'fc-1', callerUnitId: 'caller-1', calleeName: 'original', lineNumber: 1, isAsync: false }));
    repo.save(createFunctionCall({ id: 'fc-1', callerUnitId: 'caller-1', calleeName: 'updated', lineNumber: 1, isAsync: true }));

    const all = repo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].calleeName).toBe('updated');
    expect(all[0].isAsync).toBe(true);
  });
});
