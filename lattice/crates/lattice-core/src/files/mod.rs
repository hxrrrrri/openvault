use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use walkdir::WalkDir;

use crate::errors::CoreResult;
use crate::vault::Vault;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
    pub id: String,
    pub path: String,
    pub name: String,
    pub kind: String,
    pub children: Vec<FileNode>,
    pub size: Option<u64>,
    pub modified_at: Option<String>,
    pub is_markdown: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteContent {
    pub path: String,
    pub title: String,
    pub content: String,
    pub modified_at: String,
    pub word_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub path: String,
    pub content_hash: String,
    pub saved_at: String,
    pub word_count: usize,
}

pub fn scan_file_tree(vault: &Vault) -> CoreResult<Vec<FileNode>> {
    let mut roots = Vec::new();
    for entry in fs::read_dir(&vault.root)? {
        let entry = entry?;
        let path = entry.path();
        if should_ignore_path(&path) {
            continue;
        }
        roots.push(node_from_path(vault, &path)?);
    }
    roots.sort_by(|a, b| {
        a.kind
            .cmp(&b.kind)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(roots)
}

pub fn list_markdown_files(vault: &Vault) -> Vec<PathBuf> {
    WalkDir::new(&vault.root)
        .into_iter()
        .filter_entry(|entry| entry.depth() == 0 || !should_ignore_path(entry.path()))
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
        .map(|entry| entry.into_path())
        .filter(|path| {
            path.extension()
                .and_then(|ext| ext.to_str())
                .is_some_and(|ext| ext.eq_ignore_ascii_case("md"))
        })
        .collect()
}

pub fn read_note(vault: &Vault, path: &str) -> CoreResult<NoteContent> {
    let absolute = vault.resolve_user_path(path)?;
    let content = fs::read_to_string(&absolute)?;
    let metadata = fs::metadata(&absolute)?;
    Ok(NoteContent {
        path: normalize_relative(vault, &absolute),
        title: title_from_content(path, &content),
        modified_at: modified_at(&metadata),
        word_count: word_count(&content),
        content,
    })
}

pub fn write_note(vault: &Vault, path: &str, content: &str) -> CoreResult<SaveResult> {
    let absolute = vault.resolve_user_path(path)?;
    if let Some(parent) = absolute.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&absolute, content)?;
    Ok(SaveResult {
        path: normalize_relative(vault, &absolute),
        content_hash: hash_content(content),
        saved_at: Utc::now().to_rfc3339(),
        word_count: word_count(content),
    })
}

pub fn create_note(vault: &Vault, path: &str, content: &str) -> CoreResult<FileNode> {
    let absolute = vault.resolve_user_path(path)?;
    if let Some(parent) = absolute.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&absolute, content)?;
    node_from_path(vault, &absolute)
}

pub fn rename_note(vault: &Vault, old_path: &str, new_path: &str) -> CoreResult<FileNode> {
    let old_absolute = vault.resolve_user_path(old_path)?;
    let new_absolute = vault.resolve_user_path(new_path)?;
    if let Some(parent) = new_absolute.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::rename(old_absolute, &new_absolute)?;
    node_from_path(vault, &new_absolute)
}

pub fn delete_note(vault: &Vault, path: &str) -> CoreResult<bool> {
    let absolute = vault.resolve_user_path(path)?;
    if absolute.exists() {
        fs::remove_file(absolute)?;
    }
    Ok(true)
}

pub fn create_folder(vault: &Vault, path: &str) -> CoreResult<FileNode> {
    let absolute = vault.resolve_user_path(path)?;
    fs::create_dir_all(&absolute)?;
    node_from_path(vault, &absolute)
}

fn node_from_path(vault: &Vault, path: &Path) -> CoreResult<FileNode> {
    let metadata = fs::metadata(path)?;
    let kind = if metadata.is_dir() { "folder" } else { "file" };
    let mut children = Vec::new();
    if metadata.is_dir() {
        for entry in fs::read_dir(path)? {
            let entry = entry?;
            if should_ignore_path(&entry.path()) {
                continue;
            }
            children.push(node_from_path(vault, &entry.path())?);
        }
        children.sort_by(|a, b| {
            a.kind
                .cmp(&b.kind)
                .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        });
    }
    let relative = normalize_relative(vault, path);
    let is_markdown = path
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("md"));
    Ok(FileNode {
        id: relative.clone(),
        path: relative,
        name: path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .to_string(),
        kind: kind.to_string(),
        children,
        size: metadata.is_file().then_some(metadata.len()),
        modified_at: Some(modified_at(&metadata)),
        is_markdown,
    })
}

fn should_ignore_path(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| {
            matches!(
                name,
                ".git"
                    | ".hg"
                    | ".lattice"
                    | ".obsidian"
                    | ".pnpm-store"
                    | ".turbo"
                    | ".vite"
                    | ".next"
                    | "node_modules"
                    | "target"
                    | "dist"
                    | "build"
                    | "out"
                    | "coverage"
            )
        })
}

fn normalize_relative(vault: &Vault, path: &Path) -> String {
    path.strip_prefix(&vault.root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
        .trim_start_matches('/')
        .to_string()
}

fn modified_at(metadata: &fs::Metadata) -> String {
    metadata
        .modified()
        .ok()
        .map(DateTime::<Utc>::from)
        .unwrap_or_else(Utc::now)
        .to_rfc3339()
}

fn title_from_content(path: &str, content: &str) -> String {
    content
        .lines()
        .find_map(|line| {
            line.strip_prefix("# ")
                .map(str::trim)
                .map(ToOwned::to_owned)
        })
        .unwrap_or_else(|| {
            let normalized = path.replace('\\', "/");
            normalized
                .rsplit('/')
                .next()
                .unwrap_or("Untitled")
                .trim_end_matches(".md")
                .to_string()
        })
}

fn word_count(content: &str) -> usize {
    content.split_whitespace().count()
}

fn hash_content(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}
