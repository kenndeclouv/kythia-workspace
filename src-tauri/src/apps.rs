use crate::downloader;
use crate::settings;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

#[tauri::command]
pub fn check_phpmyadmin() -> bool {
    let settings = settings::get_settings().unwrap_or_default();
    let doc_root = PathBuf::from(&settings.document_root);
    let pma_dir = doc_root.join("phpmyadmin");
    pma_dir.join("index.php").exists()
}

#[tauri::command]
pub async fn install_phpmyadmin(app: AppHandle) -> Result<String, String> {
    let version = "5.2.3"; // Hardcoded version
    let url = format!("https://files.phpmyadmin.net/phpMyAdmin/{}/phpMyAdmin-{}-all-languages.zip", version, version);
    
    let dl_dir = PathBuf::from("C:\\kythia\\downloads");
    fs::create_dir_all(&dl_dir).unwrap_or_default();
    
    let zip_path = dl_dir.join(format!("phpmyadmin-{}.zip", version));
    
    downloader::download_file(&app, "phpmyadmin", &url, &zip_path).await?;
    
    let settings = settings::get_settings().unwrap_or_default();
    let doc_root = PathBuf::from(&settings.document_root);
    let target_dir = doc_root.join("phpmyadmin");
    
    // Ensure document root exists
    fs::create_dir_all(&doc_root).map_err(|e| e.to_string())?;
    
    if target_dir.exists() {
        let _ = fs::remove_dir_all(&target_dir);
    }
    
    // strip_top_dir = true handles removing the top level directory from the zip
    downloader::extract_zip(&zip_path, &target_dir, true)?;
    
    // Configure phpMyAdmin to allow no password
    let sample_config = target_dir.join("config.sample.inc.php");
    let target_config = target_dir.join("config.inc.php");
    if sample_config.exists() {
        if let Ok(mut config_content) = fs::read_to_string(&sample_config) {
            config_content.push_str("\n$cfg['Servers'][$i]['AllowNoPassword'] = true;\n");
            let _ = fs::write(&target_config, config_content);
        }
    }
    
    let _ = fs::remove_file(&zip_path);
    
    Ok(format!("phpMyAdmin {} installed successfully", version))
}

#[tauri::command]
pub fn check_adminer() -> bool {
    let settings = settings::get_settings().unwrap_or_default();
    let doc_root = PathBuf::from(&settings.document_root);
    let adminer_dir = doc_root.join("adminer");
    adminer_dir.join("index.php").exists()
}

#[tauri::command]
pub async fn install_adminer(app: AppHandle) -> Result<String, String> {
    let version = "4.8.4";
    let url = format!("https://github.com/adminerevo/adminerevo/releases/download/v{}/adminer-{}.php", version, version);
    
    let dl_dir = PathBuf::from("C:\\kythia\\downloads");
    fs::create_dir_all(&dl_dir).unwrap_or_default();
    
    let php_path = dl_dir.join("adminer.php");
    
    downloader::download_file(&app, "adminer", &url, &php_path).await?;
    
    let settings = settings::get_settings().unwrap_or_default();
    let doc_root = PathBuf::from(&settings.document_root);
    let target_dir = doc_root.join("adminer");
    
    fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
    
    fs::copy(&php_path, target_dir.join("index.php")).map_err(|e| e.to_string())?;
    let _ = fs::remove_file(&php_path);
    
    Ok(format!("Adminer {} installed successfully", version))
}

#[tauri::command]
pub fn check_wordpress() -> bool {
    let settings = settings::get_settings().unwrap_or_default();
    let doc_root = PathBuf::from(&settings.document_root);
    let wp_dir = doc_root.join("wordpress");
    wp_dir.join("wp-login.php").exists()
}

#[tauri::command]
pub async fn install_wordpress(app: AppHandle) -> Result<String, String> {
    let url = "https://wordpress.org/latest.zip";
    
    let dl_dir = PathBuf::from("C:\\kythia\\downloads");
    fs::create_dir_all(&dl_dir).unwrap_or_default();
    
    let zip_path = dl_dir.join("wordpress.zip");
    
    downloader::download_file(&app, "wordpress", url, &zip_path).await?;
    
    let settings = settings::get_settings().unwrap_or_default();
    let doc_root = PathBuf::from(&settings.document_root);
    let target_dir = doc_root.join("wordpress");
    
    fs::create_dir_all(&doc_root).map_err(|e| e.to_string())?;
    
    if target_dir.exists() {
        let _ = fs::remove_dir_all(&target_dir);
    }
    
    // WordPress zip contains a "wordpress" folder, so strip_top_dir = true will extract its contents directly into our target_dir (which we also call wordpress)
    downloader::extract_zip(&zip_path, &target_dir, true)?;
    
    let _ = fs::remove_file(&zip_path);
    
    Ok("WordPress installed successfully".to_string())
}

