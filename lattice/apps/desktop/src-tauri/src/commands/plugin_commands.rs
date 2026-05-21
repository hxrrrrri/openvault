use lattice_plugin_runtime::{
    inspect_plugin_folder, PermissionGrant, PluginInfo, PluginRuntimeBundle,
};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::State;

use crate::state::AppState;

#[tauri::command]
pub async fn list_plugins(state: State<'_, AppState>) -> Result<Vec<PluginInfo>, String> {
    state.plugins()
}

#[tauri::command]
pub async fn install_plugin_from_folder(
    path: String,
    state: State<'_, AppState>,
) -> Result<PluginInfo, String> {
    let installed = inspect_plugin_folder(&path).map_err(|error| error.to_string())?;
    state.install_plugin(installed.plugin)
}

#[tauri::command]
pub async fn install_obsidian_plugins_from_vault(
    path: String,
    state: State<'_, AppState>,
) -> Result<Vec<PluginInfo>, String> {
    let plugins_dir = resolve_obsidian_plugins_dir(Path::new(path.trim()))?;
    let entries = fs::read_dir(&plugins_dir).map_err(|error| error.to_string())?;
    let mut installed = Vec::new();
    let mut errors = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let folder = entry.path();
        if !folder.is_dir() || !folder.join("manifest.json").is_file() {
            continue;
        }
        match inspect_plugin_folder(&folder) {
            Ok(plugin_folder) => {
                let plugin = state.install_plugin(plugin_folder.plugin)?;
                installed.push(plugin);
            }
            Err(error) => errors.push(format!("{}: {error}", folder.display())),
        }
    }

    if installed.is_empty() && !errors.is_empty() {
        return Err(errors.join("\n"));
    }
    Ok(installed)
}

#[tauri::command]
pub async fn enable_plugin(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    state.set_plugin_enabled(id, true)
}

#[tauri::command]
pub async fn disable_plugin(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    state.set_plugin_enabled(id, false)
}

#[tauri::command]
pub async fn read_plugin_runtime_bundle(
    id: String,
    state: State<'_, AppState>,
) -> Result<PluginRuntimeBundle, String> {
    state.plugin_runtime_bundle(id)
}

#[tauri::command]
pub async fn read_plugin_data(
    id: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    state.read_plugin_data(id)
}

#[tauri::command]
pub async fn write_plugin_data(
    id: String,
    data: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    state.write_plugin_data(id, data)
}

#[tauri::command]
pub async fn update_plugin_permissions(
    id: String,
    permissions: Vec<PermissionGrant>,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    state.update_plugin_permissions(id, permissions)
}

fn resolve_obsidian_plugins_dir(path: &Path) -> Result<PathBuf, String> {
    if path.join("manifest.json").is_file() {
        return path
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| "plugin folder has no parent directory".to_string());
    }

    if path.join(".obsidian").join("plugins").is_dir() {
        return Ok(path.join(".obsidian").join("plugins"));
    }

    if path.file_name().and_then(|name| name.to_str()) == Some(".obsidian")
        && path.join("plugins").is_dir()
    {
        return Ok(path.join("plugins"));
    }

    if path.file_name().and_then(|name| name.to_str()) == Some("plugins") && path.is_dir() {
        return Ok(path.to_path_buf());
    }

    Err(format!(
        "Could not find Obsidian plugins directory under {}",
        path.display()
    ))
}
