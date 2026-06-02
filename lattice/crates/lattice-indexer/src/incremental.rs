//! Incremental indexing diff.
//!
//! Pure, dependency-free planning logic that decides which notes need to be
//! (re)indexed and which should be tombstoned, given the set of Markdown files
//! currently on disk and the content hashes already stored in the cache.
//!
//! Keeping this separate from the database and the Tauri runtime makes it cheap
//! to unit-test the create / update / delete / unchanged classification without
//! spinning up SQLite or a real vault.

use std::collections::BTreeMap;

/// A Markdown file as it currently exists on disk: its vault-relative path and
/// the SHA-256 hash of its content (the same hash stored in `files.content_hash`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileSnapshot {
    pub path: String,
    pub content_hash: String,
}

/// The work an incremental pass must perform.
///
/// * `create`  — paths present on disk but absent from the cache.
/// * `update`  — paths present in both, but with a changed content hash.
/// * `delete`  — paths present in the cache but no longer on disk (tombstones).
/// * `unchanged` — paths whose hash matches the cache; safe to skip.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct IndexPlan {
    pub create: Vec<String>,
    pub update: Vec<String>,
    pub delete: Vec<String>,
    pub unchanged: Vec<String>,
}

impl IndexPlan {
    /// Paths that must be parsed and upserted (created or updated).
    pub fn to_index(&self) -> Vec<&str> {
        self.create
            .iter()
            .chain(self.update.iter())
            .map(String::as_str)
            .collect()
    }

    /// Total number of files that will be written (indexed or tombstoned).
    pub fn changed_count(&self) -> usize {
        self.create.len() + self.update.len() + self.delete.len()
    }

    pub fn is_empty(&self) -> bool {
        self.changed_count() == 0
    }
}

/// Compute the incremental plan from the current on-disk snapshot and the
/// hashes already stored in the cache (`path -> content_hash`).
///
/// Output vectors are sorted for deterministic ordering, which keeps tests
/// stable and makes progress reporting predictable.
pub fn plan_incremental(current: &[FileSnapshot], stored: &BTreeMap<String, String>) -> IndexPlan {
    let mut plan = IndexPlan::default();
    let mut seen: BTreeMap<&str, ()> = BTreeMap::new();

    for snapshot in current {
        seen.insert(snapshot.path.as_str(), ());
        match stored.get(&snapshot.path) {
            None => plan.create.push(snapshot.path.clone()),
            Some(existing) if *existing != snapshot.content_hash => {
                plan.update.push(snapshot.path.clone())
            }
            Some(_) => plan.unchanged.push(snapshot.path.clone()),
        }
    }

    for stored_path in stored.keys() {
        if !seen.contains_key(stored_path.as_str()) {
            plan.delete.push(stored_path.clone());
        }
    }

    plan.create.sort();
    plan.update.sort();
    plan.delete.sort();
    plan.unchanged.sort();
    plan
}

#[cfg(test)]
mod tests {
    use super::*;

    fn snap(path: &str, hash: &str) -> FileSnapshot {
        FileSnapshot {
            path: path.to_string(),
            content_hash: hash.to_string(),
        }
    }

    fn stored(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
        pairs
            .iter()
            .map(|(p, h)| (p.to_string(), h.to_string()))
            .collect()
    }

    #[test]
    fn classifies_new_file_as_create() {
        let plan = plan_incremental(&[snap("A.md", "h1")], &stored(&[]));
        assert_eq!(plan.create, vec!["A.md"]);
        assert!(plan.update.is_empty());
        assert!(plan.delete.is_empty());
        assert!(plan.unchanged.is_empty());
    }

    #[test]
    fn classifies_changed_hash_as_update() {
        let plan = plan_incremental(&[snap("A.md", "new")], &stored(&[("A.md", "old")]));
        assert_eq!(plan.update, vec!["A.md"]);
        assert!(plan.create.is_empty());
        assert!(plan.unchanged.is_empty());
    }

    #[test]
    fn classifies_same_hash_as_unchanged() {
        let plan = plan_incremental(&[snap("A.md", "same")], &stored(&[("A.md", "same")]));
        assert_eq!(plan.unchanged, vec!["A.md"]);
        assert!(plan.changed_count() == 0);
        assert!(plan.is_empty());
    }

    #[test]
    fn classifies_missing_disk_file_as_delete() {
        let plan = plan_incremental(&[], &stored(&[("Gone.md", "h")]));
        assert_eq!(plan.delete, vec!["Gone.md"]);
    }

    #[test]
    fn mixed_change_set_is_partitioned_and_sorted() {
        let current = [
            snap("keep.md", "k"),
            snap("changed.md", "v2"),
            snap("brand-new.md", "n"),
        ];
        let stored = stored(&[("keep.md", "k"), ("changed.md", "v1"), ("removed.md", "r")]);
        let plan = plan_incremental(&current, &stored);
        assert_eq!(plan.create, vec!["brand-new.md"]);
        assert_eq!(plan.update, vec!["changed.md"]);
        assert_eq!(plan.delete, vec!["removed.md"]);
        assert_eq!(plan.unchanged, vec!["keep.md"]);
        assert_eq!(plan.to_index(), vec!["brand-new.md", "changed.md"]);
        assert_eq!(plan.changed_count(), 3);
    }
}
