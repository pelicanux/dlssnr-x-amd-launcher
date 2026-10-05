use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs;
use tauri::{AppHandle, Manager};
use reqwest::Client;

#[derive(Debug, Serialize, Clone)]
pub struct GameInfo {
    pub name: String,
    pub path: String,
    pub app_id: Option<String>,
    pub cover_url: Option<String>,
    pub launcher: String,
}

#[derive(Deserialize, Debug)]
struct SteamGridSearchResponse {
    pub success: bool,
    pub data: Vec<SteamGridGame>,
}

#[derive(Deserialize, Debug)]
struct SteamGridGame {
    pub id: u32,
    pub name: String,
}

#[derive(Deserialize, Debug)]
struct SteamGridGridResponse {
    pub success: bool,
    pub data: Vec<SteamGridGrid>,
}

#[derive(Deserialize, Debug)]
struct SteamGridGrid {
    pub url: String,
}

/// Helper to read ACF files
fn parse_acf_file(path: &Path) -> Option<(String, String, String)> {
    let content = fs::read_to_string(path).ok()?;
    
    let mut appid = String::new();
    let mut name = String::new();
    let mut installdir = String::new();
    
    for line in content.lines() {
        let l = line.trim();
        if l.starts_with("\"appid\"") {
            appid = l.replace("\"appid\"", "").replace("\"", "").trim().to_string();
        } else if l.starts_with("\"name\"") {
            name = l.replace("\"name\"", "").replace("\"", "").trim().to_string();
        } else if l.starts_with("\"installdir\"") {
            installdir = l.replace("\"installdir\"", "").replace("\"", "").trim().to_string();
        }
    }
    
    if !appid.is_empty() && !name.is_empty() && !installdir.is_empty() {
        Some((appid, name, installdir))
    } else {
        None
    }
}

/// Helper to read libraryfolders.vdf and extract all library paths
fn parse_library_folders(path: &Path) -> Vec<PathBuf> {
    let mut folders = Vec::new();
    if let Ok(content) = fs::read_to_string(path) {
        for line in content.lines() {
            let l = line.trim();
            if l.starts_with("\"path\"") {
                let p = l.replace("\"path\"", "").replace("\"", "").trim().to_string();
                // vdf often double escapes slashes in windows but on linux it's usually just strings
                let p = p.replace("\\\\", "/");
                let folder_path = PathBuf::from(p);
                if folder_path.exists() {
                    folders.push(folder_path);
                }
            }
        }
    }
    folders
}

