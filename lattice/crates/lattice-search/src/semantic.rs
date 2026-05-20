use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SemanticSearchRequest {
    pub query: String,
    pub limit: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SemanticSearchResult {
    pub path: String,
    pub title: String,
    pub score: f32,
}

pub trait SemanticIndex {
    fn upsert_embedding(&self, path: &str, embedding: &[f32]);
    fn query(&self, request: SemanticSearchRequest) -> Vec<SemanticSearchResult>;
}

#[derive(Debug, Default)]
pub struct StubSemanticIndex;

impl SemanticIndex for StubSemanticIndex {
    fn upsert_embedding(&self, _path: &str, _embedding: &[f32]) {}

    fn query(&self, _request: SemanticSearchRequest) -> Vec<SemanticSearchResult> {
        Vec::new()
    }
}
