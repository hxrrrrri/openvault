use portable_pty::PtySize;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, State};

use crate::state::AppState;
use crate::terminal::{adapter_statuses, TerminalAdapterStatus, TerminalSessionInfo};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalStartRequest {
    pub cli_id: String,
    pub cols: Option<u16>,
    pub rows: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalResizeRequest {
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[tauri::command]
pub async fn list_terminal_adapters() -> Result<Vec<TerminalAdapterStatus>, String> {
    Ok(adapter_statuses())
}

#[tauri::command]
pub async fn list_terminal_sessions(
    state: State<'_, AppState>,
) -> Result<Vec<TerminalSessionInfo>, String> {
    state.terminal.list_sessions()
}

#[tauri::command]
pub async fn start_terminal_session(
    request: TerminalStartRequest,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<TerminalSessionInfo, String> {
    let (cwd, vault_root) = state.with_workspace(|workspace| {
        let vault_root = workspace.vault.root.clone();
        let cwd = discover_project_root(&vault_root).unwrap_or_else(|| vault_root.clone());
        Ok((cwd, vault_root))
    })?;
    let size = PtySize {
        cols: request.cols.unwrap_or(120).clamp(20, 500),
        rows: request.rows.unwrap_or(32).clamp(5, 200),
        pixel_width: 0,
        pixel_height: 0,
    };
    state
        .terminal
        .create_session(request.cli_id, cwd, vault_root, app, size)
}

#[tauri::command]
pub async fn get_terminal_history(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    state.terminal.history(&session_id)
}

#[tauri::command]
pub async fn write_terminal_input(
    session_id: String,
    data: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    state.terminal.write_input(&session_id, &data)
}

#[tauri::command]
pub async fn resize_terminal_session(
    request: TerminalResizeRequest,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    state.terminal.resize(
        &request.session_id,
        request.cols.clamp(20, 500),
        request.rows.clamp(5, 200),
    )
}

#[tauri::command]
pub async fn kill_terminal_session(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    state.terminal.kill(&session_id)
}

#[tauri::command]
pub async fn kill_all_terminal_sessions(state: State<'_, AppState>) -> Result<bool, String> {
    state.terminal.kill_all()
}

fn discover_project_root(vault_root: &Path) -> Option<PathBuf> {
    std::env::current_dir()
        .ok()
        .and_then(|cwd| find_lattice_repo_root(&cwd))
        .or_else(|| find_lattice_repo_root(vault_root))
}

fn find_lattice_repo_root(start: &Path) -> Option<PathBuf> {
    for ancestor in start.ancestors() {
        if ancestor.join(".git").exists() && ancestor.join("lattice/package.json").exists() {
            return Some(ancestor.to_path_buf());
        }
        if ancestor.join("package.json").exists()
            && ancestor.join("Cargo.toml").exists()
            && ancestor.join("apps/desktop").exists()
        {
            return Some(ancestor.to_path_buf());
        }
    }
    None
}
