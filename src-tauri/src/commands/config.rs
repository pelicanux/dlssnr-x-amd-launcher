use crate::core::config_manager::{load_config, preserve_saved_preferences, save_config, AppConfig};

#[tauri::command]
pub fn load_app_config(app: tauri::AppHandle) -> Option<AppConfig> {
    let config = load_config();
    crate::core::logger::log_launcher(&app, "INFO", if config.is_some() { "Configuração carregada" } else { "Sem configuração válida; abrindo wizard inicial" });
    config
}

#[tauri::command]
pub fn save_app_config(mut config: AppConfig) -> Result<(), String> {
    if let Some(previous) = load_config() {
        preserve_saved_preferences(&mut config, previous);
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
    let result = tauri::async_runtime::spawn_blocking(move || crate::core::game_info_cache::clear_files(&cache_dir))
        .await.map_err(|error| error.to_string())?;
    crate::core::logger::log_result(&app, "Limpeza das informações em cache", &result);
    result
}

// The frontend cannot provide a deletion path. Never follow a redirected app folder.
fn remove_launcher_directory(config_root: &std::path::Path) -> Result<(), String> {
    let target = config_root.join("dlssnr-x-amd");
    match std::fs::symlink_metadata(&target) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error.to_string()),
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() =>
            return Err("The launcher configuration folder is not a regular directory".to_string()),
        Ok(_) => {},
    }
    std::fs::remove_dir_all(target).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn emergency_reset_launcher(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    let config_root = dirs::config_dir().ok_or("Configuration directory unavailable")?;
    let cache_dir = app.path().app_local_data_dir().map_err(|error| error.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        crate::core::game_info_cache::clear_files(&cache_dir)?;
        remove_launcher_directory(&config_root)
    }).await.map_err(|error| error.to_string())?
}

#[tauri::command]
pub fn restart_after_emergency_reset(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    let executable = tauri::process::current_binary(&app.env()).map_err(|error| error.to_string())?;
    let mut command = std::process::Command::new(executable);
    // AppImage must mount its own fresh runtime instead of reusing the old mount.
    if std::env::var_os("APPIMAGE").is_some() {
        command.env_remove("APPIMAGE").env_remove("APPDIR")
            .env_remove("LD_LIBRARY_PATH").env_remove("LD_PRELOAD");
    }
    command.spawn().map_err(|error| format!("Failed to restart launcher: {error}"))?;
    crate::core::logger::log_launcher(&app, "INFO", "Redefinição de emergência concluída; reiniciando para o wizard");
    app.exit(0);
    Ok(())
}

#[cfg(test)]
mod emergency_tests {
    use super::remove_launcher_directory;
    #[test]
    fn reset_only_deletes_the_launcher_folder() {
        let root = std::env::temp_dir().join(format!("dlssnr-reset-{}-{}", std::process::id(), std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        std::fs::create_dir_all(root.join("dlssnr-x-amd/backend-files")).unwrap();
        std::fs::write(root.join("dlssnr-x-amd/backend-files/model.bin"), b"test").unwrap();
        std::fs::create_dir_all(root.join("another-app")).unwrap();
        remove_launcher_directory(&root).unwrap();
        assert!(!root.join("dlssnr-x-amd").exists());
        assert!(root.join("another-app").exists());
        remove_launcher_directory(&root).unwrap();
        std::fs::remove_dir_all(root).unwrap();
    }
    #[cfg(unix)]
    #[test]
    fn reset_rejects_a_redirected_folder() {
        let root = std::env::temp_dir().join(format!("dlssnr-reset-link-{}", std::process::id()));
        std::fs::create_dir_all(root.join("keep")).unwrap();
        std::os::unix::fs::symlink(root.join("keep"), root.join("dlssnr-x-amd")).unwrap();
        assert!(remove_launcher_directory(&root).is_err());
        assert!(root.join("keep").exists());
        std::fs::remove_dir_all(root).unwrap();
    }
}

#[tauri::command]
pub fn log_cached_library(app: tauri::AppHandle, count: usize) {
    crate::core::logger::log_launcher(&app, "INFO", &format!("Biblioteca carregada do cache: {count} jogos; sem nova varredura"));
}
