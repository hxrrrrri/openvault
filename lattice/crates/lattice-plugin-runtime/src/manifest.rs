use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum PluginEcosystem {
    Lattice,
    Obsidian,
}

impl Default for PluginEcosystem {
    fn default() -> Self {
        Self::Lattice
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum PluginCompatibilityLevel {
    Installable,
    Loadable,
    Functional,
    NativeQuality,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginCompatibilityReport {
    pub level: PluginCompatibilityLevel,
    pub missing_api_warnings: Vec<String>,
    pub requested_permissions: Vec<String>,
    pub desktop_only: bool,
    pub has_styles: bool,
    pub has_data: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_author")]
    pub author: String,
    #[serde(default = "default_main")]
    pub main: String,
    #[serde(default)]
    pub permissions: BTreeMap<String, Vec<String>>,
    #[serde(default)]
    pub ecosystem: PluginEcosystem,
    #[serde(default, rename = "minAppVersion")]
    pub min_app_version: Option<String>,
    #[serde(default, rename = "isDesktopOnly")]
    pub is_desktop_only: Option<bool>,
    #[serde(default)]
    pub styles: Option<String>,
}

#[derive(Debug, Error)]
pub enum ManifestError {
    #[error("plugin id is required")]
    MissingId,
    #[error("plugin main entry is required")]
    MissingMain,
    #[error("invalid plugin id: {0}")]
    InvalidId(String),
    #[error("manifest JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

impl PluginManifest {
    pub fn from_json(input: &str) -> Result<Self, ManifestError> {
        let mut manifest: PluginManifest = serde_json::from_str(input)?;
        manifest.normalize_compatibility();
        manifest.validate()?;
        Ok(manifest)
    }

    pub fn validate(&self) -> Result<(), ManifestError> {
        if self.id.trim().is_empty() {
            return Err(ManifestError::MissingId);
        }
        if self.main.trim().is_empty() {
            return Err(ManifestError::MissingMain);
        }
        if !self
            .id
            .chars()
            .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-' || ch == '_')
        {
            return Err(ManifestError::InvalidId(self.id.clone()));
        }
        Ok(())
    }

    pub fn is_obsidian_compatible(&self) -> bool {
        self.ecosystem == PluginEcosystem::Obsidian
    }

    pub fn requested_permission_ids(&self) -> Vec<String> {
        self.permissions
            .iter()
            .flat_map(|(namespace, scopes)| {
                scopes
                    .iter()
                    .map(move |scope| format!("{namespace}:{scope}"))
            })
            .collect()
    }

    pub fn compatibility_report(
        &self,
        level: PluginCompatibilityLevel,
        missing_api_warnings: Vec<String>,
        has_styles: bool,
        has_data: bool,
    ) -> PluginCompatibilityReport {
        PluginCompatibilityReport {
            level,
            missing_api_warnings,
            requested_permissions: self.requested_permission_ids(),
            desktop_only: self.is_desktop_only.unwrap_or(false),
            has_styles,
            has_data,
        }
    }

    fn normalize_compatibility(&mut self) {
        if self.ecosystem == PluginEcosystem::Lattice
            && (self.min_app_version.is_some()
                || self.is_desktop_only.is_some()
                || self.permissions.is_empty())
        {
            self.ecosystem = PluginEcosystem::Obsidian;
        }

        if self.ecosystem == PluginEcosystem::Obsidian && self.permissions.is_empty() {
            self.permissions = obsidian_default_permissions(self.is_desktop_only.unwrap_or(false));
        }

        if self.styles.is_none() {
            self.styles = Some("styles.css".to_string());
        }
    }
}

fn default_author() -> String {
    "Unknown".to_string()
}

fn default_main() -> String {
    "main.js".to_string()
}

fn obsidian_default_permissions(is_desktop_only: bool) -> BTreeMap<String, Vec<String>> {
    let mut permissions = BTreeMap::new();
    permissions.insert(
        "vault".to_string(),
        vec!["read".to_string(), "write".to_string()],
    );
    permissions.insert(
        "workspace".to_string(),
        vec![
            "read".to_string(),
            "layout".to_string(),
            "views".to_string(),
        ],
    );
    permissions.insert(
        "editor".to_string(),
        vec![
            "read".to_string(),
            "write".to_string(),
            "commands".to_string(),
        ],
    );
    permissions.insert(
        "ui".to_string(),
        vec![
            "ribbon".to_string(),
            "status-bar".to_string(),
            "settings-tab".to_string(),
            "modal".to_string(),
            "theme".to_string(),
        ],
    );
    permissions.insert("storage".to_string(), vec!["plugin-data".to_string()]);
    permissions.insert("network".to_string(), Vec::new());
    permissions.insert("secrets".to_string(), Vec::new());

    if is_desktop_only {
        permissions.insert(
            "system".to_string(),
            vec!["node-api".to_string(), "filesystem".to_string()],
        );
    }

    permissions
}

#[cfg(test)]
mod tests {
    use super::{PluginEcosystem, PluginManifest};

    #[test]
    fn validates_manifest() {
        let raw = r#"{
          "id":"example-plugin",
          "name":"Example",
          "version":"0.1.0",
          "description":"Demo",
          "author":"LATTICE",
          "main":"main.js",
          "permissions":{"vault":["read"],"commands":["register"]}
        }"#;
        assert_eq!(PluginManifest::from_json(raw).unwrap().id, "example-plugin");
    }

    #[test]
    fn accepts_obsidian_manifest_shape() {
        let raw = r#"{
          "id":"calendar",
          "name":"Calendar",
          "version":"1.5.10",
          "minAppVersion":"1.5.0",
          "description":"Calendar view",
          "author":"Obsidian Community",
          "main":"main.js",
          "isDesktopOnly":false
        }"#;
        let manifest = PluginManifest::from_json(raw).unwrap();
        assert_eq!(manifest.ecosystem, PluginEcosystem::Obsidian);
        assert_eq!(manifest.min_app_version.as_deref(), Some("1.5.0"));
        assert!(manifest.permissions.contains_key("vault"));
    }
}
