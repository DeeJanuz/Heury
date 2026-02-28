import type Database from 'better-sqlite3';
import type { RepositoryPatternTemplate, RepositoryPatternTemplateFollower } from '@/domain/models/index.js';
import type { IPatternTemplateRepository } from '@/domain/ports/index.js';

interface PatternTemplateRow {
  id: string;
  name: string;
  description: string;
  pattern_types: string;
  template_unit_id: string;
  template_file_path: string;
  follower_count: number;
  conventions: string;
}

interface PatternTemplateFollowerRow {
  template_id: string;
  file_path: string;
  unit_name: string;
}

export class SqlitePatternTemplateRepository implements IPatternTemplateRepository {
  private readonly insertTemplateStmt: Database.Statement;
  private readonly insertFollowerStmt: Database.Statement;
  private readonly selectTemplateById: Database.Statement;
  private readonly selectFollowersByTemplateId: Database.Statement;
  private readonly selectAllTemplates: Database.Statement;
  private readonly deleteFollowersByTemplateIdStmt: Database.Statement;
  private readonly clearTemplatesStmt: Database.Statement;
  private readonly clearFollowersStmt: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.insertTemplateStmt = db.prepare(`
      INSERT OR REPLACE INTO pattern_templates
        (id, name, description, pattern_types, template_unit_id, template_file_path, follower_count, conventions)
      VALUES
        (@id, @name, @description, @pattern_types, @template_unit_id, @template_file_path, @follower_count, @conventions)
    `);

    this.insertFollowerStmt = db.prepare(`
      INSERT OR REPLACE INTO pattern_template_followers
        (template_id, file_path, unit_name)
      VALUES
        (@template_id, @file_path, @unit_name)
    `);

    this.selectTemplateById = db.prepare(
      'SELECT * FROM pattern_templates WHERE id = ?',
    );

    this.selectFollowersByTemplateId = db.prepare(
      'SELECT * FROM pattern_template_followers WHERE template_id = ?',
    );

    this.selectAllTemplates = db.prepare('SELECT * FROM pattern_templates');

    this.deleteFollowersByTemplateIdStmt = db.prepare(
      'DELETE FROM pattern_template_followers WHERE template_id = ?',
    );

    this.clearTemplatesStmt = db.prepare('DELETE FROM pattern_templates');
    this.clearFollowersStmt = db.prepare('DELETE FROM pattern_template_followers');
  }

  save(template: RepositoryPatternTemplate, followers: RepositoryPatternTemplateFollower[]): void {
    const saveTransaction = this.db.transaction(() => {
      // Delete existing followers first (for upsert behavior)
      this.deleteFollowersByTemplateIdStmt.run(template.id);

      this.insertTemplateStmt.run({
        id: template.id,
        name: template.name,
        description: template.description,
        pattern_types: JSON.stringify(template.patternTypes),
        template_unit_id: template.templateUnitId,
        template_file_path: template.templateFilePath,
        follower_count: template.followerCount,
        conventions: JSON.stringify(template.conventions),
      });

      for (const follower of followers) {
        this.insertFollowerStmt.run({
          template_id: follower.templateId,
          file_path: follower.filePath,
          unit_name: follower.unitName,
        });
      }
    });
    saveTransaction();
  }

  saveBatch(templates: Array<{ template: RepositoryPatternTemplate; followers: RepositoryPatternTemplateFollower[] }>): void {
    const batchTransaction = this.db.transaction(() => {
      for (const item of templates) {
        this.save(item.template, item.followers);
      }
    });
    batchTransaction();
  }

  findById(id: string): { template: RepositoryPatternTemplate; followers: RepositoryPatternTemplateFollower[] } | undefined {
    const row = this.selectTemplateById.get(id) as PatternTemplateRow | undefined;
    if (!row) return undefined;
    const followerRows = this.selectFollowersByTemplateId.all(id) as PatternTemplateFollowerRow[];
    return {
      template: this.rowToTemplate(row),
      followers: followerRows.map(f => this.rowToFollower(f)),
    };
  }

  findByPatternType(patternType: string): { template: RepositoryPatternTemplate; followers: RepositoryPatternTemplateFollower[] }[] {
    // Load all templates and filter in memory for accurate JSON array matching
    const allRows = this.selectAllTemplates.all() as PatternTemplateRow[];
    const matching = allRows.filter(row => {
      const types = JSON.parse(row.pattern_types) as string[];
      return types.includes(patternType);
    });
    return matching.map(row => {
      const followerRows = this.selectFollowersByTemplateId.all(row.id) as PatternTemplateFollowerRow[];
      return {
        template: this.rowToTemplate(row),
        followers: followerRows.map(f => this.rowToFollower(f)),
      };
    });
  }

  findAll(): { template: RepositoryPatternTemplate; followers: RepositoryPatternTemplateFollower[] }[] {
    const rows = this.selectAllTemplates.all() as PatternTemplateRow[];
    return rows.map(row => {
      const followerRows = this.selectFollowersByTemplateId.all(row.id) as PatternTemplateFollowerRow[];
      return {
        template: this.rowToTemplate(row),
        followers: followerRows.map(f => this.rowToFollower(f)),
      };
    });
  }

  clear(): void {
    const clearTransaction = this.db.transaction(() => {
      this.clearFollowersStmt.run();
      this.clearTemplatesStmt.run();
    });
    clearTransaction();
  }

  private rowToTemplate(row: PatternTemplateRow): RepositoryPatternTemplate {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      patternTypes: JSON.parse(row.pattern_types) as string[],
      templateUnitId: row.template_unit_id,
      templateFilePath: row.template_file_path,
      followerCount: row.follower_count,
      conventions: JSON.parse(row.conventions) as string[],
    };
  }

  private rowToFollower(row: PatternTemplateFollowerRow): RepositoryPatternTemplateFollower {
    return {
      templateId: row.template_id,
      filePath: row.file_path,
      unitName: row.unit_name,
    };
  }
}
