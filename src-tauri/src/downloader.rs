use futures_util::StreamExt;
use serde::Serialize;
use std::io::Write;
use std::os::windows::process::CommandExt;
use std::path::Path;
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Clone, Debug)]
pub struct DownloadProgress {
    pub service: String,
    pub downloaded: u64,
    pub total: u64,
    pub percent: f64,
    pub status: String, // "downloading" | "extracting" | "done" | "error"
}

/// Downloads `url` to `dest`, emitting "download-progress" events on `app`.
pub async fn download_file(
    app: &AppHandle,
    service: &str,
    url: &str,
    dest: &Path,
) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Download failed with HTTP {} for URL: {}",
            response.status(),
            url
        ));
    }

    let total = response.content_length().unwrap_or(0);
    let mut downloaded = 0u64;
    let mut stream = response.bytes_stream();

    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let mut file = std::fs::File::create(dest).map_err(|e| e.to_string())?;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        file.write_all(&chunk).map_err(|e| e.to_string())?;

        let percent = if total > 0 {
            (downloaded as f64 / total as f64) * 100.0
        } else {
            0.0
        };

        let _ = app.emit(
            "download-progress",
            DownloadProgress {
                service: service.to_string(),
                downloaded,
                total,
                percent,
                status: "downloading".to_string(),
            },
        );
    }

    // Signal extraction phase
    let _ = app.emit(
        "download-progress",
        DownloadProgress {
            service: service.to_string(),
            downloaded,
            total,
            percent: 100.0,
            status: "extracting".to_string(),
        },
    );

    Ok(())
}

/// Extracts a ZIP archive to `dest`, stripping the top-level directory if present.
pub fn extract_zip(zip_path: &Path, dest: &Path, strip_top_dir: bool) -> Result<(), String> {
    let file = std::fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let raw_name = entry.name().to_string();

        let relative = if strip_top_dir {
            match raw_name.find('/') {
                Some(pos) => &raw_name[pos + 1..],
                None => &raw_name,
            }
        } else {
            &raw_name
        };

        if relative.is_empty() {
            continue;
        }

        let out_path = dest.join(relative.replace('/', std::path::MAIN_SEPARATOR_STR));

        if entry.is_dir() {
            std::fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut out_file = std::fs::File::create(&out_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut out_file).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

/// Returns true if the given TCP port is already in use.
pub fn is_port_in_use(port: u16) -> bool {
    let timeout = std::time::Duration::from_millis(10);
    let v4 = std::net::SocketAddr::from(([127, 0, 0, 1], port));
    let v6 = std::net::SocketAddr::from(([0, 0, 0, 0, 0, 0, 0, 1], port));
    std::net::TcpStream::connect_timeout(&v4, timeout).is_ok()
        || std::net::TcpStream::connect_timeout(&v6, timeout).is_ok()
}

/// Identifies the process (name, PID) holding a specific port.
pub fn get_conflicting_process(port: u16) -> Option<(String, String)> {
    let output = std::process::Command::new("netstat")
        .args(["-ano"])
        .creation_flags(0x08000000)
        .output()
        .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let port_str = format!(":{} ", port);
    let mut pid = None;

    for line in stdout.lines() {
        if line.contains(&port_str) && line.contains("LISTENING") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if let Some(p) = parts.last() {
                pid = Some(p.to_string());
                break;
            }
        }
    }

    let pid = pid?;

    let task_output = std::process::Command::new("tasklist")
        .args(["/FI", &format!("PID eq {}", pid), "/NH"])
        .creation_flags(0x08000000)
        .output()
        .ok()?;

    let task_stdout = String::from_utf8_lossy(&task_output.stdout);
    let proc_name = task_stdout
        .split_whitespace()
        .next()
        .unwrap_or("Unknown")
        .to_string();

    Some((proc_name, pid))
}

/// Read the last `n` lines of a file. Returns an empty vec if the file doesn't exist.
pub fn tail_file(path: &Path, n: usize) -> Vec<String> {
    match std::fs::read_to_string(path) {
        Ok(content) => content
            .lines()
            .rev()
            .take(n)
            .map(String::from)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect(),
        Err(_) => vec![],
    }
}

/// Truncate a file to 0 bytes
pub fn clear_file(path: &Path) {
    let _ = std::fs::OpenOptions::new()
        .write(true)
        .truncate(true)
        .open(path);
}
