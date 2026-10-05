pub mod core;
pub mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(commands::app_updates::AppUpdateState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            crate::core::logger::log_launcher(
                &app_handle,
                "INFO",
                &format!("DLSSNR X AMD v{} iniciado", env!("CARGO_PKG_VERSION")),
            );
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::gpu::detect_linux_gpus,
            commands::neural_settings::get_neural_startup,
            commands::neural_settings::set_neural_startup,
            commands::app_updates::check_launcher_update,
            commands::app_updates::download_launcher_update,
            commands::app_updates::restart_launcher_update,
            commands::installer::install_mod,
            commands::installer::extract_dll,
            commands::installer::extract_dll_wizard,
            commands::installer::check_cached_bin,
            commands::installer::check_game_installation,
            commands::installer::get_installed_dll,
            commands::installer::get_game_installation_details,
            commands::installer::update_shortcut_key_in_game,
            commands::updater::update_backend,
            commands::updater::copy_local_backend,
            commands::updater::delete_backend,
            commands::updater::cancel_update,
            commands::updater::check_backend_version,
            commands::updater::get_backend_path,
            commands::updater::open_backend_folder,
            commands::covers::import_game_cover,
            commands::scanner::scan_installed_games,
            commands::scanner::fetch_steam_release_date,
            commands::scanner::launch_game,
            commands::scanner::open_folder,
            commands::scanner::collect_and_open_logs,
            commands::scanner::fetch_steamgriddb_cover_command,
            commands::analyzer::analyze_game,
            commands::config::load_app_config,
            commands::config::save_app_config,
            commands::config::delete_app_config,
            commands::config::save_custom_game_path,
            commands::config::clear_game_caches,
            commands::config::log_cached_library,
            commands::config::emergency_reset_launcher,
            commands::config::restart_after_emergency_reset
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
