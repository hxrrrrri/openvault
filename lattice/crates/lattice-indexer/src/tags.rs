use std::collections::BTreeMap;
use std::sync::LazyLock;

use regex::Regex;

use crate::metadata::Tag;

static TAG_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(^|[^\w/])#([A-Za-z0-9][A-Za-z0-9_/-]*)").expect("valid tag regex")
});

pub fn extract_tags(content: &str) -> Vec<Tag> {
    let tag_regex = &*TAG_RE;
    let mut tags = BTreeMap::new();

    for (line_index, line) in content.lines().enumerate() {
        for cap in tag_regex.captures_iter(line) {
            let Some(tag) = cap.get(2) else {
                continue;
            };
            let name = format!("#{}", tag.as_str());
            tags.entry(name.to_lowercase()).or_insert(Tag {
                name,
                normalized_name: tag.as_str().to_lowercase(),
                line: line_index + 1,
            });
        }
    }

    tags.into_values().collect()
}
