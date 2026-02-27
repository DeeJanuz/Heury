CREATE TABLE IF NOT EXISTS code_units (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  name TEXT NOT NULL,
  unit_type TEXT NOT NULL,
  line_start INTEGER NOT NULL,
  line_end INTEGER NOT NULL,
  parent_unit_id TEXT,
  signature TEXT,
  is_async INTEGER NOT NULL DEFAULT 0,
  is_exported INTEGER NOT NULL DEFAULT 0,
  language TEXT NOT NULL,
  complexity TEXT NOT NULL DEFAULT '{}',
  complexity_score REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_code_units_file_path ON code_units(file_path);
CREATE INDEX IF NOT EXISTS idx_code_units_unit_type ON code_units(unit_type);
CREATE INDEX IF NOT EXISTS idx_code_units_complexity_score ON code_units(complexity_score);
CREATE INDEX IF NOT EXISTS idx_code_units_language ON code_units(language);

CREATE TABLE IF NOT EXISTS code_unit_patterns (
  id TEXT PRIMARY KEY,
  code_unit_id TEXT NOT NULL,
  pattern_type TEXT NOT NULL,
  pattern_value TEXT NOT NULL,
  line_number INTEGER,
  column_access TEXT,
  FOREIGN KEY (code_unit_id) REFERENCES code_units(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_patterns_code_unit_id ON code_unit_patterns(code_unit_id);
CREATE INDEX IF NOT EXISTS idx_patterns_type ON code_unit_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_patterns_value ON code_unit_patterns(pattern_value);
CREATE INDEX IF NOT EXISTS idx_patterns_type_value ON code_unit_patterns(pattern_type, pattern_value);

CREATE TABLE IF NOT EXISTS file_dependencies (
  id TEXT PRIMARY KEY,
  source_file TEXT NOT NULL,
  target_file TEXT NOT NULL,
  import_type TEXT NOT NULL,
  imported_names TEXT NOT NULL DEFAULT '[]',
  UNIQUE(source_file, target_file)
);

CREATE INDEX IF NOT EXISTS idx_deps_source ON file_dependencies(source_file);
CREATE INDEX IF NOT EXISTS idx_deps_target ON file_dependencies(target_file);

CREATE TABLE IF NOT EXISTS env_variables (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  has_default INTEGER NOT NULL DEFAULT 0,
  line_number INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS file_hashes (
  file_path TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  last_analyzed TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analysis_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  success INTEGER NOT NULL,
  error TEXT,
  files_processed INTEGER,
  code_units_extracted INTEGER,
  patterns_detected INTEGER,
  dependencies_found INTEGER,
  env_variables_found INTEGER,
  duration INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
