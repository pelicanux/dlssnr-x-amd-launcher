use std::fs;
use super::env_utils::get_base_dir;

/// Copies the provided model binary to the package directory.
/// 
/// This ensures the `.bin` file is placed in `dlssnr-amd/dlssnr.bin`
/// relative to the current working directory, which is expected by the
/// underlying bash scripts.
/// 
/// # Arguments
/// 
/// * `bin_path` - The absolute path to the user's `dlssnr.bin` file.
/// 
/// # Returns
/// 
/// * `Result<(), String>` - Ok on success, Err with a description on failure.
pub fn copy_model_binary(bin_path: &str) -> Result<(), String> {
    let base_dir = get_base_dir();
    let target_bin = base_dir.join("dlssnr-amd/dlssnr.bin");
    
    // Ensure the parent directory exists
    if let Some(parent) = target_bin.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            return Err(format!("Failed to create directories for model bin: {}", e));
        }
    }
    
    // Copy the file
    if let Err(e) = fs::copy(bin_path, target_bin) {
        return Err(format!("Failed to copy bin file: {}", e));
    }

    Ok(())
}
