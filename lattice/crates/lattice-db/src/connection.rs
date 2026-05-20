use std::path::Path;

use chrono::Utc;
use lattice_indexer::metadata::NoteMetadata;
use rusqlite::{params, Connection, OptionalExtension};
use thiserror::Error;

use crate::migrations::MIGRATION_001;
use crate::repositories::{BacklinkRow, DbLinkRow, DbNoteRow, HealthStats, SearchRow};

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

    pub fn migrate(&self) -> DbResult<()> {
        self.conn.execute_batch(MIGRATION_001)?;
        Ok(())
    }

    pub fn upsert_note(
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
        self.rebuild_graph_edges()?;
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

    pub fn delete_note(&mut self, path: &str) -> DbResult<()> {
        let tx = self.conn.transaction()?;
        tx.execute("DELETE FROM search_index WHERE path = ?1", params![path])?;
        tx.execute("DELETE FROM files WHERE path = ?1", params![path])?;
        tx.commit()?;
        self.rebuild_graph_edges()?;
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

    fn rebuild_graph_edges(&self) -> DbResult<()> {
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

    #[test]
    fn inserts_and_searches_note() {
        let mut db = LatticeDb::in_memory().unwrap();
        let content = "# Alpha\n\nSee [[Beta]] and #tag.";
        let meta = parse_markdown("Alpha.md", content);
        db.upsert_note("Alpha.md", content, content.len() as u64, &meta)
            .unwrap();
        let results = db.search("Alpha").unwrap();
        assert_eq!(results[0].title, "Alpha");
    }
}
