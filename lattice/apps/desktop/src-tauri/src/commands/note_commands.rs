use std::fs;

use base64::{engine::general_purpose, Engine as _};
use lattice_core::files;
use lattice_core::{FileNode, NoteContent, SaveResult};
use lattice_indexer::metadata::NoteMetadata;
use lattice_indexer::parse_markdown;
use serde::Serialize;
use tauri::State;

use crate::state::relative_path;
use crate::state::AppState;
use crate::state::IndexingSummary;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnlinkedMention {
    pub source_path: String,
    pub source_title: String,
    pub excerpt: String,
    pub line: usize,
    pub match_text: String,
}

#[tauri::command]
pub async fn list_files(state: State<'_, AppState>) -> Result<Vec<FileNode>, String> {
    state.list_files()
}

#[tauri::command]
pub async fn read_note(path: String, state: State<'_, AppState>) -> Result<NoteContent, String> {
    state.with_workspace(|workspace| {
        files::read_note(&workspace.vault, &path).map_err(|error| error.to_string())
    })
}

#[tauri::command]
pub async fn write_note(
    path: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<SaveResult, String> {
    state.with_workspace_mut(|workspace| {
        let result = files::write_note(&workspace.vault, &path, &content)
            .map_err(|error| error.to_string())?;
        let meta = parse_markdown(&path, &content);
        workspace
            .db
            .upsert_note(&path, &content, content.len() as u64, &meta)
            .map_err(|error| error.to_string())?;
        Ok(result)
    })
}

#[tauri::command]
pub async fn create_note(
    path: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<FileNode, String> {
    state.with_workspace_mut(|workspace| {
        let node = files::create_note(&workspace.vault, &path, &content)
            .map_err(|error| error.to_string())?;
        let meta = parse_markdown(&path, &content);
        workspace
            .db
            .upsert_note(&path, &content, content.len() as u64, &meta)
            .map_err(|error| error.to_string())?;
        Ok(node)
    })
}

#[tauri::command]
pub async fn rename_note(
    old_path: String,
    new_path: String,
    state: State<'_, AppState>,
) -> Result<FileNode, String> {
    state.with_workspace_mut(|workspace| {
        let node = files::rename_note(&workspace.vault, &old_path, &new_path)
            .map_err(|error| error.to_string())?;
        workspace
            .db
            .delete_note(&old_path)
            .map_err(|error| error.to_string())?;
        let note =
            files::read_note(&workspace.vault, &new_path).map_err(|error| error.to_string())?;
        let meta = parse_markdown(&new_path, &note.content);
        workspace
            .db
            .upsert_note(&new_path, &note.content, note.content.len() as u64, &meta)
            .map_err(|error| error.to_string())?;
        Ok(node)
    })
}

#[tauri::command]
pub async fn delete_note(path: String, state: State<'_, AppState>) -> Result<bool, String> {
    state.with_workspace_mut(|workspace| {
        let result =
            files::delete_note(&workspace.vault, &path).map_err(|error| error.to_string())?;
        workspace
            .db
            .delete_note(&path)
            .map_err(|error| error.to_string())?;
        Ok(result)
    })
}

#[tauri::command]
pub async fn create_folder(path: String, state: State<'_, AppState>) -> Result<FileNode, String> {
    state.with_workspace(|workspace| {
        files::create_folder(&workspace.vault, &path).map_err(|error| error.to_string())
    })
}

#[tauri::command]
pub async fn get_note_metadata(
    path: String,
    state: State<'_, AppState>,
) -> Result<NoteMetadata, String> {
    state.with_workspace(|workspace| {
        let note = files::read_note(&workspace.vault, &path).map_err(|error| error.to_string())?;
        Ok(parse_markdown(path, &note.content))
    })
}

#[tauri::command]
pub async fn get_unlinked_mentions(
    path: String,
    state: State<'_, AppState>,
) -> Result<Vec<UnlinkedMention>, String> {
    state.with_workspace(|workspace| {
        let active =
            files::read_note(&workspace.vault, &path).map_err(|error| error.to_string())?;
        let basename = basename_without_extension(&path);
        let mut needles = vec![active.title, basename.to_string()];
        needles.sort();
        needles.dedup();
        needles.retain(|needle| !needle.trim().is_empty());

        let mut mentions = Vec::new();
        for absolute in files::list_markdown_files(&workspace.vault) {
            let source_path = relative_path(&workspace.vault.root, &absolute);
            if source_path == path {
                continue;
            }
            let Ok(content) = fs::read_to_string(&absolute) else {
                continue;
            };
            for (line_index, line) in content.lines().enumerate() {
                if needles.iter().any(|needle| {
                    contains_plain_mention(line, needle) && !contains_wikilink_to(line, needle)
                }) {
                    mentions.push(UnlinkedMention {
                        source_path: source_path.clone(),
                        source_title: title_from_content(&source_path, &content),
                        excerpt: line.trim().chars().take(220).collect(),
                        line: line_index + 1,
                        match_text: needles[0].clone(),
                    });
                    break;
                }
            }
        }
        Ok(mentions)
    })
}

#[tauri::command]
pub async fn convert_unlinked_mention(
    source_path: String,
    target_path: String,
    line: usize,
    state: State<'_, AppState>,
) -> Result<NoteContent, String> {
    state.with_workspace_mut(|workspace| {
        let target_title = basename_without_extension(&target_path);
        let absolute = workspace
            .vault
            .resolve_user_path(&source_path)
            .map_err(|error| error.to_string())?;
        let content = fs::read_to_string(&absolute).map_err(|error| error.to_string())?;
        let mut lines: Vec<String> = content.lines().map(ToOwned::to_owned).collect();
        let line_index = line.saturating_sub(1);
        let selected_line = lines
            .get_mut(line_index)
            .ok_or_else(|| format!("line {line} not found in {source_path}"))?;
        let replacement = format!("[[{target_title}]]");
        let changed = replace_first_case_insensitive(selected_line, &target_title, &replacement);
        if !changed {
            return Err(format!(
                "no unlinked mention of {target_title} found on line {line}"
            ));
        }

        let updated = preserve_trailing_newline(&content, &lines.join("\n"));
        files::write_note(&workspace.vault, &source_path, &updated)
            .map_err(|error| error.to_string())?;
        let meta = parse_markdown(&source_path, &updated);
        workspace
            .db
            .upsert_note(&source_path, &updated, updated.len() as u64, &meta)
            .map_err(|error| error.to_string())?;
        files::read_note(&workspace.vault, &source_path).map_err(|error| error.to_string())
    })
}

#[tauri::command]
pub async fn reindex_note(
    path: String,
    state: State<'_, AppState>,
) -> Result<NoteMetadata, String> {
    state.with_workspace_mut(|workspace| {
        let note = files::read_note(&workspace.vault, &path).map_err(|error| error.to_string())?;
        let meta = parse_markdown(&path, &note.content);
        workspace
            .db
            .upsert_note(&path, &note.content, note.content.len() as u64, &meta)
            .map_err(|error| error.to_string())?;
        Ok(meta)
    })
}

#[tauri::command]
pub async fn read_asset_data_url(
    path: String,
    base_path: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state.with_workspace(|workspace| {
        let clean_path = path
            .split('|')
            .next()
            .unwrap_or(&path)
            .trim()
            .trim_start_matches('/');
        let mut candidates = Vec::new();

        if let Some(base_path) = base_path.as_deref() {
            if let Some((parent, _)) = base_path.replace('\\', "/").rsplit_once('/') {
                if !parent.is_empty() {
                    candidates.push(format!("{parent}/{clean_path}"));
                }
            }
        }
        candidates.push(clean_path.to_string());

        let mut last_error = None;
        for candidate in candidates {
            match workspace.vault.resolve_user_path(&candidate) {
                Ok(absolute) if absolute.exists() && absolute.is_file() => {
                    let bytes = fs::read(&absolute).map_err(|error| error.to_string())?;
                    let mime = mime_for(&absolute);
                    let encoded = general_purpose::STANDARD.encode(bytes);
                    return Ok(format!("data:{mime};base64,{encoded}"));
                }
                Ok(_) => {}
                Err(error) => last_error = Some(error.to_string()),
            }
        }

        Err(last_error.unwrap_or_else(|| format!("asset not found: {clean_path}")))
    })
}

fn mime_for(path: &std::path::Path) -> &'static str {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or_default()
        .to_lowercase()
        .as_str()
    {
        "apng" => "image/apng",
        "avif" => "image/avif",
        "gif" => "image/gif",
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "mp3" => "audio/mpeg",
        "ogg" => "audio/ogg",
        "wav" => "audio/wav",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "pdf" => "application/pdf",
        _ => "application/octet-stream",
    }
}

fn basename_without_extension(path: &str) -> String {
    let normalized = path.replace('\\', "/");
    normalized
        .rsplit('/')
        .next()
        .unwrap_or(path)
        .trim_end_matches(".md")
        .to_string()
}

fn title_from_content(path: &str, content: &str) -> String {
    content
        .lines()
        .find_map(|line| {
            line.strip_prefix("# ")
                .map(str::trim)
                .map(ToOwned::to_owned)
        })
        .unwrap_or_else(|| basename_without_extension(path))
}

fn contains_plain_mention(line: &str, needle: &str) -> bool {
    let line = line.to_lowercase();
    let needle = needle.to_lowercase();
    line.contains(&needle)
}

fn contains_wikilink_to(line: &str, needle: &str) -> bool {
    let line = line.to_lowercase();
    let needle = needle.to_lowercase();
    line.contains(&format!("[[{needle}")) || line.contains(&format!("|{needle}]]"))
}

fn replace_first_case_insensitive(value: &mut String, needle: &str, replacement: &str) -> bool {
    if let Some(index) = value.find(needle) {
        value.replace_range(index..index + needle.len(), replacement);
        return true;
    }
    let lower_value = value.to_lowercase();
    let lower_needle = needle.to_lowercase();
    if let Some(index) = lower_value.find(&lower_needle) {
        value.replace_range(index..index + needle.len(), replacement);
        return true;
    }
    false
}

fn preserve_trailing_newline(original: &str, updated: &str) -> String {
    if original.ends_with('\n') {
        format!("{updated}\n")
    } else {
        updated.to_string()
    }
}

#[tauri::command]
pub async fn reindex_vault(state: State<'_, AppState>) -> Result<IndexingSummary, String> {
    state.reindex()
}
