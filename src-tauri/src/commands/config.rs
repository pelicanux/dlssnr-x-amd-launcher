use crate::core::config_manager::{load_config, save_config, AppConfig};

#[tauri::command]
pub fn load_app_config() -> Option<AppConfig> {
    load_config()
}

#[tauri::command]
pub fn save_app_config(mut config: AppConfig) -> Result<(), String> {
    // Re-running the setup wizard must preserve the personal cover key.
    if config.steamgriddb_api_key.is_none() {
        config.steamgriddb_api_key = load_config().and_then(|old| old.steamgriddb_api_key);
    }
    if let Some(key) = &mut config.steamgriddb_api_key { *key = key.trim().to_string(); }
    save_config(&config)
}

#[tauri::command]
pub fn delete_app_config() -> Result<(), String> {
    crate::core::config_manager::delete_config()
}

#[tauri::command]
pub fn save_custom_game_path(game_name: String, new_path: String) -> Result<(), String> {
    let mut config = crate::core::config_manager::load_config().unwrap_or_default();
    config.custom_game_paths.insert(game_name, new_path);
    crate::core::config_manager::save_config(&config)
}

#[tauri::command]
pub async fn clear_game_caches(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    let cache_dir = app.path().app_local_data_dir().map_err(|error| error.to_string())?;
    tauri::async_runtime::spawn_blocking(move || crate::core::game_info_cache::clear_files(&cache_dir))
        .await.map_err(|error| error.to_string())?
}