fn scan_steam(home: &Path) -> Vec<GameInfo> {
    let mut games = Vec::new();
    
    let steam_paths = vec![
        home.join(".local/share/Steam"),
        home.join(".steam/steam"),
        home.join(".var/app/com.valvesoftware.Steam/.local/share/Steam"),
        home.join(".var/app/com.valvesoftware.Steam/data/Steam"),
    ];

    let mut libraries = Vec::new();

    for steam_path in steam_paths {
        let vdf_path = steam_path.join("config/libraryfolders.vdf");
        if vdf_path.exists() {
            libraries.extend(parse_library_folders(&vdf_path));
            // Add the default steamapps folder as well just in case
            libraries.push(steam_path.clone());
        }
    }

    // Deduplicate libraries
    libraries.sort();
    libraries.dedup();

    for lib in libraries {
        let steamapps = lib.join("steamapps");
        if !steamapps.exists() { continue; }

        if let Ok(entries) = fs::read_dir(&steamapps) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() && p.extension().and_then(|e| e.to_str()) == Some("acf") {
                    if let Some((appid, name, installdir)) = parse_acf_file(&p) {
                        let lower_name = name.to_lowercase();
                        if lower_name.contains("proton") || lower_name.contains("steam linux runtime") || lower_name.contains("steamworks common") || lower_name.contains("sniper") || lower_name.contains("soldier") || lower_name.contains("legacy") || lower_name.contains("runtime") {
                            continue;
                        }
                        let game_path = steamapps.join("common").join(&installdir);
                        if game_path.exists() {
                            games.push(GameInfo {
                                name,
                                path: game_path.to_string_lossy().to_string(),
                                app_id: Some(appid.clone()),
                                cover_url: Some(format!("https://steamcdn-a.akamaihd.net/steam/apps/{}/library_600x900.jpg", appid)),
                                launcher: "Steam".to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    games
}

fn scan_heroic(home: &Path) -> Vec<GameInfo> {
    [home.join(".config/heroic"), home.join(".var/app/com.heroicgameslauncher.hgl/config/heroic")]
        .iter().flat_map(|base| super::heroic_library::scan(base)).map(|game| GameInfo {
            name: game.name, path: game.path, app_id: None, cover_url: game.cover,
            launcher: "Heroic".to_string(),
        }).collect()
}

async fn fetch_best_cover(name: &str, api_key: &str) -> Option<String> {
    let name = super::store_artwork::catalog_title(name);
    // Try Steam Store first since it might have games SteamGridDB doesn't have yet, and it's official
    if let Some(url) = super::store_artwork::fetch_steam_cover(name).await {
        return Some(url);
    }
    
    // Search official online catalogs directly; Heroic is not needed for artwork.
    if let Some(url) = super::store_artwork::fetch_cover(name).await {
        return Some(url);
    }

    // SteamGridDB is optional; the official stores do not require this key.
    let personal_key = crate::core::config_manager::load_config()
        .and_then(|config| config.steamgriddb_api_key).unwrap_or_default();
    let key = if personal_key.trim().is_empty() { api_key } else { personal_key.trim() };
    if key.is_empty() { return None; }
    fetch_steamgriddb_cover(name, key).await
}

#[tauri::command]
pub async fn fetch_steamgriddb_cover_command(name: String, api_key: String) -> Result<Option<String>, String> {
    Ok(fetch_best_cover(&name, &api_key).await)
}

async fn fetch_steamgriddb_cover(name: &str, api_key: &str) -> Option<String> {
    let client = Client::new();
    
    // 1. Search for the game
    let search_url = format!("https://www.steamgriddb.com/api/v2/search/autocomplete/{}", urlencoding::encode(name));
    let search_resp = client.get(&search_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send().await.ok()?;
        
    let search_json: SteamGridSearchResponse = search_resp.json().await.ok()?;
    let first_game = search_json.data.first()?;
    
    // 2. Get the grid
    let grid_url = format!("https://www.steamgriddb.com/api/v2/grids/game/{}?dimensions=600x900,342x482", first_game.id);
    let grid_resp = client.get(&grid_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send().await.ok()?;
        
    let grid_json: SteamGridGridResponse = grid_resp.json().await.ok()?;
    let first_grid = grid_json.data.first()?;
    
    Some(first_grid.url.clone())
}

fn has_executable(dir: &Path, depth: u8) -> bool {
    if depth == 0 {
        return false;
    }
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                    if ext.eq_ignore_ascii_case("exe") {
                        return true;
                    }
                }
            } else if p.is_dir() {
                if has_executable(&p, depth - 1) {
                    return true;
                }
            }
        }
    }
    false
}

fn find_best_executable_dir(dir: &Path, max_depth: u8) -> Option<PathBuf> {
    if max_depth == 0 {
        return None;
    }
    
    let mut best_dir: Option<PathBuf> = None;
    let mut best_score = -1;

    let mut dirs_to_check = vec![(dir.to_path_buf(), max_depth)];
    
    let keywords = ["win64", "x64", "binaries", "bin"];
    
    while let Some((current_dir, current_depth)) = dirs_to_check.pop() {
        if let Ok(entries) = fs::read_dir(&current_dir) {
            let mut has_exe = false;
            let mut has_shipping_exe = false;
            
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() {
                    if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                        if ext.eq_ignore_ascii_case("exe") {
                            has_exe = true;
                            if let Some(name) = p.file_stem().and_then(|n| n.to_str()) {
                                if name.to_lowercase().contains("shipping") {
                                    has_shipping_exe = true;
                                }
                            }
                        }
                    }
                } else if p.is_dir() && current_depth > 1 {
                    dirs_to_check.push((p, current_depth - 1));
                }
            }
            
            if has_exe {
                let mut score = 0;
                let path_str = current_dir.to_string_lossy().to_lowercase();
                
                for keyword in &keywords {
                    if path_str.contains(keyword) {
                        score += 1;
                    }
                }
                
                if has_shipping_exe {
                    score += 2;
                }
                
                if score > best_score {
                    best_score = score;
                    best_dir = Some(current_dir.clone());
                }
            }
        }
    }
    
    best_dir
}

fn scan_custom(folders: Vec<String>) -> Vec<GameInfo> {
    let mut games = Vec::new();
    for folder in folders {
        let path = Path::new(&folder);
        if path.is_dir() {
            if let Ok(entries) = fs::read_dir(path) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.is_dir() {
                        // Check if it actually contains an .exe file (up to depth 3)
                        if has_executable(&p, 3) {
                            if let Some(name) = p.file_name().and_then(|n| n.to_str()) {
                                games.push(GameInfo {
                                    name: name.to_string(),
                                    path: p.to_string_lossy().to_string(),
                                    app_id: None,
                                    cover_url: None,
                                    launcher: "Custom".to_string(),
                                });
                            }
                        }
                    }
                }
            }
        }
    }
    games
}

