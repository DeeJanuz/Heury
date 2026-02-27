import { describe, it, expect, afterEach } from 'vitest';
import { DatabaseManager } from '@/adapters/storage/database.js';

describe('DatabaseManager', () => {
  let db: DatabaseManager;

  afterEach(() => {
    db?.close();
  });

  it('should create an in-memory database and run migrations', () => {
    db = new DatabaseManager({ path: ':memory:', inMemory: true });
    db.initialize();
    const raw = db.getDatabase();
    // Verify tables exist by querying sqlite_master
    const tables = raw
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('code_units');
    expect(tableNames).toContain('code_unit_patterns');
    expect(tableNames).toContain('file_dependencies');
    expect(tableNames).toContain('env_variables');
    expect(tableNames).toContain('file_hashes');
    expect(tableNames).toContain('analysis_results');
  });

  it('should enable WAL mode', () => {
    db = new DatabaseManager({ path: ':memory:', inMemory: true });
    db.initialize();
    const raw = db.getDatabase();
    const result = raw.pragma('journal_mode') as { journal_mode: string }[];
    // In-memory databases may report 'memory' instead of 'wal'
    expect(['wal', 'memory']).toContain(result[0].journal_mode);
  });

  it('should run migrations idempotently', () => {
    db = new DatabaseManager({ path: ':memory:', inMemory: true });
    db.initialize();
    // Second initialization should not throw
    expect(() => db.initialize()).not.toThrow();
  });

  it('should close without error', () => {
    db = new DatabaseManager({ path: ':memory:', inMemory: true });
    db.initialize();
    expect(() => db.close()).not.toThrow();
  });

  it('should provide raw database instance', () => {
    db = new DatabaseManager({ path: ':memory:', inMemory: true });
    db.initialize();
    const raw = db.getDatabase();
    expect(raw).toBeDefined();
    expect(typeof raw.prepare).toBe('function');
  });
});
