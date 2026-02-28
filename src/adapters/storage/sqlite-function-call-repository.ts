import type Database from 'better-sqlite3';
import type { FunctionCall } from '@/domain/models/index.js';
import type { IFunctionCallRepository } from '@/domain/ports/index.js';

interface FunctionCallRow {
  id: string;
  caller_unit_id: string;
  callee_name: string;
  callee_file_path: string | null;
  callee_unit_id: string | null;
  line_number: number;
  is_async: number;
}

export class SqliteFunctionCallRepository implements IFunctionCallRepository {
  private readonly insertStmt: Database.Statement;
  private readonly selectByCallerUnitId: Database.Statement;
  private readonly selectByCalleeName: Database.Statement;
  private readonly selectByCalleeUnitId: Database.Statement;
  private readonly selectAll: Database.Statement;
  private readonly deleteByCallerUnitIdStmt: Database.Statement;
  private readonly clearStmt: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT OR REPLACE INTO function_calls
        (id, caller_unit_id, callee_name, callee_file_path, callee_unit_id, line_number, is_async)
      VALUES
        (@id, @caller_unit_id, @callee_name, @callee_file_path, @callee_unit_id, @line_number, @is_async)
    `);

    this.selectByCallerUnitId = db.prepare(
      'SELECT * FROM function_calls WHERE caller_unit_id = ?',
    );
    this.selectByCalleeName = db.prepare(
      'SELECT * FROM function_calls WHERE callee_name = ?',
    );
    this.selectByCalleeUnitId = db.prepare(
      'SELECT * FROM function_calls WHERE callee_unit_id = ?',
    );
    this.selectAll = db.prepare('SELECT * FROM function_calls');
    this.deleteByCallerUnitIdStmt = db.prepare(
      'DELETE FROM function_calls WHERE caller_unit_id = ?',
    );
    this.clearStmt = db.prepare('DELETE FROM function_calls');
  }

  save(call: FunctionCall): void {
    this.insertStmt.run({
      id: call.id,
      caller_unit_id: call.callerUnitId,
      callee_name: call.calleeName,
      callee_file_path: call.calleeFilePath ?? null,
      callee_unit_id: call.calleeUnitId ?? null,
      line_number: call.lineNumber,
      is_async: call.isAsync ? 1 : 0,
    });
  }

  saveBatch(calls: FunctionCall[]): void {
    const batchTransaction = this.db.transaction(() => {
      for (const call of calls) {
        this.save(call);
      }
    });
    batchTransaction();
  }

  findByCallerUnitId(callerUnitId: string): FunctionCall[] {
    const rows = this.selectByCallerUnitId.all(callerUnitId) as FunctionCallRow[];
    return rows.map((row) => this.rowToFunctionCall(row));
  }

  findByCalleeName(calleeName: string): FunctionCall[] {
    const rows = this.selectByCalleeName.all(calleeName) as FunctionCallRow[];
    return rows.map((row) => this.rowToFunctionCall(row));
  }

  findByCalleeUnitId(calleeUnitId: string): FunctionCall[] {
    const rows = this.selectByCalleeUnitId.all(calleeUnitId) as FunctionCallRow[];
    return rows.map((row) => this.rowToFunctionCall(row));
  }

  findAll(): FunctionCall[] {
    const rows = this.selectAll.all() as FunctionCallRow[];
    return rows.map((row) => this.rowToFunctionCall(row));
  }

  deleteByCallerUnitId(callerUnitId: string): void {
    this.deleteByCallerUnitIdStmt.run(callerUnitId);
  }

  clear(): void {
    this.clearStmt.run();
  }

  private rowToFunctionCall(row: FunctionCallRow): FunctionCall {
    return {
      id: row.id,
      callerUnitId: row.caller_unit_id,
      calleeName: row.callee_name,
      calleeFilePath: row.callee_file_path ?? undefined,
      calleeUnitId: row.callee_unit_id ?? undefined,
      lineNumber: row.line_number,
      isAsync: row.is_async === 1,
    };
  }
}