#[tauri::command]
pub async fn scan_installed_games(app: AppHandle, api_key: String, custom_folders: Option<Vec<String>>) -> Result<Vec<GameInfo>, String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    
    let mut all_games = Vec::new();
    
    // 1. Scan Steam
    all_games.extend(scan_steam(&home));
    
    // 2. Scan Heroic
    all_games.extend(scan_heroic(&home));

    // 3. Scan Custom
    if let Some(folders) = custom_folders {
        all_games.extend(scan_custom(folders));
    }
    
    // Deduplicate by path and name
    let mut unique_games: Vec<GameInfo> = Vec::new();
    for game in all_games {
        if !unique_games.iter().any(|g| g.path == game.path || g.name == game.name) {
            unique_games.push(game);
        }
    }
    
    let config = crate::core::config_manager::load_config().unwrap_or_default();
    
    // Process paths: heuristic + user overrides
    for game in &mut unique_games {
        // 1. Check for manual overrides first
        if let Some(custom_path) = config.custom_game_paths.get(&game.name) {
            game.path = custom_path.clone();
            continue; // Skip heuristic if user set a manual override
        }
        
        // 2. Apply heuristics for nested executable paths
        let base_path = Path::new(&game.path);
        if base_path.exists() {
            // We search up to 4 levels deep for the most likely executable directory
            if let Some(best_dir) = find_best_executable_dir(base_path, 4) {
                game.path = best_dir.to_string_lossy().to_string();
            }
        }
    }
    
    // Resolve current Steam artwork filenames in one catalog request.
    let steam_ids: Vec<u32> = unique_games.iter().filter_map(|game| game.app_id.as_ref()?.parse().ok()).collect();
    let steam_assets = super::store_artwork::fetch_steam_assets(&steam_ids).await;
    for game in &mut unique_games {
        if let Some(url) = game.app_id.as_ref().and_then(|id| id.parse::<u32>().ok()).and_then(|id| steam_assets.get(&id)) {
            game.cover_url = Some(url.clone());
        }
    }

    // Copy Heroic file artwork into our scoped asset directory before displaying it.
    for game in &mut unique_games {
        if let Some(url) = game.cover_url.as_ref().filter(|url| url.starts_with("file://")) {
            let source = reqwest::Url::parse(url).ok().and_then(|url| url.to_file_path().ok());
            game.cover_url = match source {
                Some(source) => super::covers::cache_heroic_cover(&app, source).await.ok()
                    .and_then(|path| reqwest::Url::from_file_path(path).ok()).map(|url| url.to_string()),
                None => None,
            };
        }
    }

    // 3. Fetch missing covers using API
    for game in &mut unique_games {
        if game.cover_url.is_none() {
            if let Some(url) = fetch_best_cover(&game.name, &api_key).await {
                game.cover_url = Some(url);
            } else {
                // Fallback to a placeholder or generic Steam search
                // For demonstration, keep it None to show a generic cover
            }
        }
    }

    // Sort alphabetically
    unique_games.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    
    Ok(unique_games)
}

#[derive(Deserialize, Debug)]
struct SteamAppDetailsResponse {
    #[serde(flatten)]
    apps: std::collections::HashMap<String, SteamAppDetails>,
}

