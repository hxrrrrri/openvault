use std::fs;
use std::path::{Component, Path, PathBuf};

use lattice_core::VaultInfo;
use tauri::{AppHandle, State};

use crate::state::{spawn_background_index, AppState, IndexStatus, IndexingSummary};

#[tauri::command]
pub async fn bootstrap_vault(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<VaultInfo, String> {
    let info = state.bootstrap_vault()?;
    spawn_background_index(app);
    Ok(info)
}

#[tauri::command]
pub async fn create_vault(
    path: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<VaultInfo, String> {
    let info = state.create_vault(path)?;
    spawn_background_index(app);
    Ok(info)
}

#[tauri::command]
pub async fn open_vault(
    path: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<VaultInfo, String> {
    let info = state.open_vault(path)?;
    spawn_background_index(app);
    Ok(info)
}

#[tauri::command]
pub async fn get_vault_state(state: State<'_, AppState>) -> Result<VaultInfo, String> {
    state.info()
}

#[tauri::command]
pub async fn list_tags(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    state.list_tags()
}

/// Full, forced reindex of every Markdown file.
#[tauri::command]
pub async fn scan_vault(state: State<'_, AppState>) -> Result<IndexingSummary, String> {
    state.reindex()
}

/// Current background indexing status (phase, progress, errors, staleness).
#[tauri::command]
pub async fn get_indexing_status(state: State<'_, AppState>) -> Result<IndexStatus, String> {
    Ok(state.indexing_status())
}

/// Request cancellation of an in-flight indexing job.
#[tauri::command]
pub async fn cancel_indexing(state: State<'_, AppState>) -> Result<bool, String> {
    state.cancel_indexing();
    Ok(true)
}

/// Kick off an incremental reindex in the background (e.g. "Rebuild index"
/// triggered manually). Returns immediately.
#[tauri::command]
pub async fn start_indexing(app: AppHandle, _state: State<'_, AppState>) -> Result<bool, String> {
    spawn_background_index(app);
    Ok(true)
}

/// Back up the cache, clear it, and rebuild the index from Markdown files.
#[tauri::command]
pub async fn rebuild_index(state: State<'_, AppState>) -> Result<IndexingSummary, String> {
    state.rebuild_index()
}

/// Start (or restart) the filesystem watcher for the open vault.
#[tauri::command]
pub async fn watch_vault(app: AppHandle, state: State<'_, AppState>) -> Result<bool, String> {
    state.start_watcher(app);
    Ok(true)
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
    if is_sensitive_path(relative) {
        return Err(format!("blocked sensitive path: {relative}"));
    }
    Ok(root.join(entry))
}

/// Deny access to credential-like files by default (env files, private keys,
/// cloud credentials). Conservative match on the file name and known secret
/// directories.
fn is_sensitive_path(relative: &str) -> bool {
    let lower = relative.replace('\\', "/").to_ascii_lowercase();
    let name = lower.rsplit('/').next().unwrap_or(&lower);
    name == ".env"
        || name.starts_with(".env.")
        || name.ends_with(".pem")
        || name.ends_with(".key")
        || name == "id_rsa"
        || name == "id_ed25519"
        || name == ".netrc"
        || name == ".npmrc"
        || name == "credentials"
        || lower.contains("/.ssh/")
        || lower.contains("/.aws/")
        || lower.contains("/.gnupg/")
}

#[cfg(test)]
mod tests {
    use super::{is_sensitive_path, safe_vault_path};
    use std::path::Path;

    #[test]
    fn rejects_path_traversal() {
        let root = Path::new("/vault");
        assert!(safe_vault_path(root, "../secret.md").is_err());
        assert!(safe_vault_path(root, "notes/../../etc/passwd").is_err());
        assert!(safe_vault_path(root, "a/../../b.md").is_err());
        // A leading slash is treated as vault-relative (stripped), not absolute.
        assert!(safe_vault_path(root, "/notes/today.md").is_ok());
    }

    #[test]
    fn allows_normal_relative_paths() {
        let root = Path::new("/vault");
        assert!(safe_vault_path(root, "notes/today.md").is_ok());
        assert!(safe_vault_path(root, "attachments/image.png").is_ok());
    }

    #[test]
    fn blocks_credential_like_paths_by_default() {
        let root = Path::new("/vault");
        assert!(safe_vault_path(root, ".env").is_err());
        assert!(safe_vault_path(root, ".env.local").is_err());
        assert!(safe_vault_path(root, "config/server.key").is_err());
        assert!(safe_vault_path(root, "certs/tls.pem").is_err());
        assert!(safe_vault_path(root, "home/.ssh/id_rsa").is_err());
        assert!(is_sensitive_path("secrets/credentials"));
        assert!(!is_sensitive_path("notes/environment.md"));
    }
}
