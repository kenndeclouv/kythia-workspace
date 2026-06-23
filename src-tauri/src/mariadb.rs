use crate::downloader;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;
use std::os::windows::process::CommandExt;
use crate::settings;

fn get_port() -> u16 {
    settings::get_settings().map(|s| s.mariadb.port).unwrap_or(3306)
}

fn bin_dir() -> PathBuf {
    PathBuf::from("C:\\kythia\\bin\\mariadb")
}

fn data_dir() -> PathBuf {
    PathBuf::from("C:\\kythia\\data\\mariadb")
}

fn logs_dir() -> PathBuf {
    PathBuf::from("C:\\kythia\\logs\\mariadb")
}

fn downloads_dir() -> PathBuf {
    PathBuf::from("C:\\kythia\\downloads")
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MariaDbRelease {
    pub version: String,
    pub url: String,
}

#[derive(Deserialize)]
struct ApiMajorReleases {
    major_releases: Vec<ApiMajorRelease>,
}

#[derive(Deserialize)]
struct ApiMajorRelease {
    release_id: String,
    release_status: String,
}

#[derive(Deserialize)]
struct ApiReleaseData {
    releases: std::collections::HashMap<String, ApiRelease>,
}

#[derive(Deserialize)]
struct ApiRelease {
    files: Vec<ApiFile>,
}

#[derive(Deserialize)]
struct ApiFile {
    file_name: String,
    package_type: Option<String>,
    cpu: Option<String>,
    file_download_url: Option<String>,
}

pub fn is_running() -> bool {
    downloader::is_port_in_use(get_port())
}

pub fn is_initialized() -> bool {
    data_dir().join("mysql").exists()
}

/// Fetch stable MariaDB releases using the downloads.mariadb.org REST API.
pub async fn fetch_versions() -> Result<Vec<MariaDbRelease>, String> {
    if let Some(cached) = crate::cache::get_cached("mariadb_versions") {
        if let Ok(releases) = serde_json::from_str(&cached) {
            return Ok(releases);
        }
    }

    let client = reqwest::Client::builder()
        .user_agent("KythiaWorkspace/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let majors: ApiMajorReleases = client
        .get("https://downloads.mariadb.org/rest-api/mariadb/")
        .send()
        .await
        .map_err(|e| format!("Failed to reach mariadb.org: {}", e))?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let stable_ids: Vec<String> = majors
        .major_releases
        .into_iter()
        .filter(|r| r.release_status == "Stable")
        .map(|r| r.release_id)
        .take(4)
        .collect();

    let mut releases = Vec::new();

    for major_id in &stable_ids {
        let url = format!(
            "https://downloads.mariadb.org/rest-api/mariadb/{}/",
            major_id
        );

        let data: ApiReleaseData = match client.get(&url).send().await {
            Ok(r) => match r.json().await {
                Ok(d) => d,
                Err(_) => continue,
            },
            Err(_) => continue,
        };

        let mut patch_versions: Vec<&String> = data.releases.keys().collect();
        patch_versions.sort_by(|a, b| cmp_versions(b, a));

        if let Some(patch_ver) = patch_versions.first() {
            if let Some(release) = data.releases.get(*patch_ver) {
                let file = release.files.iter().find(|f| {
                    f.package_type.as_ref().map(|s| s.to_lowercase().contains("zip")).unwrap_or(false)
                        && f.file_name.contains("winx64")
                        && f.cpu.as_deref().unwrap_or("") == "x86_64"
                });

                if let Some(f) = file {
                    let download_url = f.file_download_url.clone().unwrap_or_else(|| {
                        format!(
                            "https://archive.mariadb.org/mariadb-{}/winx64-packages/{}",
                            patch_ver, f.file_name
                        )
                    });

                    releases.push(MariaDbRelease {
                        version: patch_ver.to_string(),
                        url: download_url,
                    });
                }
            }
        }
    }

    if let Ok(json_str) = serde_json::to_string(&releases) {
        crate::cache::set_cached("mariadb_versions", &json_str);
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

/// Download and extract MariaDB for Windows.
pub async fn install(app: &AppHandle, version: &str, url: &str) -> Result<String, String> {
    let zip_path = downloads_dir().join(format!("mariadb-{}.zip", version));
    let dest = bin_dir().join(version);

    std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(downloads_dir()).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(logs_dir()).map_err(|e| e.to_string())?;

    downloader::download_file(app, "mariadb", url, &zip_path).await?;
    // MariaDB zip HAS a top-level dir like "mariadb-11.4.5-winx64/"
    downloader::extract_zip(&zip_path, &dest, true)?;

    let _ = std::fs::remove_file(&zip_path);
    Ok(format!(
        "MariaDB {} installed to C:\\kythia\\bin\\mariadb\\{}",
        version, version
    ))
}

pub fn initialize(version: &str) -> Result<String, String> {
    let installer = bin_dir().join(version).join("bin").join("mysql_install_db.exe");
    if !installer.exists() {
        return Err(format!("MariaDB installer not found for {}.", version));
    }

    let data = data_dir();
    std::fs::create_dir_all(&data).map_err(|e| e.to_string())?;

    // Check if already initialized
    if data.join("mysql").exists() {
        return Ok("Database already initialized.".to_string());
    }

    let output = std::process::Command::new(&installer)
        .args([
            &format!("--datadir={}", data.display()),
            "--default-user",
        ])
        .creation_flags(0x08000000)
        .output()
        .map_err(|e| format!("Failed to run mysql_install_db.exe: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!("Initialization failed:\n{}\n{}", stderr, stdout));
    }

    Ok("MariaDB data directory initialized successfully. Root user has no password.".to_string())
}

/// Start the MariaDB server process, returning the PID.
pub fn start(version: &str) -> Result<u32, String> {
    if is_running() {
        let port = get_port();
        if let Some((proc_name, pid)) = crate::downloader::get_conflicting_process(port) {
            return Err(format!("Port {} is blocked by '{}' (PID: {}). Please stop it first.", port, proc_name, pid));
        } else {
            return Err(format!("Port {} is already in use.", port));
        }
    }

    let mysqld = bin_dir().join(version).join("bin").join("mysqld.exe");
    if !mysqld.exists() {
        return Err(format!("MariaDB {} is not installed.", version));
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
        .map_err(|e| format!("Failed to start MariaDB: {}", e))?;

    let pid = child.id();
    drop(child); // Detach; process keeps running on Windows

    // Wait up to 5 seconds for MariaDB to bind
    for _ in 0..25 {
        std::thread::sleep(std::time::Duration::from_millis(200));
        if is_running() {
            return Ok(pid);
        }
    }

    Err("MariaDB did not start within 5 seconds. Check logs.".to_string())
}

/// Stop MariaDB by PID via taskkill.
pub fn stop(pid: Option<u32>) -> Result<(), String> {
    if let Some(p) = pid {
        let _ = std::process::Command::new("taskkill")
            .args(["/PID", &p.to_string(), "/F", "/T"])
            .creation_flags(0x08000000)
            .status();
    }
    let _ = std::process::Command::new("taskkill")
        .args(["/IM", "mysqld.exe", "/F", "/T"])
        .creation_flags(0x08000000)
        .status();
    Ok(())
}

pub fn get_logs(lines: usize) -> Vec<String> {
    // MariaDB logs to its data directory
    let log_path = data_dir().join("mariadb.err");
    let mut out = downloader::tail_file(&log_path, lines);
    if out.is_empty() {
        out = vec!["[No MariaDB logs yet. Initialize and start the database first.]".to_string()];
    }
    out
}

pub fn clear_logs() {
    let log_path = data_dir().join("mariadb.err");
    crate::downloader::clear_file(&log_path);
}

fn cmp_versions(a: &str, b: &str) -> std::cmp::Ordering {
    let parse = |s: &str| -> Vec<u32> {
        s.split(['.', '-']).filter_map(|n| n.parse().ok()).collect()
    };
    parse(a).cmp(&parse(b))
}
