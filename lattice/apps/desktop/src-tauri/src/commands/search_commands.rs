use std::fs;

use lattice_core::files;
use lattice_db::SearchRow;
use lattice_indexer::parse_markdown;
use lattice_search::SearchOptions;
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

use crate::state::{relative_path, AppState};

#[tauri::command]
pub async fn search(
    query: String,
    options: SearchOptions,
    state: State<'_, AppState>,
) -> Result<Vec<SearchRow>, String> {
    state.with_workspace(|workspace| {
        if uses_advanced_query(&query) {
            return advanced_search(workspace, &query, options.limit.unwrap_or(50));
        }
        workspace
            .db
            .search(&query)
            .map_err(|error| error.to_string())
            .map(|rows| rows.into_iter().take(options.limit.unwrap_or(50)).collect())
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandSearchResult {
    pub id: String,
    pub label: String,
    pub group: String,
    pub kind: String,
}

#[derive(Debug, Clone, Default)]
struct QueryBranch {
    required_terms: Vec<String>,
    excluded_terms: Vec<String>,
    phrases: Vec<String>,
    path_filters: Vec<String>,
    file_filters: Vec<String>,
    tags: Vec<String>,
    content_terms: Vec<String>,
    property_keys: Vec<String>,
    property_values: Vec<(String, String)>,
    task_filter: Option<TaskFilter>,
    regexes: Vec<Regex>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TaskFilter {
    Any,
    Todo,
    Done,
}

struct SearchCandidate {
    path: String,
    title: String,
    excerpt: String,
    content: String,
    tags: Vec<String>,
    properties: Vec<(String, Value)>,
    tasks: Vec<lattice_indexer::metadata::Task>,
}

fn advanced_search(
    workspace: &crate::state::AppWorkspace,
    query: &str,
    limit: usize,
) -> Result<Vec<SearchRow>, String> {
    let branches = parse_query(query);
    let mut rows = Vec::new();

    for absolute in files::list_markdown_files(&workspace.vault) {
        let path = relative_path(&workspace.vault.root, &absolute);
        let content = fs::read_to_string(&absolute).map_err(|error| error.to_string())?;
        let metadata = parse_markdown(&path, &content);
        let candidate = SearchCandidate {
            path,
            title: metadata.title,
            excerpt: metadata.excerpt,
            content,
            tags: metadata.tags.into_iter().map(|tag| tag.name).collect(),
            properties: metadata
                .properties
                .into_iter()
                .map(|property| (property.key, property.value))
                .collect(),
            tasks: metadata.tasks,
        };

        let score = branches
            .iter()
            .filter_map(|branch| branch_score(branch, &candidate))
            .fold(None, |best: Option<f64>, score| {
                Some(best.map_or(score, |best| best.max(score)))
            });

        if let Some(score) = score {
            rows.push(SearchRow {
                path: candidate.path.clone(),
                title: candidate.title.clone(),
                excerpt: best_excerpt(&candidate, &branches),
                score,
                kind: "note".to_string(),
            });
        }
    }

    rows.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.path.cmp(&b.path))
    });
    rows.truncate(limit);
    Ok(rows)
}

fn branch_score(branch: &QueryBranch, candidate: &SearchCandidate) -> Option<f64> {
    let haystack = format!(
        "{} {} {}",
        candidate.title, candidate.excerpt, candidate.content
    )
    .to_lowercase();
    let content = candidate.content.to_lowercase();
    let path = candidate.path.to_lowercase();
    let file_name = candidate
        .path
        .rsplit('/')
        .next()
        .unwrap_or(&candidate.path)
        .trim_end_matches(".md")
        .to_lowercase();

    for filter in &branch.path_filters {
        if !path.contains(filter) {
            return None;
        }
    }
    for filter in &branch.file_filters {
        if !file_name.contains(filter) {
            return None;
        }
    }
    for tag in &branch.tags {
        if !candidate
            .tags
            .iter()
            .any(|candidate_tag| normalize_tag(candidate_tag) == normalize_tag(tag))
        {
            return None;
        }
    }
    for key in &branch.property_keys {
        if !candidate
            .properties
            .iter()
            .any(|(candidate_key, _)| candidate_key.eq_ignore_ascii_case(key))
        {
            return None;
        }
    }
    for (key, expected) in &branch.property_values {
        let (_, value) = candidate
            .properties
            .iter()
            .find(|(candidate_key, _)| candidate_key.eq_ignore_ascii_case(key))?;
        if !value_to_search_text(value)
            .to_lowercase()
            .contains(expected)
        {
            return None;
        }
    }
    if let Some(task_filter) = branch.task_filter {
        let matches_task = match task_filter {
            TaskFilter::Any => !candidate.tasks.is_empty(),
            TaskFilter::Todo => candidate.tasks.iter().any(|task| !task.completed),
            TaskFilter::Done => candidate.tasks.iter().any(|task| task.completed),
        };
        if !matches_task {
            return None;
        }
    }
    for term in &branch.required_terms {
        if !haystack.contains(term) {
            return None;
        }
    }
    for term in &branch.content_terms {
        if !content.contains(term) {
            return None;
        }
    }
    for phrase in &branch.phrases {
        if !haystack.contains(phrase) {
            return None;
        }
    }
    for regex in &branch.regexes {
        if !regex.is_match(&candidate.content) {
            return None;
        }
    }
    for term in &branch.excluded_terms {
        if haystack.contains(term)
            || candidate
                .tags
                .iter()
                .any(|tag| normalize_tag(tag).contains(term))
        {
            return None;
        }
    }

    let mut score = 0.35;
    score += branch.required_terms.len() as f64 * 0.08;
    score += branch.phrases.len() as f64 * 0.12;
    score += branch.tags.len() as f64 * 0.1;
    if branch.task_filter.is_some() {
        score += 0.08;
    }
    if !branch.property_keys.is_empty() || !branch.property_values.is_empty() {
        score += 0.08;
    }
    if branch
        .required_terms
        .iter()
        .any(|term| candidate.title.to_lowercase().contains(term))
    {
        score += 0.25;
    }
    Some(score.min(1.0))
}

fn parse_query(query: &str) -> Vec<QueryBranch> {
    split_or(query)
        .into_iter()
        .map(|branch| {
            let mut parsed = QueryBranch::default();
            for raw_token in tokenize(&branch) {
                add_token(&mut parsed, raw_token);
            }
            parsed
        })
        .filter(|branch| !branch.is_empty())
        .collect::<Vec<_>>()
        .tap_non_empty()
}

fn add_token(branch: &mut QueryBranch, raw_token: String) {
    let mut token = raw_token.trim().to_string();
    if token.is_empty() || token.eq_ignore_ascii_case("AND") {
        return;
    }

    let excluded = token.starts_with('-');
    if excluded {
        token = token.trim_start_matches('-').to_string();
    }
    let lower = token.to_lowercase();

    if excluded {
        branch
            .excluded_terms
            .push(strip_quotes(&token).to_lowercase());
        return;
    }
    if is_quoted(&token) {
        branch.phrases.push(strip_quotes(&token).to_lowercase());
        return;
    }
    if lower == "task:" {
        branch.task_filter = Some(TaskFilter::Any);
        return;
    }
    if lower == "task-todo:" {
        branch.task_filter = Some(TaskFilter::Todo);
        return;
    }
    if lower == "task-done:" {
        branch.task_filter = Some(TaskFilter::Done);
        return;
    }
    if let Some(value) = lower.strip_prefix("path:") {
        branch
            .path_filters
            .push(value.trim_matches('"').to_string());
        return;
    }
    if let Some(value) = lower.strip_prefix("file:") {
        branch
            .file_filters
            .push(value.trim_matches('"').to_string());
        return;
    }
    if let Some(value) = token.strip_prefix("tag:") {
        branch.tags.push(value.to_string());
        return;
    }
    if let Some(value) = lower.strip_prefix("content:") {
        branch
            .content_terms
            .push(value.trim_matches('"').to_string());
        return;
    }
    if let Some(value) = token.strip_prefix("property:") {
        branch
            .property_keys
            .push(value.trim_matches('"').to_string());
        return;
    }
    if token.starts_with('[') && token.ends_with(']') {
        if let Some((key, value)) = token[1..token.len() - 1].split_once(':') {
            branch.property_values.push((
                key.trim().to_string(),
                value.trim().trim_matches('"').to_lowercase(),
            ));
            return;
        }
    }
    if token.starts_with('/') && token.ends_with('/') && token.len() > 2 {
        if let Ok(regex) = Regex::new(&token[1..token.len() - 1]) {
            branch.regexes.push(regex);
            return;
        }
    }

    branch.required_terms.push(lower);
}

fn tokenize(query: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    for ch in query.chars() {
        match ch {
            '"' => {
                in_quotes = !in_quotes;
                current.push(ch);
            }
            ' ' | '\t' if !in_quotes => {
                if !current.trim().is_empty() {
                    tokens.push(current.trim().to_string());
                    current.clear();
                }
            }
            _ => current.push(ch),
        }
    }
    if !current.trim().is_empty() {
        tokens.push(current.trim().to_string());
    }
    tokens
}

fn split_or(query: &str) -> Vec<String> {
    query
        .split(" OR ")
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

fn best_excerpt(candidate: &SearchCandidate, branches: &[QueryBranch]) -> String {
    let terms = branches
        .iter()
        .flat_map(|branch| {
            branch
                .required_terms
                .iter()
                .chain(branch.phrases.iter())
                .chain(branch.content_terms.iter())
        })
        .collect::<Vec<_>>();
    for line in candidate.content.lines() {
        let lower = line.to_lowercase();
        if terms.iter().any(|term| lower.contains(term.as_str())) {
            return line.trim().chars().take(240).collect();
        }
    }
    candidate.excerpt.clone()
}

fn uses_advanced_query(query: &str) -> bool {
    let query = query.trim();
    query.contains('"')
        || query.contains(" OR ")
        || query.starts_with('-')
        || query.contains("path:")
        || query.contains("file:")
        || query.contains("tag:")
        || query.contains("task:")
        || query.contains("task-todo:")
        || query.contains("task-done:")
        || query.contains("content:")
        || query.contains("property:")
        || (query.starts_with('/') && query.ends_with('/'))
        || (query.starts_with('[') && query.ends_with(']'))
}

fn normalize_tag(tag: &str) -> String {
    tag.trim().trim_start_matches('#').to_lowercase()
}

fn value_to_search_text(value: &Value) -> String {
    match value {
        Value::Null => String::new(),
        Value::Bool(value) => value.to_string(),
        Value::Number(value) => value.to_string(),
        Value::String(value) => value.clone(),
        Value::Array(values) => values
            .iter()
            .map(value_to_search_text)
            .collect::<Vec<_>>()
            .join(" "),
        Value::Object(object) => object
            .values()
            .map(value_to_search_text)
            .collect::<Vec<_>>()
            .join(" "),
    }
}

fn is_quoted(value: &str) -> bool {
    value.starts_with('"') && value.ends_with('"') && value.len() >= 2
}

fn strip_quotes(value: &str) -> &str {
    if is_quoted(value) {
        &value[1..value.len() - 1]
    } else {
        value
    }
}

impl QueryBranch {
    fn is_empty(&self) -> bool {
        self.required_terms.is_empty()
            && self.excluded_terms.is_empty()
            && self.phrases.is_empty()
            && self.path_filters.is_empty()
            && self.file_filters.is_empty()
            && self.tags.is_empty()
            && self.content_terms.is_empty()
            && self.property_keys.is_empty()
            && self.property_values.is_empty()
            && self.task_filter.is_none()
            && self.regexes.is_empty()
    }
}

trait NonEmptyBranches {
    fn tap_non_empty(self) -> Self;
}

impl NonEmptyBranches for Vec<QueryBranch> {
    fn tap_non_empty(self) -> Self {
        if self.is_empty() {
            vec![QueryBranch::default()]
        } else {
            self
        }
    }
}

#[tauri::command]
pub async fn command_search(query: String) -> Result<Vec<CommandSearchResult>, String> {
    let commands = vec![
        CommandSearchResult {
            id: "note.new".to_string(),
            label: "New note".to_string(),
            group: "Quick Actions".to_string(),
            kind: "command".to_string(),
        },
        CommandSearchResult {
            id: "note.daily".to_string(),
            label: "Open daily note".to_string(),
            group: "Quick Actions".to_string(),
            kind: "command".to_string(),
        },
        CommandSearchResult {
            id: "collections.open".to_string(),
            label: "Open collections".to_string(),
            group: "Quick Actions".to_string(),
            kind: "command".to_string(),
        },
        CommandSearchResult {
            id: "ai.open".to_string(),
            label: "Open terminal".to_string(),
            group: "Quick Actions".to_string(),
            kind: "command".to_string(),
        },
        CommandSearchResult {
            id: "canvas.open".to_string(),
            label: "Open canvas".to_string(),
            group: "Quick Actions".to_string(),
            kind: "command".to_string(),
        },
        CommandSearchResult {
            id: "graph.open".to_string(),
            label: "Open graph".to_string(),
            group: "Quick Actions".to_string(),
            kind: "command".to_string(),
        },
        CommandSearchResult {
            id: "health.open".to_string(),
            label: "Open vault health".to_string(),
            group: "Quick Actions".to_string(),
            kind: "command".to_string(),
        },
        CommandSearchResult {
            id: "plugins.open".to_string(),
            label: "Open plugin marketplace".to_string(),
            group: "Quick Actions".to_string(),
            kind: "command".to_string(),
        },
    ];
    if query.trim().is_empty() {
        return Ok(commands);
    }
    let query = query.to_lowercase();
    Ok(commands
        .into_iter()
        .filter(|command| command.label.to_lowercase().contains(&query))
        .collect())
}
