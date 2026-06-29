use crate::downloader;
use crate::settings;
use serde::{Deserialize, Serialize};
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use tauri::AppHandle;

fn get_port() -> u16 {
    settings::get_settings()
        .map(|s| s.postgres.port)
        .unwrap_or(5432)
}

fn bin_dir() -> PathBuf {
    PathBuf::from("C:\\kythia\\bin\\postgres")
}

fn data_dir() -> PathBuf {
    PathBuf::from("C:\\kythia\\data\\postgres")
}

fn logs_dir() -> PathBuf {
    PathBuf::from("C:\\kythia\\logs\\postgres")
}

fn downloads_dir() -> PathBuf {
    PathBuf::from("C:\\kythia\\downloads")
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PostgresRelease {
    pub version: String,
    pub url: String,
}

pub fn is_running() -> bool {
    downloader::is_port_in_use(get_port())
}

pub fn is_initialized() -> bool {
    data_dir().join("PG_VERSION").exists() || data_dir().join("postgresql.conf").exists()
}

pub async fn fetch_versions() -> Result<Vec<PostgresRelease>, String> {
    let mut releases = Vec::new();

    let versions = vec!["16.3-1", "15.7-1", "14.12-1"];

    for ver in versions {
        releases.push(PostgresRelease {
            version: ver.to_string(),
            url: format!(
                "https://get.enterprisedb.com/postgresql/postgresql-{}-windows-x64-binaries.zip",
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
                .filter(|e| {
                    e.path().join("bin").join("postgres.exe").exists()
                        || e.path()
                            .join("pgsql")
                            .join("bin")
                            .join("postgres.exe")
                            .exists()
                })
                .filter_map(|e| e.file_name().into_string().ok())
                .collect()
        })
        .unwrap_or_default();
    v.sort_by(|a, b| cmp_versions(b, a));
    v
}

pub async fn install(app: &AppHandle, version: &str, url: &str) -> Result<String, String> {
    let zip_path = downloads_dir().join(format!("postgres-{}.zip", version));
    let dest = bin_dir().join(version);

    std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(downloads_dir()).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(logs_dir()).map_err(|e| e.to_string())?;

    downloader::download_file(app, "postgres", url, &zip_path).await?;
    // EDB postgres zip has a top-level dir like "pgsql/"
    downloader::extract_zip(&zip_path, &dest, true)?;

    let _ = std::fs::remove_file(&zip_path);
    Ok(format!(
        "PostgreSQL {} installed to C:\\kythia\\bin\\postgres\\{}",
        version, version
    ))
}

pub fn initialize(version: &str) -> Result<String, String> {
    let mut initdb = bin_dir().join(version).join("bin").join("initdb.exe");
    if !initdb.exists() {
        initdb = bin_dir()
            .join(version)
            .join("pgsql")
            .join("bin")
            .join("initdb.exe");
        if !initdb.exists() {
            return Err(format!("PostgreSQL not found for {}.", version));
        }
    }

    let data = data_dir();
    std::fs::create_dir_all(&data).map_err(|e| e.to_string())?;

    if is_initialized() {
        return Ok("Database already initialized.".to_string());
    }

    let output = std::process::Command::new(&initdb)
        .args([
            "-D",
            &data.to_string_lossy(),
            "-U",
            "postgres",
            "--auth=trust",
        ])
        .creation_flags(0x08000000)
        .output()
        .map_err(|e| format!("Failed to run initdb: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!("Initialization failed:\n{}\n{}", stderr, stdout));
    }

    Ok(
        "PostgreSQL data directory initialized successfully. Root user 'postgres' has no password."
            .to_string(),
    )
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

    let mut postgres = bin_dir().join(version).join("bin").join("postgres.exe");
    if !postgres.exists() {
        postgres = bin_dir()
            .join(version)
            .join("pgsql")
            .join("bin")
            .join("postgres.exe");
        if !postgres.exists() {
            return Err(format!("PostgreSQL {} is not installed.", version));
        }
    }

    if !is_initialized() {
        return Err("Database not initialized. Click 'Initialize' first.".to_string());
    }

    let data = data_dir();
    let log_file = logs_dir().join("postgres.log");

    let child = std::process::Command::new(&postgres)
        .args(["-D", &data.to_string_lossy(), "-p", &get_port().to_string()])
        .creation_flags(0x08000000)
        .stdout(
            std::fs::File::create(&log_file)
                .unwrap_or_else(|_| std::fs::File::create("NUL").unwrap()),
        )
        .stderr(
            std::fs::File::create(&log_file)
                .unwrap_or_else(|_| std::fs::File::create("NUL").unwrap()),
        )
        .spawn()
        .map_err(|e| format!("Failed to start PostgreSQL: {}", e))?;

    let pid = child.id();
    drop(child);

    for _ in 0..25 {
        std::thread::sleep(std::time::Duration::from_millis(200));
        if is_running() {
            return Ok(pid);
        }
    }

    Err("PostgreSQL did not start within 5 seconds. Check logs.".to_string())
}

pub fn stop(pid: Option<u32>) -> Result<(), String> {
    if let Some(p) = pid {
        let _ = std::process::Command::new("taskkill")
            .args(["/PID", &p.to_string(), "/F", "/T"])
            .creation_flags(0x08000000)
            .status();
    }
    let _ = std::process::Command::new("taskkill")
        .args(["/IM", "postgres.exe", "/F", "/T"])
        .creation_flags(0x08000000)
        .status();
    Ok(())
}

pub fn get_logs(lines: usize) -> Vec<String> {
    let log_path = logs_dir().join("postgres.log");
    let out = downloader::tail_file(&log_path, lines);
    if out.is_empty() {
        return vec![
            "[No PostgreSQL logs yet. Initialize and start the database first.]".to_string(),
        ];
    }
    out
}

pub fn clear_logs() {
    let log_path = logs_dir().join("postgres.log");
    crate::downloader::clear_file(&log_path);
}

fn cmp_versions(a: &str, b: &str) -> std::cmp::Ordering {
    let parse =
        |s: &str| -> Vec<u32> { s.split(['.', '-']).filter_map(|n| n.parse().ok()).collect() };
    parse(a).cmp(&parse(b))
}
