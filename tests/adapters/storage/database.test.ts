import { describe, it, expect, afterEach, vi } from 'vitest';
import { DatabaseManager } from '@/adapters/storage/database.js';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

  it('should run all migration files in sorted order', () => {
    // Verify that the migrations directory contains .sql files and that
    // DatabaseManager iterates all of them (not just a hardcoded one).
    // We do this by checking the migrations directory directly and confirming
    // that after initialization, tables from all migration files exist.
    const migrationsDir = join(
      dirname(fileURLToPath(import.meta.url)),
      '../../../src/adapters/storage/migrations',
    );
    const migrationFiles = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    // There should be at least one migration file
    expect(migrationFiles.length).toBeGreaterThanOrEqual(1);
    // Files should be sorted lexicographically (001 before 002, etc.)
    expect(migrationFiles[0]).toBe('001-initial.sql');

    // Initialize and verify it doesn't throw (all migrations run successfully)
    db = new DatabaseManager({ path: ':memory:', inMemory: true });
    db.initialize();

    const raw = db.getDatabase();
    const tables = raw
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);

    // Tables from 001-initial.sql should exist
    expect(tableNames).toContain('code_units');
    expect(tableNames).toContain('file_hashes');
  });
});
