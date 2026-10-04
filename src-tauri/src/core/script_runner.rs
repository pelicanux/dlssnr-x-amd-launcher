use std::process::Command;
use std::path::Path;
use std::fs;
use std::env;

/// Executes a standalone installation by copying bundled resources to a temp directory.
pub fn execute_standalone_install(
    resource_path: &Path,
    game_dir: &str,
    route: &str,
    dll_path: Option<&String>,
    bin_path: Option<&String>,
    shortcut_key: &str,
) -> Result<String, String> {
    // 1. Create a unique temporary directory
    let temp_dir = env::temp_dir().join(format!("dlssnr-installer-{}", uuid::Uuid::new_v4()));
    if let Err(e) = fs::create_dir_all(&temp_dir) {
        return Err(format!("Failed to create temporary directory: {}", e));
    }

    // 2. Copy the bundled resources recursively to the temp directory
    let mut cp_cmd = Command::new("cp");
    cp_cmd.arg("-r");
    // Ensure we copy the contents, not the folder itself if we want it to be the base
    cp_cmd.arg(format!("{}/.", resource_path.display()));
    cp_cmd.arg(&temp_dir);
    
    if let Ok(output) = cp_cmd.output() {
        if !output.status.success() {
            let _ = fs::remove_dir_all(&temp_dir);
            return Err(format!("Failed to extract bundled resources: {}", String::from_utf8_lossy(&output.stderr)));
        }
    } else {
        let _ = fs::remove_dir_all(&temp_dir);
        return Err("Failed to execute cp command for extraction".to_string());
    }

    // 3. Prepare the `.bin` model if provided
    if let Some(bin) = bin_path {
        let target_bin = temp_dir.join("dlssnr-amd/dlssnr.bin");
        if let Some(parent) = target_bin.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Err(e) = fs::copy(bin, &target_bin) {
            let _ = fs::remove_dir_all(&temp_dir);
            return Err(format!("Failed to copy bin file: {}", e));
        }
    }

    // 4. Patch extract_model.sh to print python errors if it fails
    let extract_script = temp_dir.join("model-tools/extract_model.sh");
    if extract_script.exists() {
        if let Ok(content) = fs::read_to_string(&extract_script) {
            let patched = content.replace(
                "echo \"Cannot read nvngx_dlssnr weights",
                "cat \"$work/inspect.err\" >&2\n    echo \"Cannot read nvngx_dlssnr weights"
            );
            let _ = fs::write(&extract_script, patched);
        }
    }

    // 5. Execute `install.sh` from the temporary directory
    let mut cmd = Command::new("bash");
    
    // Fix for AppImage: Strip environment variables that break PyInstaller binaries like dlssnr-amd
    if let Ok(orig_ld) = std::env::var("ORIG_LD_LIBRARY_PATH") {
        cmd.env("LD_LIBRARY_PATH", orig_ld);
    } else {
        cmd.env_remove("LD_LIBRARY_PATH");
    }
    cmd.env_remove("APPDIR");
    cmd.env_remove("APPIMAGE");
    cmd.env_remove("PYTHONHOME");
    cmd.env_remove("PYTHONPATH");
    
    cmd.current_dir(&temp_dir);
    cmd.arg("install.sh");
    cmd.arg(game_dir);
    cmd.arg(route);
    
    if let Some(dll) = dll_path {
        cmd.arg("--dll");
        cmd.arg(dll);
    }

    let output = cmd.output().map_err(|e| format!("Failed to execute bash process: {}", e));

    // 5. Handle the output and copy back the .bin if generated
    let result = match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            let combined = format!("{}\n{}", stdout, stderr);
            
            let combined_lower = combined.to_lowercase();
            
            // Check for known backend warnings that should be treated as fatal errors
            if combined_lower.contains("will not load") || 
               combined_lower.contains("incompatible") {
                Err(format!("Aviso do Backend (Instalação Incompatível):\nO mod detectou um problema de compatibilidade (provavelmente você selecionou 64 bits para um jogo 32 bits, ou a rota selecionada não é suportada por este jogo).\n\nLog completo:\n{}", combined))
            } else if out.status.success() {
                // Success: If we used a DLL, copy the generated bin back to resource_path to cache it
                if dll_path.is_some() {
                    let generated_bin = temp_dir.join("dlssnr-amd/dlssnr.bin");
                    if generated_bin.exists() {
                        let target_bin = resource_path.join("dlssnr-amd/dlssnr.bin");
                        if let Some(parent) = target_bin.parent() {
                            let _ = fs::create_dir_all(parent);
                        }
                        let _ = fs::copy(&generated_bin, &target_bin);
                    }
                }
                Ok(format!("Success:\n{}", combined))
            } else {
                Err(format!("Script Error (code: {:?}):\n{}", out.status.code(), combined))
            }
        }
        Err(e) => Err(e),
    };

    // 6. Cleanup the temporary directory
    let _ = fs::remove_dir_all(&temp_dir);

    if result.is_ok() {
        let _ = inject_shortcut_key(game_dir, shortcut_key);
    }

    result
}

