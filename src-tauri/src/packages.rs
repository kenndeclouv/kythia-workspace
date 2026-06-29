use crate::downloader;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

// ────────────────────────────────────────────────────────────────
// Node.js
// ────────────────────────────────────────────────────────────────

#[derive(Deserialize, Debug)]
pub struct NodeReleaseJson {
    pub version: String,
    pub lts: Option<serde_json::Value>,
    pub files: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct NodeRelease {
    pub version: String,
    pub lts: bool,
    pub url: String,
}

#[tauri::command]
pub async fn fetch_node_versions() -> Result<Vec<NodeRelease>, String> {
    if let Some(cached) = crate::cache::get_cached("node_versions") {
        if let Ok(releases) = serde_json::from_str(&cached) {
            return Ok(releases);
        }
    }

    let client = reqwest::Client::builder()
        .user_agent("KythiaWorkspace/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let json: Vec<NodeReleaseJson> = client
        .get("https://nodejs.org/dist/index.json")
        .send()
        .await
        .map_err(|e| format!("Failed to reach nodejs.org: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Failed to parse nodejs json: {}", e))?;

    let mut releases = Vec::new();
    for entry in json {
        if let Some(files) = entry.files {
            if files.contains(&"win-x64-zip".to_string()) {
                let version = entry.version.trim_start_matches('v').to_string();
                let lts = match entry.lts {
                    Some(serde_json::Value::Bool(b)) => b,
                    Some(serde_json::Value::String(_)) => true,
                    _ => false,
                };
                let url = format!(
                    "https://nodejs.org/dist/v{}/node-v{}-win-x64.zip",
                    version, version
                );
                releases.push(NodeRelease { version, lts, url });
            }
        }
    }

    if let Ok(json_str) = serde_json::to_string(&releases) {
        crate::cache::set_cached("node_versions", &json_str);
    }

    Ok(releases)
}

#[tauri::command]
pub fn get_installed_node() -> Vec<String> {
    let mut versions = Vec::new();
    let base = PathBuf::from("C:\\kythia\\bin\\node");
    if let Ok(entries) = fs::read_dir(base) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                if let Some(name) = entry.file_name().to_str() {
                    versions.push(name.to_string());
                }
            }
        }
    }
    // Sort descending manually (simplistic for x.y.z)
    versions.sort_by(|a, b| b.cmp(a));
    versions
}

#[tauri::command]
pub async fn install_node(app: AppHandle, version: String, url: String) -> Result<String, String> {
    let dl_dir = PathBuf::from("C:\\kythia\\downloads");
    fs::create_dir_all(&dl_dir).unwrap_or_default();

    let zip_path = dl_dir.join(format!("node-{}.zip", version));
    downloader::download_file(&app, "node", &url, &zip_path).await?;

    let bin_dir = PathBuf::from("C:\\kythia\\bin\\node");
    let target_dir = bin_dir.join(&version);
    if target_dir.exists() {
        let _ = fs::remove_dir_all(&target_dir);
    }

    // Node zips extract into a folder named "node-vX.X.X-win-x64"
    let extract_dir = bin_dir.join(format!("node-v{}-win-x64", version));
    downloader::extract_zip(&zip_path, &bin_dir, false)?;

    if extract_dir.exists() {
        fs::rename(&extract_dir, &target_dir).map_err(|e| format!("Rename failed: {}", e))?;
    } else {
        return Err("Extraction failed: unexpected folder structure".to_string());
    }

    Ok(format!("Node {} installed successfully", version))
}

// ────────────────────────────────────────────────────────────────
// Bun
// ────────────────────────────────────────────────────────────────

#[derive(Deserialize, Debug)]
pub struct GithubRelease {
    pub tag_name: String,
    pub assets: Vec<GithubAsset>,
}

