import type Database from 'better-sqlite3';
import type { EventFlow } from '@/domain/models/index.js';
import type { IEventFlowRepository } from '@/domain/ports/index.js';

interface EventFlowRow {
  id: string;
  code_unit_id: string;
  event_name: string;
  direction: string;
  framework: string;
  line_number: number;
}

export class SqliteEventFlowRepository implements IEventFlowRepository {
  private readonly insertStmt: Database.Statement;
  private readonly selectByCodeUnitId: Database.Statement;
  private readonly selectByEventName: Database.Statement;
  private readonly selectAll: Database.Statement;
  private readonly deleteByCodeUnitIdStmt: Database.Statement;
  private readonly clearStmt: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT OR REPLACE INTO event_flows
        (id, code_unit_id, event_name, direction, framework, line_number)
      VALUES
        (@id, @code_unit_id, @event_name, @direction, @framework, @line_number)
    `);

    this.selectByCodeUnitId = db.prepare(
      'SELECT * FROM event_flows WHERE code_unit_id = ?',
    );
    this.selectByEventName = db.prepare(
      'SELECT * FROM event_flows WHERE event_name = ?',
    );
    this.selectAll = db.prepare('SELECT * FROM event_flows');
    this.deleteByCodeUnitIdStmt = db.prepare(
      'DELETE FROM event_flows WHERE code_unit_id = ?',
    );
    this.clearStmt = db.prepare('DELETE FROM event_flows');
  }

  save(flow: EventFlow): void {
    this.insertStmt.run({
      id: flow.id,
      code_unit_id: flow.codeUnitId,
      event_name: flow.eventName,
      direction: flow.direction,
      framework: flow.framework,
      line_number: flow.lineNumber,
    });
  }

  saveBatch(flows: EventFlow[]): void {
    const batchTransaction = this.db.transaction(() => {
      for (const flow of flows) {
        this.save(flow);
      }
    });
    batchTransaction();
  }

  findByCodeUnitId(codeUnitId: string): EventFlow[] {
    const rows = this.selectByCodeUnitId.all(codeUnitId) as EventFlowRow[];
    return rows.map((row) => this.rowToEventFlow(row));
  }

  findByEventName(eventName: string): EventFlow[] {
    const rows = this.selectByEventName.all(eventName) as EventFlowRow[];
    return rows.map((row) => this.rowToEventFlow(row));
  }

  findAll(): EventFlow[] {
    const rows = this.selectAll.all() as EventFlowRow[];
    return rows.map((row) => this.rowToEventFlow(row));
  }

  deleteByCodeUnitId(codeUnitId: string): void {
    this.deleteByCodeUnitIdStmt.run(codeUnitId);
  }

  clear(): void {
    this.clearStmt.run();
  }

  private rowToEventFlow(row: EventFlowRow): EventFlow {
    return {
      id: row.id,
      codeUnitId: row.code_unit_id,
      eventName: row.event_name,
      direction: row.direction as EventFlow['direction'],
      framework: row.framework,
      lineNumber: row.line_number,
    };
  }
}