#[tauri::command]
pub fn check_phpinfo() -> bool {
    let settings = settings::get_settings().unwrap_or_default();
    let doc_root = PathBuf::from(&settings.document_root);
    doc_root.join("info.php").exists()
}

#[tauri::command]
pub async fn install_phpinfo() -> Result<String, String> {
    let settings = settings::get_settings().unwrap_or_default();
    let doc_root = PathBuf::from(&settings.document_root);
    fs::create_dir_all(&doc_root).map_err(|e| e.to_string())?;
    
    let info_path = doc_root.join("info.php");
    fs::write(&info_path, "<?php phpinfo(); ?>").map_err(|e| e.to_string())?;
    
    Ok("PHP Info installed successfully".to_string())
}

#[tauri::command]
pub fn check_tinyfilemanager() -> bool {
    let settings = settings::get_settings().unwrap_or_default();
    let doc_root = PathBuf::from(&settings.document_root);
    let tfm_dir = doc_root.join("filemanager");
    tfm_dir.join("index.php").exists()
}

#[tauri::command]
pub async fn install_tinyfilemanager(app: AppHandle) -> Result<String, String> {
    let url = "https://raw.githubusercontent.com/prasathmani/tinyfilemanager/master/tinyfilemanager.php";
    
    let dl_dir = PathBuf::from("C:\\kythia\\downloads");
    fs::create_dir_all(&dl_dir).unwrap_or_default();
    
    let php_path = dl_dir.join("tinyfilemanager.php");
    
    downloader::download_file(&app, "tinyfilemanager", url, &php_path).await?;
    
    let settings = settings::get_settings().unwrap_or_default();
    let doc_root = PathBuf::from(&settings.document_root);
    let target_dir = doc_root.join("filemanager");
    
    fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
    
    fs::copy(&php_path, target_dir.join("index.php")).map_err(|e| e.to_string())?;
    let _ = fs::remove_file(&php_path);
    
    Ok("Tiny File Manager installed successfully".to_string())
}

#[tauri::command]
pub fn check_drupal() -> bool {
    let settings = settings::get_settings().unwrap_or_default();
    let doc_root = PathBuf::from(&settings.document_root);
    let drupal_dir = doc_root.join("drupal");
    drupal_dir.join("index.php").exists()
}

#[tauri::command]
pub async fn install_drupal(app: AppHandle) -> Result<String, String> {
    let url = "https://ftp.drupal.org/files/projects/drupal-11.1.0.zip";
    
    let dl_dir = PathBuf::from("C:\\kythia\\downloads");
    fs::create_dir_all(&dl_dir).unwrap_or_default();
    
    let zip_path = dl_dir.join("drupal.zip");
    
    downloader::download_file(&app, "drupal", url, &zip_path).await?;
    
    let settings = settings::get_settings().unwrap_or_default();
    let doc_root = PathBuf::from(&settings.document_root);
    let target_dir = doc_root.join("drupal");
    
    fs::create_dir_all(&doc_root).map_err(|e| e.to_string())?;
    
    if target_dir.exists() {
        let _ = fs::remove_dir_all(&target_dir);
    }
    
    // Drupal zip contains a top level folder, strip it
    downloader::extract_zip(&zip_path, &target_dir, true)?;
    
    let _ = fs::remove_file(&zip_path);
    
    Ok("Drupal installed successfully".to_string())
}

#[tauri::command]
pub fn check_joomla() -> bool {
    let settings = settings::get_settings().unwrap_or_default();
    let doc_root = PathBuf::from(&settings.document_root);
    let joomla_dir = doc_root.join("joomla");
    joomla_dir.join("administrator").exists()
}

#[tauri::command]
pub async fn install_joomla(app: AppHandle) -> Result<String, String> {
    let url = "https://github.com/joomla/joomla-cms/releases/download/5.0.3/Joomla_5.0.3-Stable-Full_Package.zip";
    
    let dl_dir = PathBuf::from("C:\\kythia\\downloads");
    fs::create_dir_all(&dl_dir).unwrap_or_default();
    
    let zip_path = dl_dir.join("joomla.zip");
    
    downloader::download_file(&app, "joomla", url, &zip_path).await?;
    
    let settings = settings::get_settings().unwrap_or_default();
    let doc_root = PathBuf::from(&settings.document_root);
    let target_dir = doc_root.join("joomla");
    
    fs::create_dir_all(&doc_root).map_err(|e| e.to_string())?;
    
    if target_dir.exists() {
        let _ = fs::remove_dir_all(&target_dir);
    }
    
    // Joomla zip does NOT contain a top level folder
    downloader::extract_zip(&zip_path, &target_dir, false)?;
    
    let _ = fs::remove_file(&zip_path);
    
    Ok("Joomla installed successfully".to_string())
}

