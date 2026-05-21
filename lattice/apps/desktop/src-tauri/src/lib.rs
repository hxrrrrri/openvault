mod commands;
#[allow(dead_code)]
mod errors;
#[allow(dead_code)]
mod events;
mod state;
mod terminal;

use commands::*;
use state::AppState;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            bootstrap_vault,
            create_vault,
            open_vault,
            get_vault_state,
            list_tags,
            scan_vault,
            watch_vault,
            list_files,
            read_note,
            write_note,
            create_note,
            rename_note,
            delete_note,
            create_folder,
            get_note_metadata,
            read_asset_data_url,
            import_asset,
            get_unlinked_mentions,
            convert_unlinked_mention,
            reindex_note,
            reindex_vault,
            list_collection_items,
            list_ai_cli_adapters,
            run_ai_cli,
            list_terminal_adapters,
            list_terminal_sessions,
            start_terminal_session,
            get_terminal_history,
            write_terminal_input,
            resize_terminal_session,
            kill_terminal_session,
            kill_all_terminal_sessions,
            get_global_graph,
            get_local_graph,
            get_backlinks,
            get_outgoing_links,
            get_unresolved_links,
            search,
            command_search,
            get_vault_health,
            list_plugins,
            install_plugin_from_folder,
            install_obsidian_plugins_from_vault,
            enable_plugin,
            disable_plugin,
            read_plugin_runtime_bundle,
            read_plugin_data,
            write_plugin_data,
            update_plugin_permissions
        ])
        .run(tauri::generate_context!())
        .expect("failed to run LATTICE");
}
