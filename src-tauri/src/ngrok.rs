use std::collections::HashMap;
use std::fs;
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use tauri::AppHandle;

static NGROK_PIDS: OnceLock<Mutex<HashMap<String, u32>>> = OnceLock::new();

fn get_pids() -> &'static Mutex<HashMap<String, u32>> {
    NGROK_PIDS.get_or_init(|| Mutex::new(HashMap::new()))
}

#[tauri::command]
pub async fn share_site(app: AppHandle, domain: String) -> Result<String, String> {
    let ngrok_dir = PathBuf::from("C:\\kythia\\bin\\ngrok");
    fs::create_dir_all(&ngrok_dir).ok();
    let ngrok_exe = ngrok_dir.join("ngrok.exe");

    if !ngrok_exe.exists() {
        let zip_url = "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip";
        let zip_path = PathBuf::from("C:\\kythia\\downloads\\ngrok.zip");
        fs::create_dir_all("C:\\kythia\\downloads").ok();

        crate::downloader::download_file(&app, "ngrok", zip_url, &zip_path).await?;

        // Extract
        let zip_file = fs::File::open(&zip_path).map_err(|e| e.to_string())?;
        let mut archive = zip::ZipArchive::new(zip_file).map_err(|e| e.to_string())?;
        for i in 0..archive.len() {
            let mut file = archive.by_index(i).unwrap();
            let outpath = match file.enclosed_name() {
                Some(path) => path.to_owned(),
                None => continue,
            };
            if outpath.to_string_lossy() == "ngrok.exe" {
                let mut outfile = fs::File::create(&ngrok_exe).unwrap();
                std::io::copy(&mut file, &mut outfile).unwrap();
            }
        }
        let _ = fs::remove_file(zip_path);
    }

    // Auth token check
    let s = crate::settings::get_settings().unwrap_or_default();
    if let Some(token) = s.ngrok_auth_token {
        if !token.is_empty() {
            let _ = std::process::Command::new(&ngrok_exe)
                .arg("config")
                .arg("add-authtoken")
                .arg(token)
                .creation_flags(0x08000000)
                .status();
        }
    }

    // Start ngrok tunnel for the domain
    // ngrok http http://myapp.test:80 --host-header=myapp.test --log=stdout
    let child = std::process::Command::new(&ngrok_exe)
        .arg("http")
        .arg(format!("http://{}:80", domain))
        .arg("--host-header")
        .arg(&domain)
        .creation_flags(0x08000000)
        .spawn()
        .map_err(|e| format!("Failed to start ngrok: {}", e))?;

    get_pids()
        .lock()
        .unwrap()
        .insert(domain.clone(), child.id());

    // Poll API for tunnel URL
    let client = reqwest::Client::new();
    let mut public_url = String::new();
    for _ in 0..15 {
        std::thread::sleep(std::time::Duration::from_millis(500));
        if let Ok(res) = client.get("http://127.0.0.1:4040/api/tunnels").send().await {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                if let Some(tunnels) = json.get("tunnels").and_then(|t| t.as_array()) {
                    for tunnel in tunnels {
                        if let Some(cfg) = tunnel.get("config").and_then(|c| c.get("addr")) {
                            if cfg.as_str().unwrap_or("").contains(&domain) {
                                if let Some(url) = tunnel.get("public_url") {
                                    public_url = url.as_str().unwrap_or("").to_string();
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
        if !public_url.is_empty() {
            break;
        }
    }

    if public_url.is_empty() {
        stop_share(domain.clone()).ok();
        return Err(
            "Ngrok started but failed to fetch public URL. Do you have a valid auth token?"
                .to_string(),
        );
    }

    Ok(public_url)
}

#[tauri::command]
pub fn stop_share(domain: String) -> Result<(), String> {
    if let Some(pid) = get_pids().lock().unwrap().remove(&domain) {
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/PID", &pid.to_string()])
            .creation_flags(0x08000000).stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null())
            .status();
    }
    Ok(())
}

#[tauri::command]
pub fn get_shared_sites() -> Result<Vec<String>, String> {
    let pids = get_pids().lock().unwrap();
    Ok(pids.keys().cloned().collect())
}
