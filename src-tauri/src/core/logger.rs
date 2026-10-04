use std::fs::OpenOptions;
use std::io::Write;
use tauri::Manager;

pub fn log_launcher(app: &tauri::AppHandle, level: &str, message: &str) {
    let Ok(config_dir) = app.path().config_dir() else { return };
    let log_dir = config_dir.join("dlssnr-x-amd");
    let _ = std::fs::create_dir_all(&log_dir);
    let log_file = log_dir.join("launcher.log");

    // Simple timestamp without chrono dependency
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let line = format!("[{}] [{}] {}\n", timestamp, level, message);

    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&log_file) {
        let _ = f.write_all(line.as_bytes());
    }
}
