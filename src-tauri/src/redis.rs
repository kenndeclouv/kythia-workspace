use crate::downloader;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use std::os::windows::process::CommandExt;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RedisRelease {
    pub version: String,
    pub url: String,
}

fn get_port() -> u16 {
    crate::settings::get_settings().map(|s| s.redis.port).unwrap_or(6379)
}

pub fn is_running() -> bool {
    downloader::is_port_in_use(get_port())
}

pub fn start(version: &str) -> Result<u32, String> {
    if is_running() {
        let port = get_port();
        if let Some((proc_name, pid)) = crate::downloader::get_conflicting_process(port) {
            return Err(format!("Port {} is blocked by '{}' (PID: {}). Please stop it first.", port, proc_name, pid));
        } else {
            return Err(format!("Port {} is already in use.", port));
        }
    }

    let redis_exe = PathBuf::from("C:\\kythia\\bin\\redis")
        .join(version)
        .join("redis-server.exe");

    if !redis_exe.exists() {
        return Err(format!("Redis {} is not installed.", version));
    }

    let conf_dir = PathBuf::from("C:\\kythia\\data\\redis");
    let _ = fs::create_dir_all(&conf_dir);
    let conf_path = conf_dir.join("redis.conf");
    
    let settings = crate::settings::get_settings().unwrap_or_default();
    let port = settings.redis.port;
    let mut conf_content = format!("port {}\n", port);
    
    if let Some(pass) = &settings.redis.password {
        if !pass.is_empty() {
            if let Some(user) = &settings.redis.user {
                if !user.is_empty() && user != "default" {
                    conf_content.push_str("user default off\n");
                    conf_content.push_str(&format!("user {} on >{} ~* &* +@all\n", user, pass));
                } else {
                    conf_content.push_str(&format!("requirepass {}\n", pass));
                }
            } else {
                conf_content.push_str(&format!("requirepass {}\n", pass));
            }
        }
    }
    
    let _ = fs::write(&conf_path, conf_content);

    let child = std::process::Command::new(&redis_exe)
        .arg(&conf_path)
        .creation_flags(0x08000000)
        .spawn()
        .map_err(|e| format!("Failed to start Redis: {}", e))?;

    let pid = child.id();
    drop(child);

    // Wait up to 5 seconds
    for _ in 0..25 {
        std::thread::sleep(std::time::Duration::from_millis(200));
        if is_running() {
            return Ok(pid);
        }
    }

    Err("Redis did not start within 5 seconds.".to_string())
}

pub fn stop(pid: Option<u32>) -> Result<(), String> {
    if let Some(p) = pid {
        let _ = std::process::Command::new("taskkill")
            .args(["/PID", &p.to_string(), "/F", "/T"])
            .creation_flags(0x08000000)
            .status();
    }
    let _ = std::process::Command::new("taskkill")
        .args(["/IM", "redis-server.exe", "/F", "/T"])
        .creation_flags(0x08000000)
        .status();
    Ok(())
}

pub fn get_logs(_lines: usize) -> Vec<String> {
    vec!["[Redis is running in standalone console mode. Default configurations do not write to a log file.]".to_string()]
}

pub fn clear_logs() {
    // No default log file for redis
}

#[tauri::command]
pub fn get_installed_redis() -> Vec<String> {
    let mut versions = Vec::new();
    let base = PathBuf::from("C:\\kythia\\bin\\redis");
    if let Ok(entries) = fs::read_dir(base) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                if let Some(name) = entry.file_name().to_str() {
                    versions.push(name.to_string());
                }
            }
        }
    }
    versions.sort_by(|a, b| b.cmp(a));
    versions
}

#[tauri::command]
pub async fn install_redis(app: AppHandle, version: String, url: String) -> Result<String, String> {
    let dl_dir = PathBuf::from("C:\\kythia\\downloads");
    fs::create_dir_all(&dl_dir).unwrap_or_default();
    
    let zip_path = dl_dir.join(format!("redis-{}.zip", version));
    downloader::download_file(&app, "redis", &url, &zip_path).await?;

    let bin_dir = PathBuf::from("C:\\kythia\\bin\\redis");
    let target_dir = bin_dir.join(&version);
    
    if target_dir.exists() {
        let _ = fs::remove_dir_all(&target_dir);
    }
    
    fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

    // The new MSYS2 redis zip has a top level folder, so we strip it
    downloader::extract_zip(&zip_path, &target_dir, true)?;

    let _ = fs::remove_file(&zip_path);

    Ok(format!("Redis {} installed successfully", version))
}

#[tauri::command]
pub async fn fetch_versions() -> Result<Vec<RedisRelease>, String> {
    if let Some(cached) = crate::cache::get_cached("redis_versions") {
        if let Ok(releases) = serde_json::from_str(&cached) {
            return Ok(releases);
        }
    }

    let client = reqwest::Client::builder()
        .user_agent("KythiaWorkspace/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = client
        .get("https://api.github.com/repos/redis-windows/redis-windows/releases")
        .send()
        .await
        .map_err(|e| format!("Failed to reach github api: {}", e))?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let mut releases = Vec::new();

    if let Some(arr) = json.as_array() {
        for release in arr {
            if let Some(tag) = release.get("tag_name").and_then(|t| t.as_str()) {
                if let Some(assets) = release.get("assets").and_then(|a| a.as_array()) {
                    for asset in assets {
                        if let Some(name) = asset.get("name").and_then(|n| n.as_str()) {
                            if name.ends_with("msys2.zip") {
                                if let Some(url) = asset.get("browser_download_url").and_then(|u| u.as_str()) {
                                    releases.push(RedisRelease {
                                        version: tag.to_string(),
                                        url: url.to_string(),
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    releases.sort_by(|a, b| cmp_versions(&b.version, &a.version));

    if let Ok(json_str) = serde_json::to_string(&releases) {
        crate::cache::set_cached("redis_versions", &json_str);
    }

    Ok(releases)
}

pub fn cmp_versions(a: &str, b: &str) -> std::cmp::Ordering {
    let parse = |s: &str| -> Vec<u32> {
        s.split(['.', '-']).filter_map(|n| n.parse().ok()).collect()
    };
    parse(a).cmp(&parse(b))
}
