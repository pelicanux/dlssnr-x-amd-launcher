// Keep package selection and installer arguments independent of privileged execution.
pub fn distro_format(content: &str) -> Option<&'static str> {
    let mut id = String::new();
    let mut like = String::new();
    for line in content.lines() {
        let Some((key, value)) = line.split_once('=') else { continue; };
        let value = value.trim().trim_matches(|c| c == '"' || c == '\'').to_ascii_lowercase();
        match key.trim() { "ID" => id = value, "ID_LIKE" => like = value, _ => {} }
    }
    for family in std::iter::once(id.as_str()).chain(like.split_whitespace()) {
        match family {
            "debian" | "ubuntu" => return Some(".deb"),
            "nobara" | "fedora" | "rhel" | "centos" | "opensuse" | "opensuse-tumbleweed" | "opensuse-leap" | "suse" | "sles" => return Some(".rpm"),
            _ => {}
        }
    }
    None
}
pub fn package_matches_format(name: &str, format: &str) -> bool {
    matches!(format, ".rpm" | ".deb" | ".appimage") && name.to_ascii_lowercase().ends_with(format)
}
pub fn installer_plan(format: &str, exists: impl Fn(&str) -> bool) -> Option<(&'static str, &'static [&'static str])> {
    let plans: &[(&str, &[&str])] = match format {
        ".deb" => &[("/usr/bin/apt-get", &["install", "-y", "--"]), ("/usr/bin/dpkg", &["-i", "--"])],
        ".rpm" => &[("/usr/bin/dnf", &["install", "-y", "--"]), ("/usr/bin/zypper", &["--non-interactive", "install", "--allow-unsigned-rpm", "--"]), ("/usr/bin/rpm", &["-Uvh", "--"])],
        _ => return None,
    };
    plans.iter().copied().find(|(program, _)| exists(program))
}
pub fn installation_result(code: Option<i32>) -> Result<(), String> {
    match code { Some(0) => Ok(()), Some(126) => Err("authCancelled".into()), Some(127) => Err("pkexecFailed".into()), _ => Err("packageInstallFailed".into()) }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn quoted_and_ordered_distro_ids() {
        assert_eq!(distro_format("ID=\"ubuntu\"\nID_LIKE=debian"), Some(".deb"));
        assert_eq!(distro_format("ID=linuxmint\nID_LIKE=\"ubuntu debian\""), Some(".deb"));
        assert_eq!(distro_format("ID=rocky\nID_LIKE=\"rhel centos fedora\""), Some(".rpm"));
        assert_eq!(distro_format("ID=opensuse-tumbleweed\nID_LIKE=\"suse opensuse\""), Some(".rpm"));
        assert_eq!(distro_format("ID=arch\nNAME=Ubuntu-compatible"), None);
        assert_eq!(distro_format("ID=fedora\nID_LIKE=debian"), Some(".rpm"));
    }
    #[test] fn only_the_detected_package_format_is_allowed() {
        assert_eq!(distro_format("ID=nobara"), Some(".rpm"));
        assert_eq!(distro_format("ID=nobara\nID_LIKE=fedora"), Some(".rpm"));
        assert!(package_matches_format("Launcher_x86_64.rpm", ".rpm"));
        assert!(!package_matches_format("Launcher_amd64.deb", ".rpm"));
        assert!(!package_matches_format("Launcher_amd64.AppImage", ".rpm"));
        assert!(package_matches_format("Launcher_amd64.AppImage", ".appimage"));
        assert!(!package_matches_format("Launcher_amd64.deb", ""));
    }
    #[test] fn installer_selection_and_fallback() {
        assert_eq!(installer_plan(".deb", |p| p == "/usr/bin/apt-get").unwrap().0, "/usr/bin/apt-get");
        assert_eq!(installer_plan(".rpm", |p| p == "/usr/bin/zypper").unwrap().0, "/usr/bin/zypper");
        assert_eq!(installer_plan(".rpm", |p| p == "/usr/bin/rpm").unwrap().0, "/usr/bin/rpm");
        assert!(installer_plan(".deb", |_| false).is_none());
        assert!(installer_plan(".appimage", |_| true).is_none());
    }
    #[test] fn cancelled_auth_is_distinct_from_install_failure() {
        assert!(installation_result(Some(0)).is_ok());
        assert_eq!(installation_result(Some(126)).unwrap_err(), "authCancelled");
        assert_eq!(installation_result(Some(127)).unwrap_err(), "pkexecFailed");
        assert_eq!(installation_result(Some(1)).unwrap_err(), "packageInstallFailed");
        assert!(installation_result(None).is_err());
    }
}
