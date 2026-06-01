use std::fs;
use std::path::{Component, Path, PathBuf};

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

#[tauri::command]
pub async fn read_vault_binary(
    path: String,
    state: State<'_, AppState>,
) -> Result<Vec<u8>, String> {
    state.with_workspace(|workspace| {
        let resolved = safe_vault_path(&workspace.vault.root, &path)?;
        fs::read(resolved).map_err(|error| error.to_string())
    })
}

#[tauri::command]
pub async fn write_vault_binary(
    path: String,
    data: Vec<u8>,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    state.with_workspace(|workspace| {
        let resolved = safe_vault_path(&workspace.vault.root, &path)?;
        if let Some(parent) = resolved.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::write(resolved, data).map_err(|error| error.to_string())?;
        Ok(true)
    })
}

fn safe_vault_path(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let entry = Path::new(relative.trim_start_matches('/').trim_start_matches('\\'));
    if entry.is_absolute()
        || entry.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::Prefix(_) | Component::RootDir
            )
        })
    {
        return Err(format!("unsafe vault path: {relative}"));
    }
    Ok(root.join(entry))
}
