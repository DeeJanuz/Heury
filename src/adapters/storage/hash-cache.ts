import type Database from 'better-sqlite3';

interface HashRow {
  file_path: string;
  hash: string;
  last_analyzed: string;
}

export class FileHashCache {
  private readonly getStmt: Database.Statement;
  private readonly setStmt: Database.Statement;
  private readonly getAllStmt: Database.Statement;
  private readonly removeStmt: Database.Statement;
  private readonly clearStmt: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.getStmt = db.prepare('SELECT * FROM file_hashes WHERE file_path = ?');
    this.setStmt = db.prepare(`
      INSERT INTO file_hashes (file_path, hash, last_analyzed)
      VALUES (@file_path, @hash, @last_analyzed)
      ON CONFLICT(file_path) DO UPDATE SET
        hash = @hash,
        last_analyzed = @last_analyzed
    `);
    this.getAllStmt = db.prepare('SELECT file_path FROM file_hashes');
    this.removeStmt = db.prepare('DELETE FROM file_hashes WHERE file_path = ?');
    this.clearStmt = db.prepare('DELETE FROM file_hashes');
  }

  getHash(filePath: string): string | undefined {
    const row = this.getStmt.get(filePath) as HashRow | undefined;
    return row?.hash;
  }

  setHash(filePath: string, hash: string): void {
    this.setStmt.run({
      file_path: filePath,
      hash,
      last_analyzed: new Date().toISOString(),
    });
  }

  hasChanged(filePath: string, currentHash: string): boolean {
    const storedHash = this.getHash(filePath);
    if (storedHash === undefined) return true;
    return storedHash !== currentHash;
  }

  getAnalyzedFiles(): string[] {
    const rows = this.getAllStmt.all() as { file_path: string }[];
    return rows.map((r) => r.file_path);
  }

  remove(filePath: string): void {
    this.removeStmt.run(filePath);
  }

  clear(): void {
    this.clearStmt.run();
  }
}
