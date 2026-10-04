use serde::{Deserialize, Serialize};
use std::fs;
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub backend: String,
    pub dll_version: String,
    pub shortcut_key: String,
    #[serde(default)]
    pub custom_game_paths: HashMap<String, String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            backend: "AMDNR".to_string(),
            dll_version: "0.5.1".to_string(),
            shortcut_key: "Insert".to_string(),
            custom_game_paths: HashMap::new(),
        }
    }
}

pub fn get_config_path() -> PathBuf {
    // Save to ~/.config/dlssnr-x-amd/config.json
    let config_dir = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    let app_dir = config_dir.join("dlssnr-x-amd");
    if !app_dir.exists() {
        let _ = fs::create_dir_all(&app_dir);
    }
    app_dir.join("config.json")
}

pub fn load_config() -> Option<AppConfig> {
    let path = get_config_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(config) = serde_json::from_str(&content) {
                return Some(config);
            }
        }
    }
    None
}

pub fn save_config(config: &AppConfig) -> Result<(), String> {
    let path = get_config_path();
    let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

pub fn delete_config() -> Result<(), String> {
    let path = get_config_path();
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}