#[derive(Deserialize, Debug)]
struct SteamAppDetails {
    success: bool,
    data: Option<SteamAppDetailsData>,
}

#[derive(Deserialize, Debug)]
struct SteamAppDetailsData {
    release_date: Option<SteamReleaseDate>,
}

#[derive(Deserialize, Debug)]
struct SteamReleaseDate {
    date: String,
}

#[derive(serde::Serialize, serde::Deserialize, Default)]
struct ReleaseDateCache {
    dates: std::collections::HashMap<String, String>,
}

fn load_date_cache(app: &tauri::AppHandle) -> ReleaseDateCache {
    let cache_dir = app.path().app_local_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    let cache_file = cache_dir.join("release_date_cache.json");
    if let Ok(data) = std::fs::read_to_string(cache_file) {
        if let Ok(cache) = serde_json::from_str(&data) {
            return cache;
        }
    }
    ReleaseDateCache::default()
}

fn save_date_cache(app: &tauri::AppHandle, cache: &ReleaseDateCache) {
    let cache_dir = app.path().app_local_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    std::fs::create_dir_all(&cache_dir).ok();
    let cache_file = cache_dir.join("release_date_cache.json");
    if let Ok(data) = serde_json::to_string(cache) {
        std::fs::write(cache_file, data).ok();
    }
}

fn cache_release_date(app: &tauri::AppHandle, app_id: &str, date: &str, generation: u64) {
    let current_generation = crate::core::game_info_cache::lock_generation();
    if *current_generation != generation { return; }
    let mut cache = load_date_cache(app);
    cache.dates.insert(app_id.to_string(), date.to_string());
    save_date_cache(app, &cache);
}

#[tauri::command]
pub async fn fetch_steam_release_date(app: tauri::AppHandle, app_id: String) -> Result<String, String> {
    let (cache, generation) = {
        let generation = crate::core::game_info_cache::lock_generation();
        (load_date_cache(&app), *generation)
    };
    if let Some(cached_date) = cache.dates.get(&app_id) {
        return Ok(cached_date.clone());
    }

    let url = format!("https://store.steampowered.com/api/appdetails?appids={}", app_id);
    let client = Client::new();
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let json: SteamAppDetailsResponse = res.json().await.map_err(|e| e.to_string())?;
    
    if let Some(app_data) = json.apps.get(&app_id) {
        if app_data.success {
            if let Some(data) = &app_data.data {
                if let Some(release_date) = &data.release_date {
                    let date = release_date.date.clone();
                    cache_release_date(&app, &app_id, &date, generation);
                    return Ok(date);
                }
            }
        }
    }
    
    // Se chegou aqui, não tem data. Grava como "Desconhecido" para não ficar pedindo de novo.
    let unknown = "Desconhecido".to_string();
    cache_release_date(&app, &app_id, &unknown, generation);
    Ok(unknown)
}

fn log_action(message: &str) {
    use std::io::{Read, Write};
    let version = "0.5.0"; // hardcoded for now, or use env!("CARGO_PKG_VERSION")
    
    #[cfg(target_os = "linux")]
    let config_dir = match std::env::var("HOME") {
        Ok(home) => std::path::PathBuf::from(home).join(".config").join("dlssnr-x-amd"),
        Err(_) => return,
    };
    
    #[cfg(target_os = "windows")]
    let config_dir = match std::env::var("APPDATA") {
        Ok(appdata) => std::path::PathBuf::from(appdata).join("dlssnr-x-amd"),
        Err(_) => return,
    };
    
    if !config_dir.exists() {
        let _ = fs::create_dir_all(&config_dir);
    }
    
    let log_file = config_dir.join("app.log");
    
    // Read existing lines if any
    let mut lines = Vec::new();
    if log_file.exists() {
        if let Ok(content) = fs::read_to_string(&log_file) {
            lines = content.lines().map(|s| s.to_string()).collect();
        }
    }
    
    // Append new line with timestamp
    let timestamp = match std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) {
        Ok(n) => n.as_secs(),
        Err(_) => 0,
    };
    let new_line = format!("[v{}][ts:{}] {}", env!("CARGO_PKG_VERSION"), timestamp, message);
    lines.push(new_line);
    
    // Keep only last 1000 lines
    if lines.len() > 1000 {
        lines = lines[lines.len() - 1000..].to_vec();
    }
    
    // Write back
    if let Ok(mut file) = std::fs::File::create(&log_file) {
        let _ = file.write_all(lines.join("\n").as_bytes());
        let _ = file.write_all(b"\n");
    }
}

