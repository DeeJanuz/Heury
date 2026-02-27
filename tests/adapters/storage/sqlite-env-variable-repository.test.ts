import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '@/adapters/storage/database.js';
import { SqliteEnvVariableRepository } from '@/adapters/storage/sqlite-env-variable-repository.js';
import { createEnvVariable } from '@/domain/models/index.js';

function makeEnvVariable(overrides: Partial<Parameters<typeof createEnvVariable>[0]> = {}) {
  return createEnvVariable({
    name: 'DATABASE_URL',
    lineNumber: 1,
    ...overrides,
  });
}

describe('SqliteEnvVariableRepository', () => {
  let dbManager: DatabaseManager;
  let repo: SqliteEnvVariableRepository;

  beforeEach(() => {
    dbManager = new DatabaseManager({ path: ':memory:', inMemory: true });
    dbManager.initialize();
    repo = new SqliteEnvVariableRepository(dbManager.getDatabase());
  });

  afterEach(() => {
    dbManager.close();
  });

  it('should save and find by name', () => {
    const envVar = makeEnvVariable({ id: 'e1', name: 'API_KEY', description: 'The API key', hasDefault: true });
    repo.save(envVar);
    const found = repo.findByName('API_KEY');
    expect(found).toBeDefined();
    expect(found!.id).toBe('e1');
    expect(found!.name).toBe('API_KEY');
    expect(found!.description).toBe('The API key');
    expect(found!.hasDefault).toBe(true);
    expect(found!.lineNumber).toBe(1);
  });

  it('should return undefined for non-existent name', () => {
    expect(repo.findByName('MISSING')).toBeUndefined();
  });

  it('should save batch and find all', () => {
    repo.saveBatch([
      makeEnvVariable({ name: 'A', lineNumber: 1 }),
      makeEnvVariable({ name: 'B', lineNumber: 2 }),
    ]);
    expect(repo.findAll()).toHaveLength(2);
  });

  it('should upsert on duplicate name', () => {
    repo.save(makeEnvVariable({ id: 'e1', name: 'API_KEY', lineNumber: 1 }));
    repo.save(makeEnvVariable({ id: 'e2', name: 'API_KEY', lineNumber: 5, description: 'updated' }));
    const all = repo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].lineNumber).toBe(5);
    expect(all[0].description).toBe('updated');
  });

  it('should clear all variables', () => {
    repo.save(makeEnvVariable());
    repo.clear();
    expect(repo.findAll()).toHaveLength(0);
  });
});
