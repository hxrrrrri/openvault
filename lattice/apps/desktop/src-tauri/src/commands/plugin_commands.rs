use std::fs;
use std::path::PathBuf;

use lattice_plugin_runtime::{PermissionGrant, PluginInfo, PluginManifest};
use tauri::State;

use crate::state::AppState;

#[tauri::command]
pub async fn list_plugins(state: State<'_, AppState>) -> Result<Vec<PluginInfo>, String> {
    state.plugins()
}

#[tauri::command]
pub async fn install_plugin_from_folder(path: String) -> Result<PluginInfo, String> {
    let manifest_path = PathBuf::from(&path).join("manifest.json");
    let raw = fs::read_to_string(&manifest_path).map_err(|error| error.to_string())?;
    let manifest = PluginManifest::from_json(&raw).map_err(|error| error.to_string())?;
    Ok(PluginInfo::from_manifest(manifest, path))
}

#[tauri::command]
pub async fn enable_plugin(_id: String) -> Result<bool, String> {
    Ok(true)
}

#[tauri::command]
pub async fn disable_plugin(_id: String) -> Result<bool, String> {
    Ok(true)
}

#[tauri::command]
pub async fn update_plugin_permissions(
    id: String,
    permissions: Vec<PermissionGrant>,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    state.update_plugin_permissions(id, permissions)
}
