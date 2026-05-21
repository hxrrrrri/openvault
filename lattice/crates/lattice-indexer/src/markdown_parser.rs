use regex::Regex;
use sha2::{Digest, Sha256};

use crate::frontmatter::{parse_frontmatter, parse_properties};
use crate::links::extract_links;
use crate::metadata::{Heading, NoteMetadata};
use crate::tags::extract_tags;
use crate::tasks::extract_tasks;

pub fn parse_markdown(path: impl Into<String>, content: &str) -> NoteMetadata {
    let path = path.into();
    let headings = extract_headings(content);
    let first_heading = headings.first().map(|heading| heading.text.clone());
    let title = first_heading
        .clone()
        .or_else(|| frontmatter_title(content))
        .unwrap_or_else(|| title_from_path(&path));

    NoteMetadata {
        path,
        title,
        first_heading,
        headings,
        links: extract_links(content),
        tags: extract_tags(content),
        properties: parse_properties(content),
        tasks: extract_tasks(content),
        word_count: word_count(content),
        line_count: content.lines().count(),
        excerpt: excerpt(content),
        content_hash: content_hash(content),
    }
}

fn extract_headings(content: &str) -> Vec<Heading> {
    let heading_regex = Regex::new(r"^(#{1,6})\s+(.+?)\s*$").expect("valid heading regex");
    content
        .lines()
        .enumerate()
        .filter_map(|(line_index, line)| {
            let cap = heading_regex.captures(line)?;
            let marks = cap.get(1)?;
            let text = cap.get(2)?.as_str().trim().to_string();
            Some(Heading {
                level: marks.as_str().len() as u8,
                slug: slugify(&text),
                text,
                line_start: line_index + 1,
                line_end: line_index + 1,
            })
        })
        .collect()
}

fn frontmatter_title(content: &str) -> Option<String> {
    parse_frontmatter(content)
        .into_iter()
        .find(|property| property.key == "title")
        .and_then(|property| property.value.as_str().map(ToOwned::to_owned))
}

fn title_from_path(path: &str) -> String {
    let normalized = path.replace('\\', "/");
    normalized
        .rsplit('/')
        .next()
        .unwrap_or("Untitled")
        .trim_end_matches(".md")
        .to_string()
}

fn slugify(text: &str) -> String {
    text.to_lowercase()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn word_count(content: &str) -> usize {
    let regex = Regex::new(r"[[:alnum:]']+").expect("valid word regex");
    regex.find_iter(content).count()
}

fn excerpt(content: &str) -> String {
    content
        .lines()
        .filter(|line| !line.trim().is_empty() && !line.trim_start().starts_with("---"))
        .take(3)
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(240)
        .collect()
}

fn content_hash(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::parse_markdown;
    use crate::metadata::LinkType;

    #[test]
    fn parses_wikilinks_tags_frontmatter_and_tasks() {
        let md = r#"---
title: Demo Note
aliases: [Demo]
---

# Demo Heading

See [[Target Note|alias]] and ![[Embedded Note]] plus [site](https://example.com).

- [ ] Follow up due:2026-05-30 priority:A ^task-one
- [x] Done item

#project/active
"#;

        let meta = parse_markdown("Research/Demo Note.md", md);
        assert_eq!(meta.title, "Demo Heading");
        assert_eq!(meta.headings[0].slug, "demo-heading");
        assert!(meta.tags.iter().any(|tag| tag.name == "#project/active"));
        assert!(meta
            .links
            .iter()
            .any(|link| link.link_type == LinkType::Wikilink && link.target_text == "Target Note"));
        assert!(meta
            .links
            .iter()
            .any(|link| link.link_type == LinkType::Embed && link.target_text == "Embedded Note"));
        assert_eq!(meta.tasks.len(), 2);
        assert_eq!(meta.tasks[0].block_id.as_deref(), Some("task-one"));
        assert!(meta
            .properties
            .iter()
            .any(|property| property.key == "title"));
    }
}
