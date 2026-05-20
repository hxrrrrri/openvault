use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::errors::{CoreError, CoreResult};

#[derive(Debug, Clone)]
pub struct Vault {
    pub root: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultInfo {
    pub name: String,
    pub path: String,
    pub note_count: usize,
    pub tag_count: usize,
    pub indexed_percent: u8,
    pub has_obsidian_config: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultState {
    pub vault: Option<VaultInfo>,
    pub indexing: bool,
}

impl Vault {
    pub fn create(path: impl AsRef<Path>) -> CoreResult<Self> {
        fs::create_dir_all(path.as_ref())?;
        let vault = Self::open(path)?;
        vault.ensure_lattice_dirs()?;
        Ok(vault)
    }

    pub fn open(path: impl AsRef<Path>) -> CoreResult<Self> {
        let root = path.as_ref();
        if !root.exists() {
            return Err(CoreError::InvalidVault(root.display().to_string()));
        }
        if !root.is_dir() {
            return Err(CoreError::InvalidVault(root.display().to_string()));
        }
        let root = root.canonicalize()?;
        let vault = Self { root };
        vault.ensure_lattice_dirs()?;
        Ok(vault)
    }

    pub fn info(&self, note_count: usize, tag_count: usize, indexed_percent: u8) -> VaultInfo {
        VaultInfo {
            name: self
                .root
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("Vault")
                .to_string(),
            path: self.root.display().to_string(),
            note_count,
            tag_count,
            indexed_percent,
            has_obsidian_config: self.root.join(".obsidian").exists(),
        }
    }

    pub fn lattice_dir(&self) -> PathBuf {
        self.root.join(".lattice")
    }

    pub fn index_db_path(&self) -> PathBuf {
        self.lattice_dir().join("index.db")
    }

    pub fn workspace_path(&self) -> PathBuf {
        self.lattice_dir().join("workspace.json")
    }

    pub fn ensure_lattice_dirs(&self) -> CoreResult<()> {
        fs::create_dir_all(self.lattice_dir().join("plugins"))?;
        fs::create_dir_all(self.lattice_dir().join("themes"))?;
        Ok(())
    }

    pub fn resolve_user_path(&self, relative: impl AsRef<Path>) -> CoreResult<PathBuf> {
        let relative = relative.as_ref();
        if relative.is_absolute()
            || relative.components().any(|component| {
                matches!(
                    component,
                    Component::ParentDir | Component::Prefix(_) | Component::RootDir
                )
            })
        {
            return Err(CoreError::PathTraversal(relative.display().to_string()));
        }
        let path = self.root.join(relative);
        let parent = path.parent().unwrap_or(&self.root);
        let canonical_parent = if parent.exists() {
            parent.canonicalize()?
        } else {
            self.root.canonicalize()?
        };
        if !canonical_parent.starts_with(&self.root) {
            return Err(CoreError::PathTraversal(path.display().to_string()));
        }
        Ok(path)
    }
}
