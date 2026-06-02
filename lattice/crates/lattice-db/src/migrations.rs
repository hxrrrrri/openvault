pub const MIGRATION_001: &str = r#"
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  basename TEXT NOT NULL,
  extension TEXT NOT NULL,
  parent_path TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  ctime TEXT NOT NULL,
  mtime TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  is_markdown INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notes (
  file_id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  first_heading TEXT,
  word_count INTEGER NOT NULL,
  line_count INTEGER NOT NULL,
  excerpt TEXT NOT NULL,
  FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS headings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  level INTEGER NOT NULL,
  text TEXT NOT NULL,
  slug TEXT NOT NULL,
  line_start INTEGER NOT NULL,
  line_end INTEGER NOT NULL,
  FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_file_id INTEGER NOT NULL,
  target_text TEXT NOT NULL,
  resolved_file_id INTEGER,
  link_type TEXT NOT NULL,
  display_text TEXT,
  line INTEGER NOT NULL,
  column INTEGER NOT NULL,
  FOREIGN KEY(source_file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY(resolved_file_id) REFERENCES files(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  normalized_name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS note_tags (
  file_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY(file_id, tag_id),
  FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  value_type TEXT NOT NULL,
  FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  completed INTEGER NOT NULL,
  line INTEGER NOT NULL,
  block_id TEXT,
  due_date TEXT,
  priority TEXT,
  FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS graph_edges (
  source_file_id INTEGER NOT NULL,
  target_file_id INTEGER NOT NULL,
  edge_type TEXT NOT NULL,
  weight REAL NOT NULL,
  PRIMARY KEY(source_file_id, target_file_id, edge_type),
  FOREIGN KEY(source_file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY(target_file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(path, title, content, tokenize='porter unicode61');

CREATE TABLE IF NOT EXISTS plugins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  installed_path TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  permissions_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plugin_permissions (
  plugin_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  granted INTEGER NOT NULL,
  last_used_at TEXT,
  PRIMARY KEY(plugin_id, permission),
  FOREIGN KEY(plugin_id) REFERENCES plugins(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_state (
  id TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
"#;

/// Version 2: explicit indexes for the hot query paths used by search, graph
/// generation, backlinks, and incremental reindexing.
///
/// Note: `files.path`, `tags.name`, and `tags.normalized_name` are declared
/// `UNIQUE`, so SQLite already maintains covering indexes for them; we add the
/// remaining non-unique paths here.
pub const MIGRATION_002: &str = r#"
CREATE INDEX IF NOT EXISTS idx_files_basename ON files(basename);
CREATE INDEX IF NOT EXISTS idx_files_parent_path ON files(parent_path);
CREATE INDEX IF NOT EXISTS idx_files_content_hash ON files(content_hash);
CREATE INDEX IF NOT EXISTS idx_links_source_file_id ON links(source_file_id);
CREATE INDEX IF NOT EXISTS idx_links_resolved_file_id ON links(resolved_file_id);
CREATE INDEX IF NOT EXISTS idx_links_target_text ON links(target_text);
CREATE INDEX IF NOT EXISTS idx_headings_file_id ON headings(file_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id ON note_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_properties_file_id ON properties(file_id);
CREATE INDEX IF NOT EXISTS idx_tasks_file_id ON tasks(file_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges(source_file_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges(target_file_id);
"#;

/// Ordered list of (version, sql) migrations applied by [`crate::LatticeDb::migrate`].
pub const MIGRATIONS: &[(i64, &str)] = &[(1, MIGRATION_001), (2, MIGRATION_002)];
