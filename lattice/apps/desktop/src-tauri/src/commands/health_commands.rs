use lattice_graph::{score_health, VaultHealthReport};
use tauri::State;

use crate::state::AppState;

#[tauri::command]
pub async fn get_vault_health(state: State<'_, AppState>) -> Result<VaultHealthReport, String> {
    state.with_workspace(|workspace| {
        let stats = workspace
            .db
            .health_stats()
            .map_err(|error| error.to_string())?;
        let top = workspace
            .db
            .top_connected(5)
            .map_err(|error| error.to_string())?;
        Ok(score_health(&stats, top))
    })
}
