use std::fs;
use std::path::Path;
use std::path::PathBuf;
use std::sync::Mutex;

use lattice_core::files::{list_markdown_files, scan_file_tree};
use lattice_core::{Vault, VaultInfo};
use lattice_db::LatticeDb;
use lattice_indexer::parse_markdown;
use lattice_plugin_runtime::{
    inspect_plugin_folder, read_runtime_bundle, PermissionGrant, PluginInfo, PluginManifest,
    PluginRuntimeBundle,
};
use serde::{Deserialize, Serialize};

const ENABLED_PLUGINS_FILE: &str = "community-plugins.json";
const PLUGIN_GRANTS_FILE: &str = "lattice-plugin-grants.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PluginGrantsRecord {
    #[serde(default)]
    granted_permissions: Vec<PermissionGrant>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(transparent)]
struct PluginGrantsFile(std::collections::BTreeMap<String, PluginGrantsRecord>);

impl From<std::collections::BTreeMap<String, PluginGrantsRecord>> for PluginGrantsFile {
    fn from(value: std::collections::BTreeMap<String, PluginGrantsRecord>) -> Self {
        Self(value)
    }
}

impl From<PluginGrantsFile> for std::collections::BTreeMap<String, PluginGrantsRecord> {
    fn from(value: PluginGrantsFile) -> Self {
        value.0
    }
}

use crate::terminal::TerminalRegistry;

#[derive(Default)]
pub struct AppState {
    workspace: Mutex<Option<AppWorkspace>>,
    plugins: Mutex<Vec<PluginInfo>>,
    pub terminal: TerminalRegistry,
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

    pub fn uninstall_plugin(&self, id: String) -> Result<bool, String> {
        let removed = {
            let mut guard = self
                .plugins
                .lock()
                .map_err(|_| "plugin lock poisoned".to_string())?;
            let before = guard.len();
            let target = guard.iter().find(|plugin| plugin.id == id).cloned();
            guard.retain(|plugin| plugin.id != id);
            (before != guard.len(), target, guard.clone())
        };
        let (changed, target, snapshot) = removed;
        if !changed {
            return Err(format!("plugin not installed: {id}"));
        }
        if let Some(plugin) = target {
            let installed_path = PathBuf::from(&plugin.installed_path);
            if installed_path.is_dir() {
                let _ = fs::remove_dir_all(&installed_path);
            }
            let _ = self.with_workspace(|workspace| {
                let managed = workspace.vault.lattice_dir().join("plugins").join(&id);
                if managed.is_dir() {
                    let _ = fs::remove_dir_all(managed);
                }
                Ok(())
            });
        }
        self.persist_enabled_plugins(&snapshot).ok();
        self.persist_plugin_grants(&snapshot).ok();
        Ok(true)
    }

    pub fn install_plugin(&self, plugin: PluginInfo) -> Result<PluginInfo, String> {
        let mut guard = self
            .plugins
            .lock()
            .map_err(|_| "plugin lock poisoned".to_string())?;
        let mut next = plugin;
        if let Some(existing) = guard.iter().find(|existing| existing.id == next.id) {
            preserve_plugin_state(&mut next, existing);
        }
        guard.retain(|existing| existing.id != next.id);
        guard.push(next.clone());
        Ok(next)
    }

    pub fn set_plugin_enabled(&self, id: String, enabled: bool) -> Result<bool, String> {
        let snapshot = {
            let mut guard = self
                .plugins
                .lock()
                .map_err(|_| "plugin lock poisoned".to_string())?;
            let plugin = guard
                .iter_mut()
                .find(|plugin| plugin.id == id)
                .ok_or_else(|| format!("plugin not installed: {id}"))?;
            plugin.enabled = enabled;
            guard.clone()
        };
        self.persist_enabled_plugins(&snapshot).ok();
        Ok(true)
    }

    pub fn plugin_runtime_bundle(&self, id: String) -> Result<PluginRuntimeBundle, String> {
        let guard = self
            .plugins
            .lock()
            .map_err(|_| "plugin lock poisoned".to_string())?;
        let plugin = guard
            .iter()
            .find(|plugin| plugin.id == id)
            .ok_or_else(|| format!("plugin not installed: {id}"))?;
        read_runtime_bundle(plugin).map_err(|error| error.to_string())
    }

    pub fn read_plugin_data(&self, id: String) -> Result<Option<String>, String> {
        self.assert_plugin_permission(&id, "storage:plugin-data")?;
        let plugin = self.plugin_by_id(&id)?;
        self.with_workspace(|workspace| {
            let managed = workspace
                .vault
                .lattice_dir()
                .join("plugins")
                .join(&id)
                .join("data.json");
            if managed.exists() {
                return fs::read_to_string(managed)
                    .map(Some)
                    .map_err(|error| error.to_string());
            }
            let bundled = PathBuf::from(&plugin.installed_path).join("data.json");
            if bundled.exists() {
                return fs::read_to_string(bundled)
                    .map(Some)
                    .map_err(|error| error.to_string());
            }
            Ok(None)
        })
    }

    pub fn write_plugin_data(&self, id: String, data: String) -> Result<bool, String> {
        self.assert_plugin_permission(&id, "storage:plugin-data")?;
        self.with_workspace(|workspace| {
            let directory = workspace.vault.lattice_dir().join("plugins").join(&id);
            fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
            fs::write(directory.join("data.json"), data).map_err(|error| error.to_string())?;
            Ok(true)
        })
    }

    pub fn update_plugin_permissions(
        &self,
        id: String,
        permissions: Vec<PermissionGrant>,
    ) -> Result<bool, String> {
        let snapshot = {
            let mut guard = self
                .plugins
                .lock()
                .map_err(|_| "plugin lock poisoned".to_string())?;
            if let Some(plugin) = guard.iter_mut().find(|plugin| plugin.id == id) {
                plugin.granted_permissions = permissions;
            }
            guard.clone()
        };
        self.persist_plugin_grants(&snapshot).ok();
        Ok(true)
    }

