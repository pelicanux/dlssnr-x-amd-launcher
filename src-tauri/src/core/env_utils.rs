use std::env;
use std::path::PathBuf;

/// Gets the base directory of the executable.
/// 
/// If running as an AppImage, `std::env::current_exe()` returns a path inside
/// the read-only `/tmp/.mount_xxx` filesystem. To find the actual directory
/// where the user placed the `.AppImage`, we must check the `APPIMAGE` environment variable.
pub fn get_base_dir() -> PathBuf {
    if let Ok(appimage_path) = env::var("APPIMAGE") {
        let p = PathBuf::from(appimage_path);
        if let Some(parent) = p.parent() {
            return parent.to_path_buf();
        }
    }
    
    if let Ok(exe_path) = env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            return parent.to_path_buf();
        }
    }
    
    PathBuf::from(".")
}
