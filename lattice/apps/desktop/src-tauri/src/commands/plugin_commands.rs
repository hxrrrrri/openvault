use lattice_plugin_runtime::{
    inspect_plugin_folder, PermissionGrant, PluginInfo, PluginManifest, PluginRuntimeBundle,
};
use reqwest::header::ACCEPT;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::State;

use crate::state::{AppState, PermissionAuditEntry};

const OBSIDIAN_REGISTRY_URL: &str =
    "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json";
const OBSIDIAN_PLUGIN_STATS_URL: &str =
    "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json";
const GITHUB_API_ACCEPT: &str = "application/vnd.github+json, application/json";
const TEXT_ACCEPT: &str = "text/plain, application/octet-stream, */*";

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ObsidianCommunityPlugin {
    pub id: String,
    pub name: String,
    pub author: String,
    pub description: String,
    pub repo: String,
    #[serde(default)]
    pub downloads: Option<u64>,
    #[serde(default)]
    pub updated_at: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
struct ObsidianPluginStatsEntry {
    #[serde(default)]
    downloads: Option<u64>,
    #[serde(default)]
    updated: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
struct GithubReleaseAsset {
    name: String,
    browser_download_url: String,
}

#[derive(Debug, Clone, Deserialize)]
struct GithubRelease {
    #[allow(dead_code)]
    tag_name: Option<String>,
    #[serde(default)]
    assets: Vec<GithubReleaseAsset>,
}

#[derive(Debug, Clone, Deserialize)]
struct GithubRepository {
    default_branch: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct GithubContentFile {
    download_url: Option<String>,
}

struct DownloadedPluginSources {
    manifest_json: String,
    main_source: String,
    styles_source: Option<String>,
}

#[tauri::command]
pub async fn list_plugins(state: State<'_, AppState>) -> Result<Vec<PluginInfo>, String> {
    state.plugins()
}

#[tauri::command]
pub async fn list_obsidian_community_plugins() -> Result<Vec<ObsidianCommunityPlugin>, String> {
    let client = http_client()?;
    let stats = fetch_json::<HashMap<String, ObsidianPluginStatsEntry>>(
        &client,
        OBSIDIAN_PLUGIN_STATS_URL,
        GITHUB_API_ACCEPT,
    )
    .await
    .unwrap_or_default();
    let plugins = fetch_json::<Vec<ObsidianCommunityPlugin>>(
        &client,
        OBSIDIAN_REGISTRY_URL,
        GITHUB_API_ACCEPT,
    )
    .await?;

    Ok(plugins
        .into_iter()
        .filter(|plugin| !plugin.id.trim().is_empty() && !plugin.repo.trim().is_empty())
        .map(|mut plugin| {
            if let Some(entry) = stats.get(&plugin.id) {
                plugin.downloads = entry.downloads;
                plugin.updated_at = entry.updated;
            }
            plugin
        })
        .collect())
}

#[tauri::command]
pub async fn install_plugin_from_folder(
    path: String,
    state: State<'_, AppState>,
) -> Result<PluginInfo, String> {
    let installed = inspect_plugin_folder(&path).map_err(|error| error.to_string())?;
    state.install_plugin(installed.plugin)
}

#[tauri::command]
pub async fn install_obsidian_plugins_from_vault(
    path: String,
    state: State<'_, AppState>,
) -> Result<Vec<PluginInfo>, String> {
    let plugins_dir = resolve_obsidian_plugins_dir(Path::new(path.trim()))?;
    let entries = fs::read_dir(&plugins_dir).map_err(|error| error.to_string())?;
    let mut installed = Vec::new();
    let mut errors = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let folder = entry.path();
        if !folder.is_dir() || !folder.join("manifest.json").is_file() {
            continue;
        }
        match inspect_plugin_folder(&folder) {
            Ok(plugin_folder) => {
                let plugin = state.install_plugin(plugin_folder.plugin)?;
                installed.push(plugin);
            }
            Err(error) => errors.push(format!("{}: {error}", folder.display())),
        }
    }

    if installed.is_empty() && !errors.is_empty() {
        return Err(errors.join("\n"));
    }
    Ok(installed)
}

#[tauri::command]
pub async fn install_obsidian_community_plugin(
    repo: String,
    state: State<'_, AppState>,
) -> Result<PluginInfo, String> {
    let repo = normalize_github_repo(&repo)?;
    let client = http_client()?;
    let sources = download_community_plugin(&client, &repo).await?;
    install_obsidian_sources(
        sources.manifest_json,
        sources.main_source,
        sources.styles_source,
        state.inner(),
    )
}

#[tauri::command]
pub async fn install_obsidian_plugin_from_sources(
    manifest_json: String,
    main_source: String,
    styles_source: Option<String>,
    state: State<'_, AppState>,
) -> Result<PluginInfo, String> {
    install_obsidian_sources(manifest_json, main_source, styles_source, state.inner())
}

fn install_obsidian_sources(
    manifest_json: String,
    main_source: String,
    styles_source: Option<String>,
    state: &AppState,
) -> Result<PluginInfo, String> {
    let manifest = PluginManifest::from_json(&manifest_json).map_err(|error| error.to_string())?;
    let plugin_id = manifest.id.clone();
    let main_entry = manifest.main.clone();
    let styles_entry = manifest
        .styles
        .clone()
        .unwrap_or_else(|| "styles.css".to_string());

    state.with_workspace(|workspace| {
        let plugin_dir = workspace
            .vault
            .root
            .join(".obsidian")
            .join("plugins")
            .join(&plugin_id);
        fs::create_dir_all(&plugin_dir).map_err(|error| error.to_string())?;
        write_plugin_file(&plugin_dir, "manifest.json", &manifest_json)?;
        write_plugin_file(&plugin_dir, &main_entry, &main_source)?;
        match styles_source {
            Some(source) if !source.trim().is_empty() => {
                write_plugin_file(&plugin_dir, &styles_entry, &source)?;
            }
            _ => {
                let candidate = safe_plugin_child(&plugin_dir, &styles_entry)?;
                if candidate.is_file() {
                    fs::remove_file(candidate).map_err(|error| error.to_string())?;
                }
            }
        }
        Ok(())
    })?;

    let plugin_dir = state.with_workspace(|workspace| {
        Ok(workspace
            .vault
            .root
            .join(".obsidian")
            .join("plugins")
            .join(&plugin_id))
    })?;
    let installed = inspect_plugin_folder(plugin_dir).map_err(|error| error.to_string())?;
    state.install_plugin(installed.plugin)
}

#[tauri::command]
pub async fn enable_plugin(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    state.set_plugin_enabled(id, true)
}

#[tauri::command]
pub async fn uninstall_plugin(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    state.uninstall_plugin(id)
}

#[tauri::command]
pub async fn disable_plugin(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    state.set_plugin_enabled(id, false)
}

#[tauri::command]
pub async fn read_plugin_runtime_bundle(
    id: String,
    state: State<'_, AppState>,
) -> Result<PluginRuntimeBundle, String> {
    state.plugin_runtime_bundle(id)
}

#[tauri::command]
pub async fn read_plugin_data(
    id: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    state.read_plugin_data(id)
}

#[tauri::command]
pub async fn write_plugin_data(
    id: String,
    data: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    state.write_plugin_data(id, data)
}

#[tauri::command]
pub async fn update_plugin_permissions(
    id: String,
    permissions: Vec<PermissionGrant>,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    state.update_plugin_permissions(id, permissions)
}

/// Permission-use audit log: every gated action a plugin attempted, with target
/// and allow/deny outcome. Powers the security review UI.
#[tauri::command]
pub async fn get_permission_audit_log(
    state: State<'_, AppState>,
) -> Result<Vec<PermissionAuditEntry>, String> {
    Ok(state.permission_audit_log())
}

/// Read a scoped secret for a plugin (requires the `secrets:read` grant).
#[tauri::command]
pub async fn read_plugin_secret(
    id: String,
    key: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    state.read_plugin_secret(&id, &key)
}

/// Write a scoped secret for a plugin (requires the `secrets:write` grant).
#[tauri::command]
pub async fn write_plugin_secret(
    id: String,
    key: String,
    value: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    state.write_plugin_secret(&id, &key, &value)
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginRequestUrlInput {
    pub url: String,
    #[serde(default)]
    pub method: Option<String>,
    #[serde(default)]
    pub headers: Option<HashMap<String, String>>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub content_type: Option<String>,
    #[serde(default)]
    pub plugin_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginRequestUrlResult {
    pub status: u16,
    pub text: String,
    pub headers: HashMap<String, String>,
    pub json: Option<serde_json::Value>,
    pub array_buffer: Option<Vec<u8>>,
}

#[tauri::command]
pub async fn plugin_request_url(
    input: PluginRequestUrlInput,
    state: State<'_, AppState>,
) -> Result<PluginRequestUrlResult, String> {
    if let Some(plugin_id) = input.plugin_id.as_deref() {
        state.assert_plugin_permission(plugin_id, "network:http")?;
    }
    let client = http_client()?;
    let method = input
        .method
        .as_deref()
        .map(|m| m.to_ascii_uppercase())
        .unwrap_or_else(|| "GET".to_string());
    let mut builder = client.request(
        reqwest::Method::from_bytes(method.as_bytes())
            .map_err(|error| format!("invalid HTTP method: {error}"))?,
        &input.url,
    );
    if let Some(headers) = input.headers.as_ref() {
        for (name, value) in headers {
            builder = builder.header(name.as_str(), value.as_str());
        }
    }
    if let Some(content_type) = input.content_type.as_deref() {
        builder = builder.header("Content-Type", content_type);
    }
    if let Some(body) = input.body.as_deref() {
        builder = builder.body(body.to_string());
    }
    let response = builder
        .send()
        .await
        .map_err(|error| format!("request failed for {}: {}", input.url, error))?;
    let status = response.status().as_u16();
    let mut headers = HashMap::new();
    for (name, value) in response.headers().iter() {
        if let Ok(value_str) = value.to_str() {
            headers.insert(name.as_str().to_string(), value_str.to_string());
        }
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("could not read response body: {error}"))?;
    let text = String::from_utf8_lossy(&bytes).to_string();
    let json = serde_json::from_slice(&bytes).ok();
    Ok(PluginRequestUrlResult {
        status,
        text,
        headers,
        json,
        array_buffer: Some(bytes.to_vec()),
    })
}

fn resolve_obsidian_plugins_dir(path: &Path) -> Result<PathBuf, String> {
    if path.join("manifest.json").is_file() {
        return path
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| "plugin folder has no parent directory".to_string());
    }

    if path.join(".obsidian").join("plugins").is_dir() {
        return Ok(path.join(".obsidian").join("plugins"));
    }

    if path.file_name().and_then(|name| name.to_str()) == Some(".obsidian")
        && path.join("plugins").is_dir()
    {
        return Ok(path.join("plugins"));
    }

    if path.file_name().and_then(|name| name.to_str()) == Some("plugins") && path.is_dir() {
        return Ok(path.to_path_buf());
    }

    Err(format!(
        "Could not find Obsidian plugins directory under {}",
        path.display()
    ))
}

fn write_plugin_file(root: &Path, relative: &str, content: &str) -> Result<(), String> {
    let path = safe_plugin_child(root, relative)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(path, content).map_err(|error| error.to_string())
}

fn safe_plugin_child(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let entry = Path::new(relative);
    if entry.is_absolute()
        || entry.components().any(|component| {
            matches!(
                component,
                std::path::Component::ParentDir
                    | std::path::Component::Prefix(_)
                    | std::path::Component::RootDir
            )
        })
    {
        return Err(format!("unsafe plugin asset path: {relative}"));
    }
    Ok(root.join(entry))
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent("LATTICE plugin installer")
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|error| error.to_string())
}

async fn download_community_plugin(
    client: &reqwest::Client,
    repo: &str,
) -> Result<DownloadedPluginSources, String> {
    let release = fetch_best_release(client, repo).await?;
    let manifest_asset = release
        .as_ref()
        .and_then(|release| find_asset(release, "manifest.json"));
    let manifest_json = if let Some(asset) = manifest_asset {
        fetch_text(client, &asset.browser_download_url, TEXT_ACCEPT).await?
    } else {
        fetch_repository_text(client, repo, "manifest.json").await?
    };

    let manifest = PluginManifest::from_json(&manifest_json).map_err(|error| error.to_string())?;
    let main_name = manifest.main.clone();
    let main_asset = release.as_ref().and_then(|release| {
        find_asset(release, &main_name).or_else(|| find_asset(release, "main.js"))
    });
    let main_source = if let Some(asset) = main_asset {
        fetch_text(client, &asset.browser_download_url, TEXT_ACCEPT).await?
    } else {
        fetch_repository_text(client, repo, &main_name).await?
    };

    let styles_name = manifest
        .styles
        .clone()
        .unwrap_or_else(|| "styles.css".to_string());
    let styles_asset = release.as_ref().and_then(|release| {
        find_asset(release, &styles_name).or_else(|| find_asset(release, "styles.css"))
    });
    let styles_source = if let Some(asset) = styles_asset {
        fetch_text(client, &asset.browser_download_url, TEXT_ACCEPT)
            .await
            .ok()
    } else {
        fetch_repository_text(client, repo, &styles_name).await.ok()
    };

    Ok(DownloadedPluginSources {
        manifest_json,
        main_source,
        styles_source,
    })
}

async fn fetch_best_release(
    client: &reqwest::Client,
    repo: &str,
) -> Result<Option<GithubRelease>, String> {
    let latest_url = format!("https://api.github.com/repos/{repo}/releases/latest");
    if let Ok(release) = fetch_json::<GithubRelease>(client, &latest_url, GITHUB_API_ACCEPT).await {
        return Ok(Some(release));
    }

    let releases_url = format!("https://api.github.com/repos/{repo}/releases?per_page=20");
    let mut releases = fetch_json::<Vec<GithubRelease>>(client, &releases_url, GITHUB_API_ACCEPT)
        .await
        .unwrap_or_default();
    if let Some(index) = releases
        .iter()
        .position(|release| find_asset(release, "manifest.json").is_some())
    {
        return Ok(Some(releases.remove(index)));
    }
    Ok(releases.into_iter().next())
}

async fn fetch_repository_text(
    client: &reqwest::Client,
    repo: &str,
    path: &str,
) -> Result<String, String> {
    let metadata_url = format!("https://api.github.com/repos/{repo}");
    let metadata = fetch_json::<GithubRepository>(client, &metadata_url, GITHUB_API_ACCEPT).await?;
    let ref_name = metadata
        .default_branch
        .unwrap_or_else(|| "main".to_string());
    let encoded_path = path
        .split('/')
        .map(percent_encode_component)
        .collect::<Vec<_>>()
        .join("/");
    let url = format!(
        "https://api.github.com/repos/{repo}/contents/{encoded_path}?ref={}",
        percent_encode_component(&ref_name)
    );
    let file = fetch_json::<GithubContentFile>(client, &url, GITHUB_API_ACCEPT).await?;
    let download_url = file
        .download_url
        .ok_or_else(|| format!("{repo} does not expose {path} on {ref_name}"))?;
    fetch_text(client, &download_url, TEXT_ACCEPT).await
}

async fn fetch_json<T: DeserializeOwned>(
    client: &reqwest::Client,
    url: &str,
    accept: &str,
) -> Result<T, String> {
    let text = fetch_text(client, url, accept).await?;
    serde_json::from_str(&text).map_err(|error| format!("Invalid JSON from {url}: {error}"))
}

async fn fetch_text(client: &reqwest::Client, url: &str, accept: &str) -> Result<String, String> {
    let response = client
        .get(url)
        .header(ACCEPT, accept)
        .send()
        .await
        .map_err(|error| format!("Request failed for {url}: {error}"))?;
    let status = response.status();
    if !status.is_success() {
        let detail = response.text().await.unwrap_or_default();
        let detail = detail.trim();
        let suffix = if detail.is_empty() {
            String::new()
        } else {
            format!(": {}", detail.chars().take(220).collect::<String>())
        };
        return Err(format!("Request failed for {url}: {status}{suffix}"));
    }
    response
        .text()
        .await
        .map_err(|error| format!("Could not read response from {url}: {error}"))
}

fn find_asset<'a>(release: &'a GithubRelease, name: &str) -> Option<&'a GithubReleaseAsset> {
    release
        .assets
        .iter()
        .find(|asset| asset.name.eq_ignore_ascii_case(name))
}

fn normalize_github_repo(raw: &str) -> Result<String, String> {
    let mut repo = raw.trim();
    if let Some(rest) = repo.strip_prefix("https://github.com/") {
        repo = rest;
    } else if let Some(rest) = repo.strip_prefix("http://github.com/") {
        repo = rest;
    }
    repo = repo.trim_end_matches('/');
    repo = repo.strip_suffix(".git").unwrap_or(repo);

    let parts = repo.split('/').collect::<Vec<_>>();
    if parts.len() != 2
        || parts.iter().any(|part| {
            part.is_empty()
                || !part
                    .chars()
                    .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' || ch == '.')
        })
    {
        return Err(format!("invalid GitHub repository: {raw}"));
    }

    Ok(format!("{}/{}", parts[0], parts[1]))
}

fn percent_encode_component(input: &str) -> String {
    let mut encoded = String::with_capacity(input.len());
    for byte in input.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
            encoded.push(byte as char);
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded
}
