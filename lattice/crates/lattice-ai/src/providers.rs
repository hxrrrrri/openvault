use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderConfig {
    pub id: String,
    pub enabled: bool,
    pub endpoint: Option<String>,
    pub local_only: bool,
}

pub trait AiProvider {
    fn id(&self) -> &str;
    fn is_local(&self) -> bool;
}
