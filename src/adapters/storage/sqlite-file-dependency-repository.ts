import type Database from 'better-sqlite3';
import type { FileDependency } from '@/domain/models/index.js';
import type { IFileDependencyRepository } from '@/domain/ports/index.js';

interface FileDependencyRow {
  id: string;
  source_file: string;
  target_file: string;
  import_type: string;
  imported_names: string;
}

export class SqliteFileDependencyRepository implements IFileDependencyRepository {
  private readonly insertStmt: Database.Statement;
  private readonly selectBySource: Database.Statement;
  private readonly selectByTarget: Database.Statement;
  private readonly selectAll: Database.Statement;
  private readonly deleteBySourceStmt: Database.Statement;
  private readonly clearStmt: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO file_dependencies (id, source_file, target_file, import_type, imported_names)
      VALUES (@id, @source_file, @target_file, @import_type, @imported_names)
      ON CONFLICT(source_file, target_file) DO UPDATE SET
        id = @id,
        import_type = @import_type,
        imported_names = @imported_names
    `);

    this.selectBySource = db.prepare('SELECT * FROM file_dependencies WHERE source_file = ?');
    this.selectByTarget = db.prepare('SELECT * FROM file_dependencies WHERE target_file = ?');
    this.selectAll = db.prepare('SELECT * FROM file_dependencies');
    this.deleteBySourceStmt = db.prepare('DELETE FROM file_dependencies WHERE source_file = ?');
    this.clearStmt = db.prepare('DELETE FROM file_dependencies');
  }

  save(dep: FileDependency): void {
    this.insertStmt.run({
      id: dep.id,
      source_file: dep.sourceFile,
      target_file: dep.targetFile,
      import_type: dep.importType,
      imported_names: JSON.stringify(dep.importedNames),
    });
  }

  saveBatch(deps: FileDependency[]): void {
    const batchTransaction = this.db.transaction(() => {
      for (const dep of deps) {
        this.save(dep);
      }
    });
    batchTransaction();
  }

  findBySourceFile(sourceFile: string): FileDependency[] {
    const rows = this.selectBySource.all(sourceFile) as FileDependencyRow[];
    return rows.map((row) => this.rowToDependency(row));
  }

  findByTargetFile(targetFile: string): FileDependency[] {
    const rows = this.selectByTarget.all(targetFile) as FileDependencyRow[];
    return rows.map((row) => this.rowToDependency(row));
  }

  findAll(): FileDependency[] {
    const rows = this.selectAll.all() as FileDependencyRow[];
    return rows.map((row) => this.rowToDependency(row));
  }

  deleteBySourceFile(sourceFile: string): void {
    this.deleteBySourceStmt.run(sourceFile);
  }

  clear(): void {
    this.clearStmt.run();
  }

  private rowToDependency(row: FileDependencyRow): FileDependency {
    return {
      id: row.id,
      sourceFile: row.source_file,
      targetFile: row.target_file,
      importType: row.import_type as FileDependency['importType'],
      importedNames: JSON.parse(row.imported_names) as string[],
    };
  }
}
