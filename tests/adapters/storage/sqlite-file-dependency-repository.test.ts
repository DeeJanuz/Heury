import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '@/adapters/storage/database.js';
import { SqliteFileDependencyRepository } from '@/adapters/storage/sqlite-file-dependency-repository.js';
import { ImportType, createFileDependency } from '@/domain/models/index.js';

function makeFileDependency(overrides: Partial<Parameters<typeof createFileDependency>[0]> = {}) {
  return createFileDependency({
    sourceFile: 'src/a.ts',
    targetFile: 'src/b.ts',
    importType: ImportType.NAMED,
    ...overrides,
  });
}

describe('SqliteFileDependencyRepository', () => {
  let dbManager: DatabaseManager;
  let repo: SqliteFileDependencyRepository;

  beforeEach(() => {
    dbManager = new DatabaseManager({ path: ':memory:', inMemory: true });
    dbManager.initialize();
    repo = new SqliteFileDependencyRepository(dbManager.getDatabase());
  });

  afterEach(() => {
    dbManager.close();
  });

  it('should save and find by source file', () => {
    const dep = makeFileDependency({ id: 'd1', sourceFile: 'src/a.ts' });
    repo.save(dep);
    const found = repo.findBySourceFile('src/a.ts');
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe('d1');
    expect(found[0].sourceFile).toBe('src/a.ts');
    expect(found[0].targetFile).toBe('src/b.ts');
    expect(found[0].importType).toBe(ImportType.NAMED);
  });

  it('should find by target file', () => {
    repo.save(makeFileDependency({ id: 'd1', targetFile: 'src/b.ts' }));
    expect(repo.findByTargetFile('src/b.ts')).toHaveLength(1);
    expect(repo.findByTargetFile('src/c.ts')).toHaveLength(0);
  });

  it('should save batch and find all', () => {
    repo.saveBatch([
      makeFileDependency({ id: 'd1', sourceFile: 'src/a.ts', targetFile: 'src/b.ts' }),
      makeFileDependency({ id: 'd2', sourceFile: 'src/c.ts', targetFile: 'src/d.ts' }),
    ]);
    expect(repo.findAll()).toHaveLength(2);
  });

  it('should delete by source file', () => {
    repo.save(makeFileDependency({ id: 'd1', sourceFile: 'src/a.ts' }));
    repo.save(makeFileDependency({ id: 'd2', sourceFile: 'src/b.ts', targetFile: 'src/c.ts' }));
    repo.deleteBySourceFile('src/a.ts');
    expect(repo.findAll()).toHaveLength(1);
    expect(repo.findBySourceFile('src/a.ts')).toHaveLength(0);
  });

  it('should upsert on duplicate source+target', () => {
    repo.save(
      makeFileDependency({
        id: 'd1',
        sourceFile: 'src/a.ts',
        targetFile: 'src/b.ts',
        importType: ImportType.NAMED,
        importedNames: ['foo'],
      }),
    );
    repo.save(
      makeFileDependency({
        id: 'd2',
        sourceFile: 'src/a.ts',
        targetFile: 'src/b.ts',
        importType: ImportType.DEFAULT,
        importedNames: ['bar'],
      }),
    );
    const all = repo.findAll();
    expect(all).toHaveLength(1);
    // The second save should have replaced the first
    expect(all[0].importType).toBe(ImportType.DEFAULT);
    expect(all[0].importedNames).toEqual(['bar']);
  });

  it('should store and retrieve imported names', () => {
    repo.save(
      makeFileDependency({
        id: 'd1',
        importedNames: ['useState', 'useEffect', 'useMemo'],
      }),
    );
    const found = repo.findBySourceFile('src/a.ts');
    expect(found[0].importedNames).toEqual(['useState', 'useEffect', 'useMemo']);
  });

  it('should clear all dependencies', () => {
    repo.save(makeFileDependency({ id: 'd1' }));
    repo.clear();
    expect(repo.findAll()).toHaveLength(0);
  });
});
