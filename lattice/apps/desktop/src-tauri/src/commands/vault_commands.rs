use lattice_core::VaultInfo;
use tauri::State;

use crate::state::{AppState, IndexingSummary};

#[tauri::command]
pub async fn bootstrap_vault(state: State<'_, AppState>) -> Result<VaultInfo, String> {
    state.bootstrap_vault()
}

#[tauri::command]
pub async fn create_vault(path: String, state: State<'_, AppState>) -> Result<VaultInfo, String> {
    state.create_vault(path)
}

#[tauri::command]
pub async fn open_vault(path: String, state: State<'_, AppState>) -> Result<VaultInfo, String> {
    state.open_vault(path)
}

#[tauri::command]
pub async fn get_vault_state(state: State<'_, AppState>) -> Result<VaultInfo, String> {
    state.info()
}

#[tauri::command]
pub async fn list_tags(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    state.list_tags()
}

#[tauri::command]
pub async fn scan_vault(state: State<'_, AppState>) -> Result<IndexingSummary, String> {
    state.reindex()
}

#[tauri::command]
pub async fn watch_vault() -> Result<bool, String> {
    Ok(false)
}
