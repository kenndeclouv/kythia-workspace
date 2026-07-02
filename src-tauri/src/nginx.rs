use crate::downloader;
use crate::settings;
use regex::Regex;
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use tauri::AppHandle;

fn get_port() -> u16 {
    settings::get_settings().map(|s| s.nginx.port).unwrap_or(80)
}

fn bin_dir() -> PathBuf {
    PathBuf::from("C:\\kythia\\bin\\nginx")
}

fn logs_dir() -> PathBuf {
    PathBuf::from("C:\\kythia\\logs\\nginx")
}

fn downloads_dir() -> PathBuf {
    PathBuf::from("C:\\kythia\\downloads")
}

pub fn is_running() -> bool {
    downloader::is_port_in_use(get_port())
}

/// Fetch available Nginx versions by scraping nginx.org/en/download.html
pub async fn fetch_versions() -> Result<Vec<String>, String> {
    if let Some(cached) = crate::cache::get_cached("nginx_versions") {
        if let Ok(releases) = serde_json::from_str(&cached) {
            return Ok(releases);
        }
    }

    let client = reqwest::Client::builder()
        .user_agent("KythiaWorkspace/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let html = client
        .get("http://nginx.org/download/")
        .send()
        .await
        .map_err(|e| format!("Failed to reach nginx.org: {}", e))?
        .text()
        .await
        .map_err(|e| e.to_string())?;

    let re = Regex::new(r#"href="nginx-(\d+\.\d+\.\d+)\.zip""#).unwrap();

    let mut seen = std::collections::HashSet::new();
    let mut versions: Vec<String> = re
        .captures_iter(&html)
        .filter_map(|cap| {
            let ver = cap[1].to_string();
            if seen.insert(ver.clone()) {
                Some(ver)
            } else {
                None
            }
        })
        .collect();

    versions.sort_by(|a, b| crate::php::cmp_versions(b, a));

    if let Ok(json_str) = serde_json::to_string(&versions) {
        crate::cache::set_cached("nginx_versions", &json_str);
    }

    Ok(versions)
}

pub fn get_installed() -> Vec<String> {
    let base = bin_dir();
    if !base.exists() {
        return vec![];
    }
    let mut v: Vec<String> = std::fs::read_dir(&base)
        .map(|d| {
            d.filter_map(|e| e.ok())
                .filter(|e| e.path().join("nginx.exe").exists())
                .filter_map(|e| e.file_name().into_string().ok())
                .collect()
        })
        .unwrap_or_default();
    v.sort_by(|a, b| cmp_versions(b, a));
    v
}

/// Download and install a specific Nginx version.
pub async fn install(app: &AppHandle, version: &str) -> Result<String, String> {
    let url = format!("https://nginx.org/download/nginx-{}.zip", version);
    let zip_path = downloads_dir().join(format!("nginx-{}.zip", version));
    let dest = bin_dir().join(version);

    std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(downloads_dir()).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(logs_dir()).map_err(|e| e.to_string())?;

    downloader::download_file(app, "nginx", &url, &zip_path).await?;
    downloader::extract_zip(&zip_path, &dest, true)?;

    // Patch nginx.conf to redirect logs to C:\kythia\logs\nginx\
    patch_conf(&dest)?;

    let _ = std::fs::remove_file(&zip_path);
    Ok(format!(
        "Nginx {} installed to C:\\kythia\\bin\\nginx\\{}",
        version, version
    ))
}

fn patch_conf(dest: &PathBuf) -> Result<(), String> {
    let conf_path = dest.join("conf").join("nginx.conf");
    if !conf_path.exists() {
        return Ok(());
    }

    let logs = logs_dir();
    let error_log = logs.join("error.log").to_str().unwrap().replace('\\', "/");
    let access_log = logs.join("access.log").to_str().unwrap().replace('\\', "/");

    let content = std::fs::read_to_string(&conf_path).map_err(|e| e.to_string())?;

    let error_re = Regex::new(r"#?error_log\s+[^\r\n;]+;?").unwrap();
    let access_re = Regex::new(r"#?access_log\s+[^\r\n;]+;?").unwrap();

    let patched = error_re.replace(&content, format!("error_log  {};", error_log));
    let patched = access_re.replace(&patched, format!("access_log  {};", access_log));

    std::fs::write(&conf_path, patched.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

/// Start the Nginx process. Nginx on Windows spawns a master+worker pair and
/// the launcher process exits quickly, so we track status by port occupancy.
pub fn start(version: &str) -> Result<(), String> {
    let port = get_port();
    if is_running() {
        if let Some((proc_name, pid)) = crate::downloader::get_conflicting_process(port) {
            return Err(format!(
                "Port {} is blocked by '{}' (PID: {}). Please stop it first.",
                port, proc_name, pid
            ));
        } else {
            return Err(format!(
                "Port {} is already in use. Stop the conflicting process first.",
                port
            ));
        }
    }

    patch_conf_dynamic(version)?;
    let _ = create_welcome_page();
    let _ = crate::hosts::sync_hosts(); // Synchronize local domain folders with Windows hosts

    let dir = bin_dir().join(version);
    let exe = dir.join("nginx.exe");
    if !exe.exists() {
        return Err(format!("Nginx {} is not installed.", version));
    }

    std::process::Command::new(&exe)
        .current_dir(&dir)
        .creation_flags(0x08000000)
        .spawn()
        .map_err(|e| {
            format!(
                "Failed to launch nginx.exe: {}. Try running as Administrator.",
                e
            )
        })?;

    // Poll for up to 6 seconds
    for _ in 0..30 {
        std::thread::sleep(std::time::Duration::from_millis(200));
        if is_running() {
            return Ok(());
        }
    }

    Err(format!(
        "Nginx did not bind port {}. Check logs or try running Kythia as Administrator.",
        port
    ))
}

fn patch_conf_dynamic(version: &str) -> Result<(), String> {
    let conf_path = bin_dir().join(version).join("conf").join("nginx.conf");
    if !conf_path.exists() {
        return Ok(());
    }

    let settings = settings::get_settings().unwrap_or_default();
    let content = std::fs::read_to_string(&conf_path).map_err(|e| e.to_string())?;

    let listen_re = Regex::new(r"listen\s+\d+;").unwrap();
    let patched = listen_re.replace(
        &content,
        format!("listen       {};", settings.nginx.port).as_str(),
    );

    let root_re = Regex::new(r"(location\s+/\s*\{[\s\r\n]*)root\s+[^;]+;").unwrap();
    let doc_root = settings.document_root.replace('\\', "/");
    let patched = root_re.replace(&patched, format!("${{1}}root   {};", doc_root).as_str());

    // Add index.php to index directive
    let index_re = Regex::new(r"index\s+index\.html\s+index\.htm;").unwrap();
    let mut patched = index_re
        .replace(&patched, "index  index.php index.html index.htm;")
        .to_string();

    // Add PHP FastCGI location block before error_page
    if !patched.contains("SCRIPT_FILENAME  $document_root$fastcgi_script_name;") {
        let php_block = format!(
            r#"location / {{
            try_files $uri $uri/ /index.php?$query_string;
        }}
        
        location ~ \.php$ {{
            root           {};
            fastcgi_pass   127.0.0.1:{};
            fastcgi_index  index.php;
            fastcgi_param  SCRIPT_FILENAME  $document_root$fastcgi_script_name;
            include        fastcgi_params;
        }}

        error_page   500 502 503 504  /50x.html;"#,
            doc_root, settings.php.port
        );
        let error_page_re =
            Regex::new(r"error_page\s+500\s+502\s+503\s+504\s+/50x\.html;").unwrap();
        patched = error_page_re
            .replace(&patched, regex::NoExpand(php_block.as_str()))
            .to_string();
    } else {
        let fastcgi_pass_re = Regex::new(r"fastcgi_pass\s+127\.0\.0\.1:\d+;").unwrap();
        patched = fastcgi_pass_re
            .replace(
                &patched,
                format!("fastcgi_pass   127.0.0.1:{};", settings.php.port).as_str(),
            )
            .to_string();
    }

    // Add dynamic virtual host block at the end (before the last closing brace)
    let domain_suffix = settings.local_domain;
    let vhost_block = format!(
        r#"
    server {{
        listen       {};
        server_name  ~^(?<project>.+)\.{}$;
        
        # Default to /public if it exists, otherwise just the project folder
        set $project_root "{}/$project";
        if (-d "$project_root/public") {{
            set $project_root "{}/$project/public";
        }}
        
        root $project_root;
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
}}"#,
        settings.nginx.port, domain_suffix, doc_root, doc_root, settings.php.port
    );

    // Ensure include directive is present
    if !patched.contains("include C:/kythia/bin/nginx/conf/sites-enabled/*.conf;") {
        let last_brace_re = Regex::new(r"\}\s*$").unwrap();
        patched = last_brace_re
            .replace(
                &patched,
                "    include C:/kythia/bin/nginx/conf/sites-enabled/*.conf;\n}",
            )
            .to_string();
    }

    // Replace the final '}' with our new server block + '}'
    if !patched.contains(&format!(
        "server_name  ~^(?<project>.+)\\.{}$",
        domain_suffix
    )) {
        let last_brace_re = Regex::new(r"\}\s*$").unwrap();
        patched = last_brace_re
            .replace(&patched, regex::NoExpand(vhost_block.as_str()))
            .to_string();
    }

    std::fs::write(&conf_path, patched.as_bytes()).map_err(|e| e.to_string())?;

    Ok(())
}

fn create_welcome_page() -> Result<(), String> {
    let settings = settings::get_settings().unwrap_or_default();
    let doc_root = PathBuf::from(&settings.document_root);

    if !doc_root.exists() {
        std::fs::create_dir_all(&doc_root).map_err(|e| e.to_string())?;
    }

    let index_html = doc_root.join("index.html");
    if !index_html.exists() {
        let html = include_str!("default_index.html");
        std::fs::write(&index_html, html).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Send `nginx -s stop` to gracefully shut down the master process.
pub fn stop(version: &str) -> Result<(), String> {
    let dir = bin_dir().join(version);
    let exe = dir.join("nginx.exe");

    if exe.exists() {
        std::process::Command::new(&exe)
            .args(["-s", "stop"])
            .current_dir(&dir)
            .creation_flags(0x08000000)
            .status()
            .map_err(|e| e.to_string())?;
    } else {
        let _ = std::process::Command::new("taskkill")
            .args(["/IM", "nginx.exe", "/F"])
            .creation_flags(0x08000000).stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null())
            .status();
    }
    Ok(())
}

pub fn get_logs(lines: usize) -> Vec<String> {
    let mut out = downloader::tail_file(&logs_dir().join("error.log"), lines);
    if out.is_empty() {
        out = downloader::tail_file(&logs_dir().join("access.log"), lines);
    }
    if out.is_empty() {
        out = vec!["[No Nginx logs yet. Start the server to generate logs.]".to_string()];
    }
    out
}

pub fn clear_logs() {
    crate::downloader::clear_file(&logs_dir().join("error.log"));
    crate::downloader::clear_file(&logs_dir().join("access.log"));
}

fn cmp_versions(a: &str, b: &str) -> std::cmp::Ordering {
    let parse = |s: &str| -> Vec<u32> { s.split('.').filter_map(|n| n.parse().ok()).collect() };
    parse(a).cmp(&parse(b))
}
