use lattice_db::{DbResult, LatticeDb, SearchRow};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SearchOptions {
    pub limit: Option<usize>,
    pub include_content: Option<bool>,
}

pub trait FullTextSearch {
    fn search(&self, query: &str, options: &SearchOptions) -> DbResult<Vec<SearchRow>>;
}

impl FullTextSearch for LatticeDb {
    fn search(&self, query: &str, _options: &SearchOptions) -> DbResult<Vec<SearchRow>> {
        LatticeDb::search(self, query)
    }
}
