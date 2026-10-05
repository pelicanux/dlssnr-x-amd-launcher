use std::path::Path;
use tauri::Manager;

// Keep a private copy: moving or deleting the user's source image must not break the cover.
#[tauri::command]
pub async fn import_game_cover(app: tauri::AppHandle, source: String) -> Result<String, String> {
    let directory = app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("covers");
    tauri::async_runtime::spawn_blocking(move || {
        let input = Path::new(&source);
        let extension = input.extension().and_then(|s| s.to_str()).unwrap_or("").to_ascii_lowercase();
        if !["png", "jpg", "jpeg", "webp"].contains(&extension.as_str()) {
            return Err("Unsupported cover format".to_string());
        }
        std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
        let target = directory.join(format!("{}.{}", uuid::Uuid::new_v4(), extension));
        std::fs::copy(input, &target).map_err(|e| e.to_string())?;
        Ok(target.to_string_lossy().into_owned())
    }).await.map_err(|e| e.to_string())?
}

// Stable copies keep automatic Heroic covers inside the existing asset scope.
// Repeated scans reuse the same file until its source changes.
pub(super) async fn cache_heroic_cover(app: &tauri::AppHandle, source: std::path::PathBuf) -> Result<std::path::PathBuf, String> {
    let directory = app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("covers");
    tauri::async_runtime::spawn_blocking(move || {
        use std::hash::{Hash, Hasher};
        let extension = source.extension().and_then(|s| s.to_str()).unwrap_or("").to_ascii_lowercase();
        if !["png", "jpg", "jpeg", "webp"].contains(&extension.as_str()) {
            return Err("Unsupported Heroic cover format".to_string());
        }
        let metadata = std::fs::metadata(&source).map_err(|e| e.to_string())?;
        if !metadata.is_file() { return Err("Heroic cover is not a file".to_string()); }
        let mut hash = std::collections::hash_map::DefaultHasher::new();
        source.hash(&mut hash);
        metadata.len().hash(&mut hash);
        metadata.modified().ok().hash(&mut hash);
        std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
        let target = directory.join(format!("heroic-{:x}.{}", hash.finish(), extension));
        if !target.is_file() { std::fs::copy(source, &target).map_err(|e| e.to_string())?; }
        Ok(target)
    }).await.map_err(|e| e.to_string())?
}
