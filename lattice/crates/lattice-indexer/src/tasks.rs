use std::sync::LazyLock;

use regex::Regex;

use crate::metadata::Task;

static TASK_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\s*[-*]\s+\[([ xX])\]\s+(.*)$").expect("valid task regex"));
static BLOCK_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\^([A-Za-z0-9_-]+)").expect("valid block id regex"));
static DUE_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\bdue:(\d{4}-\d{2}-\d{2})\b").expect("valid due regex"));
static PRIORITY_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\bpriority:([A-C]|high|medium|low)\b").expect("valid priority regex")
});

pub fn extract_tasks(content: &str) -> Vec<Task> {
    let task_regex = &*TASK_RE;
    let block_regex = &*BLOCK_RE;
    let due_regex = &*DUE_RE;
    let priority_regex = &*PRIORITY_RE;

    content
        .lines()
        .enumerate()
        .filter_map(|(line_index, line)| {
            let cap = task_regex.captures(line)?;
            let text = cap.get(2)?.as_str().trim().to_string();
            Some(Task {
                text: text.clone(),
                completed: cap
                    .get(1)
                    .map(|m| m.as_str().eq_ignore_ascii_case("x"))
                    .unwrap_or(false),
                line: line_index + 1,
                block_id: block_regex
                    .captures(&text)
                    .and_then(|capture| capture.get(1).map(|m| m.as_str().to_string())),
                due_date: due_regex
                    .captures(&text)
                    .and_then(|capture| capture.get(1).map(|m| m.as_str().to_string())),
                priority: priority_regex
                    .captures(&text)
                    .and_then(|capture| capture.get(1).map(|m| m.as_str().to_string())),
            })
        })
        .collect()
}
