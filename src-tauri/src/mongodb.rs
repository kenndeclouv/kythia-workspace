use crate::downloader;
use crate::settings;
use serde::{Deserialize, Serialize};
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use tauri::AppHandle;

fn get_port() -> u16 {
    settings::get_settings()
        .map(|s| s.mongodb.port)
        .unwrap_or(27017)
}

fn bin_dir() -> PathBuf {
    PathBuf::from("C:\\kythia\\bin\\mongodb")
}

fn data_dir() -> PathBuf {
    PathBuf::from("C:\\kythia\\data\\mongodb")
}

fn logs_dir() -> PathBuf {
    PathBuf::from("C:\\kythia\\logs\\mongodb")
}

fn downloads_dir() -> PathBuf {
    PathBuf::from("C:\\kythia\\downloads")
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MongodbRelease {
    pub version: String,
    pub url: String,
}

pub fn is_running() -> bool {
    downloader::is_port_in_use(get_port())
}

pub fn is_initialized() -> bool {
    data_dir().join("WiredTiger").exists() || data_dir().join("mongod.lock").exists()
}

pub async fn fetch_versions() -> Result<Vec<MongodbRelease>, String> {
    let mut releases = Vec::new();

    let versions = vec!["7.0.12", "6.0.16", "5.0.28"];

    for ver in versions {
        releases.push(MongodbRelease {
            version: ver.to_string(),
            url: format!(
                "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-{}.zip",
                ver
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
                .filter(|e| e.path().join("bin").join("mongod.exe").exists())
                .filter_map(|e| e.file_name().into_string().ok())
                .collect()
        })
        .unwrap_or_default();
    v.sort_by(|a, b| cmp_versions(b, a));
    v
}

pub async fn install(app: &AppHandle, version: &str, url: &str) -> Result<String, String> {
    let zip_path = downloads_dir().join(format!("mongodb-{}.zip", version));
    let dest = bin_dir().join(version);

    std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(downloads_dir()).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(logs_dir()).map_err(|e| e.to_string())?;

    downloader::download_file(app, "mongodb", url, &zip_path).await?;
    downloader::extract_zip(&zip_path, &dest, true)?;

    let _ = std::fs::remove_file(&zip_path);
    Ok(format!(
        "MongoDB {} installed to C:\\kythia\\bin\\mongodb\\{}",
        version, version
    ))
}

pub fn initialize(version: &str) -> Result<String, String> {
    let mongod = bin_dir().join(version).join("bin").join("mongod.exe");
    if !mongod.exists() {
        return Err(format!("MongoDB not found for {}.", version));
    }

    let data = data_dir();
    std::fs::create_dir_all(&data).map_err(|e| e.to_string())?;

    Ok("MongoDB data directory initialized successfully.".to_string())
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

    let mongod = bin_dir().join(version).join("bin").join("mongod.exe");
    if !mongod.exists() {
        return Err(format!("MongoDB {} is not installed.", version));
    }

    let data = data_dir();
    std::fs::create_dir_all(&data).map_err(|e| e.to_string())?;

    let log_file = logs_dir().join("mongod.log");

    let child = std::process::Command::new(&mongod)
        .args([
            "--dbpath",
            &data.to_string_lossy(),
            "--port",
            &get_port().to_string(),
            "--bind_ip",
            "127.0.0.1",
            "--logpath",
            &log_file.to_string_lossy(),
        ])
        .creation_flags(0x08000000)
        .spawn()
        .map_err(|e| format!("Failed to start MongoDB: {}", e))?;

    let pid = child.id();
    drop(child);

    for _ in 0..25 {
        std::thread::sleep(std::time::Duration::from_millis(200));
        if is_running() {
            return Ok(pid);
        }
    }

    Err("MongoDB did not start within 5 seconds. Check logs.".to_string())
}

pub fn stop(pid: Option<u32>) -> Result<(), String> {
    if let Some(p) = pid {
        let _ = std::process::Command::new("taskkill")
            .args(["/PID", &p.to_string(), "/F", "/T"])
            .creation_flags(0x08000000).stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null())
            .status();
    }
    let _ = std::process::Command::new("taskkill")
        .args(["/IM", "mongod.exe", "/F", "/T"])
        .creation_flags(0x08000000).stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null())
        .status();
    Ok(())
}

pub fn get_logs(lines: usize) -> Vec<String> {
    let log_path = logs_dir().join("mongod.log");
    let out = downloader::tail_file(&log_path, lines);
    if out.is_empty() {
        return vec!["[No MongoDB logs yet. Start the database first.]".to_string()];
    }
    out
}

pub fn clear_logs() {
    let log_path = logs_dir().join("mongod.log");
    crate::downloader::clear_file(&log_path);
}

fn cmp_versions(a: &str, b: &str) -> std::cmp::Ordering {
    let parse =
        |s: &str| -> Vec<u32> { s.split(['.', '-']).filter_map(|n| n.parse().ok()).collect() };
    parse(a).cmp(&parse(b))
}
