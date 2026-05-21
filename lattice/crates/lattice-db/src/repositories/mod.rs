use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DbNoteRow {
    pub path: String,
    pub title: String,
    pub excerpt: String,
    pub word_count: usize,
    pub line_count: usize,
    pub mtime: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DbCollectionRow {
    pub path: String,
    pub title: String,
    pub excerpt: String,
    pub properties: BTreeMap<String, Value>,
    pub tags: Vec<String>,
    pub modified_at: String,
    pub word_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DbLinkRow {
    pub source_path: String,
    pub target_text: String,
    pub resolved_path: Option<String>,
    pub link_type: String,
    pub display_text: Option<String>,
    pub line: usize,
    pub column: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BacklinkRow {
    pub source_path: String,
    pub source_title: String,
    pub excerpt: String,
    pub line: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchRow {
    pub path: String,
    pub title: String,
    pub excerpt: String,
    pub score: f64,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HealthStats {
    pub total_notes: usize,
    pub total_links: usize,
    pub orphan_notes: usize,
    pub broken_links: usize,
    pub notes_without_tags: usize,
}
