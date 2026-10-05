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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub steamgriddb_api_key: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            backend: "AMDNR".to_string(),
            dll_version: "0.5.1".to_string(),
            shortcut_key: "Insert".to_string(),
            custom_game_paths: HashMap::new(),
            steamgriddb_api_key: None,
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
    #[cfg(unix)]
    {
        use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
        use std::io::Write;
        let mut file = fs::OpenOptions::new().write(true).create(true).truncate(true).mode(0o600)
            .open(&path).map_err(|e| e.to_string())?;
        file.set_permissions(fs::Permissions::from_mode(0o600)).map_err(|e| e.to_string())?;
        file.write_all(content.as_bytes()).map_err(|e| e.to_string())
    }
    #[cfg(not(unix))]
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

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn existing_configurations_do_not_require_a_cover_key() {
        let config: AppConfig = serde_json::from_str(r#"{"backend":"AMDNR","dll_version":"model.bin","shortcut_key":"Insert","custom_game_paths":{"Example":"/games/example"}}"#).unwrap();
        assert!(config.steamgriddb_api_key.is_none());
        assert_eq!(config.custom_game_paths["Example"], "/games/example");
        assert!(serde_json::to_value(config).unwrap().get("steamgriddb_api_key").is_none());
    }
    #[test]
    fn clearing_a_key_is_explicit_and_survives_serialization() {
        let mut config = AppConfig::default();
        config.steamgriddb_api_key = Some(String::new());
        let restored: AppConfig = serde_json::from_str(&serde_json::to_string(&config).unwrap()).unwrap();
        assert_eq!(restored.steamgriddb_api_key.as_deref(), Some(""));
    }
}
