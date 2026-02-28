import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '@/adapters/storage/database.js';
import { SqliteTypeFieldRepository } from '@/adapters/storage/sqlite-type-field-repository.js';
import { SqliteCodeUnitRepository } from '@/adapters/storage/sqlite-code-unit-repository.js';
import { createTypeField } from '@/domain/models/index.js';
import { CodeUnitType, createCodeUnit } from '@/domain/models/index.js';

function makeCodeUnit(id: string) {
  return createCodeUnit({
    id,
    filePath: 'src/index.ts',
    name: `unit-${id}`,
    unitType: CodeUnitType.INTERFACE,
    lineStart: 1,
    lineEnd: 10,
    isAsync: false,
    isExported: true,
    language: 'typescript',
  });
}

describe('SqliteTypeFieldRepository', () => {
  let dbManager: DatabaseManager;
  let repo: SqliteTypeFieldRepository;
  let codeUnitRepo: SqliteCodeUnitRepository;

  beforeEach(() => {
    dbManager = new DatabaseManager({ path: ':memory:', inMemory: true });
    dbManager.initialize();
    repo = new SqliteTypeFieldRepository(dbManager.getDatabase());
    codeUnitRepo = new SqliteCodeUnitRepository(dbManager.getDatabase());
    codeUnitRepo.save(makeCodeUnit('parent-1'));
    codeUnitRepo.save(makeCodeUnit('parent-2'));
  });

  afterEach(() => {
    dbManager.close();
  });

  it('should save and find type fields by parent unit id', () => {
    const field = createTypeField({
      id: 'tf-1',
      parentUnitId: 'parent-1',
      name: 'username',
      fieldType: 'string',
      isOptional: false,
      isReadonly: true,
      lineNumber: 5,
    });
    repo.save(field);

    const found = repo.findByParentUnitId('parent-1');
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe('tf-1');
    expect(found[0].parentUnitId).toBe('parent-1');
    expect(found[0].name).toBe('username');
    expect(found[0].fieldType).toBe('string');
    expect(found[0].isOptional).toBe(false);
    expect(found[0].isReadonly).toBe(true);
    expect(found[0].lineNumber).toBe(5);
  });

  it('should return empty array for non-existent parent', () => {
    expect(repo.findByParentUnitId('non-existent')).toHaveLength(0);
  });

  it('should find multiple fields for same parent', () => {
    repo.save(createTypeField({ id: 'tf-1', parentUnitId: 'parent-1', name: 'id', fieldType: 'number', isOptional: false, isReadonly: true, lineNumber: 2 }));
    repo.save(createTypeField({ id: 'tf-2', parentUnitId: 'parent-1', name: 'name', fieldType: 'string', isOptional: true, isReadonly: false, lineNumber: 3 }));

    const found = repo.findByParentUnitId('parent-1');
    expect(found).toHaveLength(2);
  });

  it('should save batch in transaction', () => {
    const fields = [
      createTypeField({ id: 'tf-1', parentUnitId: 'parent-1', name: 'a', fieldType: 'string', isOptional: false, isReadonly: false, lineNumber: 1 }),
      createTypeField({ id: 'tf-2', parentUnitId: 'parent-1', name: 'b', fieldType: 'number', isOptional: true, isReadonly: true, lineNumber: 2 }),
      createTypeField({ id: 'tf-3', parentUnitId: 'parent-2', name: 'c', fieldType: 'boolean', isOptional: false, isReadonly: false, lineNumber: 3 }),
    ];
    repo.saveBatch(fields);
    expect(repo.findAll()).toHaveLength(3);
  });

  it('should delete by parent unit id', () => {
    repo.save(createTypeField({ id: 'tf-1', parentUnitId: 'parent-1', name: 'a', fieldType: 'string', isOptional: false, isReadonly: false, lineNumber: 1 }));
    repo.save(createTypeField({ id: 'tf-2', parentUnitId: 'parent-1', name: 'b', fieldType: 'number', isOptional: false, isReadonly: false, lineNumber: 2 }));
    repo.save(createTypeField({ id: 'tf-3', parentUnitId: 'parent-2', name: 'c', fieldType: 'boolean', isOptional: false, isReadonly: false, lineNumber: 3 }));

    repo.deleteByParentUnitId('parent-1');
    expect(repo.findAll()).toHaveLength(1);
    expect(repo.findByParentUnitId('parent-1')).toHaveLength(0);
  });

  it('should clear all type fields', () => {
    repo.save(createTypeField({ id: 'tf-1', parentUnitId: 'parent-1', name: 'a', fieldType: 'string', isOptional: false, isReadonly: false, lineNumber: 1 }));
    repo.save(createTypeField({ id: 'tf-2', parentUnitId: 'parent-2', name: 'b', fieldType: 'number', isOptional: false, isReadonly: false, lineNumber: 2 }));

    repo.clear();
    expect(repo.findAll()).toHaveLength(0);
  });

  it('should overwrite existing field on save with same id', () => {
    repo.save(createTypeField({ id: 'tf-1', parentUnitId: 'parent-1', name: 'original', fieldType: 'string', isOptional: false, isReadonly: false, lineNumber: 1 }));
    repo.save(createTypeField({ id: 'tf-1', parentUnitId: 'parent-1', name: 'updated', fieldType: 'number', isOptional: true, isReadonly: true, lineNumber: 1 }));

    const all = repo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('updated');
    expect(all[0].fieldType).toBe('number');
    expect(all[0].isOptional).toBe(true);
    expect(all[0].isReadonly).toBe(true);
  });
});
