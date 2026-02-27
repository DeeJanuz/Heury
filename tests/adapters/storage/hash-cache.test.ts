import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '@/adapters/storage/database.js';
import { FileHashCache } from '@/adapters/storage/hash-cache.js';

describe('FileHashCache', () => {
  let dbManager: DatabaseManager;
  let cache: FileHashCache;

  beforeEach(() => {
    dbManager = new DatabaseManager({ path: ':memory:', inMemory: true });
    dbManager.initialize();
    cache = new FileHashCache(dbManager.getDatabase());
  });

  afterEach(() => {
    dbManager.close();
  });

  it('should set and get a hash', () => {
    cache.setHash('src/index.ts', 'abc123');
    expect(cache.getHash('src/index.ts')).toBe('abc123');
  });

  it('should return undefined for unknown file', () => {
    expect(cache.getHash('missing.ts')).toBeUndefined();
  });

  it('should report hasChanged as true for different hash', () => {
    cache.setHash('src/index.ts', 'abc123');
    expect(cache.hasChanged('src/index.ts', 'def456')).toBe(true);
  });

  it('should report hasChanged as false for same hash', () => {
    cache.setHash('src/index.ts', 'abc123');
    expect(cache.hasChanged('src/index.ts', 'abc123')).toBe(false);
  });

  it('should report hasChanged as true for unknown file', () => {
    expect(cache.hasChanged('missing.ts', 'abc123')).toBe(true);
  });

  it('should return all analyzed files', () => {
    cache.setHash('src/a.ts', 'h1');
    cache.setHash('src/b.ts', 'h2');
    cache.setHash('src/c.ts', 'h3');
    const files = cache.getAnalyzedFiles();
    expect(files).toHaveLength(3);
    expect(files).toContain('src/a.ts');
    expect(files).toContain('src/b.ts');
    expect(files).toContain('src/c.ts');
  });

  it('should remove a hash', () => {
    cache.setHash('src/index.ts', 'abc123');
    cache.remove('src/index.ts');
    expect(cache.getHash('src/index.ts')).toBeUndefined();
  });

  it('should clear all hashes', () => {
    cache.setHash('src/a.ts', 'h1');
    cache.setHash('src/b.ts', 'h2');
    cache.clear();
    expect(cache.getAnalyzedFiles()).toHaveLength(0);
  });
});