#[tauri::command]
pub async fn launch_game(path: String, app_id: Option<String>, launcher: String) -> Result<(), String> {
    log_action(&format!("Attempting to open game/folder. Launcher: {}, Path: {}", launcher, path));
    
    if launcher == "Steam" && app_id.is_some() {
        let id = app_id.unwrap();
        log_action(&format!("Launching Steam AppID: {}", id));
        #[cfg(target_os = "linux")]
        let res = {
            let mut cmd = std::process::Command::new("xdg-open");
            cmd.arg(format!("steam://rungameid/{}", id));
            cmd.env_remove("LD_LIBRARY_PATH");
            cmd.spawn()
        };
        #[cfg(target_os = "windows")]
        let res = std::process::Command::new("cmd").args(["/c", "start", &format!("steam://rungameid/{}", id)]).spawn();
        
        if let Err(e) = res {
            log_action(&format!("Failed to spawn Steam process: {}", e));
        }
    } else {
        log_action(&format!("Opening folder for Non-Steam game: {}", path));
        #[cfg(target_os = "linux")]
        let res = {
            let mut cmd = std::process::Command::new("xdg-open");
            cmd.arg(&path);
            cmd.env_remove("LD_LIBRARY_PATH");
            cmd.spawn()
        };
        #[cfg(target_os = "windows")]
        let res = std::process::Command::new("explorer").arg(&path).spawn();
        
        if let Err(e) = res {
            log_action(&format!("Failed to open folder: {}", e));
        }
    }
    Ok(())
}

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        let mut cmd = std::process::Command::new("xdg-open");
        cmd.arg(&path);
        cmd.env_remove("LD_LIBRARY_PATH");
        cmd.spawn().map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn collect_and_open_logs(app: tauri::AppHandle, game_name: String, game_dir: String) -> Result<(), String> {
    use std::fs;
    let config_dir = app.path().config_dir().map_err(|_| "Failed to get config dir".to_string())?;
    
    if game_name.is_empty() {
        let base_logs_dir = config_dir.join("dlssnr-x-amd").join("logs");
        let _ = fs::create_dir_all(&base_logs_dir);
        return open_folder(base_logs_dir.to_string_lossy().to_string());
    }

    let logs_dir = config_dir.join("dlssnr-x-amd").join("logs").join(&game_name);
    
    // Create logs directory if it doesn't exist
    fs::create_dir_all(&logs_dir).map_err(|e| format!("Failed to create logs directory: {}", e))?;
    
    // Common log files generated by the mod
    let log_files = ["OptiScaler.log", "dlssnr-amd.log", "ReShade.log", "dxgi.log", "nvngx.log", "dlssnr-amd-install.txt"];
    let game_path = std::path::Path::new(&game_dir);
    
    // For games, the logs are usually next to the exe. We'll search the base dir and immediate subdirs
    // But since the mod is installed where the EXE is, we should ideally use the same logic as check_game_installation
    let exe_path = crate::commands::analyzer::scan_directory_for_exe(game_path);
    let dir = if let Some(exe) = exe_path {
        exe.parent().unwrap_or(game_path).to_path_buf()
    } else {
        game_path.to_path_buf()
    };

    let mut found_any = false;
    for log_name in log_files.iter() {
        let source_log = dir.join(log_name);
        if source_log.exists() {
            let dest_log = logs_dir.join(log_name);
            let _ = fs::copy(&source_log, &dest_log);
            found_any = true;
        }
    }

    if !found_any {
        // If no logs found, we can at least write a dummy file to inform the user
        let _ = fs::write(logs_dir.join("info.txt"), format!("No logs found for {} in {}.\nThe game might not have been launched yet or the mod is not active.", game_name, dir.display()));
    }

    // Open the logs directory
    open_folder(logs_dir.to_string_lossy().to_string())
}
