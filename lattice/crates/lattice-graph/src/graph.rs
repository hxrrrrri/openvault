use std::collections::{HashMap, HashSet, VecDeque};

use lattice_db::{DbLinkRow, DbNoteRow};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    pub id: String,
    pub path: String,
    pub title: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub tags: Vec<String>,
    pub degree: usize,
    pub is_orphan: bool,
    pub is_active: bool,
    pub last_modified: String,
    pub x: Option<f32>,
    pub y: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub edge_type: String,
    pub weight: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GraphPayload {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GraphFilters {
    pub tags: Option<Vec<String>>,
    pub folders: Option<Vec<String>>,
    pub include_orphans: Option<bool>,
    pub depth: Option<u8>,
}

pub fn build_graph(
    notes: &[DbNoteRow],
    links: &[DbLinkRow],
    active_path: Option<&str>,
) -> GraphPayload {
    build_scoped_graph(notes, links, active_path, None)
}

pub fn build_local_graph(
    notes: &[DbNoteRow],
    links: &[DbLinkRow],
    active_path: &str,
    depth: u8,
) -> GraphPayload {
    let note_paths = notes
        .iter()
        .map(|note| note.path.clone())
        .collect::<HashSet<_>>();
    if !note_paths.contains(active_path) {
        return GraphPayload::default();
    }

    let mut adjacency: HashMap<String, Vec<String>> = HashMap::new();
    for link in links {
        if let Some(target) = &link.resolved_path {
            if !note_paths.contains(&link.source_path) || !note_paths.contains(target) {
                continue;
            }
            adjacency
                .entry(link.source_path.clone())
                .or_default()
                .push(target.clone());
            adjacency
                .entry(target.clone())
                .or_default()
                .push(link.source_path.clone());
        }
    }

    let max_depth = depth as usize;
    let mut included = HashSet::from([active_path.to_string()]);
    let mut queue = VecDeque::from([(active_path.to_string(), 0usize)]);
    while let Some((path, current_depth)) = queue.pop_front() {
        if current_depth >= max_depth {
            continue;
        }
        if let Some(neighbors) = adjacency.get(&path) {
            for neighbor in neighbors {
                if included.insert(neighbor.clone()) {
                    queue.push_back((neighbor.clone(), current_depth + 1));
                }
            }
        }
    }

    build_scoped_graph(notes, links, Some(active_path), Some(&included))
}

fn build_scoped_graph(
    notes: &[DbNoteRow],
    links: &[DbLinkRow],
    active_path: Option<&str>,
    included_paths: Option<&HashSet<String>>,
) -> GraphPayload {
    let mut degree: HashMap<String, usize> = HashMap::new();
    let mut edges = Vec::new();

    for link in links {
        if let Some(target) = &link.resolved_path {
            if let Some(included) = included_paths {
                if !included.contains(&link.source_path) || !included.contains(target) {
                    continue;
                }
            }
            *degree.entry(link.source_path.clone()).or_default() += 1;
            *degree.entry(target.clone()).or_default() += 1;
            edges.push(GraphEdge {
                id: format!("{}->{}:{}", link.source_path, target, link.line),
                source: link.source_path.clone(),
                target: target.clone(),
                edge_type: link.link_type.clone(),
                weight: 1.0,
            });
        }
    }

    let visible_notes = notes
        .iter()
        .filter(|note| {
            included_paths
                .map(|included| included.contains(&note.path))
                .unwrap_or(true)
        })
        .collect::<Vec<_>>();

    let nodes = notes
        .iter()
        .filter(|note| {
            included_paths
                .map(|included| included.contains(&note.path))
                .unwrap_or(true)
        })
        .enumerate()
        .map(|(index, note)| {
            let d = *degree.get(&note.path).unwrap_or(&0);
            let angle = (index as f32 / visible_notes.len().max(1) as f32) * std::f32::consts::TAU;
            let ring = 150.0 + ((index % 4) as f32 * 68.0);
            GraphNode {
                id: note.path.clone(),
                path: note.path.clone(),
                title: note.title.clone(),
                node_type: "note".to_string(),
                tags: note.tags.clone(),
                degree: d,
                is_orphan: d == 0,
                is_active: active_path.is_some_and(|path| path == note.path),
                last_modified: note.mtime.clone(),
                x: Some(angle.cos() * ring),
                y: Some(angle.sin() * ring),
            }
        })
        .collect();

    GraphPayload { nodes, edges }
}

#[cfg(test)]
mod tests {
    use lattice_db::{DbLinkRow, DbNoteRow};

    use super::{build_graph, build_local_graph};

    #[test]
    fn global_graph_keeps_all_notes() {
        let notes = notes(&["A.md", "B.md", "C.md"]);
        let links = vec![link("A.md", "B.md")];

        let graph = build_graph(&notes, &links, None);

        assert_eq!(graph.nodes.len(), 3);
        assert_eq!(graph.edges.len(), 1);
        assert!(graph.nodes.iter().any(|node| node.id == "C.md"));
    }

    #[test]
    fn local_graph_respects_link_depth() {
        let notes = notes(&["A.md", "B.md", "C.md", "D.md"]);
        let links = vec![
            link("A.md", "B.md"),
            link("B.md", "C.md"),
            link("C.md", "D.md"),
        ];

        let depth_one = build_local_graph(&notes, &links, "A.md", 1);
        assert_eq!(ids(&depth_one.nodes), vec!["A.md", "B.md"]);
        assert_eq!(depth_one.edges.len(), 1);
        assert!(depth_one
            .nodes
            .iter()
            .any(|node| node.id == "A.md" && node.is_active));

        let depth_two = build_local_graph(&notes, &links, "A.md", 2);
        assert_eq!(ids(&depth_two.nodes), vec!["A.md", "B.md", "C.md"]);
        assert_eq!(depth_two.edges.len(), 2);
    }

    fn notes(paths: &[&str]) -> Vec<DbNoteRow> {
        paths
            .iter()
            .map(|path| DbNoteRow {
                path: path.to_string(),
                title: path.trim_end_matches(".md").to_string(),
                excerpt: String::new(),
                word_count: 0,
                line_count: 0,
                mtime: "2026-01-01T00:00:00Z".to_string(),
                tags: Vec::new(),
            })
            .collect()
    }

    fn link(source: &str, target: &str) -> DbLinkRow {
        DbLinkRow {
            source_path: source.to_string(),
            target_text: target.to_string(),
            resolved_path: Some(target.to_string()),
            link_type: "wikilink".to_string(),
            display_text: None,
            line: 1,
            column: 1,
        }
    }

    fn ids(nodes: &[super::GraphNode]) -> Vec<&str> {
        nodes.iter().map(|node| node.id.as_str()).collect()
    }
}
