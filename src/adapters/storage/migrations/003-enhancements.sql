CREATE TABLE IF NOT EXISTS guard_clauses (
  id TEXT PRIMARY KEY,
  code_unit_id TEXT NOT NULL,
  guard_type TEXT NOT NULL,
  condition TEXT NOT NULL,
  line_number INTEGER NOT NULL,
  FOREIGN KEY (code_unit_id) REFERENCES code_units(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_guard_clauses_unit ON guard_clauses(code_unit_id);
CREATE INDEX IF NOT EXISTS idx_guard_clauses_type ON guard_clauses(guard_type);
