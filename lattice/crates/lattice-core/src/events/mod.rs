use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexProgress {
    pub scanned_files: usize,
    pub indexed_files: usize,
    pub current_path: Option<String>,
    pub done: bool,
}
