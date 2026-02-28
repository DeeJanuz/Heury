import type Database from 'better-sqlite3';
import type { UnitSummary } from '@/domain/models/index.js';
import type { IUnitSummaryRepository } from '@/domain/ports/index.js';

interface UnitSummaryRow {
  id: string;
  code_unit_id: string;
  summary: string;
  key_behaviors: string;
  side_effects: string;
  provider_model: string;
  generated_at: string;
}

export class SqliteUnitSummaryRepository implements IUnitSummaryRepository {
  private readonly insertStmt: Database.Statement;
  private readonly selectByCodeUnitId: Database.Statement;
  private readonly selectAll: Database.Statement;
  private readonly deleteByCodeUnitIdStmt: Database.Statement;
  private readonly clearStmt: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT OR REPLACE INTO unit_summaries
        (id, code_unit_id, summary, key_behaviors, side_effects, provider_model, generated_at)
      VALUES
        (@id, @code_unit_id, @summary, @key_behaviors, @side_effects, @provider_model, @generated_at)
    `);

    this.selectByCodeUnitId = db.prepare(
      'SELECT * FROM unit_summaries WHERE code_unit_id = ?',
    );
    this.selectAll = db.prepare('SELECT * FROM unit_summaries');
    this.deleteByCodeUnitIdStmt = db.prepare(
      'DELETE FROM unit_summaries WHERE code_unit_id = ?',
    );
    this.clearStmt = db.prepare('DELETE FROM unit_summaries');
  }

  save(summary: UnitSummary): void {
    this.insertStmt.run({
      id: summary.id,
      code_unit_id: summary.codeUnitId,
      summary: summary.summary,
      key_behaviors: JSON.stringify(summary.keyBehaviors),
      side_effects: JSON.stringify(summary.sideEffects),
      provider_model: summary.providerModel,
      generated_at: summary.generatedAt,
    });
  }

  saveBatch(summaries: UnitSummary[]): void {
    const batchTransaction = this.db.transaction(() => {
      for (const summary of summaries) {
        this.save(summary);
      }
    });
    batchTransaction();
  }

  findByCodeUnitId(codeUnitId: string): UnitSummary | undefined {
    const row = this.selectByCodeUnitId.get(codeUnitId) as UnitSummaryRow | undefined;
    if (!row) return undefined;
    return this.rowToUnitSummary(row);
  }

  findAll(): UnitSummary[] {
    const rows = this.selectAll.all() as UnitSummaryRow[];
    return rows.map((row) => this.rowToUnitSummary(row));
  }

  deleteByCodeUnitId(codeUnitId: string): void {
    this.deleteByCodeUnitIdStmt.run(codeUnitId);
  }

  clear(): void {
    this.clearStmt.run();
  }

  private rowToUnitSummary(row: UnitSummaryRow): UnitSummary {
    return {
      id: row.id,
      codeUnitId: row.code_unit_id,
      summary: row.summary,
      keyBehaviors: JSON.parse(row.key_behaviors) as string[],
      sideEffects: JSON.parse(row.side_effects) as string[],
      providerModel: row.provider_model,
      generatedAt: row.generated_at,
    };
  }
}
