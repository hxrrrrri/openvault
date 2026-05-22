use lattice_graph::{
    build_graph, build_local_graph, Backlink, GraphFilters, GraphPayload, OutgoingLink,
    UnresolvedLink,
};
use tauri::State;

use crate::state::AppState;

#[tauri::command]
pub async fn get_global_graph(
    _filters: GraphFilters,
    state: State<'_, AppState>,
) -> Result<GraphPayload, String> {
    state.with_workspace(|workspace| {
        let notes = workspace
            .db
            .list_notes()
            .map_err(|error| error.to_string())?;
        let links = workspace.db.links().map_err(|error| error.to_string())?;
        Ok(build_graph(&notes, &links, None))
    })
}

#[tauri::command]
pub async fn get_local_graph(
    path: String,
    depth: u8,
    state: State<'_, AppState>,
) -> Result<GraphPayload, String> {
    state.with_workspace(|workspace| {
        let notes = workspace
            .db
            .list_notes()
            .map_err(|error| error.to_string())?;
        let links = workspace.db.links().map_err(|error| error.to_string())?;
        Ok(build_local_graph(&notes, &links, &path, depth))
    })
}

#[tauri::command]
pub async fn get_backlinks(
    path: String,
    state: State<'_, AppState>,
) -> Result<Vec<Backlink>, String> {
    state.with_workspace(|workspace| {
        let rows = workspace
            .db
            .backlinks(&path)
            .map_err(|error| error.to_string())?;
        Ok(rows
            .into_iter()
            .map(|row| Backlink {
                source_path: row.source_path,
                source_title: row.source_title,
                excerpt: row.excerpt,
                line: row.line,
            })
            .collect())
    })
}

#[tauri::command]
pub async fn get_outgoing_links(
    path: String,
    state: State<'_, AppState>,
) -> Result<Vec<OutgoingLink>, String> {
    state.with_workspace(|workspace| {
        Ok(workspace
            .db
            .links()
            .map_err(|error| error.to_string())?
            .into_iter()
            .filter(|link| link.source_path == path)
            .map(|link| OutgoingLink {
                target_text: link.target_text,
                resolved_path: link.resolved_path,
                link_type: link.link_type,
                line: link.line,
            })
            .collect())
    })
}

#[tauri::command]
pub async fn get_unresolved_links(
    path: String,
    state: State<'_, AppState>,
) -> Result<Vec<UnresolvedLink>, String> {
    state.with_workspace(|workspace| {
        Ok(workspace
            .db
            .links()
            .map_err(|error| error.to_string())?
            .into_iter()
            .filter(|link| link.source_path == path && link.resolved_path.is_none())
            .map(|link| UnresolvedLink {
                source_path: link.source_path,
                target_text: link.target_text,
                line: link.line,
            })
            .collect())
    })
}
