use crate::downloader;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;
use std::os::windows::process::CommandExt;
use crate::settings;

fn get_port() -> u16 {
    settings::get_settings().map(|s| s.php.port).unwrap_or(8080)
}

fn get_doc_root() -> PathBuf {
    PathBuf::from(
        settings::get_settings()
            .map(|s| s.document_root)
            .unwrap_or_else(|_| "C:\\kythia\\www".to_string()),
    )
}

fn bin_dir() -> PathBuf {
    PathBuf::from("C:\\kythia\\bin\\php")
}

fn downloads_dir() -> PathBuf {
    PathBuf::from("C:\\kythia\\downloads")
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PhpRelease {
    pub version: String,
    pub url: String,
}

pub fn is_running() -> bool {
    downloader::is_port_in_use(get_port())
}

/// Scrape windows.php.net/download/ to find NTS x64 ZIP download links.
pub async fn fetch_versions() -> Result<Vec<PhpRelease>, String> {
    if let Some(cached) = crate::cache::get_cached("php_versions") {
        if let Ok(releases) = serde_json::from_str(&cached) {
            return Ok(releases);
        }
    }

    let client = reqwest::Client::builder()
        .user_agent("KythiaWorkspace/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let html = client
        .get("https://downloads.php.net/~windows/releases/archives/")
        .send()
        .await
        .map_err(|e| format!("Failed to reach php archives: {}", e))?
        .text()
        .await
        .map_err(|e| e.to_string())?;

    // Pattern: href="php-8.1.20-nts-Win32-vs16-x64.zip"
    let re = Regex::new(
        r#"href="(php-(\d+\.\d+\.\d+)-nts-Win32-[a-zA-Z0-9]+-x64\.zip)""#,
    )
    .unwrap();

    let mut seen = std::collections::HashSet::new();
    let mut releases: Vec<PhpRelease> = re
        .captures_iter(&html)
        .filter_map(|cap| {
            let filename = cap[1].to_string();
            let version = cap[2].to_string();
            if seen.insert(version.clone()) {
                Some(PhpRelease {
                    version,
                    url: format!("https://downloads.php.net/~windows/releases/archives/{}", filename),
                })
            } else {
                None
            }
        })
        .collect();

    releases.sort_by(|a, b| cmp_versions(&b.version, &a.version));

    if let Ok(json) = serde_json::to_string(&releases) {
        crate::cache::set_cached("php_versions", &json);
    }

    Ok(releases)
}

pub fn get_installed() -> Vec<String> {
    let base = bin_dir();
    if !base.exists() {
        return vec![];
    }
    let mut v: Vec<String> = std::fs::read_dir(&base)
        .map(|d| {
            d.filter_map(|e| e.ok())
                .filter(|e| e.path().join("php.exe").exists())
                .filter_map(|e| e.file_name().into_string().ok())
                .collect()
        })
        .unwrap_or_default();
    v.sort_by(|a, b| cmp_versions(b, a));
    v
}

/// Download, extract, and configure a PHP version.
pub async fn install(app: &AppHandle, version: &str, url: &str) -> Result<String, String> {
    let zip_path = downloads_dir().join(format!("php-{}.zip", version));
    let dest = bin_dir().join(version);

    std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(downloads_dir()).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(get_doc_root()).map_err(|e| e.to_string())?;

    downloader::download_file(app, "php", url, &zip_path).await?;

    // PHP ZIPs do NOT have a top-level directory — extract directly into dest
    downloader::extract_zip(&zip_path, &dest, false)?;

    setup_php_ini(&dest)?;
    create_welcome_page()?;

    let _ = std::fs::remove_file(&zip_path);
    Ok(format!("PHP {} installed to C:\\kythia\\bin\\php\\{}", version, version))
}

fn setup_php_ini(dest: &PathBuf) -> Result<(), String> {
    let ini_development = dest.join("php.ini-development");
    let ini_target = dest.join("php.ini");

    if ini_development.exists() && !ini_target.exists() {
        std::fs::copy(&ini_development, &ini_target).map_err(|e| e.to_string())?;
    }

    if ini_target.exists() {
        let mut content = std::fs::read_to_string(&ini_target).map_err(|e| e.to_string())?;

        // Uncomment extension_dir for windows so extensions can be found
        content = content.replace(";extension_dir = \"ext\"", "extension_dir = \"ext\"");

        // Uncomment common extensions
        for ext in &[
            "curl", "fileinfo", "gd", "mbstring", "mysqli", "openssl", "pdo_mysql", "zip",
        ] {
            let commented = format!(";extension={}", ext);
            let active = format!("extension={}", ext);
            content = content.replace(&commented, &active);
        }

        std::fs::write(&ini_target, content).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn create_welcome_page() -> Result<(), String> {
    let index = get_doc_root().join("index.php");
    if !index.exists() {
        let html = r#"<?php
$version = phpversion();
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Kythia Workspace</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f111a; color: #e2e8f0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #1e2235; border: 1px solid #334155; border-radius: 16px; padding: 48px; text-align: center; max-width: 480px; }
    h1 { font-size: 2rem; margin: 0 0 12px; background: linear-gradient(to right, #60a5fa, #22d3ee); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    p { color: #94a3b8; }
    .badge { display: inline-block; background: #1e3a5f; color: #60a5fa; border: 1px solid #2563eb55; border-radius: 8px; padding: 4px 12px; font-size: 0.875rem; font-family: monospace; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🚀 Kythia Workspace</h1>
    <p>Your local PHP development server is running!</p>
    <div class="badge">PHP <?= $version ?></div>
  </div>
</body>
</html>
"#;
        std::fs::write(&index, html).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Start PHP's built-in web server, return the PID.
pub fn start(version: &str) -> Result<u32, String> {
    if is_running() {
        let port = get_port();
        if let Some((proc_name, pid)) = crate::downloader::get_conflicting_process(port) {
            return Err(format!("Port {} is blocked by '{}' (PID: {}). Please stop it first.", port, proc_name, pid));
        } else {
            return Err(format!("Port {} is already in use.", port));
        }
    }

    let exe = bin_dir().join(version).join("php-cgi.exe");
    if !exe.exists() {
        return Err(format!("PHP {} (php-cgi.exe) is not installed.", version));
    }

    let www = get_doc_root();
    std::fs::create_dir_all(&www).map_err(|e| e.to_string())?;

    let child = std::process::Command::new(&exe)
        .args([
            "-b",
            &format!("127.0.0.1:{}", get_port()),
        ])
        .creation_flags(0x08000000)
        .spawn()
        .map_err(|e| format!("Failed to start PHP: {}", e))?;

    let pid = child.id();
    // Detach: on Windows, dropping Child does NOT kill the child process.
    drop(child);

    // Give it a moment to bind
    std::thread::sleep(std::time::Duration::from_millis(600));
    if !is_running() {
        return Err("PHP server did not start. Check if php.exe is valid.".to_string());
    }

    Ok(pid)
}

/// Kill PHP built-in server by PID.
pub fn stop(pid: Option<u32>) -> Result<(), String> {
    if let Some(p) = pid {
        let _ = std::process::Command::new("taskkill")
            .args(["/PID", &p.to_string(), "/F", "/T"])
            .creation_flags(0x08000000)
            .status();
    }
    let _ = std::process::Command::new("taskkill")
        .args(["/IM", "php-cgi.exe", "/F", "/T"])
        .creation_flags(0x08000000)
        .status();
    Ok(())
}

pub fn cmp_versions(a: &str, b: &str) -> std::cmp::Ordering {
    let parse = |s: &str| -> Vec<u32> {
        s.split(['.', '-']).filter_map(|n| n.parse().ok()).collect()
    };
    parse(a).cmp(&parse(b))
}

pub fn get_logs(_lines: usize) -> Vec<String> {
    vec!["[PHP FastCGI does not output a persistent error log by default unless explicitly configured in php.ini]".to_string()]
}

pub fn clear_logs() {
    // No default log file to clear
}

#[tauri::command]
pub fn get_php_ini_content(version: &str) -> Result<String, String> {
    let dest = bin_dir().join(version);
    let ini_target = dest.join("php.ini");
    let ini_development = dest.join("php.ini-development");

    if !ini_target.exists() && ini_development.exists() {
        std::fs::copy(&ini_development, &ini_target).map_err(|e| e.to_string())?;
    }

    if ini_target.exists() {
        std::fs::read_to_string(&ini_target).map_err(|e| e.to_string())
    } else {
        Err(format!("php.ini not found for version {}", version))
    }
}

#[tauri::command]
pub fn save_php_ini_content(version: &str, content: &str) -> Result<(), String> {
    let ini_target = bin_dir().join(version).join("php.ini");
    std::fs::write(&ini_target, content).map_err(|e| e.to_string())
}
