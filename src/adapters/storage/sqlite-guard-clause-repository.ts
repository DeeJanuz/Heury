import type Database from 'better-sqlite3';
import type { RepositoryGuardClause } from '@/domain/models/index.js';
import type { IGuardClauseRepository } from '@/domain/ports/index.js';

interface GuardClauseRow {
  id: string;
  code_unit_id: string;
  guard_type: string;
  condition: string;
  line_number: number;
}

export class SqliteGuardClauseRepository implements IGuardClauseRepository {
  private readonly insertStmt: Database.Statement;
  private readonly selectByCodeUnitId: Database.Statement;
  private readonly selectByGuardType: Database.Statement;
  private readonly selectAll: Database.Statement;
  private readonly deleteByCodeUnitIdStmt: Database.Statement;
  private readonly clearStmt: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT OR REPLACE INTO guard_clauses
        (id, code_unit_id, guard_type, condition, line_number)
      VALUES
        (@id, @code_unit_id, @guard_type, @condition, @line_number)
    `);

    this.selectByCodeUnitId = db.prepare(
      'SELECT * FROM guard_clauses WHERE code_unit_id = ?',
    );
    this.selectByGuardType = db.prepare(
      'SELECT * FROM guard_clauses WHERE guard_type = ?',
    );
    this.selectAll = db.prepare('SELECT * FROM guard_clauses');
    this.deleteByCodeUnitIdStmt = db.prepare(
      'DELETE FROM guard_clauses WHERE code_unit_id = ?',
    );
    this.clearStmt = db.prepare('DELETE FROM guard_clauses');
  }

  save(guard: RepositoryGuardClause): void {
    this.insertStmt.run({
      id: guard.id,
      code_unit_id: guard.codeUnitId,
      guard_type: guard.guardType,
      condition: guard.condition,
      line_number: guard.lineNumber,
    });
  }

  saveBatch(guards: RepositoryGuardClause[]): void {
    const batchTransaction = this.db.transaction(() => {
      for (const guard of guards) {
        this.save(guard);
      }
    });
    batchTransaction();
  }

  findByCodeUnitId(codeUnitId: string): RepositoryGuardClause[] {
    const rows = this.selectByCodeUnitId.all(codeUnitId) as GuardClauseRow[];
    return rows.map((row) => this.rowToGuardClause(row));
  }

  findByGuardType(guardType: string): RepositoryGuardClause[] {
    const rows = this.selectByGuardType.all(guardType) as GuardClauseRow[];
    return rows.map((row) => this.rowToGuardClause(row));
  }

  findAll(): RepositoryGuardClause[] {
    const rows = this.selectAll.all() as GuardClauseRow[];
    return rows.map((row) => this.rowToGuardClause(row));
  }

  deleteByCodeUnitId(codeUnitId: string): void {
    this.deleteByCodeUnitIdStmt.run(codeUnitId);
  }

  clear(): void {
    this.clearStmt.run();
  }

  private rowToGuardClause(row: GuardClauseRow): RepositoryGuardClause {
    return {
      id: row.id,
      codeUnitId: row.code_unit_id,
      guardType: row.guard_type,
      condition: row.condition,
      lineNumber: row.line_number,
    };
  }
}
