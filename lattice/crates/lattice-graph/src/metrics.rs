use lattice_db::HealthStats;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultHealthReport {
    pub score: u8,
    pub total_notes: usize,
    pub total_links: usize,
    pub orphan_notes: usize,
    pub broken_links: usize,
    pub stale_notes: usize,
    pub notes_without_tags: usize,
    pub duplicate_titles: Vec<String>,
    pub most_connected: Vec<ConnectedNote>,
    pub suggestions: Vec<HealthSuggestion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectedNote {
    pub title: String,
    pub path: String,
    pub links: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthSuggestion {
    pub title: String,
    pub body: String,
    pub severity: String,
}

pub fn score_health(
    stats: &HealthStats,
    top_connected: Vec<(String, String, usize)>,
) -> VaultHealthReport {
    let mut score = 100i32;
    score -= (stats.broken_links as i32 * 4).min(24);
    score -= (stats.orphan_notes as i32 * 2).min(20);
    score -= (stats.notes_without_tags as i32).min(12);
    let score = score.clamp(0, 100) as u8;

    let mut suggestions = Vec::new();
    if stats.broken_links > 0 {
        suggestions.push(HealthSuggestion {
            title: "Resolve broken links".to_string(),
            body: format!(
                "{} links point to notes that do not exist.",
                stats.broken_links
            ),
            severity: "warning".to_string(),
        });
    }
    if stats.orphan_notes > 0 {
        suggestions.push(HealthSuggestion {
            title: "Connect orphan notes".to_string(),
            body: format!("{} notes have no graph connections.", stats.orphan_notes),
            severity: "info".to_string(),
        });
    }

    VaultHealthReport {
        score,
        total_notes: stats.total_notes,
        total_links: stats.total_links,
        orphan_notes: stats.orphan_notes,
        broken_links: stats.broken_links,
        stale_notes: 0,
        notes_without_tags: stats.notes_without_tags,
        duplicate_titles: Vec::new(),
        most_connected: top_connected
            .into_iter()
            .map(|(path, title, links)| ConnectedNote { title, path, links })
            .collect(),
        suggestions,
    }
}
