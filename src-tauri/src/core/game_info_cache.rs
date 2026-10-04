use std::sync::{Mutex, MutexGuard};

// Serializes cache writes/deletion and invalidates queries started before a clear.
static GENERATION: Mutex<u64> = Mutex::new(0);

pub fn lock_generation() -> MutexGuard<'static, u64> {
    GENERATION.lock().unwrap_or_else(|error| error.into_inner())
}

pub fn clear_files(cache_dir: &std::path::Path) -> Result<(), String> {
    let mut generation = lock_generation();
    *generation = generation.wrapping_add(1);
    for name in ["analyzer_cache.json", "release_date_cache.json"] {
        match std::fs::remove_file(cache_dir.join(name)) {
            Ok(()) => {},
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {},
            Err(error) => return Err(format!("{}: {}", name, error)),
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn directory() -> std::path::PathBuf {
        let root = std::env::temp_dir().join(format!("dlssnr-cache-test-{}-{}", std::process::id(), std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        std::fs::create_dir_all(&root).unwrap();
        root
    }
    #[test]
    fn removes_only_information_caches_and_accepts_missing_files() {
        let root = directory();
        for name in ["analyzer_cache.json", "release_date_cache.json", "config.json", "dlssnr.bin", "game_library_cache_v1"] {
            std::fs::write(root.join(name), b"data").unwrap();
        }
        clear_files(&root).unwrap();
        assert!(!root.join("analyzer_cache.json").exists());
        assert!(!root.join("release_date_cache.json").exists());
        for name in ["config.json", "dlssnr.bin", "game_library_cache_v1"] { assert!(root.join(name).exists()); }
        clear_files(&root).unwrap();
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn deletion_failures_are_reported() {
        let root = directory();
        std::fs::create_dir(root.join("analyzer_cache.json")).unwrap();
        assert!(clear_files(&root).unwrap_err().contains("analyzer_cache.json"));
        std::fs::remove_dir_all(root).unwrap();
    }
}
