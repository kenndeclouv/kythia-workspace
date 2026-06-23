use crate::settings;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use std::os::windows::process::CommandExt;

#[derive(Serialize, Deserialize, Clone)]
pub struct Site {
    pub name: String,
    pub path: String,
    pub domain: String,
    pub secured: bool,
}

#[tauri::command]
pub fn list_sites() -> Result<Vec<Site>, String> {
    let s = settings::get_settings().unwrap_or_default();
    let root = PathBuf::from(&s.document_root);
    let mut sites = Vec::new();
    
    if !root.exists() {
        return Ok(sites);
    }
    
    let entries = fs::read_dir(root).map_err(|e| e.to_string())?;
    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        if path.is_dir() {
            let name = entry.file_name().to_string_lossy().to_string();
            let domain = format!("{}.{}", name, s.local_domain);
            let conf_path = PathBuf::from("C:\\kythia\\bin\\nginx\\conf\\sites-enabled").join(format!("{}.conf", domain));
            sites.push(Site {
                name,
                path: path.to_string_lossy().to_string(),
                domain,
                secured: conf_path.exists(),
            });
        }
    }
    Ok(sites)
}

#[tauri::command]
pub async fn secure_site(app: AppHandle, domain: String, project_path: String) -> Result<String, String> {
    let mkcert_dir = PathBuf::from("C:\\kythia\\bin\\mkcert");
    fs::create_dir_all(&mkcert_dir).ok();
    let mkcert_exe = mkcert_dir.join("mkcert.exe");
    
    if !mkcert_exe.exists() {
        let url = "https://dl.filippo.io/mkcert/latest?for=windows/amd64";
        crate::downloader::download_file(&app, "mkcert", url, &mkcert_exe).await?;
    }
    
    // Install Root CA
    std::process::Command::new(&mkcert_exe)
        .arg("-install")
        .creation_flags(0x08000000)
        .status()
        .map_err(|e| format!("Failed to install mkcert CA: {}", e))?;
        
    // Generate certificates
    let certs_dir = PathBuf::from("C:\\kythia\\data\\certs");
    fs::create_dir_all(&certs_dir).ok();
    
    std::process::Command::new(&mkcert_exe)
        .current_dir(&certs_dir)
        .arg(&domain)
        .creation_flags(0x08000000)
        .status()
        .map_err(|e| format!("Failed to generate cert: {}", e))?;
        
    // Update Hosts File
    let hosts_path = "C:\\Windows\\System32\\drivers\\etc\\hosts";
    let hosts_content = fs::read_to_string(hosts_path).unwrap_or_default();
    if !hosts_content.contains(&domain) {
        let ps_cmd = format!("Add-Content -Path $env:windir\\System32\\drivers\\etc\\hosts -Value \"127.0.0.1 {}\"", domain);
        let status = std::process::Command::new("powershell")
            .arg("-Command")
            .arg(&format!("Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command \"{}\"' -Verb RunAs", ps_cmd))
            .creation_flags(0x08000000)
            .status();
        if status.is_err() || !status.unwrap().success() {
            // Non-fatal, just a warning
            println!("Failed to modify hosts file via UAC automatically.");
        }
    }
    
    // Generate Nginx Conf
    let s = settings::get_settings().unwrap_or_default();
    let sites_enabled = PathBuf::from("C:\\kythia\\bin\\nginx\\conf\\sites-enabled");
    fs::create_dir_all(&sites_enabled).ok();
    
    let mut root = project_path.replace('\\', "/");
    if PathBuf::from(&project_path).join("public").exists() {
        root = format!("{}/public", root);
    }
    
    let conf = format!(r#"
server {{
    listen 80;
    listen 443 ssl;
    server_name {};
    
    ssl_certificate "C:/kythia/data/certs/{}.pem";
    ssl_certificate_key "C:/kythia/data/certs/{}-key.pem";
    
    root "{}";
    index index.php index.html index.htm;
    
    location / {{
        try_files $uri $uri/ /index.php?$query_string;
    }}
    
    location ~ \.php$ {{
        fastcgi_pass   127.0.0.1:{};
        fastcgi_index  index.php;
        fastcgi_param  SCRIPT_FILENAME  $document_root$fastcgi_script_name;
        include        fastcgi_params;
    }}
}}
"#, domain, domain, domain, root, s.php.port);

    fs::write(sites_enabled.join(format!("{}.conf", domain)), conf).map_err(|e| e.to_string())?;
    
    Ok(format!("Site {} secured successfully! Please restart Nginx to apply changes.", domain))
}

#[tauri::command]
pub fn unsecure_site(domain: String) -> Result<String, String> {
    let conf_path = PathBuf::from(format!("C:\\kythia\\bin\\nginx\\conf\\sites-enabled\\{}.conf", domain));
    if conf_path.exists() {
        fs::remove_file(conf_path).map_err(|e| e.to_string())?;
    }
    Ok("Site unsecured. Restart Nginx to apply changes.".to_string())
}
