use std::fs;
use std::path::Path;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Instant;

use chrono::Utc;
use lattice_core::files::{list_markdown_files, scan_file_tree};
use lattice_core::{Vault, VaultInfo};
use lattice_db::LatticeDb;
use lattice_indexer::{content_hash, parse_markdown, plan_incremental, FileSnapshot};
use lattice_plugin_runtime::{
    inspect_plugin_folder, read_runtime_bundle, PermissionGrant, PluginInfo, PluginManifest,
    PluginRuntimeBundle,
};
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::events::INDEX_PROGRESS_EVENT;

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
    index: Mutex<IndexStatus>,
    cancel_index: AtomicBool,
    watcher: Mutex<Option<RecommendedWatcher>>,
    audit_log: Mutex<Vec<PermissionAuditEntry>>,
}

const MAX_AUDIT_ENTRIES: usize = 1000;
const SECRETS_FILE: &str = "plugin-secrets.json";

/// One entry in the plugin permission-use audit log. Records every gated action
/// a plugin attempts, whether it was allowed, and what it targeted.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionAuditEntry {
    pub plugin_id: String,
    pub permission: String,
    pub action: String,
    pub target: Option<String>,
    pub timestamp: String,
    pub allowed: bool,
}

/// On-disk per-plugin secret store: `plugin_id -> (key -> value)`. Secrets are
/// scoped to the plugin that owns them; a plugin can only ever reach its own
/// namespace because the broker keys by the calling plugin's id.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(transparent)]
struct SecretsFile(std::collections::BTreeMap<String, std::collections::BTreeMap<String, String>>);

