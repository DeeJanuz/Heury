import type Database from 'better-sqlite3';
import type { TypeField } from '@/domain/models/index.js';
import type { ITypeFieldRepository } from '@/domain/ports/index.js';

interface TypeFieldRow {
  id: string;
  parent_unit_id: string;
  name: string;
  field_type: string;
  is_optional: number;
  is_readonly: number;
  line_number: number;
}

export class SqliteTypeFieldRepository implements ITypeFieldRepository {
  private readonly insertStmt: Database.Statement;
  private readonly selectByParentUnitId: Database.Statement;
  private readonly selectAll: Database.Statement;
  private readonly deleteByParentUnitIdStmt: Database.Statement;
  private readonly clearStmt: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT OR REPLACE INTO type_fields
        (id, parent_unit_id, name, field_type, is_optional, is_readonly, line_number)
      VALUES
        (@id, @parent_unit_id, @name, @field_type, @is_optional, @is_readonly, @line_number)
    `);

    this.selectByParentUnitId = db.prepare(
      'SELECT * FROM type_fields WHERE parent_unit_id = ?',
    );
    this.selectAll = db.prepare('SELECT * FROM type_fields');
    this.deleteByParentUnitIdStmt = db.prepare(
      'DELETE FROM type_fields WHERE parent_unit_id = ?',
    );
    this.clearStmt = db.prepare('DELETE FROM type_fields');
  }

  save(field: TypeField): void {
    this.insertStmt.run({
      id: field.id,
      parent_unit_id: field.parentUnitId,
      name: field.name,
      field_type: field.fieldType,
      is_optional: field.isOptional ? 1 : 0,
      is_readonly: field.isReadonly ? 1 : 0,
      line_number: field.lineNumber,
    });
  }

  saveBatch(fields: TypeField[]): void {
    const batchTransaction = this.db.transaction(() => {
      for (const field of fields) {
        this.save(field);
      }
    });
    batchTransaction();
  }

  findByParentUnitId(parentUnitId: string): TypeField[] {
    const rows = this.selectByParentUnitId.all(parentUnitId) as TypeFieldRow[];
    return rows.map((row) => this.rowToTypeField(row));
  }

  findAll(): TypeField[] {
    const rows = this.selectAll.all() as TypeFieldRow[];
    return rows.map((row) => this.rowToTypeField(row));
  }

  deleteByParentUnitId(parentUnitId: string): void {
    this.deleteByParentUnitIdStmt.run(parentUnitId);
  }

  clear(): void {
    this.clearStmt.run();
  }

  private rowToTypeField(row: TypeFieldRow): TypeField {
    return {
      id: row.id,
      parentUnitId: row.parent_unit_id,
      name: row.name,
      fieldType: row.field_type,
      isOptional: row.is_optional === 1,
      isReadonly: row.is_readonly === 1,
      lineNumber: row.line_number,
    };
  }
}