pub fn inject_shortcut_key_pub(game_dir: &str, shortcut_key: &str) -> Result<(), String> {
    inject_shortcut_key(game_dir, shortcut_key)
}

fn inject_shortcut_key(game_dir: &str, shortcut_key: &str) -> Result<(), String> {
    let (key_hex, key_dec) = match shortcut_key {
        "End" => ("0x23", "35"),
        "Home" => ("0x24", "36"),
        "Page Up" => ("0x21", "33"),
        "Page Down" => ("0x22", "34"),
        "Insert" => ("0x2D", "45"),
        "Delete" => ("0x2E", "46"),
        "F1" => ("0x70", "112"),
        "F2" => ("0x71", "113"),
        "F11" => ("0x7A", "122"),
        "F12" => ("0x7B", "123"),
        _ => ("0x2D", "45"), // Default to Insert
    };

    let ini_files = vec!["nvngx.ini", "optiscaler.ini", "reshade.ini"];
    let base_path = Path::new(game_dir);

    // Let's also check in common subdirectories where the exe might be (like /Binaries/Win64)
    // To keep it simple, we use a basic recursive search (up to 3 levels) to find these ini files
    for entry in walkdir::WalkDir::new(base_path).max_depth(4).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() {
            if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                let file_name_lower = file_name.to_lowercase();
                if ini_files.contains(&file_name_lower.as_str()) {
                    if let Ok(content) = fs::read_to_string(path) {
                        let mut lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
                        let mut changed = false;

                        if file_name_lower == "reshade.ini" {
                            let mut has_input = false;
                            let mut has_keyoverlay = false;
                            for line in &lines {
                                if line.starts_with("[INPUT]") { has_input = true; }
                                if line.starts_with("KeyOverlay=") { has_keyoverlay = true; }
                            }
                            
                            if !has_keyoverlay {
                                if has_input {
                                    if let Some(idx) = lines.iter().position(|l| l.starts_with("[INPUT]")) {
                                        lines.insert(idx + 1, format!("KeyOverlay={},0,0,0", key_dec));
                                        changed = true;
                                    }
                                } else {
                                    lines.push(String::from("[INPUT]"));
                                    lines.push(format!("KeyOverlay={},0,0,0", key_dec));
                                    changed = true;
                                }
                            } else {
                                for line in &mut lines {
                                    if line.starts_with("KeyOverlay=") {
                                        *line = format!("KeyOverlay={},0,0,0", key_dec);
                                        changed = true;
                                        break;
                                    }
                                }
                            }
                        } else {
                            // optiscaler.ini or nvngx.ini
                            for line in &mut lines {
                                if line.starts_with("MenuKey=") {
                                    *line = format!("MenuKey={}", key_hex);
                                    changed = true;
                                } else if line.starts_with("KeyMenu=") {
                                    *line = format!("KeyMenu={}", key_hex);
                                    changed = true;
                                } else if line.starts_with("ShortcutKey=") {
                                    *line = format!("ShortcutKey={}", key_hex);
                                    changed = true;
                                }
                            }
                        }

                        if changed {
                            let _ = fs::write(path, lines.join("\n"));
                        }
                    }
                }
            }
        }
    }

    Ok(())
}
