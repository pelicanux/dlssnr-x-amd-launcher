use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{io::{Read, Write}, path::PathBuf, sync::{Mutex, atomic::{AtomicBool, Ordering}}, time::Duration};
use tauri::{Emitter, Manager};

const API: &str = "https://api.github.com/repos/pelicanux/dlssnr-x-amd-launcher/releases/latest";
const DOWNLOAD_PREFIX: &str = "https://github.com/pelicanux/dlssnr-x-amd-launcher/releases/download/";
#[derive(Default)]
pub struct AppUpdateState { downloaded: Mutex<Option<DownloadedUpdate>>, busy: AtomicBool }
#[derive(Clone)]
struct DownloadedUpdate { path: PathBuf, sha256: String }
#[derive(Clone, Deserialize, Serialize)]
pub struct Package { id: u64, name: String, size: u64, browser_download_url: String, digest: Option<String> }
#[derive(Deserialize)]
struct Release { tag_name: String, body: Option<String>, assets: Vec<Package> }
#[derive(Serialize)]
pub struct UpdateInfo { current: String, latest: Option<String>, available: bool, notes: String, packages: Vec<Package>, preferred: Option<u64>, appimage: bool, format: String }
fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder().user_agent("DLSSNR-X-AMD-Launcher")
        .connect_timeout(Duration::from_secs(10)).timeout(Duration::from_secs(600))
        .build().map_err(|_| "network".into())
}
async fn latest() -> Result<Option<Release>, String> {
    let response = client()?.get(API).header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28").timeout(Duration::from_secs(20))
        .send().await.map_err(|_| "network".to_string())?;
    if response.status() == reqwest::StatusCode::NOT_FOUND { return Ok(None); }
    if response.status() == reqwest::StatusCode::FORBIDDEN || response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS { return Err("rateLimit".into()); }
    response.error_for_status().map_err(|_| "network".to_string())?.json().await.map(Some).map_err(|_| "invalidRelease".into())
}
fn is_newer(tag: &str, current: &str) -> Result<bool, String> {
    let new = semver::Version::parse(tag.trim_start_matches('v')).map_err(|_| "invalidRelease".to_string())?;
    let old = semver::Version::parse(current).map_err(|_| "invalidRelease".to_string())?;
    Ok(new > old)
}
fn compatible(name: &str) -> bool {
    let name = name.to_ascii_lowercase();
    let format = name.ends_with(".appimage") || name.ends_with(".deb") || name.ends_with(".rpm");
    let arch = match std::env::consts::ARCH {
        "x86_64" => name.contains("amd64") || name.contains("x86_64"),
        "aarch64" => name.contains("arm64") || name.contains("aarch64"),
        _ => false,
    };
    format && arch && !name.contains('/') && !name.contains('\\') && !name.contains("..")
}
#[path = "update_policy.rs"]
mod update_policy;
fn preferred_format() -> &'static str {
    if std::env::var_os("APPIMAGE").is_some() { return ".appimage"; }
    match tauri::utils::platform::bundle_type() {
        Some(tauri::utils::config::BundleType::Deb) => return ".deb",
        Some(tauri::utils::config::BundleType::Rpm) => return ".rpm",
        _ => {}
    }
    update_policy::distro_format(&std::fs::read_to_string("/etc/os-release").unwrap_or_default())
        .unwrap_or_else(|| if std::path::Path::new("/usr/bin/rpm").exists() && !std::path::Path::new("/usr/bin/dpkg").exists() { ".rpm" } else { ".deb" })
}
#[tauri::command]
pub async fn check_launcher_update() -> Result<UpdateInfo, String> {
    let current = env!("CARGO_PKG_VERSION").to_string();
    let mut info = UpdateInfo { current: current.clone(), latest: None, available: false, notes: String::new(), packages: vec![], preferred: None, appimage: std::env::var_os("APPIMAGE").is_some(), format: preferred_format().into() };
    if let Some(release) = latest().await? {
        info.available = is_newer(&release.tag_name, &current)?;
        info.latest = Some(release.tag_name);
        info.notes = release.body.unwrap_or_default();
        info.packages = release.assets.into_iter().filter(|a| compatible(&a.name) && a.browser_download_url.starts_with(DOWNLOAD_PREFIX)).collect();
        info.preferred = info.packages.iter().find(|a| a.name.to_ascii_lowercase().ends_with(preferred_format())).or_else(|| info.packages.first()).map(|a| a.id);
    }
    Ok(info)
}
struct BusyGuard<'a>(&'a AtomicBool);
impl Drop for BusyGuard<'_> { fn drop(&mut self) { self.0.store(false, Ordering::Release); } }
#[tauri::command]
pub async fn download_launcher_update(app: tauri::AppHandle, state: tauri::State<'_, AppUpdateState>, asset_id: u64) -> Result<String, String> {
    if state.busy.swap(true, Ordering::AcqRel) { return Err("busy".into()); }
    let _guard = BusyGuard(&state.busy);
    *state.downloaded.lock().map_err(|_| "download".to_string())? = None;
    // Resolve the ID against our repository again; never accept a URL or path from the webview.
    let release = latest().await?.ok_or("noRelease")?;
    if !is_newer(&release.tag_name, env!("CARGO_PKG_VERSION"))? { return Err("upToDate".into()); }
    let asset = release.assets.into_iter().find(|a| a.id == asset_id && compatible(&a.name) && a.browser_download_url.starts_with(DOWNLOAD_PREFIX)).ok_or("noPackage")?;
    let expected = asset.digest.as_deref().and_then(|d| d.strip_prefix("sha256:")).filter(|d| d.len() == 64 && d.bytes().all(|b| b.is_ascii_hexdigit())).ok_or("checksumMissing")?.to_ascii_lowercase();
    let folder = app.path().app_cache_dir().map_err(|_| "download".to_string())?.join("updates");
    std::fs::create_dir_all(&folder).map_err(|_| "download".to_string())?;
    let target = folder.join(&asset.name);
    let partial = folder.join(format!("{}.part", uuid::Uuid::new_v4()));
    let result = async {
        let mut response = client()?.get(&asset.browser_download_url).send().await.map_err(|_| "network".to_string())?.error_for_status().map_err(|_| "network".to_string())?;
        let mut file = std::fs::File::create(&partial).map_err(|_| "download".to_string())?;
        let mut hash = Sha256::new();
        let mut received = 0u64;
        let mut last_percent = 101u64;
        while let Some(chunk) = response.chunk().await.map_err(|_| "network".to_string())? {
            received += chunk.len() as u64;
            if received > asset.size { return Err("checksum".into()); }
            file.write_all(&chunk).map_err(|_| "download".to_string())?;
            hash.update(&chunk);
            let percent = received.saturating_mul(100) / asset.size.max(1);
            if percent != last_percent { let _ = app.emit("launcher-download-progress", percent); last_percent = percent; }
        }
        file.sync_all().map_err(|_| "download".to_string())?;
        if received != asset.size || format!("{:x}", hash.finalize()) != expected { return Err("checksum".into()); }
        #[cfg(unix)]
        if asset.name.to_ascii_lowercase().ends_with(".appimage") {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&partial, std::fs::Permissions::from_mode(0o755)).map_err(|_| "download".to_string())?;
        }
        std::fs::rename(&partial, &target).map_err(|_| "download".to_string())?;
        Ok::<(), String>(())
    }.await;
    if result.is_err() { let _ = std::fs::remove_file(&partial); }
    result?;
    *state.downloaded.lock().map_err(|_| "download".to_string())? = Some(DownloadedUpdate { path: target.clone(), sha256: expected });
    Ok(target.to_string_lossy().to_string())
}
#[tauri::command]
pub async fn restart_launcher_update(app: tauri::AppHandle, state: tauri::State<'_, AppUpdateState>) -> Result<(), String> {
    if state.busy.swap(true, Ordering::AcqRel) { return Err("busy".into()); }
    let _guard = BusyGuard(&state.busy);
    let downloaded = state.downloaded.lock().map_err(|_| "apply".to_string())?.clone().ok_or("download")?;
    // Authentication and package installation must not block the webview thread.
    tauri::async_runtime::spawn_blocking(move || apply_downloaded_update(app, downloaded))
        .await.map_err(|_| "apply".to_string())?
}
fn apply_downloaded_update(app: tauri::AppHandle, update: DownloadedUpdate) -> Result<(), String> {
    let downloaded = update.path;
    let lower_path = downloaded.to_string_lossy().to_ascii_lowercase();
    if !lower_path.ends_with(preferred_format()) { return Err("manualInstall".into()); }
    // Detect cache changes between downloading and applying a package.
    let mut file = std::fs::File::open(&downloaded).map_err(|_| "download".to_string())?;
    let mut hash = Sha256::new();
    let mut buffer = [0u8; 65536];
    loop {
        let count = file.read(&mut buffer).map_err(|_| "download".to_string())?;
        if count == 0 { break; }
        hash.update(&buffer[..count]);
    }
    if format!("{:x}", hash.finalize()) != update.sha256 { return Err("checksum".into()); }
    #[cfg(unix)] {
        if lower_path.ends_with(".appimage") {
            let current = PathBuf::from(std::env::var_os("APPIMAGE").ok_or("manualInstall")?);
            use std::os::unix::fs::PermissionsExt;
            let staged = current.with_file_name(format!(".dlssnr-update-{}.AppImage", uuid::Uuid::new_v4()));
            let backup = current.with_extension("AppImage.previous");
            let result = (|| {
                std::fs::copy(&downloaded, &staged).map_err(|_| "apply".to_string())?;
                std::fs::set_permissions(&staged, std::fs::Permissions::from_mode(0o755)).map_err(|_| "apply".to_string())?;
                std::fs::copy(&current, &backup).map_err(|_| "apply".to_string())?;
                std::fs::rename(&staged, &current).map_err(|_| "apply".to_string())?;
                if std::process::Command::new(&current).env_remove("APPIMAGE").env_remove("APPDIR").env_remove("LD_LIBRARY_PATH").env_remove("LD_PRELOAD").spawn().is_err() {
                    let _ = std::fs::rename(&backup, &current);
                    return Err("apply".into());
                }
                Ok::<(), String>(())
            })();
            let _ = std::fs::remove_file(&staged);
            result?;
            app.exit(0);
            return Ok(());
        } else if lower_path.ends_with(".deb") || lower_path.ends_with(".rpm") {
            let executable = std::env::current_exe().map_err(|_| "apply".to_string())?;
            let (manager, arguments) = update_policy::installer_plan(preferred_format(), |path| std::path::Path::new(path).is_file())
                .ok_or("manualInstall")?;
            let status = std::process::Command::new("/usr/bin/pkexec")
                .arg(manager).args(arguments).arg(&downloaded)
                .stdin(std::process::Stdio::null())
                .status().map_err(|_| "pkexecFailed".to_string())?;
            update_policy::installation_result(status.code())?;
            // Only the package manager ran as root; the relaunched UI keeps the user's identity.
            std::process::Command::new(executable).spawn().map_err(|_| "restartFailed".to_string())?;
            app.exit(0);
            return Ok(());
        }
        return Err("manualInstall".into());
    }
    #[cfg(not(unix))] { let _ = (app, lower_path); Err("manualInstall".into()) }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn version_ordering() { assert!(is_newer("v0.10.0", "0.7.0").unwrap()); assert!(!is_newer("v0.7.0", "0.7.0").unwrap()); assert!(!is_newer("v0.6.0", "0.7.0").unwrap()); assert!(is_newer("bad", "0.7.0").is_err()); }
    #[test] fn package_filters() { if std::env::consts::ARCH == "x86_64" { assert!(compatible("Launcher_0.8.0_amd64.deb")); assert!(compatible("Launcher-0.8.0-1.x86_64.rpm")); assert!(compatible("Launcher_0.8.0_amd64.AppImage")); assert!(!compatible("Launcher_aarch64.AppImage")); } assert!(!compatible("../bad_amd64.deb")); assert!(!compatible("source_amd64.zip")); }
}
