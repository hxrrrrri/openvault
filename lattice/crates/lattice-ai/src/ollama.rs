use crate::providers::AiProvider;

#[derive(Debug, Clone)]
pub struct OllamaProvider {
    pub endpoint: String,
}

impl Default for OllamaProvider {
    fn default() -> Self {
        Self {
            endpoint: "http://127.0.0.1:11434".to_string(),
        }
    }
}

impl AiProvider for OllamaProvider {
    fn id(&self) -> &str {
        "ollama"
    }

    fn is_local(&self) -> bool {
        self.endpoint.starts_with("http://127.0.0.1")
            || self.endpoint.starts_with("http://localhost")
    }
}
