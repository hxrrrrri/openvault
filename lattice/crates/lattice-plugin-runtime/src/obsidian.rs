use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::manifest::{
    PluginCompatibilityLevel, PluginCompatibilityReport, PluginEcosystem, PluginManifest,
};
use crate::permissions::PermissionGrant;
use crate::registry::PluginInfo;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginRuntimeBundle {
    pub id: String,
    pub installed_path: String,
    pub manifest: PluginManifest,
    pub main_source: String,
    pub styles_source: Option<String>,
    pub initial_data_source: Option<String>,
    pub granted_permissions: Vec<PermissionGrant>,
    pub compatibility: PluginCompatibilityReport,
}

#[derive(Debug, Clone)]
pub struct InstalledPluginFolder {
    pub plugin: PluginInfo,
    pub main_path: PathBuf,
    pub styles_path: Option<PathBuf>,
    pub data_path: Option<PathBuf>,
}

#[derive(Debug, Error)]
pub enum PluginInstallError {
    #[error("plugin manifest not found: {0}")]
    MissingManifest(String),
    #[error("plugin main entry not found: {0}")]
    MissingMain(String),
    #[error("unsafe plugin path entry: {0}")]
    UnsafePath(String),
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("manifest error: {0}")]
    Manifest(#[from] crate::manifest::ManifestError),
}

pub fn inspect_plugin_folder(
    path: impl AsRef<Path>,
) -> Result<InstalledPluginFolder, PluginInstallError> {
    let folder = path.as_ref();
    let manifest_path = folder.join("manifest.json");
    if !manifest_path.exists() {
        return Err(PluginInstallError::MissingManifest(
            manifest_path.display().to_string(),
        ));
    }

    let raw = fs::read_to_string(&manifest_path)?;
    let manifest = PluginManifest::from_json(&raw)?;
    let main_path = safe_child_path(folder, &manifest.main)?;
    if !main_path.exists() || !main_path.is_file() {
        return Err(PluginInstallError::MissingMain(
            main_path.display().to_string(),
        ));
    }

    let styles_path = manifest
        .styles
        .as_deref()
        .and_then(|styles| safe_child_path(folder, styles).ok())
        .filter(|candidate| candidate.exists() && candidate.is_file());
    let data_path = safe_child_path(folder, "data.json")
        .ok()
        .filter(|candidate| candidate.exists() && candidate.is_file());
    let source = fs::read_to_string(&main_path)?;
    let warnings = compatibility_warnings(&manifest, &source);
    let level = if manifest.ecosystem == PluginEcosystem::Obsidian {
        PluginCompatibilityLevel::Loadable
    } else {
        PluginCompatibilityLevel::NativeQuality
    };
    let compatibility =
        manifest.compatibility_report(level, warnings, styles_path.is_some(), data_path.is_some());
    let plugin = PluginInfo::from_manifest_with_compatibility(
        manifest,
        folder.display().to_string(),
        compatibility,
    );

    Ok(InstalledPluginFolder {
        plugin,
        main_path,
        styles_path,
        data_path,
    })
}

pub fn read_runtime_bundle(plugin: &PluginInfo) -> Result<PluginRuntimeBundle, PluginInstallError> {
    let folder = PathBuf::from(&plugin.installed_path);
    let main_path = safe_child_path(&folder, &plugin.manifest.main)?;
    if !main_path.exists() || !main_path.is_file() {
        return Err(PluginInstallError::MissingMain(
            main_path.display().to_string(),
        ));
    }
    let styles_source = plugin
        .manifest
        .styles
        .as_deref()
        .and_then(|styles| safe_child_path(&folder, styles).ok())
        .filter(|candidate| candidate.exists() && candidate.is_file())
        .map(fs::read_to_string)
        .transpose()?;
    let initial_data_source = safe_child_path(&folder, "data.json")
        .ok()
        .filter(|candidate| candidate.exists() && candidate.is_file())
        .map(fs::read_to_string)
        .transpose()?;

    Ok(PluginRuntimeBundle {
        id: plugin.id.clone(),
        installed_path: plugin.installed_path.clone(),
        manifest: plugin.manifest.clone(),
        main_source: fs::read_to_string(main_path)?,
        styles_source,
        initial_data_source,
        granted_permissions: plugin.granted_permissions.clone(),
        compatibility: plugin.compatibility.clone(),
    })
}

fn safe_child_path(folder: &Path, entry: &str) -> Result<PathBuf, PluginInstallError> {
    let relative = Path::new(entry);
    if relative.is_absolute()
        || relative.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::Prefix(_) | Component::RootDir
            )
        })
    {
        return Err(PluginInstallError::UnsafePath(entry.to_string()));
    }
    Ok(folder.join(relative))
}

fn compatibility_warnings(_manifest: &PluginManifest, source: &str) -> Vec<String> {
    let mut warnings = Vec::new();
    if source.contains("require(\"electron\")")
        || source.contains("require('electron')")
        || source.contains("from \"electron\"")
        || source.contains("from 'electron'")
    {
        warnings.push(
            "Uses Electron APIs — most internals are unavailable; main IPC may not work."
                .to_string(),
        );
    }
    if source.contains("require(\"child_process\")") || source.contains("require('child_process')")
    {
        warnings.push("Spawns child processes — not supported in the sandbox.".to_string());
    }
    warnings.sort();
    warnings.dedup();
    warnings
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    use crate::manifest::PluginCompatibilityLevel;

    use super::inspect_plugin_folder;

    #[test]
    fn installs_standard_obsidian_plugin_folder() {
        let root = temp_plugin_dir();
        fs::create_dir_all(&root).unwrap();
        fs::write(
            root.join("manifest.json"),
            r#"{
              "id":"sample-plugin",
              "name":"Sample Plugin",
              "version":"1.0.0",
              "minAppVersion":"1.5.0",
              "description":"Sample",
              "author":"Obsidian Community",
              "main":"main.js",
              "isDesktopOnly":false
            }"#,
        )
        .unwrap();
        fs::write(
            root.join("main.js"),
            "module.exports = class SamplePlugin {};",
        )
        .unwrap();
        fs::write(root.join("styles.css"), ".sample-plugin { color: red; }").unwrap();
        fs::write(root.join("data.json"), r#"{"enabled":true}"#).unwrap();

        let installed = inspect_plugin_folder(&root).unwrap();

        assert_eq!(installed.plugin.id, "sample-plugin");
        assert_eq!(
            installed.plugin.compatibility.level,
            PluginCompatibilityLevel::Loadable
        );
        assert!(installed.plugin.compatibility.has_styles);
        assert!(installed.plugin.compatibility.has_data);
        assert!(installed
            .plugin
            .granted_permissions
            .iter()
            .any(|grant| grant.permission == "vault:read" && !grant.granted));

        fs::remove_dir_all(root).unwrap();
    }

    fn temp_plugin_dir() -> PathBuf {
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis();
        std::env::temp_dir().join(format!(
            "lattice-plugin-runtime-test-{}-{}",
            std::process::id(),
            millis
        ))
    }
}
