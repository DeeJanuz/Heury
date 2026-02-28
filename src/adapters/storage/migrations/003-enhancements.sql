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

CREATE TABLE IF NOT EXISTS file_clusters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cohesion REAL NOT NULL,
  internal_edges INTEGER NOT NULL,
  external_edges INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS file_cluster_members (
  cluster_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  is_entry_point INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (cluster_id, file_path),
  FOREIGN KEY (cluster_id) REFERENCES file_clusters(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cluster_members_file ON file_cluster_members(file_path);