#[derive(Deserialize, Debug)]
pub struct GithubAsset {
    pub name: String,
    pub browser_download_url: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct BunRelease {
    pub version: String,
    pub url: String,
}

#[tauri::command]
pub async fn fetch_bun_versions() -> Result<Vec<BunRelease>, String> {
    if let Some(cached) = crate::cache::get_cached("bun_versions") {
        if let Ok(releases) = serde_json::from_str(&cached) {
            return Ok(releases);
        }
    }

    let client = reqwest::Client::builder()
        .user_agent("KythiaWorkspace/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let json: Vec<GithubRelease> = client
        .get("https://api.github.com/repos/oven-sh/bun/releases")
        .send()
        .await
        .map_err(|e| format!("Failed to reach Github API: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Failed to parse Github releases: {}", e))?;

    let mut releases = Vec::new();
    for release in json {
        if let Some(asset) = release
            .assets
            .iter()
            .find(|a| a.name == "bun-windows-x64.zip")
        {
            let version = release.tag_name.trim_start_matches("bun-v").to_string();
            releases.push(BunRelease {
                version,
                url: asset.browser_download_url.clone(),
            });
        }
    }

    if let Ok(json_str) = serde_json::to_string(&releases) {
        crate::cache::set_cached("bun_versions", &json_str);
    }

    Ok(releases)
}

#[tauri::command]
pub fn get_installed_bun() -> Vec<String> {
    let mut versions = Vec::new();
    let base = PathBuf::from("C:\\kythia\\bin\\bun");
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
pub async fn install_bun(app: AppHandle, version: String, url: String) -> Result<String, String> {
    let dl_dir = PathBuf::from("C:\\kythia\\downloads");
    fs::create_dir_all(&dl_dir).unwrap_or_default();

    let zip_path = dl_dir.join(format!("bun-{}.zip", version));
    downloader::download_file(&app, "bun", &url, &zip_path).await?;

    let bin_dir = PathBuf::from("C:\\kythia\\bin\\bun");
    let target_dir = bin_dir.join(&version);
    if target_dir.exists() {
        let _ = fs::remove_dir_all(&target_dir);
    }

    // Bun zips extract into "bun-windows-x64"
    let extract_dir = bin_dir.join("bun-windows-x64");
    downloader::extract_zip(&zip_path, &bin_dir, false)?;

    if extract_dir.exists() {
        fs::rename(&extract_dir, &target_dir).map_err(|e| format!("Rename failed: {}", e))?;
    } else {
        return Err("Extraction failed: unexpected folder structure".to_string());
    }

    Ok(format!("Bun {} installed successfully", version))
}

// ────────────────────────────────────────────────────────────────
// Composer
// ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_installed_composer() -> Option<String> {
    let composer_path = PathBuf::from("C:\\kythia\\bin\\composer\\composer.phar");
    if composer_path.exists() {
        Some("latest".to_string())
    } else {
        None
    }
}

#[tauri::command]
pub async fn install_composer(app: AppHandle) -> Result<String, String> {
    let bin_dir = PathBuf::from("C:\\kythia\\bin\\composer");
    fs::create_dir_all(&bin_dir).unwrap_or_default();

    let phar_path = bin_dir.join("composer.phar");
    downloader::download_file(
        &app,
        "composer",
        "https://getcomposer.org/download/latest-stable/composer.phar",
        &phar_path,
    )
    .await?;

    // Create the wrapper bat script
    let bat_content = "@echo off\r\nphp \"%~dp0composer.phar\" %*\r\n";
    let bat_path = bin_dir.join("composer.bat");
    fs::write(&bat_path, bat_content)
        .map_err(|e| format!("Failed to write composer.bat: {}", e))?;

    Ok("Composer installed successfully".to_string())
}
// ────────────────────────────────────────────────────────────────
// WP-CLI
// ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_installed_wp_cli() -> Option<String> {
    let path = PathBuf::from("C:\\kythia\\bin\\wp-cli\\wp-cli.phar");
    if path.exists() {
        Some("latest".to_string())
    } else {
        None
    }
}

#[tauri::command]
pub async fn install_wp_cli(app: AppHandle) -> Result<String, String> {
    let bin_dir = PathBuf::from("C:\\kythia\\bin\\wp-cli");
    fs::create_dir_all(&bin_dir).unwrap_or_default();

    let phar_path = bin_dir.join("wp-cli.phar");
    downloader::download_file(
        &app,
        "wp-cli",
        "https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar",
        &phar_path,
    )
    .await?;

    let bat_content = "@echo off\r\nphp \"%~dp0wp-cli.phar\" %*\r\n";
    let bat_path = bin_dir.join("wp.bat");
    fs::write(&bat_path, bat_content).map_err(|e| format!("Failed to write wp.bat: {}", e))?;

    Ok("WP-CLI installed successfully".to_string())
}

// ────────────────────────────────────────────────────────────────
// Meilisearch
// ────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
pub struct MeiliRelease {
    pub version: String,
    pub url: String,
}

#[tauri::command]
pub async fn fetch_meilisearch_versions() -> Result<Vec<MeiliRelease>, String> {
    if let Some(cached) = crate::cache::get_cached("meilisearch_versions") {
        if let Ok(releases) = serde_json::from_str(&cached) {
            return Ok(releases);
        }
    }

    let client = reqwest::Client::builder()
        .user_agent("KythiaWorkspace/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let json: Vec<GithubRelease> = client
        .get("https://api.github.com/repos/meilisearch/meilisearch/releases")
        .send()
        .await
        .map_err(|e| format!("Failed to reach Github API: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Failed to parse Github releases: {}", e))?;

    let mut releases = Vec::new();
    for release in json {
        if let Some(asset) = release
            .assets
            .iter()
            .find(|a| a.name == "meilisearch-windows-amd64.exe")
        {
            let version = release.tag_name.trim_start_matches("v").to_string();
            releases.push(MeiliRelease {
                version,
                url: asset.browser_download_url.clone(),
            });
        }
    }

    if let Ok(json_str) = serde_json::to_string(&releases) {
        crate::cache::set_cached("meilisearch_versions", &json_str);
    }

    Ok(releases)
}

#[tauri::command]
pub fn get_installed_meilisearch() -> Vec<String> {
    let mut versions = Vec::new();
    let base = PathBuf::from("C:\\kythia\\bin\\meilisearch");
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
pub async fn install_meilisearch(
    app: AppHandle,
    version: String,
    url: String,
) -> Result<String, String> {
    let bin_dir = PathBuf::from("C:\\kythia\\bin\\meilisearch");
    let target_dir = bin_dir.join(&version);

    if target_dir.exists() {
        let _ = fs::remove_dir_all(&target_dir);
    }

    fs::create_dir_all(&target_dir).unwrap_or_default();

    let exe_path = target_dir.join("meilisearch.exe");
    downloader::download_file(&app, "meilisearch", &url, &exe_path).await?;

    Ok(format!("Meilisearch {} installed successfully", version))
}

// ────────────────────────────────────────────────────────────────
// Deno
// ────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
pub struct DenoRelease {
    pub version: String,
    pub url: String,
}

#[tauri::command]
pub async fn fetch_deno_versions() -> Result<Vec<DenoRelease>, String> {
    if let Some(cached) = crate::cache::get_cached("deno_versions") {
        if let Ok(releases) = serde_json::from_str(&cached) {
            return Ok(releases);
        }
    }

    let client = reqwest::Client::builder()
        .user_agent("KythiaWorkspace/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let json: Vec<GithubRelease> = client
        .get("https://api.github.com/repos/denoland/deno/releases")
        .send()
        .await
        .map_err(|e| format!("Failed to reach Github API: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Failed to parse Github releases: {}", e))?;

    let mut releases = Vec::new();
    for release in json {
        if let Some(asset) = release
            .assets
            .iter()
            .find(|a| a.name == "deno-x86_64-pc-windows-msvc.zip")
        {
            let version = release.tag_name.trim_start_matches("v").to_string();
            releases.push(DenoRelease {
                version,
                url: asset.browser_download_url.clone(),
            });
        }
    }

    if let Ok(json_str) = serde_json::to_string(&releases) {
        crate::cache::set_cached("deno_versions", &json_str);
    }

    Ok(releases)
}

#[tauri::command]
pub fn get_installed_deno() -> Vec<String> {
    let mut versions = Vec::new();
    let base = PathBuf::from("C:\\kythia\\bin\\deno");
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
pub async fn install_deno(app: AppHandle, version: String, url: String) -> Result<String, String> {
    let dl_dir = PathBuf::from("C:\\kythia\\downloads");
    fs::create_dir_all(&dl_dir).unwrap_or_default();

    let zip_path = dl_dir.join(format!("deno-{}.zip", version));
    downloader::download_file(&app, "deno", &url, &zip_path).await?;

    let bin_dir = PathBuf::from("C:\\kythia\\bin\\deno");
    let target_dir = bin_dir.join(&version);
    if target_dir.exists() {
        let _ = fs::remove_dir_all(&target_dir);
    }

    fs::create_dir_all(&target_dir).unwrap_or_default();

    downloader::extract_zip(&zip_path, &target_dir, false)?;

    Ok(format!("Deno {} installed successfully", version))
}

// ────────────────────────────────────────────────────────────────
// PNPM
// ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_installed_pnpm() -> Option<String> {
    let pnpm_path = PathBuf::from("C:\\kythia\\bin\\pnpm\\pnpm.exe");
    if pnpm_path.exists() {
        Some("latest".to_string())
    } else {
        None
    }
}

#[tauri::command]
pub async fn install_pnpm(app: AppHandle) -> Result<String, String> {
    let dl_dir = PathBuf::from("C:\\kythia\\downloads");
    fs::create_dir_all(&dl_dir).unwrap_or_default();

    let zip_path = dl_dir.join("pnpm-win32-x64.zip");
    downloader::download_file(
        &app,
        "pnpm",
        "https://github.com/pnpm/pnpm/releases/latest/download/pnpm-win32-x64.zip",
        &zip_path,
    )
    .await?;

    let bin_dir = PathBuf::from("C:\\kythia\\bin\\pnpm");
    fs::create_dir_all(&bin_dir).unwrap_or_default();

    downloader::extract_zip(&zip_path, &bin_dir, false)?;

    Ok("PNPM installed successfully".to_string())
}

// ────────────────────────────────────────────────────────────────
// Yarn
// ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_installed_yarn() -> Option<String> {
    let yarn_path = PathBuf::from("C:\\kythia\\bin\\yarn\\yarn.js");
    if yarn_path.exists() {
        Some("latest".to_string())
    } else {
        None
    }
}

#[tauri::command]
pub async fn install_yarn(app: AppHandle) -> Result<String, String> {
    let bin_dir = PathBuf::from("C:\\kythia\\bin\\yarn");
    fs::create_dir_all(&bin_dir).unwrap_or_default();

    let js_path = bin_dir.join("yarn.js");
    downloader::download_file(
        &app,
        "yarn",
        "https://github.com/yarnpkg/yarn/releases/download/v1.22.22/yarn-1.22.22.js",
        &js_path,
    )
    .await?;

    let bat_content = "@echo off\r\nnode \"%~dp0yarn.js\" %*\r\n";
    let bat_path = bin_dir.join("yarn.bat");
    fs::write(&bat_path, bat_content).map_err(|e| format!("Failed to write yarn.bat: {}", e))?;

    Ok("Yarn installed successfully".to_string())
}
