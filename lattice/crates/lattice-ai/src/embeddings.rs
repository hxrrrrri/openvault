use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddingRequest {
    pub input: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddingResponse {
    pub embedding: Vec<f32>,
}

pub trait EmbeddingProvider {
    fn embed(&self, request: EmbeddingRequest) -> Result<EmbeddingResponse, String>;
}

#[derive(Debug, Default)]
pub struct StubEmbeddingProvider;

impl EmbeddingProvider for StubEmbeddingProvider {
    fn embed(&self, _request: EmbeddingRequest) -> Result<EmbeddingResponse, String> {
        Ok(EmbeddingResponse {
            embedding: Vec::new(),
        })
    }
}
