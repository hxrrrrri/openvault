use std::collections::BTreeMap;
use std::path::Path;

use chrono::Utc;
use lattice_indexer::metadata::NoteMetadata;
use rusqlite::{params, Connection, OptionalExtension};
use thiserror::Error;

use crate::migrations::MIGRATIONS;
use crate::repositories::{
    BacklinkRow, DbCollectionRow, DbLinkRow, DbNoteRow, HealthStats, SearchRow,
};

pub type DbResult<T> = Result<T, DbError>;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),
}

pub struct LatticeDb {
    conn: Connection,
}

impl LatticeDb {
    pub fn open(path: impl AsRef<Path>) -> DbResult<Self> {
        let conn = Connection::open(path)?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        let db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    pub fn in_memory() -> DbResult<Self> {
        let conn = Connection::open_in_memory()?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        let db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    /// Apply all pending migrations in order, recording each applied version in
    /// the `schema_migrations` table. Idempotent: already-applied versions are
    /// skipped, and every migration uses `IF NOT EXISTS` so re-running against an
    /// existing database is safe.
    pub fn migrate(&self) -> DbResult<()> {
        self.conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_migrations (\
               version INTEGER PRIMARY KEY,\
               applied_at TEXT NOT NULL\
             );",
        )?;
        for (version, sql) in MIGRATIONS {
            let applied: bool = self.conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = ?1)",
                params![version],
                |row| row.get(0),
            )?;
            if applied {
                continue;
            }
            self.conn.execute_batch(sql)?;
            self.conn.execute(
                "INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(?1, ?2)",
                params![version, Utc::now().to_rfc3339()],
            )?;
        }
        Ok(())
    }

    /// Highest applied schema version (0 if the database has never been migrated).
    pub fn schema_version(&self) -> DbResult<i64> {
        let version: Option<i64> = self
            .conn
            .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| {
                row.get(0)
            })
            .optional()?
            .flatten();
        Ok(version.unwrap_or(0))
    }

    /// Remove every indexed row, leaving the schema intact. Used by the
    /// "Rebuild index" command before a full reindex from Markdown files.
    /// Rows are deleted children-first so foreign keys stay satisfied even
    /// without relying on cascade.
    pub fn clear_index(&self) -> DbResult<()> {
        self.conn.execute_batch(
            "DELETE FROM graph_edges;\
             DELETE FROM search_index;\
             DELETE FROM note_tags;\
             DELETE FROM tags;\
             DELETE FROM properties;\
             DELETE FROM tasks;\
             DELETE FROM headings;\
             DELETE FROM links;\
             DELETE FROM notes;\
             DELETE FROM files;",
        )?;
        Ok(())
    }

    /// Run a SQLite integrity check. Returns `true` when the database reports
    /// `ok`, `false` when corruption is detected.
    pub fn integrity_ok(&self) -> DbResult<bool> {
        let result: String = self
            .conn
            .query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
        Ok(result == "ok")
    }

    /// Map of `path -> content_hash` for every indexed file. Used by incremental
    /// indexing to skip files whose content has not changed.
    pub fn content_hashes(&self) -> DbResult<BTreeMap<String, String>> {
        let mut stmt = self.conn.prepare("SELECT path, content_hash FROM files")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        let mut map = BTreeMap::new();
        for row in rows {
            let (path, hash) = row?;
            map.insert(path, hash);
        }
        Ok(map)
    }

    /// Insert or update a single note and rebuild graph edges immediately.
    /// Convenient for one-off writes; for batch indexing prefer
    /// [`Self::upsert_note_deferred`] followed by a single
    /// [`Self::rebuild_graph_edges`] to avoid O(n^2) edge rebuilds.
    pub fn upsert_note(
        &mut self,
        path: &str,
        content: &str,
        size: u64,
        metadata: &NoteMetadata,
    ) -> DbResult<()> {
        self.upsert_note_deferred(path, content, size, metadata)?;
        self.rebuild_graph_edges()?;
        Ok(())
    }

    /// Insert or update a single note **without** rebuilding graph edges. The
    /// caller is responsible for calling [`Self::rebuild_graph_edges`] once after
    /// a batch of writes.
    pub fn upsert_note_deferred(
        &mut self,
        path: &str,
        content: &str,
        size: u64,
        metadata: &NoteMetadata,
    ) -> DbResult<()> {
        let tx = self.conn.transaction()?;
        let now = Utc::now().to_rfc3339();
        let name = path.rsplit('/').next().unwrap_or(path);
        let basename = name.trim_end_matches(".md");
        let extension = name.rsplit('.').next().unwrap_or_default();
        let parent_path = path
            .rsplit_once('/')
            .map(|(parent, _)| parent)
            .unwrap_or_default();

        tx.execute(
            r#"
            INSERT INTO files(path, name, basename, extension, parent_path, size, ctime, mtime, content_hash, is_markdown, updated_at)
            VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8, 1, ?7)
            ON CONFLICT(path) DO UPDATE SET
              name=excluded.name,
              basename=excluded.basename,
              extension=excluded.extension,
              parent_path=excluded.parent_path,
              size=excluded.size,
              mtime=excluded.mtime,
              content_hash=excluded.content_hash,
              updated_at=excluded.updated_at
            "#,
            params![path, name, basename, extension, parent_path, size as i64, now, &metadata.content_hash],
        )?;

        let file_id: i64 = tx.query_row(
            "SELECT id FROM files WHERE path = ?1",
            params![path],
            |row| row.get(0),
        )?;

        tx.execute(
            r#"
            INSERT INTO notes(file_id, title, first_heading, word_count, line_count, excerpt)
            VALUES(?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(file_id) DO UPDATE SET
              title=excluded.title,
              first_heading=excluded.first_heading,
              word_count=excluded.word_count,
              line_count=excluded.line_count,
              excerpt=excluded.excerpt
            "#,
            params![
                file_id,
                &metadata.title,
                metadata.first_heading.as_deref(),
                metadata.word_count as i64,
                metadata.line_count as i64,
                &metadata.excerpt
            ],
        )?;

        tx.execute("DELETE FROM headings WHERE file_id = ?1", params![file_id])?;
        tx.execute(
            "DELETE FROM links WHERE source_file_id = ?1",
            params![file_id],
        )?;
        tx.execute("DELETE FROM note_tags WHERE file_id = ?1", params![file_id])?;
        tx.execute(
            "DELETE FROM properties WHERE file_id = ?1",
            params![file_id],
        )?;
        tx.execute("DELETE FROM tasks WHERE file_id = ?1", params![file_id])?;
        tx.execute("DELETE FROM search_index WHERE path = ?1", params![path])?;

        for heading in &metadata.headings {
            tx.execute(
                "INSERT INTO headings(file_id, level, text, slug, line_start, line_end) VALUES(?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    file_id,
                    heading.level as i64,
                    &heading.text,
                    &heading.slug,
                    heading.line_start as i64,
                    heading.line_end as i64
                ],
            )?;
        }

        for link in &metadata.links {
            let resolved_file_id = Self::resolve_link_id_tx(&tx, &link.target_text)?;
            tx.execute(
                "INSERT INTO links(source_file_id, target_text, resolved_file_id, link_type, display_text, line, column) VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    file_id,
                    &link.target_text,
                    resolved_file_id,
                    format!("{:?}", link.link_type).to_lowercase(),
                    link.display_text.as_deref(),
                    link.line as i64,
                    link.column as i64
                ],
            )?;
        }

        for tag in &metadata.tags {
            tx.execute(
                "INSERT INTO tags(name, normalized_name) VALUES(?1, ?2) ON CONFLICT(normalized_name) DO UPDATE SET name=excluded.name",
                params![&tag.name, &tag.normalized_name],
            )?;
            let tag_id: i64 = tx.query_row(
                "SELECT id FROM tags WHERE normalized_name = ?1",
                params![&tag.normalized_name],
                |row| row.get(0),
            )?;
            tx.execute(
                "INSERT OR IGNORE INTO note_tags(file_id, tag_id) VALUES(?1, ?2)",
                params![file_id, tag_id],
            )?;
        }

        for property in &metadata.properties {
            tx.execute(
                "INSERT INTO properties(file_id, key, value_json, value_type) VALUES(?1, ?2, ?3, ?4)",
                params![file_id, &property.key, serde_json::to_string(&property.value)?, &property.value_type],
            )?;
        }

        for task in &metadata.tasks {
            tx.execute(
                "INSERT INTO tasks(file_id, text, completed, line, block_id, due_date, priority) VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    file_id,
                    &task.text,
                    task.completed as i64,
                    task.line as i64,
                    task.block_id.as_deref(),
                    task.due_date.as_deref(),
                    task.priority.as_deref()
                ],
            )?;
        }

        tx.execute(
            "INSERT INTO search_index(path, title, content) VALUES(?1, ?2, ?3)",
            params![path, &metadata.title, content],
        )?;

        tx.commit()?;
        Ok(())
    }

    pub fn list_notes(&self) -> DbResult<Vec<DbNoteRow>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT f.path, n.title, n.excerpt, n.word_count, n.line_count, f.mtime, COALESCE(GROUP_CONCAT(t.name, CHAR(31)), '')
            FROM notes n
            JOIN files f ON f.id = n.file_id
            LEFT JOIN note_tags nt ON nt.file_id = n.file_id
            LEFT JOIN tags t ON t.id = nt.tag_id
            GROUP BY f.path, n.title, n.excerpt, n.word_count, n.line_count, f.mtime
            ORDER BY f.path
            "#,
        )?;
        let rows = stmt
            .query_map([], |row| {
                Ok(DbNoteRow {
                    path: row.get(0)?,
                    title: row.get(1)?,
                    excerpt: row.get(2)?,
                    word_count: row.get::<_, i64>(3)? as usize,
                    line_count: row.get::<_, i64>(4)? as usize,
                    mtime: row.get(5)?,
                    tags: row
                        .get::<_, String>(6)?
                        .split('\u{1f}')
                        .filter(|tag| !tag.is_empty())
                        .map(ToOwned::to_owned)
                        .collect(),
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn list_tags(&self) -> DbResult<Vec<String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT name FROM tags ORDER BY normalized_name")?;
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn collection_items(&self) -> DbResult<Vec<DbCollectionRow>> {
        let mut property_stmt = self.conn.prepare(
            r#"
            SELECT f.path, p.key, p.value_json
            FROM properties p
            JOIN files f ON f.id = p.file_id
            ORDER BY f.path, p.key
            "#,
        )?;
        let mut properties_by_path: BTreeMap<String, BTreeMap<String, serde_json::Value>> =
            BTreeMap::new();
        let property_rows = property_stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })?;
        for row in property_rows {
            let (path, key, value_json) = row?;
            let value = serde_json::from_str(&value_json).unwrap_or(serde_json::Value::Null);
            properties_by_path
                .entry(path)
                .or_default()
                .insert(key, value);
        }

        let mut stmt = self.conn.prepare(
            r#"
            SELECT f.path, n.title, n.excerpt, n.word_count, f.mtime, COALESCE(GROUP_CONCAT(t.name, CHAR(31)), '')
            FROM notes n
            JOIN files f ON f.id = n.file_id
            LEFT JOIN note_tags nt ON nt.file_id = n.file_id
            LEFT JOIN tags t ON t.id = nt.tag_id
            GROUP BY f.path, n.title, n.excerpt, n.word_count, f.mtime
            ORDER BY f.mtime DESC, f.path
            "#,
        )?;
        let rows = stmt
            .query_map([], |row| {
                let path = row.get::<_, String>(0)?;
                Ok(DbCollectionRow {
                    properties: properties_by_path.remove(&path).unwrap_or_default(),
                    path,
                    title: row.get(1)?,
                    excerpt: row.get(2)?,
                    word_count: row.get::<_, i64>(3)? as usize,
                    modified_at: row.get(4)?,
                    tags: row
                        .get::<_, String>(5)?
                        .split('\u{1f}')
                        .filter(|tag| !tag.is_empty())
                        .map(ToOwned::to_owned)
                        .collect(),
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    /// Remove a note from the cache (tombstone) and rebuild graph edges.
    pub fn delete_note(&mut self, path: &str) -> DbResult<()> {
        self.delete_note_deferred(path)?;
        self.rebuild_graph_edges()?;
        Ok(())
    }

    /// Remove a note from the cache **without** rebuilding graph edges. Pair with
    /// a single [`Self::rebuild_graph_edges`] when deleting in a batch.
    pub fn delete_note_deferred(&mut self, path: &str) -> DbResult<()> {
        let tx = self.conn.transaction()?;
        tx.execute("DELETE FROM search_index WHERE path = ?1", params![path])?;
        tx.execute("DELETE FROM files WHERE path = ?1", params![path])?;
        tx.commit()?;
        Ok(())
    }

    pub fn links(&self) -> DbResult<Vec<DbLinkRow>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT sf.path, l.target_text, tf.path, l.link_type, l.display_text, l.line, l.column
            FROM links l
            JOIN files sf ON sf.id = l.source_file_id
            LEFT JOIN files tf ON tf.id = l.resolved_file_id
            "#,
        )?;
        let rows = stmt
            .query_map([], |row| {
                Ok(DbLinkRow {
                    source_path: row.get(0)?,
                    target_text: row.get(1)?,
                    resolved_path: row.get(2)?,
                    link_type: row.get(3)?,
                    display_text: row.get(4)?,
                    line: row.get::<_, i64>(5)? as usize,
                    column: row.get::<_, i64>(6)? as usize,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn backlinks(&self, path: &str) -> DbResult<Vec<BacklinkRow>> {
        let basename = path
            .rsplit('/')
            .next()
            .unwrap_or(path)
            .trim_end_matches(".md");
        let mut stmt = self.conn.prepare(
            r#"
            SELECT sf.path, sn.title, sn.excerpt, l.line
            FROM links l
            JOIN files sf ON sf.id = l.source_file_id
            JOIN notes sn ON sn.file_id = sf.id
            LEFT JOIN files tf ON tf.id = l.resolved_file_id
            WHERE tf.path = ?1 OR l.target_text = ?2
            ORDER BY sf.path
            "#,
        )?;
        let rows = stmt
            .query_map(params![path, basename], |row| {
                Ok(BacklinkRow {
                    source_path: row.get(0)?,
                    source_title: row.get(1)?,
                    excerpt: row.get(2)?,
                    line: row.get::<_, i64>(3)? as usize,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn search(&self, query: &str) -> DbResult<Vec<SearchRow>> {
        if query.trim().is_empty() {
            return Ok(Vec::new());
        }
        let mut stmt = self.conn.prepare(
            r#"
            SELECT s.path, s.title, snippet(search_index, 2, '<b>', '</b>', '...', 12), bm25(search_index) AS rank
            FROM search_index s
            WHERE search_index MATCH ?1
            ORDER BY rank
            LIMIT 50
            "#,
        )?;
        let rows = stmt
            .query_map(params![query], |row| {
                let rank: f64 = row.get(3)?;
                Ok(SearchRow {
                    path: row.get(0)?,
                    title: row.get(1)?,
                    excerpt: row.get(2)?,
                    score: 1.0 / (1.0 + rank.abs()),
                    kind: "note".to_string(),
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn health_stats(&self) -> DbResult<HealthStats> {
        let total_notes: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))?;
        let total_links: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM links", [], |row| row.get(0))?;
        let broken_links: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM links WHERE resolved_file_id IS NULL",
            [],
            |row| row.get(0),
        )?;
        let notes_without_tags: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM notes n WHERE NOT EXISTS (SELECT 1 FROM note_tags nt WHERE nt.file_id = n.file_id)",
            [],
            |row| row.get(0),
        )?;
        let orphan_notes: i64 = self.conn.query_row(
            r#"
            SELECT COUNT(*) FROM notes n
            WHERE NOT EXISTS (SELECT 1 FROM links l WHERE l.source_file_id = n.file_id OR l.resolved_file_id = n.file_id)
            "#,
            [],
            |row| row.get(0),
        )?;
        Ok(HealthStats {
            total_notes: total_notes as usize,
            total_links: total_links as usize,
            orphan_notes: orphan_notes as usize,
            broken_links: broken_links as usize,
            notes_without_tags: notes_without_tags as usize,
        })
    }

    pub fn top_connected(&self, limit: usize) -> DbResult<Vec<(String, String, usize)>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT f.path, n.title, COUNT(l.id) AS degree
            FROM notes n
            JOIN files f ON f.id = n.file_id
            LEFT JOIN links l ON l.source_file_id = n.file_id OR l.resolved_file_id = n.file_id
            GROUP BY f.path, n.title
            ORDER BY degree DESC
            LIMIT ?1
            "#,
        )?;
        let rows = stmt
            .query_map(params![limit as i64], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get::<_, i64>(2)? as usize))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    fn resolve_link_id_tx(tx: &rusqlite::Transaction<'_>, target: &str) -> DbResult<Option<i64>> {
        let normalized = target.trim().trim_end_matches(".md");
        let by_path = tx
            .query_row(
                "SELECT id FROM files WHERE path = ?1 OR path = ?2 LIMIT 1",
                params![normalized, format!("{normalized}.md")],
                |row| row.get(0),
            )
            .optional()?;
        if by_path.is_some() {
            return Ok(by_path);
        }
        let by_basename = tx
            .query_row(
                "SELECT id FROM files WHERE basename = ?1 ORDER BY path LIMIT 1",
                params![normalized.rsplit('/').next().unwrap_or(normalized)],
                |row| row.get(0),
            )
            .optional()?;
        Ok(by_basename)
    }

    /// Recompute the `graph_edges` table from resolved links. Call once after a
    /// batch of deferred upserts/deletes.
    pub fn rebuild_graph_edges(&self) -> DbResult<()> {
        self.conn.execute("DELETE FROM graph_edges", [])?;
        self.conn.execute(
            r#"
            INSERT OR REPLACE INTO graph_edges(source_file_id, target_file_id, edge_type, weight)
            SELECT source_file_id, resolved_file_id, link_type, 1.0
            FROM links
            WHERE resolved_file_id IS NOT NULL
            "#,
            [],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use lattice_indexer::parse_markdown;

    use super::LatticeDb;

    fn upsert(db: &mut LatticeDb, path: &str, content: &str) {
        let meta = parse_markdown(path, content);
        db.upsert_note(path, content, content.len() as u64, &meta)
            .unwrap();
    }

    #[test]
    fn inserts_and_searches_note() {
        let mut db = LatticeDb::in_memory().unwrap();
        upsert(&mut db, "Alpha.md", "# Alpha\n\nSee [[Beta]] and #tag.");
        let results = db.search("Alpha").unwrap();
        assert_eq!(results[0].title, "Alpha");
    }

    #[test]
    fn migrate_records_schema_version() {
        let db = LatticeDb::in_memory().unwrap();
        // Two migrations are defined (tables + indexes).
        assert_eq!(db.schema_version().unwrap(), 2);
        // migrate is idempotent.
        db.migrate().unwrap();
        assert_eq!(db.schema_version().unwrap(), 2);
    }

    #[test]
    fn content_hashes_reflect_indexed_files() {
        let mut db = LatticeDb::in_memory().unwrap();
        upsert(&mut db, "A.md", "# A");
        upsert(&mut db, "B.md", "# B");
        let hashes = db.content_hashes().unwrap();
        assert_eq!(hashes.len(), 2);
        assert!(hashes.contains_key("A.md"));
        // Re-upsert with identical content yields identical hash (skip signal).
        let before = hashes.get("A.md").cloned();
        upsert(&mut db, "A.md", "# A");
        assert_eq!(db.content_hashes().unwrap().get("A.md").cloned(), before);
    }

    #[test]
    fn delete_note_tombstones_file_and_search() {
        let mut db = LatticeDb::in_memory().unwrap();
        upsert(&mut db, "Gone.md", "# Gone\n\nfindme content");
        assert!(!db.search("findme").unwrap().is_empty());
        db.delete_note("Gone.md").unwrap();
        assert!(db.search("findme").unwrap().is_empty());
        assert!(!db.content_hashes().unwrap().contains_key("Gone.md"));
    }

    #[test]
    fn fts_matches_filename_content_and_title() {
        let mut db = LatticeDb::in_memory().unwrap();
        upsert(
            &mut db,
            "Meeting Notes.md",
            "# Quarterly Review\n\nDiscussed the budget forecast.",
        );
        // content term
        assert!(db
            .search("budget")
            .unwrap()
            .iter()
            .any(|r| r.path == "Meeting Notes.md"));
        // title/heading term (heading becomes title)
        assert!(db
            .search("Quarterly")
            .unwrap()
            .iter()
            .any(|r| r.path == "Meeting Notes.md"));
    }

    /// Core indexing + search benchmark over the real db/indexer code paths.
    /// In-memory (excludes disk IO and Tauri IPC); run manually:
    ///   cargo test -p lattice-db --release -- --ignored --nocapture core_indexing_benchmark
    #[test]
    #[ignore = "benchmark; run explicitly with --ignored --nocapture"]
    fn core_indexing_benchmark() {
        use std::time::Instant;
        for &n in &[100usize, 1_000, 10_000] {
            let mut db = LatticeDb::in_memory().unwrap();

            // Full index: parse + deferred upsert + single graph rebuild.
            let start = Instant::now();
            for i in 0..n {
                let path = format!("Note {i}.md");
                let content = format!(
                    "# Note {i}\n\nLinks [[Note {}]]. #bench body text here\n",
                    (i + 1) % n
                );
                let meta = parse_markdown(&path, &content);
                db.upsert_note_deferred(&path, &content, content.len() as u64, &meta)
                    .unwrap();
            }
            db.rebuild_graph_edges().unwrap();
            let full_index_ms = start.elapsed().as_secs_f64() * 1000.0;

            // Incremental skip: re-fetch hashes (the cheap path that powers skipping).
            let start = Instant::now();
            let hashes = db.content_hashes().unwrap();
            assert_eq!(hashes.len(), n);
            let incremental_skip_ms = start.elapsed().as_secs_f64() * 1000.0;

            // Search latency: average over 50 queries.
            let queries = 50;
            let start = Instant::now();
            for i in 0..queries {
                let _ = db.search(&format!("Note {}", i % n)).unwrap();
            }
            let avg_search_ms = (start.elapsed().as_secs_f64() * 1000.0) / queries as f64;

            // Graph data query (notes + links fetch, the graph payload inputs).
            let start = Instant::now();
            let _ = db.list_notes().unwrap();
            let _ = db.links().unwrap();
            let graph_query_ms = start.elapsed().as_secs_f64() * 1000.0;

            println!(
                "BENCH n={n:>6} full_index={full_index_ms:>9.2}ms incremental_skip={incremental_skip_ms:>7.2}ms avg_search={avg_search_ms:>6.3}ms graph_query={graph_query_ms:>8.2}ms"
            );
        }
    }

    #[test]
    fn rename_via_delete_then_insert_keeps_graph_consistent() {
        let mut db = LatticeDb::in_memory().unwrap();
        upsert(&mut db, "Source.md", "Link to [[Target]]");
        upsert(&mut db, "Target.md", "# Target");
        // backlink resolves
        assert_eq!(db.backlinks("Target.md").unwrap().len(), 1);
        // rename Target -> Renamed: delete old, insert new
        db.delete_note("Target.md").unwrap();
        upsert(&mut db, "Renamed.md", "# Renamed");
        // old backlink no longer resolves to a missing file
        assert_eq!(db.backlinks("Target.md").unwrap().len(), 1); // still matches by target_text
        assert!(db.backlinks("Renamed.md").unwrap().is_empty());
    }
}
