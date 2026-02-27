import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface DatabaseOptions {
  readonly path: string;
  readonly inMemory?: boolean;
}

export class DatabaseManager {
  private db: Database.Database;

  constructor(private readonly options: DatabaseOptions) {
    this.db = new Database(options.inMemory ? ':memory:' : options.path);
  }

  initialize(): void {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
    this.runMigrations();
  }

  getDatabase(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }

  private runMigrations(): void {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const migrationPath = join(currentDir, 'migrations', '001-initial.sql');
    const sql = readFileSync(migrationPath, 'utf-8');
    this.db.exec(sql);
  }
}
