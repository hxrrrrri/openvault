use std::collections::HashMap;

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
    let mut degree: HashMap<String, usize> = HashMap::new();
    let mut edges = Vec::new();

    for link in links {
        if let Some(target) = &link.resolved_path {
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

    let nodes = notes
        .iter()
        .enumerate()
        .map(|(index, note)| {
            let d = *degree.get(&note.path).unwrap_or(&0);
            let angle = (index as f32 / notes.len().max(1) as f32) * std::f32::consts::TAU;
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
