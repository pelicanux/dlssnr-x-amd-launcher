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
