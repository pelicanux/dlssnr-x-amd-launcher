use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};
use reqwest::Client;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct GameAnalysisResult {
    pub platform: String,
    pub architecture: String,
    pub graphics_api: String,
    #[serde(default)]
    pub upscalers: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct AnalysisCache {
    #[serde(default)]
    version: u32,
    entries: std::collections::HashMap<String, GameAnalysisResult>,
}

fn load_cache(app: &AppHandle) -> AnalysisCache {
    let cache_dir = app.path().app_local_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    let cache_file = cache_dir.join("analyzer_cache.json");
    if let Ok(data) = fs::read_to_string(cache_file) {
        if let Ok(cache) = serde_json::from_str(&data) {
            return cache;
        }
    }
    AnalysisCache::default()
}

fn save_cache(app: &AppHandle, cache: &AnalysisCache) {
    let cache_dir = app.path().app_local_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    fs::create_dir_all(&cache_dir).ok();
    let cache_file = cache_dir.join("analyzer_cache.json");
    if let Ok(data) = serde_json::to_string(cache) {
        fs::write(cache_file, data).ok();
    }
}

// A mod operation changes libraries on disk. Prevent an older in-flight query
// from restoring a stale result, while retaining the other games' cache entries.
pub(crate) fn invalidate_game(app: &AppHandle, path: &str) {
    let mut generation = crate::core::game_info_cache::lock_generation();
    *generation = generation.wrapping_add(1);
    let mut cache = load_cache(app);
    cache.entries.remove(path);
    save_cache(app, &cache);
}

pub fn scan_directory_for_exe(dir: &Path) -> Option<PathBuf> {
    let mut best_exe: Option<PathBuf> = None;
    let mut max_size = 0;

    for entry in walkdir::WalkDir::new(dir).max_depth(4).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if entry.file_type().is_file() {
            let name = path.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
            if name.ends_with(".exe") && !name.contains("unins") && !name.contains("crash") && !name.contains("launcher") {
                if let Ok(metadata) = entry.metadata() {
                    if metadata.len() > max_size {
                        max_size = metadata.len();
                        best_exe = Some(path.to_path_buf());
                    }
                }
            }
        }
    }

    if best_exe.is_none() {
        for entry in walkdir::WalkDir::new(dir).max_depth(4).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            if entry.file_type().is_file() {
                let ext = path.extension().unwrap_or_default().to_string_lossy().to_lowercase();
                let name = path.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
                if (ext == "" || ext == "x86_64") && !name.contains("crash") && !name.contains("launcher") {
                    if let Ok(metadata) = entry.metadata() {
                        if metadata.len() > max_size && metadata.len() > 1024 * 1024 { // Maior que 1MB
                            max_size = metadata.len();
                            best_exe = Some(path.to_path_buf());
                        }
                    }
                }
            }
        }
    }
    best_exe
}

fn analyze_pe_header(exe_path: &Path) -> Option<String> {
    // Executables can be hundreds of MB; only the DOS/ELF header and PE machine are needed.
    let mut file = fs::File::open(exe_path).ok()?;
    architecture_from_reader(&mut file)
}

fn architecture_from_reader(file: &mut (impl Read + Seek)) -> Option<String> {
    let mut header = [0u8; 64];
    file.read_exact(&mut header).ok()?;
    if header[..4] == [0x7F, b'E', b'L', b'F'] {
        return match header[4] {
            1 => Some("32-bits".to_string()),
            2 => Some("64-bits".to_string()),
            _ => None,
        };
    }
    if &header[..2] != b"MZ" { return None; }
    let pe_offset = u32::from_le_bytes(header[0x3C..0x40].try_into().ok()?) as u64;
    file.seek(SeekFrom::Start(pe_offset)).ok()?;
    let mut pe = [0u8; 6];
    file.read_exact(&mut pe).ok()?;
    if &pe[..4] != b"PE\0\0" { return None; }
    match u16::from_le_bytes([pe[4], pe[5]]) {
        0x014c => Some("32-bits".to_string()),
        0x8664 => Some("64-bits".to_string()),
        _ => Some("Não detectada".to_string()),
    }
}

