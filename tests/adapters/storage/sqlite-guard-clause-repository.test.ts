import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '@/adapters/storage/database.js';
import { SqliteGuardClauseRepository } from '@/adapters/storage/sqlite-guard-clause-repository.js';
import { SqliteCodeUnitRepository } from '@/adapters/storage/sqlite-code-unit-repository.js';
import { createGuardClause } from '@/domain/models/index.js';
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

describe('SqliteGuardClauseRepository', () => {
  let dbManager: DatabaseManager;
  let repo: SqliteGuardClauseRepository;
  let codeUnitRepo: SqliteCodeUnitRepository;

  beforeEach(() => {
    dbManager = new DatabaseManager({ path: ':memory:', inMemory: true });
    dbManager.initialize();
    repo = new SqliteGuardClauseRepository(dbManager.getDatabase());
    codeUnitRepo = new SqliteCodeUnitRepository(dbManager.getDatabase());
    // Insert code units for foreign key references
    codeUnitRepo.save(makeCodeUnit('unit-1'));
    codeUnitRepo.save(makeCodeUnit('unit-2'));
  });

  afterEach(() => {
    dbManager.close();
  });

  it('should save and find a guard clause by code unit id', () => {
    const guard = createGuardClause({
      id: 'gc-1',
      codeUnitId: 'unit-1',
      guardType: 'early-return',
      condition: 'x === null',
      lineNumber: 5,
    });
    repo.save(guard);

    const found = repo.findByCodeUnitId('unit-1');
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe('gc-1');
    expect(found[0].codeUnitId).toBe('unit-1');
    expect(found[0].guardType).toBe('early-return');
    expect(found[0].condition).toBe('x === null');
    expect(found[0].lineNumber).toBe(5);
  });

  it('should find by guard type', () => {
    repo.save(createGuardClause({
      id: 'gc-1',
      codeUnitId: 'unit-1',
      guardType: 'throw',
      condition: 'Error',
      lineNumber: 10,
    }));
    repo.save(createGuardClause({
      id: 'gc-2',
      codeUnitId: 'unit-2',
      guardType: 'throw',
      condition: 'TypeError',
      lineNumber: 20,
    }));
    repo.save(createGuardClause({
      id: 'gc-3',
      codeUnitId: 'unit-1',
      guardType: 'early-return',
      condition: '!x',
      lineNumber: 3,
    }));

    const found = repo.findByGuardType('throw');
    expect(found).toHaveLength(2);
  });

  it('should return empty array for non-existent code unit id', () => {
    expect(repo.findByCodeUnitId('non-existent')).toHaveLength(0);
  });

  it('should return empty array for non-existent guard type', () => {
    expect(repo.findByGuardType('non-existent')).toHaveLength(0);
  });

  it('should save batch in transaction', () => {
    const guards = [
      createGuardClause({ id: 'gc-1', codeUnitId: 'unit-1', guardType: 'early-return', condition: '!a', lineNumber: 1 }),
      createGuardClause({ id: 'gc-2', codeUnitId: 'unit-1', guardType: 'throw', condition: 'Error', lineNumber: 2 }),
      createGuardClause({ id: 'gc-3', codeUnitId: 'unit-2', guardType: 'type-guard', condition: 'typeof x === "string"', lineNumber: 3 }),
    ];
    repo.saveBatch(guards);
    expect(repo.findAll()).toHaveLength(3);
  });

  it('should delete by code unit id', () => {
    repo.save(createGuardClause({ id: 'gc-1', codeUnitId: 'unit-1', guardType: 'early-return', condition: '!a', lineNumber: 1 }));
    repo.save(createGuardClause({ id: 'gc-2', codeUnitId: 'unit-1', guardType: 'throw', condition: 'Error', lineNumber: 2 }));
    repo.save(createGuardClause({ id: 'gc-3', codeUnitId: 'unit-2', guardType: 'assertion', condition: 'assert(x)', lineNumber: 3 }));

    repo.deleteByCodeUnitId('unit-1');
    expect(repo.findAll()).toHaveLength(1);
    expect(repo.findByCodeUnitId('unit-1')).toHaveLength(0);
  });

  it('should clear all guard clauses', () => {
    repo.save(createGuardClause({ id: 'gc-1', codeUnitId: 'unit-1', guardType: 'early-return', condition: '!a', lineNumber: 1 }));
    repo.save(createGuardClause({ id: 'gc-2', codeUnitId: 'unit-2', guardType: 'throw', condition: 'Error', lineNumber: 2 }));

    repo.clear();
    expect(repo.findAll()).toHaveLength(0);
  });

  it('should overwrite existing guard on save with same id', () => {
    repo.save(createGuardClause({ id: 'gc-1', codeUnitId: 'unit-1', guardType: 'early-return', condition: 'original', lineNumber: 1 }));
    repo.save(createGuardClause({ id: 'gc-1', codeUnitId: 'unit-1', guardType: 'throw', condition: 'updated', lineNumber: 5 }));

    const all = repo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].guardType).toBe('throw');
    expect(all[0].condition).toBe('updated');
    expect(all[0].lineNumber).toBe(5);
  });
});
