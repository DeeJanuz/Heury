CREATE TABLE IF NOT EXISTS function_calls (
  id TEXT PRIMARY KEY,
  caller_unit_id TEXT NOT NULL,
  callee_name TEXT NOT NULL,
  callee_file_path TEXT,
  callee_unit_id TEXT,
  line_number INTEGER NOT NULL,
  is_async INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (caller_unit_id) REFERENCES code_units(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fc_caller ON function_calls(caller_unit_id);
CREATE INDEX IF NOT EXISTS idx_fc_callee_name ON function_calls(callee_name);
CREATE INDEX IF NOT EXISTS idx_fc_callee_unit ON function_calls(callee_unit_id);

CREATE TABLE IF NOT EXISTS type_fields (
  id TEXT PRIMARY KEY,
  parent_unit_id TEXT NOT NULL,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL,
  is_optional INTEGER NOT NULL DEFAULT 0,
  is_readonly INTEGER NOT NULL DEFAULT 0,
  line_number INTEGER NOT NULL,
  FOREIGN KEY (parent_unit_id) REFERENCES code_units(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tf_parent ON type_fields(parent_unit_id);

CREATE TABLE IF NOT EXISTS event_flows (
  id TEXT PRIMARY KEY,
  code_unit_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  direction TEXT NOT NULL,
  framework TEXT NOT NULL,
  line_number INTEGER NOT NULL,
  FOREIGN KEY (code_unit_id) REFERENCES code_units(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ef_unit ON event_flows(code_unit_id);
CREATE INDEX IF NOT EXISTS idx_ef_event ON event_flows(event_name);

CREATE TABLE IF NOT EXISTS schema_models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  framework TEXT NOT NULL,
  table_name TEXT
);
CREATE INDEX IF NOT EXISTS idx_sm_file ON schema_models(file_path);

CREATE TABLE IF NOT EXISTS schema_model_fields (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL,
  is_primary_key INTEGER NOT NULL DEFAULT 0,
  is_required INTEGER NOT NULL DEFAULT 0,
  is_unique INTEGER NOT NULL DEFAULT 0,
  has_default INTEGER NOT NULL DEFAULT 0,
  relation_target TEXT,
  FOREIGN KEY (model_id) REFERENCES schema_models(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_smf_model ON schema_model_fields(model_id);

CREATE TABLE IF NOT EXISTS unit_summaries (
  id TEXT PRIMARY KEY,
  code_unit_id TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL,
  key_behaviors TEXT NOT NULL DEFAULT '[]',
  side_effects TEXT NOT NULL DEFAULT '[]',
  provider_model TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  FOREIGN KEY (code_unit_id) REFERENCES code_units(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_us_unit ON unit_summaries(code_unit_id);
