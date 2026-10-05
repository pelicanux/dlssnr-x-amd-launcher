use std::{fs::OpenOptions, io::Write, path::Path, sync::Mutex};
use tauri::Manager;

static LOG_LOCK: Mutex<()> = Mutex::new(());
const MAX_LOG_BYTES: u64 = 1024 * 1024;

fn append_log(log_dir: &Path, level: &str, message: &str) -> std::io::Result<()> {
    let _guard = LOG_LOCK.lock().unwrap_or_else(|error| error.into_inner());
    std::fs::create_dir_all(log_dir)?;
    let log_file = log_dir.join("launcher.log");
    if std::fs::metadata(&log_file).map(|meta| meta.len() >= MAX_LOG_BYTES).unwrap_or(false) {
        std::fs::rename(&log_file, log_dir.join("launcher.previous.log"))?;
    }
    let timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let level = match level { "ERROR" => "ERROR", "WARN" => "WARN", _ => "INFO" };
    // Keep each event on one bounded line, even for multiline installer errors.
    let message: String = message.chars().take(4096).map(|c| if c.is_control() { ' ' } else { c }).collect();
    let mut options = OpenOptions::new();
    options.create(true).append(true);
    #[cfg(unix)] {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(log_file)?;
    writeln!(file, "[{timestamp}] [{level}] {message}")
}

pub fn log_launcher(app: &tauri::AppHandle, level: &str, message: &str) {
    let Ok(config_dir) = app.path().config_dir() else { return };
    let _ = append_log(&config_dir.join("dlssnr-x-amd"), level, message);
}

pub fn log_result<T>(app: &tauri::AppHandle, operation: &str, result: &Result<T, String>) {
    match result {
        Ok(_) => log_launcher(app, "INFO", &format!("{operation}: concluído")),
        Err(error) => log_launcher(app, "ERROR", &format!("{operation}: {error}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rotates_and_keeps_events_on_one_line() {
        let dir = std::env::temp_dir().join(format!("dlssnr-log-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("launcher.log"), vec![b'x'; MAX_LOG_BYTES as usize]).unwrap();
        append_log(&dir, "ERROR", "first\nsecond\rthird").unwrap();
        let log = std::fs::read_to_string(dir.join("launcher.log")).unwrap();
        assert_eq!(log.lines().count(), 1);
        assert!(log.contains("[ERROR] first second third"));
        assert_eq!(std::fs::metadata(dir.join("launcher.previous.log")).unwrap().len(), MAX_LOG_BYTES);
        std::fs::remove_dir_all(dir).unwrap();
    }
}
