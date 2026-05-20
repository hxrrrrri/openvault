use std::collections::BTreeMap;
use std::fs;

use lattice_core::files;
use lattice_indexer::parse_markdown;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

use crate::state::{relative_path, AppState};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionQuery {
    pub folder: Option<String>,
    pub text: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionItem {
    pub path: String,
    pub title: String,
    pub excerpt: String,
    pub properties: BTreeMap<String, Value>,
    pub tags: Vec<String>,
    pub modified_at: String,
    pub word_count: usize,
}

#[tauri::command]
pub async fn list_collection_items(
    query: CollectionQuery,
    state: State<'_, AppState>,
) -> Result<Vec<CollectionItem>, String> {
    state.with_workspace(|workspace| {
        let folder = query
            .folder
            .as_deref()
            .map(normalize_folder)
            .filter(|value| !value.is_empty());
        let text = query
            .text
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_lowercase);
        let mut items = Vec::new();

        for absolute in files::list_markdown_files(&workspace.vault) {
            let path = relative_path(&workspace.vault.root, &absolute);
            if let Some(folder) = folder.as_deref() {
                if !path.starts_with(folder) {
                    continue;
                }
            }

            let content = fs::read_to_string(&absolute).map_err(|error| error.to_string())?;
            let metadata = parse_markdown(&path, &content);
            let haystack =
                format!("{} {} {}", metadata.title, metadata.excerpt, content).to_lowercase();
            if let Some(text) = text.as_deref() {
                if !haystack.contains(text) {
                    continue;
                }
            }

            let mut properties = BTreeMap::new();
            for property in metadata.properties {
                properties.insert(property.key, property.value);
            }
            let modified_at = fs::metadata(&absolute)
                .ok()
                .and_then(|metadata| metadata.modified().ok())
                .map(chrono::DateTime::<chrono::Utc>::from)
                .unwrap_or_else(chrono::Utc::now)
                .to_rfc3339();

            items.push(CollectionItem {
                path,
                title: metadata.title,
                excerpt: metadata.excerpt,
                properties,
                tags: metadata.tags.into_iter().map(|tag| tag.name).collect(),
                modified_at,
                word_count: metadata.word_count,
            });
        }

        items.sort_by(|a, b| {
            b.modified_at
                .cmp(&a.modified_at)
                .then_with(|| a.path.cmp(&b.path))
        });
        Ok(items)
    })
}

fn normalize_folder(folder: &str) -> String {
    folder
        .replace('\\', "/")
        .trim()
        .trim_start_matches('/')
        .trim_end_matches('/')
        .to_string()
}
