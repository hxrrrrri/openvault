use serde::{Deserialize, Serialize};

use crate::manifest::PluginManifest;
use crate::permissions::PermissionGrant;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub enabled: bool,
    pub installed_path: String,
    pub manifest: PluginManifest,
    pub granted_permissions: Vec<PermissionGrant>,
}

impl PluginInfo {
    pub fn from_manifest(manifest: PluginManifest, installed_path: impl Into<String>) -> Self {
        let granted_permissions = manifest
            .permissions
            .iter()
            .flat_map(|(namespace, scopes)| {
                scopes.iter().map(move |scope| PermissionGrant {
                    permission: format!("{namespace}:{scope}"),
                    granted: false,
                    last_used_at: None,
                })
            })
            .collect();
        Self {
            id: manifest.id.clone(),
            name: manifest.name.clone(),
            version: manifest.version.clone(),
            description: manifest.description.clone(),
            author: manifest.author.clone(),
            enabled: false,
            installed_path: installed_path.into(),
            manifest,
            granted_permissions,
        }
    }
}
