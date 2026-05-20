use regex::Regex;

use crate::metadata::{Link, LinkType};

pub fn extract_links(content: &str) -> Vec<Link> {
    let wiki = Regex::new(r"(!)?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]")
        .expect("valid wikilink regex");
    let md = Regex::new(r"(!)?\[([^\]]*)\]\(([^)]+)\)").expect("valid markdown link regex");
    let mut links = Vec::new();

    for (line_index, line) in content.lines().enumerate() {
        for cap in wiki.captures_iter(line) {
            let matched = cap.get(0).expect("match");
            let is_embed = cap.get(1).is_some();
            let target = cap.get(2).map(|m| m.as_str().trim()).unwrap_or_default();
            let display = cap.get(3).map(|m| m.as_str().trim().to_string());
            links.push(Link {
                target_text: target.to_string(),
                resolved_path: None,
                link_type: if is_embed {
                    LinkType::Embed
                } else {
                    LinkType::Wikilink
                },
                display_text: display,
                line: line_index + 1,
                column: matched.start() + 1,
            });
        }

        for cap in md.captures_iter(line) {
            let matched = cap.get(0).expect("match");
            let is_embed = cap.get(1).is_some();
            let label = cap.get(2).map(|m| m.as_str().to_string());
            let target = cap.get(3).map(|m| m.as_str().trim()).unwrap_or_default();
            links.push(Link {
                target_text: target.to_string(),
                resolved_path: None,
                link_type: if is_embed {
                    LinkType::Embed
                } else {
                    LinkType::Markdown
                },
                display_text: label.filter(|value| !value.is_empty()),
                line: line_index + 1,
                column: matched.start() + 1,
            });
        }
    }

    links
}

pub fn normalize_link_target(target: &str) -> String {
    target.trim().trim_end_matches(".md").replace('\\', "/")
}