async fn fetch_steam_graphics_api(app_id: Option<String>, name: String) -> String {
    let client = Client::new();

    if let Some(id) = app_id {
        if let Ok(res) = client.get(&format!("https://store.steampowered.com/api/appdetails?appids={}", id)).send().await {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                if let Some(data) = json.get(&id).and_then(|d| d.get("data")) {
                    let mut apis = std::collections::BTreeSet::new();

                    let mut check_reqs = |reqs: Option<&serde_json::Value>| {
                        if let Some(r) = reqs {
                            let req_str = r.as_str().unwrap_or("").to_lowercase();
                            if req_str.contains("vulkan") { apis.insert("Vulkan".to_string()); }
                            if req_str.contains("directx 12") || req_str.contains("versão 12") || req_str.contains("version 12") || req_str.contains("dx12") { apis.insert("DirectX 12".to_string()); }
                            if req_str.contains("directx 11") || req_str.contains("versão 11") || req_str.contains("version 11") || req_str.contains("dx11") { apis.insert("DirectX 11".to_string()); }
                            if req_str.contains("directx 10") || req_str.contains("versão 10") || req_str.contains("version 10") || req_str.contains("dx10") { apis.insert("DirectX 10".to_string()); }
                            if req_str.contains("directx 9") || req_str.contains("versão 9") || req_str.contains("version 9") || req_str.contains("dx9") { apis.insert("DirectX 9".to_string()); }
                            if req_str.contains("opengl") { apis.insert("OpenGL".to_string()); }
                        }
                    };

                    check_reqs(data.get("pc_requirements").and_then(|r| r.get("minimum")));
                    check_reqs(data.get("pc_requirements").and_then(|r| r.get("recommended")));
                    
                    if !apis.is_empty() {
                        let sorted: Vec<String> = apis.into_iter().rev().collect(); // Rev para que o DX12 venha antes do DX9 etc
                        return sorted.join(" / ");
                    }
                }
            }
        }
    }
    
    // Fallback: search by name
    if !name.is_empty() {
        let search_url = format!("https://store.steampowered.com/search/?term={}", name);
        if let Ok(res) = client.get(&search_url).send().await {
            if let Ok(html) = res.text().await {
                if let Some(idx) = html.find("data-ds-appid=\"") {
                    let start = idx + 15;
                    if let Some(end) = html[start..].find("\"") {
                        let found_id = &html[start..start+end];
                        if let Ok(res_inner) = client.get(&format!("https://store.steampowered.com/api/appdetails?appids={}", found_id)).send().await {
                            if let Ok(json_inner) = res_inner.json::<serde_json::Value>().await {
                                if let Some(data_inner) = json_inner.get(found_id).and_then(|d| d.get("data")) {
                                    let mut apis = std::collections::BTreeSet::new();

                                    let mut check_reqs = |reqs: Option<&serde_json::Value>| {
                                        if let Some(r) = reqs {
                                            let req_str_inner = r.as_str().unwrap_or("").to_lowercase();
                                            if req_str_inner.contains("vulkan") { apis.insert("Vulkan".to_string()); }
                                            if req_str_inner.contains("directx 12") || req_str_inner.contains("versão 12") || req_str_inner.contains("version 12") || req_str_inner.contains("dx12") { apis.insert("DirectX 12".to_string()); }
                                            if req_str_inner.contains("directx 11") || req_str_inner.contains("versão 11") || req_str_inner.contains("version 11") || req_str_inner.contains("dx11") { apis.insert("DirectX 11".to_string()); }
                                            if req_str_inner.contains("directx 10") || req_str_inner.contains("versão 10") || req_str_inner.contains("version 10") || req_str_inner.contains("dx10") { apis.insert("DirectX 10".to_string()); }
                                            if req_str_inner.contains("directx 9") || req_str_inner.contains("versão 9") || req_str_inner.contains("version 9") || req_str_inner.contains("dx9") { apis.insert("DirectX 9".to_string()); }
                                            if req_str_inner.contains("opengl") { apis.insert("OpenGL".to_string()); }
                                        }
                                    };

                                    check_reqs(data_inner.get("pc_requirements").and_then(|r| r.get("minimum")));
                                    check_reqs(data_inner.get("pc_requirements").and_then(|r| r.get("recommended")));
                                    
                                    if !apis.is_empty() {
                                        let sorted: Vec<String> = apis.into_iter().rev().collect();
                                        return sorted.join(" / ");
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    "Não detectada".to_string()
}

#[tauri::command]
pub async fn analyze_game(app: AppHandle, path: String, name: Option<String>, app_id: Option<String>) -> Result<GameAnalysisResult, String> {
    let generation = *crate::core::game_info_cache::lock_generation();
    let worker_app = app.clone();
    let worker_path = path.clone();
    let (mut result, cached, has_executable) = tauri::async_runtime::spawn_blocking(move || {
        let cache = {
            let _guard = crate::core::game_info_cache::lock_generation();
            load_cache(&worker_app)
        };
        if let Some(cached) = cache.entries.get(&worker_path) {
            if cache.version == 1 && cached.upscalers.is_some() && cached.graphics_api != "Pesquisando..." && cached.graphics_api != "Verificando..." && cached.graphics_api != "Pesquisando API..." {
                return (cached.clone(), true, false);
            }
        }
        let mut result = GameAnalysisResult {
            platform: "Não detectada".to_string(),
            architecture: "Não detectada".to_string(),
            graphics_api: "Não detectada".to_string(),
            upscalers: None,
        };
        let exe_path = scan_directory_for_exe(Path::new(&worker_path));
        if let Some(ref exe) = exe_path {
            let is_exe = exe.extension().unwrap_or_default().to_string_lossy().to_lowercase() == "exe";
            result.platform = if is_exe { "Windows (Proton / Wine)" } else { "Linux Nativo" }.to_string();
            if let Some(arch) = analyze_pe_header(exe) { result.architecture = arch; }
        }
        result.upscalers = Some(super::upscalers::detect(Path::new(&worker_path), exe_path.as_deref()));
        (result, false, exe_path.is_some())
    }).await.map_err(|error| error.to_string())?;
    if cached { return Ok(result); }
    if has_executable {
        result.graphics_api = fetch_steam_graphics_api(app_id, name.unwrap_or_default()).await;
    }
    let saved_result = result.clone();
    tauri::async_runtime::spawn_blocking(move || {
        // Merge with the latest file so a slower analysis does not erase newer results.
        let current_generation = crate::core::game_info_cache::lock_generation();
        if *current_generation != generation { return; }
        let mut cache = load_cache(&app);
        if cache.version != 1 { cache.entries.clear(); }
        cache.version = 1;
        cache.entries.insert(path, saved_result);
        save_cache(&app, &cache);
    }).await.map_err(|error| error.to_string())?;
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Cursor, Result as IoResult};

    struct CountedReader { data: Cursor<Vec<u8>>, bytes_read: usize }
    impl Read for CountedReader {
        fn read(&mut self, buf: &mut [u8]) -> IoResult<usize> {
            let count = self.data.read(buf)?;
            self.bytes_read += count;
            Ok(count)
        }
    }
    impl Seek for CountedReader {
        fn seek(&mut self, position: SeekFrom) -> IoResult<u64> { self.data.seek(position) }
    }
    #[test]
    fn pe_architecture_reads_only_70_bytes() {
        for (machine, expected) in [(0x014cu16, "32-bits"), (0x8664, "64-bits")] {
            let mut bytes = vec![0u8; 4096];
            bytes[..2].copy_from_slice(b"MZ");
            bytes[60..64].copy_from_slice(&2048u32.to_le_bytes());
            bytes[2048..2052].copy_from_slice(b"PE\0\0");
            bytes[2052..2054].copy_from_slice(&machine.to_le_bytes());
            let mut reader = CountedReader { data: Cursor::new(bytes), bytes_read: 0 };
            assert_eq!(architecture_from_reader(&mut reader).as_deref(), Some(expected));
            assert_eq!(reader.bytes_read, 70);
        }
    }
    #[test]
    fn elf_and_invalid_headers() {
        for (class, expected) in [(1, Some("32-bits")), (2, Some("64-bits")), (3, None)] {
            let mut bytes = vec![0u8; 64];
            bytes[..4].copy_from_slice(b"\x7fELF");
            bytes[4] = class;
            assert_eq!(architecture_from_reader(&mut Cursor::new(bytes)).as_deref(), expected);
        }
        assert_eq!(architecture_from_reader(&mut Cursor::new(vec![0u8; 63])), None);
        assert_eq!(architecture_from_reader(&mut Cursor::new(vec![0u8; 64])), None);
        let mut bytes = vec![0u8; 64];
        bytes[..2].copy_from_slice(b"MZ");
        bytes[60..64].copy_from_slice(&u32::MAX.to_le_bytes());
        assert_eq!(architecture_from_reader(&mut Cursor::new(bytes)), None);
    }

    #[test]
    #[ignore = "Read-only timing check against a locally installed game"]
    fn inspect_local_game() {
        let path = std::env::var("DLSSNR_DIAGNOSTIC_GAME_DIR").expect("game directory required");
        let started = std::time::Instant::now();
        let exe = scan_directory_for_exe(Path::new(&path)).expect("game executable");
        let architecture = analyze_pe_header(&exe).expect("architecture");
        println!("Local executable: {:?}; architecture: {}; scan + header: {:?}", exe, architecture, started.elapsed());
    }
}
