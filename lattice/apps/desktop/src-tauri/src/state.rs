use std::fs;
use std::path::Path;
use std::path::PathBuf;
use std::sync::Mutex;

use lattice_core::files::{list_markdown_files, scan_file_tree};
use lattice_core::{Vault, VaultInfo};
use lattice_db::LatticeDb;
use lattice_indexer::parse_markdown;
use lattice_plugin_runtime::{PermissionGrant, PluginInfo, PluginManifest};
use serde::Serialize;

#[derive(Default)]
pub struct AppState {
    workspace: Mutex<Option<AppWorkspace>>,
    plugins: Mutex<Vec<PluginInfo>>,
}

pub struct AppWorkspace {
    pub vault: Vault,
    pub db: LatticeDb,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexingSummary {
    pub scanned_files: usize,
    pub indexed_files: usize,
    pub skipped_files: usize,
    pub duration_ms: u128,
}

impl AppState {
    pub fn bootstrap_vault(&self) -> Result<VaultInfo, String> {
        let path = default_vault_path();
        let vault = Vault::create(&path).map_err(|error| error.to_string())?;
        self.open_workspace(vault)
    }

    pub fn create_vault(&self, path: String) -> Result<VaultInfo, String> {
        let vault = Vault::create(path).map_err(|error| error.to_string())?;
        self.open_workspace(vault)
    }

    pub fn open_vault(&self, path: String) -> Result<VaultInfo, String> {
        let vault = Vault::open(path).map_err(|error| error.to_string())?;
        self.open_workspace(vault)
    }

    pub fn info(&self) -> Result<VaultInfo, String> {
        let guard = self
            .workspace
            .lock()
            .map_err(|_| "workspace lock poisoned".to_string())?;
        let workspace = guard
            .as_ref()
            .ok_or_else(|| "no vault is open".to_string())?;
        let notes = workspace
            .db
            .list_notes()
            .map_err(|error| error.to_string())?;
        let tags = workspace
            .db
            .list_tags()
            .map_err(|error| error.to_string())?;
        Ok(workspace.vault.info(notes.len(), tags.len(), 100))
    }

    pub fn with_workspace<T>(
        &self,
        f: impl FnOnce(&AppWorkspace) -> Result<T, String>,
    ) -> Result<T, String> {
        let guard = self
            .workspace
            .lock()
            .map_err(|_| "workspace lock poisoned".to_string())?;
        let workspace = guard
            .as_ref()
            .ok_or_else(|| "no vault is open".to_string())?;
        f(workspace)
    }

    pub fn with_workspace_mut<T>(
        &self,
        f: impl FnOnce(&mut AppWorkspace) -> Result<T, String>,
    ) -> Result<T, String> {
        let mut guard = self
            .workspace
            .lock()
            .map_err(|_| "workspace lock poisoned".to_string())?;
        let workspace = guard
            .as_mut()
            .ok_or_else(|| "no vault is open".to_string())?;
        f(workspace)
    }

    pub fn reindex(&self) -> Result<IndexingSummary, String> {
        self.with_workspace_mut(|workspace| {
            let start = std::time::Instant::now();
            let files = list_markdown_files(&workspace.vault);
            let mut indexed = 0usize;
            for absolute in &files {
                let content = fs::read_to_string(absolute).map_err(|error| error.to_string())?;
                let relative = relative_path(&workspace.vault.root, absolute);
                let metadata = parse_markdown(&relative, &content);
                workspace
                    .db
                    .upsert_note(&relative, &content, content.len() as u64, &metadata)
                    .map_err(|error| error.to_string())?;
                indexed += 1;
            }
            Ok(IndexingSummary {
                scanned_files: files.len(),
                indexed_files: indexed,
                skipped_files: files.len().saturating_sub(indexed),
                duration_ms: start.elapsed().as_millis(),
            })
        })
    }

    pub fn list_files(&self) -> Result<Vec<lattice_core::FileNode>, String> {
        self.with_workspace(|workspace| {
            scan_file_tree(&workspace.vault).map_err(|error| error.to_string())
        })
    }

    pub fn list_tags(&self) -> Result<Vec<String>, String> {
        self.with_workspace(|workspace| workspace.db.list_tags().map_err(|error| error.to_string()))
    }

    pub fn plugins(&self) -> Result<Vec<PluginInfo>, String> {
        let guard = self
            .plugins
            .lock()
            .map_err(|_| "plugin lock poisoned".to_string())?;
        Ok(guard.clone())
    }

    pub fn update_plugin_permissions(
        &self,
        id: String,
        permissions: Vec<PermissionGrant>,
    ) -> Result<bool, String> {
        let mut guard = self
            .plugins
            .lock()
            .map_err(|_| "plugin lock poisoned".to_string())?;
        if let Some(plugin) = guard.iter_mut().find(|plugin| plugin.id == id) {
            plugin.granted_permissions = permissions;
        }
        Ok(true)
    }

    fn open_workspace(&self, vault: Vault) -> Result<VaultInfo, String> {
        let db = LatticeDb::open(vault.index_db_path()).map_err(|error| error.to_string())?;
        {
            let mut guard = self
                .workspace
                .lock()
                .map_err(|_| "workspace lock poisoned".to_string())?;
            *guard = Some(AppWorkspace { vault, db });
        }
        let _ = self.reindex();
        self.info()
    }
}

fn default_vault_path() -> PathBuf {
    if let Ok(path) = std::env::var("LATTICE_VAULT_PATH") {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            return PathBuf::from(user_profile)
                .join("Documents")
                .join("Lattice Vault");
        }
    }

    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home).join("Lattice Vault");
    }

    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("Lattice Vault")
}

pub fn relative_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
        .trim_start_matches('/')
        .to_string()
}

#[allow(dead_code)]
pub fn built_in_embedding_plugin() -> PluginInfo {
    let manifest = PluginManifest::from_json(
        r#"{
          "id":"embeddings-local",
          "name":"Embeddings Local",
          "version":"0.1.0",
          "description":"Run a small embedding model on-device for semantic search.",
          "author":"lattice.core",
          "main":"main.js",
          "permissions":{"vault":["read"],"ai":["embeddings"],"secrets":["read"]}
        }"#,
    )
    .expect("sample manifest is valid");
    let mut plugin = PluginInfo::from_manifest(manifest, ".lattice/plugins/embeddings-local");
    plugin.enabled = true;
    plugin.granted_permissions.iter_mut().for_each(|grant| {
        grant.granted = grant.permission != "secrets:read";
    });
    plugin
}
