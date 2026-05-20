use lattice_db::SearchRow;
use lattice_search::SearchOptions;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::state::AppState;

#[tauri::command]
pub async fn search(
    query: String,
    options: SearchOptions,
    state: State<'_, AppState>,
) -> Result<Vec<SearchRow>, String> {
    state.with_workspace(|workspace| {
        workspace
            .db
            .search(&query)
            .map_err(|error| error.to_string())
            .map(|rows| rows.into_iter().take(options.limit.unwrap_or(50)).collect())
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandSearchResult {
    pub id: String,
    pub label: String,
    pub group: String,
    pub kind: String,
}

#[tauri::command]
pub async fn command_search(query: String) -> Result<Vec<CommandSearchResult>, String> {
    let commands = vec![
        CommandSearchResult {
            id: "note.new".to_string(),
            label: "New note".to_string(),
            group: "Quick Actions".to_string(),
            kind: "command".to_string(),
        },
        CommandSearchResult {
            id: "note.daily".to_string(),
            label: "Open daily note".to_string(),
            group: "Quick Actions".to_string(),
            kind: "command".to_string(),
        },
        CommandSearchResult {
            id: "collections.open".to_string(),
            label: "Open collections".to_string(),
            group: "Quick Actions".to_string(),
            kind: "command".to_string(),
        },
        CommandSearchResult {
            id: "ai.open".to_string(),
            label: "Open AI console".to_string(),
            group: "Quick Actions".to_string(),
            kind: "command".to_string(),
        },
        CommandSearchResult {
            id: "canvas.open".to_string(),
            label: "Open canvas".to_string(),
            group: "Quick Actions".to_string(),
            kind: "command".to_string(),
        },
        CommandSearchResult {
            id: "graph.open".to_string(),
            label: "Open graph".to_string(),
            group: "Quick Actions".to_string(),
            kind: "command".to_string(),
        },
        CommandSearchResult {
            id: "health.open".to_string(),
            label: "Open vault health".to_string(),
            group: "Quick Actions".to_string(),
            kind: "command".to_string(),
        },
        CommandSearchResult {
            id: "plugins.open".to_string(),
            label: "Open plugin marketplace".to_string(),
            group: "Quick Actions".to_string(),
            kind: "command".to_string(),
        },
    ];
    if query.trim().is_empty() {
        return Ok(commands);
    }
    let query = query.to_lowercase();
    Ok(commands
        .into_iter()
        .filter(|command| command.label.to_lowercase().contains(&query))
        .collect())
}
