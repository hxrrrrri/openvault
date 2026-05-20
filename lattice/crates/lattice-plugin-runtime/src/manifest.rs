use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub main: String,
    pub permissions: BTreeMap<String, Vec<String>>,
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
        let manifest: PluginManifest = serde_json::from_str(input)?;
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
}

#[cfg(test)]
mod tests {
    use super::PluginManifest;

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
}