    fn persist_enabled_plugins(&self, plugins: &[PluginInfo]) -> Result<(), String> {
        self.with_workspace(|workspace| {
            let path = workspace
                .vault
                .root
                .join(".obsidian")
                .join(ENABLED_PLUGINS_FILE);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            let enabled: Vec<&str> = plugins
                .iter()
                .filter(|plugin| plugin.enabled)
                .map(|plugin| plugin.id.as_str())
                .collect();
            let json = serde_json::to_string_pretty(&enabled).map_err(|error| error.to_string())?;
            fs::write(path, json).map_err(|error| error.to_string())?;
            Ok(())
        })
    }

    fn persist_plugin_grants(&self, plugins: &[PluginInfo]) -> Result<(), String> {
        self.with_workspace(|workspace| {
            let path = workspace.vault.lattice_dir().join(PLUGIN_GRANTS_FILE);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            let payload: PluginGrantsFile = plugins
                .iter()
                .map(|plugin| {
                    (
                        plugin.id.clone(),
                        PluginGrantsRecord {
                            granted_permissions: plugin.granted_permissions.clone(),
                        },
                    )
                })
                .collect::<std::collections::BTreeMap<_, _>>()
                .into();
            let json = serde_json::to_string_pretty(&payload).map_err(|error| error.to_string())?;
            fs::write(path, json).map_err(|error| error.to_string())?;
            Ok(())
        })
    }

    fn load_persisted_state(&self, root: &Path, plugins: &mut [PluginInfo]) {
        let enabled_path = root.join(".obsidian").join(ENABLED_PLUGINS_FILE);
        if let Ok(raw) = fs::read_to_string(&enabled_path) {
            if let Ok(ids) = serde_json::from_str::<Vec<String>>(&raw) {
                let set: std::collections::HashSet<String> = ids.into_iter().collect();
                for plugin in plugins.iter_mut() {
                    plugin.enabled = set.contains(&plugin.id);
                }
            }
        }
        let grants_path = root.join(".lattice").join(PLUGIN_GRANTS_FILE);
        if let Ok(raw) = fs::read_to_string(&grants_path) {
            if let Ok(map) = serde_json::from_str::<PluginGrantsFile>(&raw) {
                let map: std::collections::BTreeMap<String, PluginGrantsRecord> = map.into();
                for plugin in plugins.iter_mut() {
                    if let Some(record) = map.get(&plugin.id) {
                        for grant in plugin.granted_permissions.iter_mut() {
                            if let Some(saved) = record
                                .granted_permissions
                                .iter()
                                .find(|saved| saved.permission == grant.permission)
                            {
                                grant.granted = saved.granted;
                                grant.last_used_at = saved.last_used_at.clone();
                            }
                        }
                    }
                }
            }
        }
    }

    pub fn assert_plugin_permission(&self, id: &str, permission: &str) -> Result<(), String> {
        let plugin = self.plugin_by_id(id)?;
        if plugin
            .granted_permissions
            .iter()
            .any(|grant| grant.permission == permission && grant.granted)
        {
            Ok(())
        } else {
            Err(format!("permission denied for {id}: {permission}"))
        }
    }

    fn plugin_by_id(&self, id: &str) -> Result<PluginInfo, String> {
        let guard = self
            .plugins
            .lock()
            .map_err(|_| "plugin lock poisoned".to_string())?;
        guard
            .iter()
            .find(|plugin| plugin.id == id)
            .cloned()
            .ok_or_else(|| format!("plugin not installed: {id}"))
    }

    fn open_workspace(&self, vault: Vault) -> Result<VaultInfo, String> {
        let db = LatticeDb::open(vault.index_db_path()).map_err(|error| error.to_string())?;
        let mut discovered_plugins = discover_obsidian_plugins(&vault.root);
        {
            let mut guard = self
                .workspace
                .lock()
                .map_err(|_| "workspace lock poisoned".to_string())?;
            *guard = Some(AppWorkspace { vault, db });
        }
        let root_for_persist = {
            let guard = self
                .workspace
                .lock()
                .map_err(|_| "workspace lock poisoned".to_string())?;
            guard
                .as_ref()
                .map(|w| w.vault.root.clone())
                .ok_or_else(|| "no vault is open".to_string())?
        };
        self.load_persisted_state(&root_for_persist, &mut discovered_plugins);
        if let Ok(mut plugins) = self.plugins.lock() {
            for plugin in &mut discovered_plugins {
                if let Some(existing) = plugins.iter().find(|existing| existing.id == plugin.id) {
                    preserve_plugin_state(plugin, existing);
                }
            }
            *plugins = discovered_plugins;
        }
        let _ = self.reindex();
        self.info()
    }
}

fn discover_obsidian_plugins(root: &Path) -> Vec<PluginInfo> {
    let plugins_dir = root.join(".obsidian").join("plugins");
    let Ok(entries) = fs::read_dir(plugins_dir) else {
        return Vec::new();
    };
    entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_dir() && path.join("manifest.json").is_file())
        .filter_map(|path| inspect_plugin_folder(path).ok().map(|folder| folder.plugin))
        .collect()
}

fn preserve_plugin_state(next: &mut PluginInfo, existing: &PluginInfo) {
    next.enabled = existing.enabled;
    for grant in &mut next.granted_permissions {
        if let Some(previous) = existing
            .granted_permissions
            .iter()
            .find(|previous| previous.permission == grant.permission)
        {
            grant.granted = previous.granted;
            grant.last_used_at = previous.last_used_at.clone();
        }
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
