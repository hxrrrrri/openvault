use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceConfig {
    pub active_note: Option<String>,
    pub left_sidebar_open: bool,
    pub right_sidebar_open: bool,
    pub theme: String,
}