#[tauri::command]
pub fn check_prestashop() -> bool {
    let settings = settings::get_settings().unwrap_or_default();
    let doc_root = PathBuf::from(&settings.document_root);
    let ps_dir = doc_root.join("prestashop");
    ps_dir.join("index.php").exists()
}

#[tauri::command]
pub async fn install_prestashop(app: AppHandle) -> Result<String, String> {
    let url = "https://github.com/PrestaShop/PrestaShop/releases/download/8.1.4/prestashop_8.1.4.zip";
    
    let dl_dir = PathBuf::from("C:\\kythia\\downloads");
    fs::create_dir_all(&dl_dir).unwrap_or_default();
    
    let zip_path = dl_dir.join("prestashop.zip");
    
    downloader::download_file(&app, "prestashop", url, &zip_path).await?;
    
    let settings = settings::get_settings().unwrap_or_default();
    let doc_root = PathBuf::from(&settings.document_root);
    let target_dir = doc_root.join("prestashop");
    
    fs::create_dir_all(&doc_root).map_err(|e| e.to_string())?;
    
    if target_dir.exists() {
        let _ = fs::remove_dir_all(&target_dir);
    }
    
    downloader::extract_zip(&zip_path, &target_dir, false)?;
    
    let _ = fs::remove_file(&zip_path);
    
    Ok("PrestaShop installed successfully".to_string())
}

#[tauri::command]
pub fn check_codeigniter() -> bool {
    let settings = settings::get_settings().unwrap_or_default();
    let doc_root = PathBuf::from(&settings.document_root);
    let ci_dir = doc_root.join("codeigniter");
    ci_dir.join("spark").exists()
}

#[tauri::command]
pub async fn install_codeigniter(app: AppHandle) -> Result<String, String> {
    let url = "https://github.com/codeigniter4/CodeIgniter4/releases/download/v4.4.6/framework-4.4.6.zip";
    
    let dl_dir = PathBuf::from("C:\\kythia\\downloads");
    fs::create_dir_all(&dl_dir).unwrap_or_default();
    
    let zip_path = dl_dir.join("codeigniter.zip");
    
    downloader::download_file(&app, "codeigniter", url, &zip_path).await?;
    
    let settings = settings::get_settings().unwrap_or_default();
    let doc_root = PathBuf::from(&settings.document_root);
    let target_dir = doc_root.join("codeigniter");
    
    fs::create_dir_all(&doc_root).map_err(|e| e.to_string())?;
    
    if target_dir.exists() {
        let _ = fs::remove_dir_all(&target_dir);
    }
    
    // CI zip contains a top level folder
    downloader::extract_zip(&zip_path, &target_dir, true)?;
    
    let _ = fs::remove_file(&zip_path);
    
    Ok("CodeIgniter installed successfully".to_string())
}

#[tauri::command]
pub fn check_opencart() -> bool {
    let settings = settings::get_settings().unwrap_or_default();
    let doc_root = PathBuf::from(&settings.document_root);
    let oc_dir = doc_root.join("opencart");
    oc_dir.join("index.php").exists()
}

#[tauri::command]
pub async fn install_opencart(app: AppHandle) -> Result<String, String> {
    let url = "https://github.com/opencart/opencart/releases/download/4.0.2.3/opencart-4.0.2.3.zip";
    
    let dl_dir = PathBuf::from("C:\\kythia\\downloads");
    fs::create_dir_all(&dl_dir).unwrap_or_default();
    
    let zip_path = dl_dir.join("opencart.zip");
    
    downloader::download_file(&app, "opencart", url, &zip_path).await?;
    
    let settings = settings::get_settings().unwrap_or_default();
    let doc_root = PathBuf::from(&settings.document_root);
    let target_dir = doc_root.join("opencart");
    
    fs::create_dir_all(&doc_root).map_err(|e| e.to_string())?;
    
    if target_dir.exists() {
        let _ = fs::remove_dir_all(&target_dir);
    }
    
    downloader::extract_zip(&zip_path, &target_dir, true)?;
    
    let _ = fs::remove_file(&zip_path);
    
    Ok("OpenCart installed successfully".to_string())
}