pub struct AppWorkspace {
    pub vault: Vault,
    pub db: LatticeDb,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum IndexPhase {
    /// No indexing has run yet for the current vault.
    #[default]
    Idle,
    /// Walking the vault and hashing files to compute the change set.
    Scanning,
    /// Writing changed/created/deleted notes into the cache.
    Indexing,
    /// Finished successfully.
    Completed,
    /// Aborted by the user.
    Cancelled,
    /// Stopped on an error (see `error`).
    Failed,
}

/// Snapshot of the indexing job, emitted to the frontend on every progress tick
/// via [`crate::events::INDEX_PROGRESS_EVENT`] and queryable on demand.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct IndexStatus {
    pub phase: IndexPhase,
    pub processed: usize,
    pub total: usize,
    pub message: Option<String>,
    pub error: Option<String>,
    /// True when the cache may be out of date relative to disk (e.g. right after
    /// opening a vault, before the background job completes).
    pub stale: bool,
    pub last_summary: Option<IndexingSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct IndexingSummary {
    pub scanned_files: usize,
    pub indexed_files: usize,
    pub skipped_files: usize,
    pub created_files: usize,
    pub updated_files: usize,
    pub deleted_files: usize,
    pub errors: Vec<String>,
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

    /// Full, forced reindex of every Markdown file (used by the manual
    /// `scan_vault` / `reindex_vault` commands). Uses deferred upserts plus a
    /// single graph rebuild to avoid the O(n^2) per-note edge rebuild.
    pub fn reindex(&self) -> Result<IndexingSummary, String> {
        self.with_workspace_mut(|workspace| {
            let start = Instant::now();
            let files = list_markdown_files(&workspace.vault);
            let mut indexed = 0usize;
            let mut errors = Vec::new();
            for absolute in &files {
                let relative = relative_path(&workspace.vault.root, absolute);
                match fs::read_to_string(absolute) {
                    Ok(content) => {
                        let metadata = parse_markdown(&relative, &content);
                        match workspace.db.upsert_note_deferred(
                            &relative,
                            &content,
                            content.len() as u64,
                            &metadata,
                        ) {
                            Ok(()) => indexed += 1,
                            Err(error) => errors.push(format!("{relative}: {error}")),
                        }
                    }
                    Err(error) => errors.push(format!("{relative}: {error}")),
                }
            }
            workspace
                .db
                .rebuild_graph_edges()
                .map_err(|error| error.to_string())?;
            Ok(IndexingSummary {
                scanned_files: files.len(),
                indexed_files: indexed,
                skipped_files: files.len().saturating_sub(indexed),
                created_files: indexed,
                updated_files: 0,
                deleted_files: 0,
                errors,
                duration_ms: start.elapsed().as_millis(),
            })
        })
    }

    /// Incremental indexing: hash files on disk, skip unchanged ones, upsert
    /// changed/created notes, and tombstone removed ones. File IO and hashing
    /// happen off the workspace lock; only the per-note database writes acquire
    /// it, keeping the UI responsive. Emits a status snapshot through `emit` as
    /// it progresses and honors the cancellation flag.
    pub fn run_indexing(&self, emit: impl Fn(&IndexStatus)) -> Result<IndexingSummary, String> {
        self.cancel_index.store(false, Ordering::SeqCst);
        let start = Instant::now();

        self.publish_status(&emit, |status| {
            status.phase = IndexPhase::Scanning;
            status.processed = 0;
            status.total = 0;
            status.error = None;
            status.stale = true;
            status.message = Some("Scanning vault".into());
        });

        let (files, root) = self.with_workspace(|workspace| {
            Ok((
                list_markdown_files(&workspace.vault),
                workspace.vault.root.clone(),
            ))
        })?;

        let mut snapshots = Vec::with_capacity(files.len());
        let mut contents: std::collections::HashMap<String, (String, u64)> =
            std::collections::HashMap::new();
        let mut errors = Vec::new();
        for absolute in &files {
            if self.cancel_index.load(Ordering::SeqCst) {
                return Ok(self.finish_cancelled(&emit, start));
            }
            let relative = relative_path(&root, absolute);
            match fs::read_to_string(absolute) {
                Ok(content) => {
                    snapshots.push(FileSnapshot {
                        path: relative.clone(),
                        content_hash: content_hash(&content),
                    });
                    let size = content.len() as u64;
                    contents.insert(relative, (content, size));
                }
                Err(error) => errors.push(format!("{relative}: {error}")),
            }
        }

        let stored = self
            .with_workspace(|workspace| workspace.db.content_hashes().map_err(|e| e.to_string()))?;
        let plan = plan_incremental(&snapshots, &stored);
        let created = plan.create.len();
        let updated = plan.update.len();
        let deleted = plan.delete.len();
        let total = plan.changed_count();

        self.publish_status(&emit, |status| {
            status.phase = IndexPhase::Indexing;
            status.processed = 0;
            status.total = total;
            status.message = Some(format!("Indexing {total} changed file(s)"));
        });

        let to_index: Vec<String> = plan.to_index().into_iter().map(String::from).collect();
        let mut processed = 0usize;

        for path in to_index {
            if self.cancel_index.load(Ordering::SeqCst) {
                let _ = self
                    .with_workspace_mut(|w| w.db.rebuild_graph_edges().map_err(|e| e.to_string()));
                return Ok(self.finish_cancelled(&emit, start));
            }
            if let Some((content, size)) = contents.get(&path) {
                let metadata = parse_markdown(&path, content);
                if let Err(error) = self.with_workspace_mut(|w| {
                    w.db.upsert_note_deferred(&path, content, *size, &metadata)
                        .map_err(|e| e.to_string())
                }) {
                    errors.push(format!("{path}: {error}"));
                }
            }
            processed += 1;
            if processed.is_multiple_of(16) || processed == total {
                self.publish_status(&emit, |status| status.processed = processed);
            }
        }

        for path in &plan.delete {
            if let Err(error) = self
                .with_workspace_mut(|w| w.db.delete_note_deferred(path).map_err(|e| e.to_string()))
            {
                errors.push(format!("{path}: {error}"));
            }
            processed += 1;
            self.publish_status(&emit, |status| status.processed = processed);
        }

        self.with_workspace_mut(|w| w.db.rebuild_graph_edges().map_err(|e| e.to_string()))?;

        let summary = IndexingSummary {
            scanned_files: snapshots.len(),
            indexed_files: created + updated,
            skipped_files: plan.unchanged.len(),
            created_files: created,
            updated_files: updated,
            deleted_files: deleted,
            errors: errors.clone(),
            duration_ms: start.elapsed().as_millis(),
        };

        self.publish_status(&emit, |status| {
            status.phase = if errors.is_empty() {
                IndexPhase::Completed
            } else {
                IndexPhase::Failed
            };
            status.processed = total;
            status.total = total;
            status.stale = false;
            status.error = errors.first().cloned();
            status.message = Some(if errors.is_empty() {
                "Index up to date".into()
            } else {
                format!("Indexed with {} error(s)", errors.len())
            });
            status.last_summary = Some(summary.clone());
        });

        Ok(summary)
    }

    /// Back up the existing cache, clear it, and run a full reindex from the
    /// Markdown files. Used by the "Rebuild index" command and corrupt-DB
    /// recovery.
    pub fn rebuild_index(&self) -> Result<IndexingSummary, String> {
        if let Ok(db_path) = self.with_workspace(|w| Ok(w.vault.index_db_path())) {
            if db_path.exists() {
                let backup = db_path.with_extension("db.bak");
                let _ = fs::copy(&db_path, &backup);
            }
        }
        self.with_workspace_mut(|w| w.db.clear_index().map_err(|e| e.to_string()))?;
        self.reindex()
    }

    /// Current indexing job status (for the status-bar indicator).
    pub fn indexing_status(&self) -> IndexStatus {
        match self.index.lock() {
            Ok(guard) => guard.clone(),
            Err(poisoned) => poisoned.into_inner().clone(),
        }
    }

    /// Request cancellation of an in-flight indexing job.
    pub fn cancel_indexing(&self) {
        self.cancel_index.store(true, Ordering::SeqCst);
    }

    fn mark_index_pending(&self) {
        if let Ok(mut guard) = self.index.lock() {
            *guard = IndexStatus {
                phase: IndexPhase::Idle,
                stale: true,
                message: Some("Indexing pending".into()),
                ..Default::default()
            };
        }
        self.cancel_index.store(false, Ordering::SeqCst);
    }

    fn publish_status(&self, emit: &impl Fn(&IndexStatus), update: impl FnOnce(&mut IndexStatus)) {
        let snapshot = {
            let mut guard = match self.index.lock() {
                Ok(guard) => guard,
                Err(poisoned) => poisoned.into_inner(),
            };
            update(&mut guard);
            guard.clone()
        };
        emit(&snapshot);
    }

    fn finish_cancelled(&self, emit: &impl Fn(&IndexStatus), start: Instant) -> IndexingSummary {
        let summary = IndexingSummary {
            duration_ms: start.elapsed().as_millis(),
            ..Default::default()
        };
        self.publish_status(emit, |status| {
            status.phase = IndexPhase::Cancelled;
            status.message = Some("Indexing cancelled".into());
            status.stale = true;
            status.last_summary = Some(summary.clone());
        });
        summary
    }

    /// Start a filesystem watcher that triggers a debounced incremental reindex
    /// whenever Markdown files change. Best-effort: any failure is swallowed so
    /// a missing watcher never breaks the app. Only `.md` events trigger a
    /// reindex, which also avoids a feedback loop from cache writes.
    pub fn start_watcher(&self, app: AppHandle) {
        let root = match self.with_workspace(|w| Ok(w.vault.root.clone())) {
            Ok(root) => root,
            Err(_) => return,
        };
        let (tx, rx) = std::sync::mpsc::channel();
        let mut watcher = match RecommendedWatcher::new(
            move |res| {
                let _ = tx.send(res);
            },
            notify::Config::default(),
        ) {
            Ok(watcher) => watcher,
            Err(_) => return,
        };
        if watcher.watch(&root, RecursiveMode::Recursive).is_err() {
            return;
        }
        // Keep the watcher alive by storing it; replaces any previous one.
        if let Ok(mut guard) = self.watcher.lock() {
            *guard = Some(watcher);
        }

        let app_for_thread = app;
        std::thread::spawn(move || {
            let debounce = std::time::Duration::from_millis(400);
            while let Ok(first) = rx.recv() {
                let mut relevant = event_touches_markdown(&first);
                // Coalesce a burst of events within the debounce window.
                while let Ok(event) = rx.recv_timeout(debounce) {
                    relevant = relevant || event_touches_markdown(&event);
                }
                if !relevant {
                    continue;
                }
                let state = app_for_thread.state::<AppState>();
                let _ = state.run_indexing(|status| {
                    let _ = app_for_thread.emit(INDEX_PROGRESS_EVENT, status);
                });
            }
        });
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
        self.check_permission(id, permission, "access", None)
    }

    /// Check a permission and record the attempt in the audit log. `action`
    /// describes the operation (e.g. "request-url", "read-secret") and `target`
    /// the resource it touched (a URL, a secret key). Returns `Err` when denied.
    pub fn check_permission(
        &self,
        id: &str,
        permission: &str,
        action: &str,
        target: Option<&str>,
    ) -> Result<(), String> {
        let plugin = self.plugin_by_id(id)?;
        let allowed = plugin
            .granted_permissions
            .iter()
            .any(|grant| grant.permission == permission && grant.granted);
        self.record_permission_use(id, permission, action, target, allowed);
        if allowed {
            Ok(())
        } else {
            Err(format!("permission denied for {id}: {permission}"))
        }
    }

    fn record_permission_use(
        &self,
        plugin_id: &str,
        permission: &str,
        action: &str,
        target: Option<&str>,
        allowed: bool,
    ) {
        if let Ok(mut log) = self.audit_log.lock() {
            log.push(PermissionAuditEntry {
                plugin_id: plugin_id.to_string(),
                permission: permission.to_string(),
                action: action.to_string(),
                target: target.map(ToOwned::to_owned),
                timestamp: Utc::now().to_rfc3339(),
                allowed,
            });
            let len = log.len();
            if len > MAX_AUDIT_ENTRIES {
                log.drain(0..len - MAX_AUDIT_ENTRIES);
            }
        }
    }

    /// Snapshot of the permission-use audit log (most recent last).
    pub fn permission_audit_log(&self) -> Vec<PermissionAuditEntry> {
        match self.audit_log.lock() {
            Ok(log) => log.clone(),
            Err(poisoned) => poisoned.into_inner().clone(),
        }
    }

    /// Read a scoped secret for a plugin. Requires the `secrets:read` permission;
    /// the raw value is never returned unless that grant is present. The access
    /// is recorded in the audit log either way.
    pub fn read_plugin_secret(&self, id: &str, key: &str) -> Result<Option<String>, String> {
        self.check_permission(id, "secrets:read", "read-secret", Some(key))?;
        self.with_workspace(|workspace| {
            let path = workspace.vault.lattice_dir().join(SECRETS_FILE);
            if !path.exists() {
                return Ok(None);
            }
            let raw = fs::read_to_string(&path).map_err(|error| error.to_string())?;
            let file: SecretsFile = serde_json::from_str(&raw).unwrap_or_default();
            Ok(file.0.get(id).and_then(|scope| scope.get(key)).cloned())
        })
    }

    /// Write a scoped secret for a plugin. Requires the `secrets:write`
    /// permission. Stored under the plugin's own namespace.
    pub fn write_plugin_secret(&self, id: &str, key: &str, value: &str) -> Result<bool, String> {
        self.check_permission(id, "secrets:write", "write-secret", Some(key))?;
        self.with_workspace(|workspace| {
            let dir = workspace.vault.lattice_dir();
            fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
            let path = dir.join(SECRETS_FILE);
            let mut file: SecretsFile = if path.exists() {
                let raw = fs::read_to_string(&path).map_err(|error| error.to_string())?;
                serde_json::from_str(&raw).unwrap_or_default()
            } else {
                SecretsFile::default()
            };
            file.0
                .entry(id.to_string())
                .or_default()
                .insert(key.to_string(), value.to_string());
            let json = serde_json::to_string_pretty(&file).map_err(|error| error.to_string())?;
            fs::write(&path, json).map_err(|error| error.to_string())?;
            Ok(true)
        })
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
        // Do NOT index synchronously here — that would block the open call. Mark
        // the cache stale; the caller spawns the background indexing job (see
        // `spawn_background_index`) which reindexes and starts the watcher.
        self.mark_index_pending();
        self.info()
    }
}

/// Spawn the background indexing job for the currently open vault and, once the
/// initial pass finishes, start the filesystem watcher. Called by the vault
/// open/create/bootstrap commands so workspace open returns immediately.
pub fn spawn_background_index(app: AppHandle) {
    std::thread::spawn(move || {
        let state = app.state::<AppState>();
        let _ = state.run_indexing(|status| {
            let _ = app.emit(INDEX_PROGRESS_EVENT, status);
        });
        state.start_watcher(app.clone());
    });
}

fn event_touches_markdown(event: &Result<notify::Event, notify::Error>) -> bool {
    match event {
        Ok(event) => event.paths.iter().any(|path| {
            path.extension()
                .and_then(|ext| ext.to_str())
                .is_some_and(|ext| ext.eq_ignore_ascii_case("md"))
        }),
        Err(_) => false,
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

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_vault_dir() -> PathBuf {
        let mut dir = std::env::temp_dir();
        let unique = format!(
            "lattice-index-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        dir.push(unique);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn open_state(dir: &Path) -> AppState {
        let state = AppState::default();
        state
            .open_vault(dir.to_string_lossy().to_string())
            .expect("open vault");
        state
    }

    #[test]
    fn open_vault_does_not_index_synchronously_and_marks_pending() {
        let dir = temp_vault_dir();
        fs::write(dir.join("Note.md"), "# Note").unwrap();
        let state = open_state(&dir);
        let status = state.indexing_status();
        assert_eq!(status.phase, IndexPhase::Idle);
        assert!(status.stale, "cache should be marked stale until indexed");
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn incremental_indexing_tracks_create_update_delete() {
        let dir = temp_vault_dir();
        fs::write(dir.join("A.md"), "# A\n\nlinks to [[B]]").unwrap();
        fs::write(dir.join("B.md"), "# B\n\nfindme content").unwrap();
        let state = open_state(&dir);

        // First pass: both files are new.
        let first = state.run_indexing(|_| {}).unwrap();
        assert_eq!(first.created_files, 2);
        assert_eq!(first.updated_files, 0);
        assert_eq!(first.deleted_files, 0);
        let status = state.indexing_status();
        assert_eq!(status.phase, IndexPhase::Completed);
        assert!(!status.stale);

        // Second pass: nothing changed, everything skipped.
        let second = state.run_indexing(|_| {}).unwrap();
        assert_eq!(second.created_files, 0);
        assert_eq!(second.updated_files, 0);
        assert_eq!(second.skipped_files, 2);

        // Update A only.
        fs::write(dir.join("A.md"), "# A changed\n\nbrand new body").unwrap();
        let third = state.run_indexing(|_| {}).unwrap();
        assert_eq!(third.updated_files, 1);
        assert_eq!(third.skipped_files, 1);

        // Search still finds B before deletion.
        let before = state
            .with_workspace(|w| w.db.search("findme").map_err(|e| e.to_string()))
            .unwrap();
        assert!(!before.is_empty());

        // Delete B -> tombstoned, removed from search.
        fs::remove_file(dir.join("B.md")).unwrap();
        let fourth = state.run_indexing(|_| {}).unwrap();
        assert_eq!(fourth.deleted_files, 1);
        let after = state
            .with_workspace(|w| w.db.search("findme").map_err(|e| e.to_string()))
            .unwrap();
        assert!(
            after.is_empty(),
            "deleted note should leave the search index"
        );

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn progress_events_are_emitted_during_indexing() {
        let dir = temp_vault_dir();
        for i in 0..3 {
            fs::write(dir.join(format!("n{i}.md")), format!("# Note {i}")).unwrap();
        }
        let state = open_state(&dir);
        let phases = std::sync::Mutex::new(Vec::new());
        state
            .run_indexing(|status| phases.lock().unwrap().push(status.phase))
            .unwrap();
        let seen = phases.into_inner().unwrap();
        assert!(seen.contains(&IndexPhase::Scanning));
        assert!(seen.contains(&IndexPhase::Indexing));
        assert!(seen.last() == Some(&IndexPhase::Completed));
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn rebuild_index_reindexes_from_markdown_files() {
        let dir = temp_vault_dir();
        fs::write(dir.join("Hello.md"), "# Hello world").unwrap();
        let state = open_state(&dir);
        state.run_indexing(|_| {}).unwrap();
        let summary = state.rebuild_index().unwrap();
        assert_eq!(summary.indexed_files, 1);
        fs::remove_dir_all(&dir).ok();
    }

    fn make_plugin(id: &str, permissions_json: &str) -> PluginInfo {
        let manifest = PluginManifest::from_json(&format!(
            r#"{{"id":"{id}","name":"{id}","version":"0.1.0","description":"t","author":"t","main":"main.js","permissions":{permissions_json}}}"#
        ))
        .expect("valid test manifest");
        let mut plugin = PluginInfo::from_manifest(manifest, ".lattice/plugins/test");
        plugin.enabled = true;
        plugin
    }

    fn grant_all(state: &AppState, id: &str) {
        let mut grants = state
            .plugins()
            .unwrap()
            .into_iter()
            .find(|p| p.id == id)
            .unwrap()
            .granted_permissions;
        for grant in grants.iter_mut() {
            grant.granted = true;
        }
        state
            .update_plugin_permissions(id.to_string(), grants)
            .unwrap();
    }

    #[test]
    fn network_permission_denied_then_allowed_is_audited() {
        let state = AppState::default();
        state
            .install_plugin(make_plugin("net", r#"{"network":["http"]}"#))
            .unwrap();

        // Without a grant, the gated action is denied.
        assert!(state
            .assert_plugin_permission("net", "network:http")
            .is_err());

        // Grant it, then the same action is allowed.
        grant_all(&state, "net");
        assert!(state
            .assert_plugin_permission("net", "network:http")
            .is_ok());

        let log = state.permission_audit_log();
        assert!(
            log.iter()
                .any(|e| e.permission == "network:http" && !e.allowed),
            "deny should be recorded"
        );
        assert!(
            log.iter()
                .any(|e| e.permission == "network:http" && e.allowed),
            "allow should be recorded"
        );
    }

    #[test]
    fn secret_broker_enforces_permission_and_scopes_by_plugin() {
        let dir = temp_vault_dir();
        let state = open_state(&dir);

        // Plugin WITH secrets read+write can round-trip its own secret.
        state
            .install_plugin(make_plugin(
                "vault-secrets",
                r#"{"secrets":["read","write"]}"#,
            ))
            .unwrap();
        grant_all(&state, "vault-secrets");
        assert!(state
            .write_plugin_secret("vault-secrets", "token", "s3cr3t")
            .is_ok());
        assert_eq!(
            state.read_plugin_secret("vault-secrets", "token").unwrap(),
            Some("s3cr3t".to_string())
        );

        // Plugin WITHOUT the grant is denied raw secret access.
        state
            .install_plugin(make_plugin("nosecrets", r#"{"secrets":["read"]}"#))
            .unwrap();
        assert!(state.read_plugin_secret("nosecrets", "token").is_err());

        // The denied read was audited.
        assert!(state
            .permission_audit_log()
            .iter()
            .any(|e| e.plugin_id == "nosecrets" && e.action == "read-secret" && !e.allowed));

        fs::remove_dir_all(&dir).ok();
    }
}
