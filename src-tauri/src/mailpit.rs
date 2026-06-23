use crate::downloader;
use crate::settings;
use serde::Deserialize;
use std::path::PathBuf;
use tauri::AppHandle;
use std::os::windows::process::CommandExt;

fn bin_dir() -> PathBuf {
    PathBuf::from("C:\\kythia\\bin\\mailpit")
}

fn downloads_dir() -> PathBuf {
    PathBuf::from("C:\\kythia\\downloads")
}

#[derive(Deserialize)]
struct GitHubRelease {
    tag_name: String,
    assets: Vec<GitHubAsset>,
}

#[derive(Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
}

pub fn is_running() -> bool {
    let s = settings::get_settings().unwrap_or_default();
    downloader::is_port_in_use(s.mailpit.smtp_port) || downloader::is_port_in_use(s.mailpit.ui_port)
}

pub async fn fetch_versions() -> Result<Vec<String>, String> {
    if let Some(cached) = crate::cache::get_cached("mailpit_versions") {
        if let Ok(releases) = serde_json::from_str(&cached) {
            return Ok(releases);
        }
    }

    let client = reqwest::Client::builder()
        .user_agent("KythiaWorkspace/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let url = "https://api.github.com/repos/axllent/mailpit/releases";
    let res = client.get(url).send().await.map_err(|e| e.to_string())?;

    let releases: Vec<GitHubRelease> = res.json().await.map_err(|e| e.to_string())?;

    let mut versions = Vec::new();
    for r in releases {
        let tag = r.tag_name.trim_start_matches('v').to_string();
        versions.push(tag);
    }

    versions.sort_by(|a, b| crate::php::cmp_versions(b, a));

    if let Ok(json_str) = serde_json::to_string(&versions) {
        crate::cache::set_cached("mailpit_versions", &json_str);
    }

    Ok(versions)
}

pub fn get_installed() -> Vec<String> {
    let base = bin_dir();
    if !base.exists() {
        return vec![];
    }
    let mut v: Vec<String> = std::fs::read_dir(&base)
        .map(|d| {
            d.filter_map(|e| e.ok())
                .filter(|e| e.path().join("mailpit.exe").exists())
                .filter_map(|e| e.file_name().into_string().ok())
                .collect()
        })
        .unwrap_or_default();
    v.sort_by(|a, b| crate::php::cmp_versions(b, a));
    v
}

pub async fn install(app: &AppHandle, version: &str) -> Result<String, String> {
    // Windows amd64 build is typically named mailpit-windows-amd64.zip
    // Let's resolve the exact download URL from the GitHub release tag
    let client = reqwest::Client::builder()
        .user_agent("KythiaWorkspace/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("https://api.github.com/repos/axllent/mailpit/releases/tags/v{}", version);
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    
    let release: GitHubRelease = res.json().await.map_err(|e| e.to_string())?;
    
    let asset = release.assets.iter().find(|a| a.name == "mailpit-windows-amd64.zip")
        .ok_or_else(|| "Could not find mailpit-windows-amd64.zip for this release".to_string())?;

    let download_url = &asset.browser_download_url;
    let zip_path = downloads_dir().join(format!("mailpit-{}.zip", version));
    let dest = bin_dir().join(version);

    std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(downloads_dir()).map_err(|e| e.to_string())?;

    downloader::download_file(app, "mailpit", download_url, &zip_path).await?;
    downloader::extract_zip(&zip_path, &dest, false)?;

    let _ = std::fs::remove_file(&zip_path);
    Ok(format!("Mailpit {} installed to C:\\kythia\\bin\\mailpit\\{}", version, version))
}

pub fn start(version: &str) -> Result<(), String> {
    let s = settings::get_settings().unwrap_or_default();
    
    if is_running() {
        return Err("Mailpit ports are already in use. Stop the conflicting process first.".to_string());
    }

    let dir = bin_dir().join(version);
    let exe = dir.join("mailpit.exe");
    if !exe.exists() {
        return Err(format!("Mailpit {} is not installed.", version));
    }

    let smtp_arg = format!("0.0.0.0:{}", s.mailpit.smtp_port);
    let ui_arg = format!("0.0.0.0:{}", s.mailpit.ui_port);

    std::process::Command::new(&exe)
        .args(["--smtp", &smtp_arg, "--listen", &ui_arg, "--api-cors", "*"])
        .current_dir(&dir)
        .creation_flags(0x08000000)
        .spawn()
        .map_err(|e| format!("Failed to launch mailpit.exe: {}", e))?;

    // Poll to ensure it started
    for _ in 0..30 {
        std::thread::sleep(std::time::Duration::from_millis(200));
        if is_running() {
            return Ok(());
        }
    }

    Err("Mailpit did not bind its ports successfully.".to_string())
}

pub fn stop(_version: &str) -> Result<(), String> {
    // Mailpit doesn't have a built-in graceful stop command, so we kill it.
    let _ = std::process::Command::new("taskkill")
        .args(["/IM", "mailpit.exe", "/F"])
        .creation_flags(0x08000000)
        .status();
    Ok(())
}