#[tauri::command]
pub fn check_matomo() -> bool {
    let settings = settings::get_settings().unwrap_or_default();
    let doc_root = PathBuf::from(&settings.document_root);
    doc_root.join("matomo").join("index.php").exists()
}

#[tauri::command]
pub async fn install_matomo(app: AppHandle) -> Result<String, String> {
    let url = "https://builds.matomo.org/matomo.zip";
    let dl_dir = PathBuf::from("C:\\kythia\\downloads");
    fs::create_dir_all(&dl_dir).unwrap_or_default();
    let zip_path = dl_dir.join("matomo.zip");
    downloader::download_file(&app, "matomo", url, &zip_path).await?;
    let doc_root = PathBuf::from(&settings::get_settings().unwrap_or_default().document_root);
    let target_dir = doc_root.join("matomo");
    if target_dir.exists() { let _ = fs::remove_dir_all(&target_dir); }
    fs::create_dir_all(&doc_root).map_err(|e| e.to_string())?;
    downloader::extract_zip(&zip_path, &target_dir, true)?;
    let _ = fs::remove_file(&zip_path);
    Ok("Matomo installed successfully".to_string())
}

#[tauri::command]
pub fn check_phpbb() -> bool {
    let doc_root = PathBuf::from(&settings::get_settings().unwrap_or_default().document_root);
    doc_root.join("phpbb").join("index.php").exists()
}

#[tauri::command]
pub async fn install_phpbb(app: AppHandle) -> Result<String, String> {
    let url = "https://download.phpbb.com/pub/release/3.3/3.3.11/phpBB-3.3.11.zip";
    let dl_dir = PathBuf::from("C:\\kythia\\downloads");
    fs::create_dir_all(&dl_dir).unwrap_or_default();
    let zip_path = dl_dir.join("phpbb.zip");
    downloader::download_file(&app, "phpbb", url, &zip_path).await?;
    let doc_root = PathBuf::from(&settings::get_settings().unwrap_or_default().document_root);
    let target_dir = doc_root.join("phpbb");
    if target_dir.exists() { let _ = fs::remove_dir_all(&target_dir); }
    fs::create_dir_all(&doc_root).map_err(|e| e.to_string())?;
    downloader::extract_zip(&zip_path, &target_dir, true)?;
    let _ = fs::remove_file(&zip_path);
    Ok("phpBB installed successfully".to_string())
}

#[tauri::command]
pub fn check_mediawiki() -> bool {
    let doc_root = PathBuf::from(&settings::get_settings().unwrap_or_default().document_root);
    doc_root.join("mediawiki").join("index.php").exists()
}

#[tauri::command]
pub async fn install_mediawiki(app: AppHandle) -> Result<String, String> {
    let url = "https://releases.wikimedia.org/mediawiki/1.41/mediawiki-1.41.0.zip";
    let dl_dir = PathBuf::from("C:\\kythia\\downloads");
    fs::create_dir_all(&dl_dir).unwrap_or_default();
    let zip_path = dl_dir.join("mediawiki.zip");
    downloader::download_file(&app, "mediawiki", url, &zip_path).await?;
    let doc_root = PathBuf::from(&settings::get_settings().unwrap_or_default().document_root);
    let target_dir = doc_root.join("mediawiki");
    if target_dir.exists() { let _ = fs::remove_dir_all(&target_dir); }
    fs::create_dir_all(&doc_root).map_err(|e| e.to_string())?;
    downloader::extract_zip(&zip_path, &target_dir, true)?;
    let _ = fs::remove_file(&zip_path);
    Ok("MediaWiki installed successfully".to_string())
}

#[tauri::command]
pub fn check_opcachegui() -> bool {
    let doc_root = PathBuf::from(&settings::get_settings().unwrap_or_default().document_root);
    doc_root.join("opcache.php").exists()
}

#[tauri::command]
pub async fn install_opcachegui(app: AppHandle) -> Result<String, String> {
    let url = "https://raw.githubusercontent.com/amnuts/opcache-gui/master/index.php";
    let dl_dir = PathBuf::from("C:\\kythia\\downloads");
    fs::create_dir_all(&dl_dir).unwrap_or_default();
    let php_path = dl_dir.join("opcache.php");
    downloader::download_file(&app, "opcachegui", url, &php_path).await?;
    let doc_root = PathBuf::from(&settings::get_settings().unwrap_or_default().document_root);
    fs::create_dir_all(&doc_root).map_err(|e| e.to_string())?;
    fs::copy(&php_path, doc_root.join("opcache.php")).map_err(|e| e.to_string())?;
    let _ = fs::remove_file(&php_path);
    Ok("Opcache GUI installed successfully".to_string())
}
