import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '@/adapters/storage/database.js';
import { SqliteUnitSummaryRepository } from '@/adapters/storage/sqlite-unit-summary-repository.js';
import { SqliteCodeUnitRepository } from '@/adapters/storage/sqlite-code-unit-repository.js';
import { createUnitSummary } from '@/domain/models/index.js';
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

describe('SqliteUnitSummaryRepository', () => {
  let dbManager: DatabaseManager;
  let repo: SqliteUnitSummaryRepository;
  let codeUnitRepo: SqliteCodeUnitRepository;

  beforeEach(() => {
    dbManager = new DatabaseManager({ path: ':memory:', inMemory: true });
    dbManager.initialize();
    repo = new SqliteUnitSummaryRepository(dbManager.getDatabase());
    codeUnitRepo = new SqliteCodeUnitRepository(dbManager.getDatabase());
    codeUnitRepo.save(makeCodeUnit('unit-1'));
    codeUnitRepo.save(makeCodeUnit('unit-2'));
    codeUnitRepo.save(makeCodeUnit('unit-3'));
  });

  afterEach(() => {
    dbManager.close();
  });

  it('should save and find a unit summary by code unit id', () => {
    const summary = createUnitSummary({
      id: 'us-1',
      codeUnitId: 'unit-1',
      summary: 'Handles user authentication',
      keyBehaviors: ['validates token', 'checks expiry'],
      sideEffects: ['writes to session store'],
      providerModel: 'gpt-4',
      generatedAt: '2024-01-15T10:00:00Z',
    });
    repo.save(summary);

    const found = repo.findByCodeUnitId('unit-1');
    expect(found).toBeDefined();
    expect(found!.id).toBe('us-1');
    expect(found!.codeUnitId).toBe('unit-1');
    expect(found!.summary).toBe('Handles user authentication');
    expect(found!.keyBehaviors).toEqual(['validates token', 'checks expiry']);
    expect(found!.sideEffects).toEqual(['writes to session store']);
    expect(found!.providerModel).toBe('gpt-4');
    expect(found!.generatedAt).toBe('2024-01-15T10:00:00Z');
  });

  it('should return undefined for non-existent code unit id', () => {
    expect(repo.findByCodeUnitId('non-existent')).toBeUndefined();
  });

  it('should store empty arrays for key behaviors and side effects', () => {
    repo.save(createUnitSummary({
      id: 'us-1',
      codeUnitId: 'unit-1',
      summary: 'Simple function',
      providerModel: 'gpt-4',
      generatedAt: '2024-01-15T10:00:00Z',
    }));

    const found = repo.findByCodeUnitId('unit-1');
    expect(found!.keyBehaviors).toEqual([]);
    expect(found!.sideEffects).toEqual([]);
  });

  it('should save batch in transaction', () => {
    const summaries = [
      createUnitSummary({ id: 'us-1', codeUnitId: 'unit-1', summary: 'Summary 1', providerModel: 'gpt-4', generatedAt: '2024-01-15T10:00:00Z' }),
      createUnitSummary({ id: 'us-2', codeUnitId: 'unit-2', summary: 'Summary 2', providerModel: 'gpt-4', generatedAt: '2024-01-15T10:00:00Z' }),
      createUnitSummary({ id: 'us-3', codeUnitId: 'unit-3', summary: 'Summary 3', providerModel: 'claude-3', generatedAt: '2024-01-15T10:00:00Z' }),
    ];
    repo.saveBatch(summaries);
    expect(repo.findAll()).toHaveLength(3);
  });

  it('should delete by code unit id', () => {
    repo.save(createUnitSummary({ id: 'us-1', codeUnitId: 'unit-1', summary: 'S1', providerModel: 'gpt-4', generatedAt: '2024-01-15T10:00:00Z' }));
    repo.save(createUnitSummary({ id: 'us-2', codeUnitId: 'unit-2', summary: 'S2', providerModel: 'gpt-4', generatedAt: '2024-01-15T10:00:00Z' }));

    repo.deleteByCodeUnitId('unit-1');
    expect(repo.findAll()).toHaveLength(1);
    expect(repo.findByCodeUnitId('unit-1')).toBeUndefined();
  });

  it('should clear all unit summaries', () => {
    repo.save(createUnitSummary({ id: 'us-1', codeUnitId: 'unit-1', summary: 'S1', providerModel: 'gpt-4', generatedAt: '2024-01-15T10:00:00Z' }));
    repo.save(createUnitSummary({ id: 'us-2', codeUnitId: 'unit-2', summary: 'S2', providerModel: 'gpt-4', generatedAt: '2024-01-15T10:00:00Z' }));

    repo.clear();
    expect(repo.findAll()).toHaveLength(0);
  });

  it('should overwrite existing summary on save with same code unit id', () => {
    repo.save(createUnitSummary({
      id: 'us-1',
      codeUnitId: 'unit-1',
      summary: 'Original summary',
      providerModel: 'gpt-4',
      generatedAt: '2024-01-15T10:00:00Z',
    }));
    repo.save(createUnitSummary({
      id: 'us-2',
      codeUnitId: 'unit-1',
      summary: 'Updated summary',
      keyBehaviors: ['new behavior'],
      providerModel: 'claude-3',
      generatedAt: '2024-02-01T10:00:00Z',
    }));

    const found = repo.findByCodeUnitId('unit-1');
    expect(found!.summary).toBe('Updated summary');
    expect(found!.providerModel).toBe('claude-3');
    expect(found!.keyBehaviors).toEqual(['new behavior']);

    // Only one summary per code unit due to UNIQUE constraint
    expect(repo.findAll()).toHaveLength(1);
  });

  it('should correctly serialize and deserialize JSON arrays', () => {
    const behaviors = ['reads config', 'validates input', 'transforms data'];
    const effects = ['writes to DB', 'sends email', 'logs metrics'];

    repo.save(createUnitSummary({
      id: 'us-1',
      codeUnitId: 'unit-1',
      summary: 'Complex function',
      keyBehaviors: behaviors,
      sideEffects: effects,
      providerModel: 'gpt-4',
      generatedAt: '2024-01-15T10:00:00Z',
    }));

    const found = repo.findByCodeUnitId('unit-1');
    expect(found!.keyBehaviors).toEqual(behaviors);
    expect(found!.sideEffects).toEqual(effects);
  });
});
