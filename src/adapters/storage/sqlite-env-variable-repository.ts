import type Database from 'better-sqlite3';
import type { RepositoryEnvVariable } from '@/domain/models/index.js';
import type { IEnvVariableRepository } from '@/domain/ports/index.js';

interface EnvVariableRow {
  id: string;
  name: string;
  description: string | null;
  has_default: number;
  line_number: number;
}

export class SqliteEnvVariableRepository implements IEnvVariableRepository {
  private readonly insertStmt: Database.Statement;
  private readonly selectByName: Database.Statement;
  private readonly selectAll: Database.Statement;
  private readonly clearStmt: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO env_variables (id, name, description, has_default, line_number)
      VALUES (@id, @name, @description, @has_default, @line_number)
      ON CONFLICT(name) DO UPDATE SET
        id = @id,
        description = @description,
        has_default = @has_default,
        line_number = @line_number
    `);

    this.selectByName = db.prepare('SELECT * FROM env_variables WHERE name = ?');
    this.selectAll = db.prepare('SELECT * FROM env_variables');
    this.clearStmt = db.prepare('DELETE FROM env_variables');
  }

  save(envVar: RepositoryEnvVariable): void {
    this.insertStmt.run({
      id: envVar.id,
      name: envVar.name,
      description: envVar.description ?? null,
      has_default: envVar.hasDefault ? 1 : 0,
      line_number: envVar.lineNumber,
    });
  }

  saveBatch(envVars: RepositoryEnvVariable[]): void {
    const batchTransaction = this.db.transaction(() => {
      for (const envVar of envVars) {
        this.save(envVar);
      }
    });
    batchTransaction();
  }

  findByName(name: string): RepositoryEnvVariable | undefined {
    const row = this.selectByName.get(name) as EnvVariableRow | undefined;
    if (!row) return undefined;
    return this.rowToEnvVariable(row);
  }

  findAll(): RepositoryEnvVariable[] {
    const rows = this.selectAll.all() as EnvVariableRow[];
    return rows.map((row) => this.rowToEnvVariable(row));
  }

  clear(): void {
    this.clearStmt.run();
  }

  private rowToEnvVariable(row: EnvVariableRow): RepositoryEnvVariable {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      hasDefault: row.has_default === 1,
      lineNumber: row.line_number,
    };
  }
}
