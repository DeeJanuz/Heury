import type Database from 'better-sqlite3';
import type { SchemaModel, SchemaModelField } from '@/domain/models/index.js';
import type { ISchemaModelRepository } from '@/domain/ports/index.js';

interface SchemaModelRow {
  id: string;
  name: string;
  file_path: string;
  framework: string;
  table_name: string | null;
}

interface SchemaModelFieldRow {
  id: string;
  model_id: string;
  name: string;
  field_type: string;
  is_primary_key: number;
  is_required: number;
  is_unique: number;
  has_default: number;
  relation_target: string | null;
}

export class SqliteSchemaModelRepository implements ISchemaModelRepository {
  private readonly insertModelStmt: Database.Statement;
  private readonly insertFieldStmt: Database.Statement;
  private readonly selectById: Database.Statement;
  private readonly selectByName: Database.Statement;
  private readonly selectByFilePath: Database.Statement;
  private readonly selectByFramework: Database.Statement;
  private readonly selectAll: Database.Statement;
  private readonly selectFieldsByModelId: Database.Statement;
  private readonly deleteModelByFilePath: Database.Statement;
  private readonly deleteFieldsByModelId: Database.Statement;
  private readonly clearModelsStmt: Database.Statement;
  private readonly clearFieldsStmt: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.insertModelStmt = db.prepare(`
      INSERT OR REPLACE INTO schema_models
        (id, name, file_path, framework, table_name)
      VALUES
        (@id, @name, @file_path, @framework, @table_name)
    `);

    this.insertFieldStmt = db.prepare(`
      INSERT OR REPLACE INTO schema_model_fields
        (id, model_id, name, field_type, is_primary_key, is_required, is_unique, has_default, relation_target)
      VALUES
        (@id, @model_id, @name, @field_type, @is_primary_key, @is_required, @is_unique, @has_default, @relation_target)
    `);

    this.selectById = db.prepare('SELECT * FROM schema_models WHERE id = ?');
    this.selectByName = db.prepare('SELECT * FROM schema_models WHERE name = ?');
    this.selectByFilePath = db.prepare('SELECT * FROM schema_models WHERE file_path = ?');
    this.selectByFramework = db.prepare('SELECT * FROM schema_models WHERE framework = ?');
    this.selectAll = db.prepare('SELECT * FROM schema_models');
    this.selectFieldsByModelId = db.prepare(
      'SELECT * FROM schema_model_fields WHERE model_id = ?',
    );
    this.deleteModelByFilePath = db.prepare('DELETE FROM schema_models WHERE file_path = ?');
    this.deleteFieldsByModelId = db.prepare(
      'DELETE FROM schema_model_fields WHERE model_id = ?',
    );
    this.clearModelsStmt = db.prepare('DELETE FROM schema_models');
    this.clearFieldsStmt = db.prepare('DELETE FROM schema_model_fields');
  }

  save(model: SchemaModel): void {
    const saveTransaction = this.db.transaction(() => {
      this.deleteFieldsByModelId.run(model.id);

      this.insertModelStmt.run({
        id: model.id,
        name: model.name,
        file_path: model.filePath,
        framework: model.framework,
        table_name: model.tableName ?? null,
      });

      for (const field of model.fields) {
        this.insertFieldStmt.run({
          id: field.id,
          model_id: field.modelId,
          name: field.name,
          field_type: field.fieldType,
          is_primary_key: field.isPrimaryKey ? 1 : 0,
          is_required: field.isRequired ? 1 : 0,
          is_unique: field.isUnique ? 1 : 0,
          has_default: field.hasDefault ? 1 : 0,
          relation_target: field.relationTarget ?? null,
        });
      }
    });
    saveTransaction();
  }

  saveBatch(models: SchemaModel[]): void {
    const batchTransaction = this.db.transaction(() => {
      for (const model of models) {
        this.save(model);
      }
    });
    batchTransaction();
  }

  findById(id: string): SchemaModel | undefined {
    const row = this.selectById.get(id) as SchemaModelRow | undefined;
    if (!row) return undefined;
    return this.rowToSchemaModel(row);
  }

  findByName(name: string): SchemaModel | undefined {
    const row = this.selectByName.get(name) as SchemaModelRow | undefined;
    if (!row) return undefined;
    return this.rowToSchemaModel(row);
  }

  findByFilePath(filePath: string): SchemaModel[] {
    const rows = this.selectByFilePath.all(filePath) as SchemaModelRow[];
    return rows.map((row) => this.rowToSchemaModel(row));
  }

  findByFramework(framework: string): SchemaModel[] {
    const rows = this.selectByFramework.all(framework) as SchemaModelRow[];
    return rows.map((row) => this.rowToSchemaModel(row));
  }

  findAll(): SchemaModel[] {
    const rows = this.selectAll.all() as SchemaModelRow[];
    return rows.map((row) => this.rowToSchemaModel(row));
  }

  deleteByFilePath(filePath: string): void {
    const models = this.selectByFilePath.all(filePath) as SchemaModelRow[];
    const deleteTransaction = this.db.transaction(() => {
      for (const model of models) {
        this.deleteFieldsByModelId.run(model.id);
      }
      this.deleteModelByFilePath.run(filePath);
    });
    deleteTransaction();
  }

  clear(): void {
    const clearTransaction = this.db.transaction(() => {
      this.clearFieldsStmt.run();
      this.clearModelsStmt.run();
    });
    clearTransaction();
  }

  private rowToSchemaModel(row: SchemaModelRow): SchemaModel {
    const fieldRows = this.selectFieldsByModelId.all(row.id) as SchemaModelFieldRow[];
    const fields: SchemaModelField[] = fieldRows.map((f) => ({
      id: f.id,
      modelId: f.model_id,
      name: f.name,
      fieldType: f.field_type,
      isPrimaryKey: f.is_primary_key === 1,
      isRequired: f.is_required === 1,
      isUnique: f.is_unique === 1,
      hasDefault: f.has_default === 1,
      relationTarget: f.relation_target ?? undefined,
    }));

    return {
      id: row.id,
      name: row.name,
      filePath: row.file_path,
      framework: row.framework,
      tableName: row.table_name ?? undefined,
      fields,
    };
  }
}
