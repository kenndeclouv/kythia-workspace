use crate::downloader;
use crate::settings;
use serde::{Deserialize, Serialize};
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use tauri::AppHandle;

fn get_port() -> u16 {
    // We use the mariadb port since they share the database port conceptually,
    // but the UI will ensure only one runs at a time.
    settings::get_settings()
        .map(|s| s.mariadb.port)
        .unwrap_or(3306)
}

fn bin_dir() -> PathBuf {
    PathBuf::from("C:\\kythia\\bin\\mysql")
}

fn data_dir() -> PathBuf {
    PathBuf::from("C:\\kythia\\data\\mysql")
}

fn logs_dir() -> PathBuf {
    PathBuf::from("C:\\kythia\\logs\\mysql")
}

fn downloads_dir() -> PathBuf {
    PathBuf::from("C:\\kythia\\downloads")
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MysqlRelease {
    pub version: String,
    pub url: String,
}

pub fn is_running() -> bool {
    downloader::is_port_in_use(get_port())
}

pub fn is_initialized() -> bool {
    data_dir().join("mysql").exists()
}

/// Returns a hardcoded list of recent stable MySQL Community Server versions.
/// Fetching dynamically from dev.mysql.com is complex due to bot protection.
pub async fn fetch_versions() -> Result<Vec<MysqlRelease>, String> {
    let mut releases = Vec::new();

    // Known stable MySQL 8.0 and 8.4 archive URLs
    let versions = vec!["8.4.0", "8.0.37", "8.0.36"];

    for ver in versions {
        let parts: Vec<&str> = ver.split('.').collect();
        let major_minor = if parts.len() >= 2 {
            format!("{}.{}", parts[0], parts[1])
        } else {
            "8.0".to_string()
        };

        releases.push(MysqlRelease {
            version: ver.to_string(),
            url: format!(
                "https://cdn.mysql.com/archives/mysql-{}/mysql-{}-winx64.zip",
                major_minor, ver
            ),
        });
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
                .filter(|e| e.path().join("bin").join("mysqld.exe").exists())
                .filter_map(|e| e.file_name().into_string().ok())
                .collect()
        })
        .unwrap_or_default();
    v.sort_by(|a, b| cmp_versions(b, a));
    v
}

pub async fn install(app: &AppHandle, version: &str, url: &str) -> Result<String, String> {
    let zip_path = downloads_dir().join(format!("mysql-{}.zip", version));
    let dest = bin_dir().join(version);

    std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(downloads_dir()).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(logs_dir()).map_err(|e| e.to_string())?;

    downloader::download_file(app, "mysql", url, &zip_path).await?;
    // MySQL zip HAS a top-level dir like "mysql-8.0.36-winx64/"
    downloader::extract_zip(&zip_path, &dest, true)?;

    let _ = std::fs::remove_file(&zip_path);
    Ok(format!(
        "MySQL {} installed to C:\\kythia\\bin\\mysql\\{}",
        version, version
    ))
}

pub fn initialize(version: &str) -> Result<String, String> {
    let mysqld = bin_dir().join(version).join("bin").join("mysqld.exe");
    if !mysqld.exists() {
        return Err(format!("MySQL not found for {}.", version));
    }

    let data = data_dir();
    std::fs::create_dir_all(&data).map_err(|e| e.to_string())?;

    // Check if already initialized
    if is_initialized() {
        return Ok("Database already initialized.".to_string());
    }

    let output = std::process::Command::new(&mysqld)
        .args([
            "--initialize-insecure",
            &format!("--datadir={}", data.display()),
            "--console",
        ])
        .creation_flags(0x08000000)
        .output()
        .map_err(|e| format!("Failed to run mysqld --initialize-insecure: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!("Initialization failed:\n{}\n{}", stderr, stdout));
    }

    Ok("MySQL data directory initialized successfully. Root user has no password.".to_string())
}

pub fn start(version: &str) -> Result<u32, String> {
    if is_running() {
        let port = get_port();
        if let Some((proc_name, pid)) = crate::downloader::get_conflicting_process(port) {
            return Err(format!(
                "Port {} is blocked by '{}' (PID: {}). Please stop it first.",
                port, proc_name, pid
            ));
        } else {
            return Err(format!("Port {} is already in use.", port));
        }
    }

    let mysqld = bin_dir().join(version).join("bin").join("mysqld.exe");
    if !mysqld.exists() {
        return Err(format!("MySQL {} is not installed.", version));
    }

    if !is_initialized() {
        return Err("Database not initialized. Click 'Initialize' first.".to_string());
    }

    let data = data_dir();
    let basedir = bin_dir().join(version);

    let child = std::process::Command::new(&mysqld)
        .args([
            "--console",
            &format!("--datadir={}", data.display()),
            &format!("--basedir={}", basedir.display()),
            &format!("--port={}", get_port()),
            "--bind-address=127.0.0.1",
        ])
        .creation_flags(0x08000000)
        .spawn()
        .map_err(|e| format!("Failed to start MySQL: {}", e))?;

    let pid = child.id();
    drop(child);

    // Wait up to 5 seconds
    for _ in 0..25 {
        std::thread::sleep(std::time::Duration::from_millis(200));
        if is_running() {
            return Ok(pid);
        }
    }

    Err("MySQL did not start within 5 seconds. Check logs.".to_string())
}

pub fn stop(pid: Option<u32>) -> Result<(), String> {
    if let Some(p) = pid {
        let _ = std::process::Command::new("taskkill")
            .args(["/PID", &p.to_string(), "/F", "/T"])
            .creation_flags(0x08000000).stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null())
            .status();
    }
    let _ = std::process::Command::new("taskkill")
        .args(["/IM", "mysqld.exe", "/F", "/T"])
        .creation_flags(0x08000000).stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null())
        .status();
    Ok(())
}

pub fn get_logs(lines: usize) -> Vec<String> {
    let log_path = data_dir().join("mysql.err");
    let mut out = downloader::tail_file(&log_path, lines);
    if out.is_empty() {
        let alt_log_path = data_dir().join(format!(
            "{}.err",
            std::env::var("COMPUTERNAME").unwrap_or_else(|_| "mysql".to_string())
        ));
        out = downloader::tail_file(&alt_log_path, lines);
    }
    if out.is_empty() {
        out = vec!["[No MySQL logs yet. Initialize and start the database first.]".to_string()];
    }
    out
}

pub fn clear_logs() {
    let log_path = data_dir().join("mysql.err");
    crate::downloader::clear_file(&log_path);

    let alt_log_path = data_dir().join(format!(
        "{}.err",
        std::env::var("COMPUTERNAME").unwrap_or_else(|_| "mysql".to_string())
    ));
    crate::downloader::clear_file(&alt_log_path);
}

fn cmp_versions(a: &str, b: &str) -> std::cmp::Ordering {
    let parse =
        |s: &str| -> Vec<u32> { s.split(['.', '-']).filter_map(|n| n.parse().ok()).collect() };
    parse(a).cmp(&parse(b))
}
