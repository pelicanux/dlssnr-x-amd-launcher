use serde::Serialize;
use std::{fs, path::Path, process::Command};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuInfo {
    pub model: String,
    pub pci_address: String,
    pub backend: Option<String>,
    pub primary: bool,
}

// Only the Radeon RX series supported by the launcher's two backends qualify.
fn recommended_backend(vendor: u32, model: &str) -> Option<String> {
    if vendor != 0x1002 { return None; }
    let upper = model.to_uppercase();
    let words: Vec<_> = upper.split(|c: char| !c.is_ascii_alphanumeric()).filter(|word| !word.is_empty()).collect();
    let rx = words.iter().position(|word| *word == "RX")?;
    let number = words.get(rx + 1)?;
    let digits: String = number.chars().take_while(|c| c.is_ascii_digit()).collect();
    if digits.len() != 4 { return None; }
    match digits.as_bytes()[0] {
        b'9' => Some("rdna4".into()),
        b'7' => Some("rdna3".into()),
        _ => None,
    }
}

fn amd_model(ids: &str, device: u32, revision: u32) -> Option<String> {
    ids.lines().find_map(|line| {
        let mut fields = line.splitn(3, ',');
        let id = u32::from_str_radix(fields.next()?.trim(), 16).ok()?;
        let rev = u32::from_str_radix(fields.next()?.trim(), 16).ok()?;
        let name = fields.next()?.trim();
        (id == device && rev == revision).then(|| name.to_owned())
    })
}

// Revision-specific fallback for systems with older libdrm marketing-name data.
fn known_rx_model(device: u32, revision: u32) -> Option<String> {
    let model = match (device, revision) {
        (0x7550, 0xc0) => "AMD Radeon RX 9070 XT",
        (0x7550, 0xc2) => "AMD Radeon RX 9070 GRE",
        (0x7550, 0xc3) => "AMD Radeon RX 9070",
        (0x7590, 0xc0) => "AMD Radeon RX 9060 XT",
        (0x7590, 0xc1) => "AMD Radeon RX 9060 XT LP",
        (0x7590, 0xc7) => "AMD Radeon RX 9060",
        (0x744c, 0xc8) => "AMD Radeon RX 7900 XTX",
        (0x744c, 0xcc) => "AMD Radeon RX 7900 XT",
        (0x744c, 0xce) => "AMD Radeon RX 7900 GRE",
        (0x744c, 0xcf) => "AMD Radeon RX 7900M",
        (0x747e, 0xc8) => "AMD Radeon RX 7800 XT",
        (0x747e, 0xd8) => "AMD Radeon RX 7800M",
        (0x747e, 0xdb) => "AMD Radeon RX 7700",
        (0x747e, 0xff) => "AMD Radeon RX 7700 XT",
        (0x7480, 0xc0) => "AMD Radeon RX 7600 XT",
        (0x7480, 0xc1) => "AMD Radeon RX 7700S",
        (0x7480, 0xc2) => "AMD Radeon RX 7650 GRE",
        (0x7480, 0xc3) => "AMD Radeon RX 7600S",
        (0x7480, 0xc7) => "AMD Radeon RX 7600M XT",
        (0x7480, 0xcf) => "AMD Radeon RX 7600",
        _ => return None,
    };
    Some(model.into())
}

fn hex_file(path: &Path, name: &str) -> Option<u32> {
    let value = fs::read_to_string(path.join(name)).ok()?;
    u32::from_str_radix(value.trim().trim_start_matches("0x"), 16).ok()
}

fn detect() -> Result<Vec<GpuInfo>, String> {
    let devices = fs::read_dir("/sys/bus/pci/devices").map_err(|e| e.to_string())?;
    let ids = ["/usr/share/libdrm/amdgpu.ids", "/usr/share/hwdata/amdgpu.ids"]
        .iter().find_map(|path| fs::read_to_string(path).ok()).unwrap_or_default();
    // One optional call, outside the UI thread. Sysfs discovery does not require lspci.
    let pci_names = Command::new("lspci").args(["-D", "-mm"]).output().ok()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).into_owned()).unwrap_or_default();
    let mut gpus = Vec::new();
    for entry in devices.flatten() {
        let path = entry.path();
        if hex_file(&path, "class").map(|class| class >> 16) != Some(3) { continue; }
        let vendor = hex_file(&path, "vendor").unwrap_or(0);
        let device = hex_file(&path, "device").unwrap_or(0);
        let revision = hex_file(&path, "revision").unwrap_or(0);
        let address = entry.file_name().to_string_lossy().into_owned();
        let pci_model = pci_names.lines().find(|line| line.starts_with(&format!("{address} ")))
            .and_then(|line| line.split('"').nth(5)).map(str::to_owned);
        let model = (vendor == 0x1002).then(|| amd_model(&ids, device, revision).or_else(|| known_rx_model(device, revision))).flatten()
            .or(pci_model).unwrap_or_else(|| format!("PCI {vendor:04x}:{device:04x}"));
        let backend = recommended_backend(vendor, &model);
        let primary = fs::read_to_string(path.join("boot_vga")).unwrap_or_default().trim() == "1";
        gpus.push(GpuInfo { model, pci_address: address, backend, primary });
    }
    gpus.sort_by_key(|gpu| (gpu.backend.is_none(), !gpu.primary, gpu.pci_address.clone()));
    Ok(gpus)
}

#[tauri::command]
pub async fn detect_linux_gpus() -> Result<Vec<GpuInfo>, String> {
    tauri::async_runtime::spawn_blocking(detect).await.map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn supported_rx_series_only() {
        for model in ["AMD Radeon RX 9070 XT", "AMD Radeon RX 9060 XT"] {
            assert_eq!(recommended_backend(0x1002, model).as_deref(), Some("rdna4"));
        }
        for model in ["AMD Radeon RX 7900 XTX", "AMD Radeon RX 7600M XT", "Navi 31 [Radeon RX 7900 XT/XTX]"] {
            assert_eq!(recommended_backend(0x1002, model).as_deref(), Some("rdna3"));
        }
        for model in ["AMD Radeon RX 6800 XT", "AMD Radeon 780M", "AMD Radeon Pro W7900", "PCI 1002:7550", "RX 790"] {
            assert_eq!(recommended_backend(0x1002, model), None);
        }
        assert_eq!(recommended_backend(0x10de, "RX 9070"), None);
    }
    #[test]
    fn revision_distinguishes_professional_cards() {
        assert_eq!(known_rx_model(0x7480, 0), None);
        assert_eq!(known_rx_model(0x7550, 0xc3).as_deref(), Some("AMD Radeon RX 9070"));
        let ids = "7480, 00, AMD Radeon Pro W7600\n7480, CF, AMD Radeon RX 7600";
        assert_eq!(amd_model(ids, 0x7480, 0), Some("AMD Radeon Pro W7600".into()));
        assert_eq!(amd_model(ids, 0x7480, 0xcf), Some("AMD Radeon RX 7600".into()));
        assert_eq!(amd_model(ids, 0x7480, 0xff), None);
    }
}
