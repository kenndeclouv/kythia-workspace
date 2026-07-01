#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod apps;
mod cache;
mod downloader;
mod gamification;
mod hosts;
mod mailpit;
mod mariadb;
mod mongodb;
mod mysql;
mod nginx;
mod ngrok;
mod packages;
mod php;
mod postgres;
mod projects;
mod redis;
mod settings;
mod sites;
mod state;
mod system;

use serde::Serialize;
use state::AppState;
use tauri::{AppHandle, State};

// ────────────────────────────────────────────────────────────────
// Shared response types
// ────────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct ServiceStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub port: Option<u16>,
}

#[derive(Serialize)]
pub struct PortConflict {
    pub service: String,
    pub port: u16,
    pub process_name: String,
    pub pid: String,
}

#[tauri::command]
fn check_port_conflicts() -> Vec<PortConflict> {
    let mut conflicts = Vec::new();
    let s = settings::get_settings().unwrap_or_default();

    let checks = vec![
        ("Nginx", s.nginx.port),
        ("PHP FastCGI", s.php.port),
        ("Database", s.mariadb.port),
        ("PostgreSQL", s.postgres.port),
        ("MongoDB", s.mongodb.port),
        ("Redis", s.redis.port),
        ("Mailpit SMTP", s.mailpit.smtp_port),
        ("Mailpit UI", s.mailpit.ui_port),
    ];

    for (service, port) in checks {
        if !downloader::is_port_in_use(port) {
            continue;
        }

        if let Some((proc_name, pid)) = downloader::get_conflicting_process(port) {
            let lower_proc = proc_name.to_lowercase();
            if lower_proc.contains("nginx")
                || lower_proc.contains("php-cgi")
                || lower_proc.contains("mariadbd")
                || lower_proc.contains("mysqld")
                || lower_proc.contains("postgres")
                || lower_proc.contains("mongod")
                || lower_proc.contains("redis-server")
                || lower_proc.contains("mailpit")
                || lower_proc.contains("kythia")
            {
                continue;
            }

            conflicts.push(PortConflict {
                service: service.to_string(),
                port,
                process_name: proc_name,
                pid,
            });
        }
    }

    conflicts
}

// ────────────────────────────────────────────────────────────────
// Version fetching (hits official sites)
// ────────────────────────────────────────────────────────────────

#[tauri::command]
async fn fetch_nginx_versions() -> Result<Vec<String>, String> {
    nginx::fetch_versions().await
}

#[tauri::command]
async fn fetch_php_versions() -> Result<Vec<php::PhpRelease>, String> {
    php::fetch_versions().await
}

#[tauri::command]
async fn fetch_mariadb_versions() -> Result<Vec<mariadb::MariaDbRelease>, String> {
    mariadb::fetch_versions().await
}

#[tauri::command]
async fn fetch_mysql_versions() -> Result<Vec<mysql::MysqlRelease>, String> {
    mysql::fetch_versions().await
}

#[tauri::command]
async fn fetch_postgres_versions() -> Result<Vec<postgres::PostgresRelease>, String> {
    postgres::fetch_versions().await
}

#[tauri::command]
async fn fetch_mongodb_versions() -> Result<Vec<mongodb::MongodbRelease>, String> {
    mongodb::fetch_versions().await
}

#[tauri::command]
async fn fetch_mailpit_versions() -> Result<Vec<String>, String> {
    mailpit::fetch_versions().await
}

#[tauri::command]
fn clear_all_cache() {
    cache::clear_all();
}

// ────────────────────────────────────────────────────────────────
// Installed versions (local filesystem scan)
// ────────────────────────────────────────────────────────────────

#[tauri::command]
fn get_installed_nginx() -> Vec<String> {
    nginx::get_installed()
}

#[tauri::command]
fn get_installed_php() -> Vec<String> {
    php::get_installed()
}

#[tauri::command]
fn get_installed_mariadb() -> Vec<String> {
    mariadb::get_installed()
}

#[tauri::command]
fn get_installed_mysql() -> Vec<String> {
    mysql::get_installed()
}

#[tauri::command]
fn get_installed_postgres() -> Vec<String> {
    postgres::get_installed()
}

#[tauri::command]
fn get_installed_mongodb() -> Vec<String> {
    mongodb::get_installed()
}

#[tauri::command]
fn get_installed_mailpit() -> Vec<String> {
    mailpit::get_installed()
}

// ────────────────────────────────────────────────────────────────
// Installation (download + extract + configure)
// ────────────────────────────────────────────────────────────────

#[tauri::command]
async fn install_nginx(app: AppHandle, version: String) -> Result<String, String> {
    nginx::install(&app, &version).await
}

#[tauri::command]
async fn install_php(app: AppHandle, version: String, url: String) -> Result<String, String> {
    php::install(&app, &version, &url).await
}

#[tauri::command]
async fn install_mariadb(app: AppHandle, version: String, url: String) -> Result<String, String> {
    mariadb::install(&app, &version, &url).await
}

#[tauri::command]
async fn install_mysql(app: AppHandle, version: String, url: String) -> Result<String, String> {
    mysql::install(&app, &version, &url).await
}

#[tauri::command]
async fn install_postgres(app: AppHandle, version: String, url: String) -> Result<String, String> {
    postgres::install(&app, &version, &url).await
}

#[tauri::command]
async fn install_mongodb(app: AppHandle, version: String, url: String) -> Result<String, String> {
    mongodb::install(&app, &version, &url).await
}

#[tauri::command]
async fn install_mailpit(app: AppHandle, version: String) -> Result<String, String> {
    mailpit::install(&app, &version).await
}

// ────────────────────────────────────────────────────────────────
// MariaDB – initialize data directory
// ────────────────────────────────────────────────────────────────


#[tauri::command]
fn init_mariadb(version: String) -> Result<String, String> {
    mariadb::initialize(&version)
}

#[tauri::command]
fn is_mariadb_initialized() -> bool {
    mariadb::is_initialized()
}

#[tauri::command]
fn init_mysql(version: String) -> Result<String, String> {
    mysql::initialize(&version)
}

#[tauri::command]
fn is_mysql_initialized() -> bool {
    mysql::is_initialized()
}

#[tauri::command]
fn init_postgres(version: String) -> Result<String, String> {
    postgres::initialize(&version)
}

#[tauri::command]
fn is_postgres_initialized() -> bool {
    postgres::is_initialized()
}

#[tauri::command]
fn init_mongodb(version: String) -> Result<String, String> {
    mongodb::initialize(&version)
}

#[tauri::command]
fn is_mongodb_initialized() -> bool {
    mongodb::is_initialized()
}

// ────────────────────────────────────────────────────────────────
// Start services
// ────────────────────────────────────────────────────────────────

#[tauri::command]
fn start_nginx(state: State<'_, AppState>, version: String) -> Result<(), String> {
    nginx::start(&version)?;
    let mut pids = state.pids.lock().unwrap();
    pids.insert("nginx".to_string(), 0);
    Ok(())
}

#[tauri::command]
fn start_php(state: State<'_, AppState>, version: String) -> Result<(), String> {
    let pid = php::start(&version)?;
    let mut pids = state.pids.lock().unwrap();
    pids.insert("php".to_string(), pid);
    Ok(())
}

#[tauri::command]
fn start_mariadb(state: State<'_, AppState>, version: String) -> Result<(), String> {
    let pid = mariadb::start(&version)?;
    let mut pids = state.pids.lock().unwrap();
    pids.insert("mariadb".to_string(), pid);
    Ok(())
}

#[tauri::command]
fn start_mysql(state: State<'_, AppState>, version: String) -> Result<(), String> {
    let pid = mysql::start(&version)?;
    let mut pids = state.pids.lock().unwrap();
    pids.insert("mysql".to_string(), pid);
    Ok(())
}

#[tauri::command]
fn start_postgres(state: State<'_, AppState>, version: String) -> Result<(), String> {
    let pid = postgres::start(&version)?;
    let mut pids = state.pids.lock().unwrap();
    pids.insert("postgres".to_string(), pid);
    Ok(())
}

#[tauri::command]
fn start_mongodb(state: State<'_, AppState>, version: String) -> Result<(), String> {
    let pid = mongodb::start(&version)?;
    let mut pids = state.pids.lock().unwrap();
    pids.insert("mongodb".to_string(), pid);
    Ok(())
}

#[tauri::command]
fn start_mailpit(state: State<'_, AppState>, version: String) -> Result<(), String> {
    mailpit::start(&version)?;
    let mut pids = state.pids.lock().unwrap();
    pids.insert("mailpit".to_string(), 0);
    Ok(())
}

// ────────────────────────────────────────────────────────────────
// Stop services
// ────────────────────────────────────────────────────────────────

#[tauri::command]
fn stop_nginx(state: State<'_, AppState>, version: String) -> Result<(), String> {
    nginx::stop(&version)?;
    let mut pids = state.pids.lock().unwrap();
    pids.remove("nginx");
    Ok(())
}

#[tauri::command]
fn stop_php(state: State<'_, AppState>) -> Result<(), String> {
    let pid = {
        let pids = state.pids.lock().unwrap();
        pids.get("php").copied()
    };
    php::stop(pid)?;
    let mut pids = state.pids.lock().unwrap();
    pids.remove("php");
    Ok(())
}

#[tauri::command]
fn stop_mariadb(state: State<'_, AppState>) -> Result<(), String> {
    let pid = {
        let pids = state.pids.lock().unwrap();
        pids.get("mariadb").copied()
    };
    mariadb::stop(pid)?;
    let mut pids = state.pids.lock().unwrap();
    pids.remove("mariadb");
    Ok(())
}

#[tauri::command]
fn stop_mysql(state: State<'_, AppState>) -> Result<(), String> {
    let pid = {
        let pids = state.pids.lock().unwrap();
        pids.get("mysql").copied()
    };
    mysql::stop(pid)?;
    let mut pids = state.pids.lock().unwrap();
    pids.remove("mysql");
    Ok(())
}

#[tauri::command]
fn stop_postgres(state: State<'_, AppState>) -> Result<(), String> {
    let pid = {
        let pids = state.pids.lock().unwrap();
        pids.get("postgres").copied()
    };
    postgres::stop(pid)?;
    let mut pids = state.pids.lock().unwrap();
    pids.remove("postgres");
    Ok(())
}

#[tauri::command]
fn stop_mongodb(state: State<'_, AppState>) -> Result<(), String> {
    let pid = {
        let pids = state.pids.lock().unwrap();
        pids.get("mongodb").copied()
    };
    mongodb::stop(pid)?;
    let mut pids = state.pids.lock().unwrap();
    pids.remove("mongodb");
    Ok(())
}

#[tauri::command]
fn stop_mailpit(state: State<'_, AppState>, version: String) -> Result<(), String> {
    mailpit::stop(&version)?;
    let mut pids = state.pids.lock().unwrap();
    pids.remove("mailpit");
    Ok(())
}

// ────────────────────────────────────────────────────────────────
// Live status (polled from the frontend every 2 s)
// ────────────────────────────────────────────────────────────────

#[tauri::command]
fn get_nginx_status(state: State<'_, AppState>) -> ServiceStatus {
    let running = nginx::is_running();
    if !running {
        let mut pids = state.pids.lock().unwrap();
        pids.remove("nginx");
    }
    ServiceStatus {
        running,
        pid: None,
        port: if running {
            let p = settings::get_settings().map(|s| s.nginx.port).unwrap_or(80);
            Some(p)
        } else {
            None
        },
    }
}

#[tauri::command]
fn get_php_status(state: State<'_, AppState>) -> ServiceStatus {
    let running = php::is_running();
    let pid = {
        let pids = state.pids.lock().unwrap();
        pids.get("php").copied()
    };
    if !running {
        let mut pids = state.pids.lock().unwrap();
        pids.remove("php");
    }
    ServiceStatus {
        running,
        pid: if running { pid } else { None },
        port: if running {
            let p = settings::get_settings().map(|s| s.php.port).unwrap_or(8080);
            Some(p)
        } else {
            None
        },
    }
}

#[tauri::command]
fn get_mariadb_status(state: State<'_, AppState>) -> ServiceStatus {
    let running = mariadb::is_running();
    let pid = {
        let pids = state.pids.lock().unwrap();
        pids.get("mariadb").copied()
    };
    if !running {
        let mut pids = state.pids.lock().unwrap();
        pids.remove("mariadb");
    }
    ServiceStatus {
        running,
        pid: if running { pid } else { None },
        port: if running {
            let p = settings::get_settings()
                .map(|s| s.mariadb.port)
                .unwrap_or(3306);
            Some(p)
        } else {
            None
        },
    }
}

#[tauri::command]
fn get_mysql_status(state: State<'_, AppState>) -> ServiceStatus {
    let running = mysql::is_running();
    let pid = {
        let pids = state.pids.lock().unwrap();
        pids.get("mysql").copied()
    };
    if !running {
        let mut pids = state.pids.lock().unwrap();
        pids.remove("mysql");
    }
    ServiceStatus {
        running,
        pid: if running { pid } else { None },
        port: if running {
            let p = settings::get_settings()
                .map(|s| s.mariadb.port)
                .unwrap_or(3306);
            Some(p)
        } else {
            None
        },
    }
}

#[tauri::command]
fn get_postgres_status(state: State<'_, AppState>) -> ServiceStatus {
    let running = postgres::is_running();
    let pid = {
        let pids = state.pids.lock().unwrap();
        pids.get("postgres").copied()
    };
    if !running {
        let mut pids = state.pids.lock().unwrap();
        pids.remove("postgres");
    }
    ServiceStatus {
        running,
        pid: if running { pid } else { None },
        port: if running {
            let p = settings::get_settings()
                .map(|s| s.postgres.port)
                .unwrap_or(5432);
            Some(p)
        } else {
            None
        },
    }
}

#[tauri::command]
fn get_mongodb_status(state: State<'_, AppState>) -> ServiceStatus {
    let running = mongodb::is_running();
    let pid = {
        let pids = state.pids.lock().unwrap();
        pids.get("mongodb").copied()
    };
    if !running {
        let mut pids = state.pids.lock().unwrap();
        pids.remove("mongodb");
    }
    ServiceStatus {
        running,
        pid: if running { pid } else { None },
        port: if running {
            let p = settings::get_settings()
                .map(|s| s.mongodb.port)
                .unwrap_or(27017);
            Some(p)
        } else {
            None
        },
    }
}

#[tauri::command]
fn start_redis(state: State<'_, AppState>, version: String) -> Result<(), String> {
    let pid = redis::start(&version)?;
    let mut pids = state.pids.lock().unwrap();
    pids.insert("redis".to_string(), pid);
    Ok(())
}

#[tauri::command]
fn stop_redis(state: State<'_, AppState>) -> Result<(), String> {
    let pid = {
        let pids = state.pids.lock().unwrap();
        pids.get("redis").copied()
    };
    redis::stop(pid)?;
    let mut pids = state.pids.lock().unwrap();
    pids.remove("redis");
    Ok(())
}

#[tauri::command]
fn get_redis_status(state: State<'_, AppState>) -> ServiceStatus {
    let running = redis::is_running();
    let pid = {
        let pids = state.pids.lock().unwrap();
        pids.get("redis").copied()
    };
    if !running {
        let mut pids = state.pids.lock().unwrap();
        pids.remove("redis");
    }
    ServiceStatus {
        running,
        pid: if running { pid } else { None },
        port: if running { Some(6379) } else { None },
    }
}

#[tauri::command]
fn get_mailpit_status(state: State<'_, AppState>) -> ServiceStatus {
    let running = mailpit::is_running();
    let pid = {
        let pids = state.pids.lock().unwrap();
        pids.get("mailpit").copied()
    };
    if !running {
        let mut pids = state.pids.lock().unwrap();
        pids.remove("mailpit");
    }
    ServiceStatus {
        running,
        pid: if running { pid } else { None },
        port: if running { Some(1025) } else { None },
    }
}

#[derive(Serialize)]
pub struct AllServicesStatus {
    pub nginx: ServiceStatus,
    pub php: ServiceStatus,
    pub mariadb: ServiceStatus,
    pub mysql: ServiceStatus,
    pub postgres: ServiceStatus,
    pub mongodb: ServiceStatus,
    pub redis: ServiceStatus,
    pub mailpit: ServiceStatus,
    pub conflicts: Vec<PortConflict>,
}

#[tauri::command]
async fn get_all_services_status(state: State<'_, AppState>) -> Result<AllServicesStatus, ()> {
    Ok(AllServicesStatus {
        nginx: get_nginx_status(state.clone()),
        php: get_php_status(state.clone()),
        mariadb: get_mariadb_status(state.clone()),
        mysql: get_mysql_status(state.clone()),
        postgres: get_postgres_status(state.clone()),
        mongodb: get_mongodb_status(state.clone()),
        redis: get_redis_status(state.clone()),
        mailpit: get_mailpit_status(state.clone()),
        conflicts: check_port_conflicts(),
    })
}

// ────────────────────────────────────────────────────────────────
// Log viewer
// ────────────────────────────────────────────────────────────────

#[tauri::command]
fn get_nginx_logs(lines: usize) -> Vec<String> {
    nginx::get_logs(lines)
}

#[tauri::command]
fn get_mariadb_logs(lines: usize) -> Vec<String> {
    mariadb::get_logs(lines)
}

#[tauri::command]
fn get_mysql_logs(lines: usize) -> Vec<String> {
    mysql::get_logs(lines)
}

#[tauri::command]
fn get_postgres_logs(lines: usize) -> Vec<String> {
    postgres::get_logs(lines)
}

#[tauri::command]
fn get_mongodb_logs(lines: usize) -> Vec<String> {
    mongodb::get_logs(lines)
}

#[tauri::command]
fn get_php_logs(lines: usize) -> Vec<String> {
    php::get_logs(lines)
}

#[tauri::command]
fn get_redis_logs(lines: usize) -> Vec<String> {
    redis::get_logs(lines)
}

#[tauri::command]
fn clear_nginx_logs() {
    nginx::clear_logs();
}

#[tauri::command]
fn clear_mariadb_logs() {
    mariadb::clear_logs();
}

#[tauri::command]
fn clear_mysql_logs() {
    mysql::clear_logs();
}

#[tauri::command]
fn clear_postgres_logs() {
    postgres::clear_logs();
}

#[tauri::command]
fn clear_mongodb_logs() {
    mongodb::clear_logs();
}

#[tauri::command]
fn clear_php_logs() {
    php::clear_logs();
}

#[tauri::command]
fn clear_redis_logs() {
    redis::clear_logs();
}

#[tauri::command]
fn show_main_window(app: tauri::AppHandle, tab: Option<String>) {
    if let Some(window) = app.get_webview_window("main") {
        if let Some(t) = tab {
            let _ = window.emit("navigate", t);
        }
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

// ────────────────────────────────────────────────────────────────
// Entry point
// ────────────────────────────────────────────────────────────────

mod env;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .manage(AppState::new())
        .manage(system::SysState(std::sync::Mutex::new(sysinfo::System::new_all())))
        .setup(|app| {
            gamification::start_time_tracker(app.handle().clone());
            gamification::start_git_watcher(app.handle().clone());

            let quit_i = MenuItem::with_id(app, "quit", "Quit Kythia", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show Workspace", true, None::<&str>)?;
            let start_all_i =
                MenuItem::with_id(app, "start_all", "Start All Services", true, None::<&str>)?;
            let stop_all_i =
                MenuItem::with_id(app, "stop_all", "Stop All Services", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show_i, &start_all_i, &stop_all_i, &quit_i])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Kythia Workspace")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        std::process::exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "start_all" => {
                        // Normally we would invoke the logic directly, but for now we'll just show the window
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "stop_all" => {
                        // same here
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } => {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("tray") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                if let Ok(Some(rect)) = tray.rect() {
                                    let win_size = window
                                        .outer_size()
                                        .unwrap_or(tauri::PhysicalSize::new(320, 480));

                                    let tray_x = match rect.position {
                                        tauri::Position::Physical(p) => p.x as i32,
                                        tauri::Position::Logical(p) => p.x as i32,
                                    };
                                    let tray_y = match rect.position {
                                        tauri::Position::Physical(p) => p.y as i32,
                                        tauri::Position::Logical(p) => p.y as i32,
                                    };
                                    let tray_width = match rect.size {
                                        tauri::Size::Physical(s) => s.width as i32,
                                        tauri::Size::Logical(s) => s.width as i32,
                                    };

                                    // Calculate center of tray icon
                                    let tray_center_x = tray_x + (tray_width / 2);
                                    let x = tray_center_x - (win_size.width as i32 / 2);
                                    let y = tray_y - win_size.height as i32 - 10;

                                    // clamp to screen if monitor available
                                    let (final_x, final_y) = if let Ok(Some(monitor)) =
                                        window.current_monitor()
                                    {
                                        let screen_size = monitor.size();
                                        (
                                            x.clamp(
                                                0,
                                                (screen_size.width as i32 - win_size.width as i32)
                                                    .max(0),
                                            ),
                                            y.clamp(
                                                0,
                                                (screen_size.height as i32
                                                    - win_size.height as i32)
                                                    .max(0),
                                            ),
                                        )
                                    } else {
                                        (x, y)
                                    };

                                    let _ = window.set_position(tauri::PhysicalPosition::new(
                                        final_x, final_y,
                                    ));
                                }
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if window.label() == "main" {
                    let settings = settings::get_settings().unwrap_or_default();
                    if settings.close_to_tray {
                        window.hide().unwrap();
                        api.prevent_close();
                    } else {
                        window.app_handle().exit(0);
                    }
                }
            }
            tauri::WindowEvent::Focused(focused) => {
                if !focused && window.label() == "tray" {
                    let _ = window.hide();
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            check_port_conflicts,
            fetch_nginx_versions,
            fetch_php_versions,
            fetch_mariadb_versions,
            fetch_mysql_versions,
            fetch_postgres_versions,
            fetch_mongodb_versions,
            fetch_mailpit_versions,
            clear_all_cache,
            system::get_system_stats,
            get_installed_nginx,
            get_all_services_status,
            get_installed_php,
            get_installed_mariadb,
            get_installed_mysql,
            get_installed_postgres,
            get_installed_mongodb,
            get_installed_mailpit,
            install_nginx,
            install_php,
            install_mariadb,
            install_mysql,
            install_postgres,
            install_mongodb,
            install_mailpit,
            init_mariadb,
            is_mariadb_initialized,
            init_mysql,
            is_mysql_initialized,
            init_postgres,
            is_postgres_initialized,
            init_mongodb,
            is_mongodb_initialized,
            start_nginx,
            start_php,
            start_mariadb,
            start_mysql,
            start_postgres,
            start_mongodb,
            start_mailpit,
            stop_nginx,
            stop_php,
            stop_mariadb,
            stop_mysql,
            stop_postgres,
            stop_mongodb,
            stop_mailpit,
            settings::get_settings,
            settings::save_settings,
            get_nginx_status,
            get_php_status,
            get_mariadb_status,
            get_mysql_status,
            get_postgres_status,
            get_mongodb_status,
            get_mailpit_status,
            get_nginx_logs,
            get_mariadb_logs,
            get_mysql_logs,
            get_postgres_logs,
            get_mongodb_logs,
            get_php_logs,
            get_redis_logs,
            clear_nginx_logs,
            clear_mariadb_logs,
            clear_mysql_logs,
            clear_postgres_logs,
            clear_mongodb_logs,
            clear_php_logs,
            clear_redis_logs,
            show_main_window,
            php::get_php_ini_content,
            php::save_php_ini_content,
            env::add_to_path,
            env::remove_from_path,
            env::get_path_status,
            packages::fetch_node_versions,
            packages::fetch_bun_versions,
            packages::get_installed_node,
            packages::get_installed_bun,
            packages::get_installed_composer,
            packages::install_node,
            packages::install_bun,
            packages::install_composer,
            packages::get_installed_wp_cli,
            packages::install_wp_cli,
            packages::fetch_meilisearch_versions,
            packages::get_installed_meilisearch,
            packages::install_meilisearch,
            packages::fetch_deno_versions,
            packages::get_installed_deno,
            packages::install_deno,
            packages::get_installed_pnpm,
            packages::install_pnpm,
            packages::get_installed_yarn,
            packages::install_yarn,
            apps::check_phpmyadmin,
            apps::install_phpmyadmin,
            apps::check_adminer,
            apps::install_adminer,
            apps::check_wordpress,
            apps::install_wordpress,
            apps::check_phpinfo,
            apps::install_phpinfo,
            apps::check_tinyfilemanager,
            apps::install_tinyfilemanager,
            apps::check_drupal,
            apps::install_drupal,
            apps::check_joomla,
            apps::install_joomla,
            apps::check_prestashop,
            apps::install_prestashop,
            apps::check_codeigniter,
            apps::install_codeigniter,
            apps::check_opencart,
            apps::install_opencart,
            apps::check_matomo,
            apps::install_matomo,
            apps::check_phpbb,
            apps::install_phpbb,
            apps::check_mediawiki,
            apps::install_mediawiki,
            apps::check_opcachegui,
            apps::install_opcachegui,
            redis::fetch_versions,
            redis::get_installed_redis,
            redis::install_redis,
            start_redis,
            stop_redis,
            get_redis_status,
            sites::list_sites,
            sites::secure_site,
            sites::unsecure_site,
            ngrok::share_site,
            ngrok::stop_share,
            ngrok::get_shared_sites,
            projects::create_project,
            quit_app,
            gamification::get_gamification_data,
            gamification::add_xp,
            gamification::add_coins,
            gamification::unlock_achievement,
            gamification::purchase_item,
            gamification::equip_theme,
            gamification::equip_sound,
            gamification::equip_badge,
            gamification::delete_account,
            gamification::update_profile,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}

#[tauri::command]
fn quit_app() {
    std::process::exit(0);
}
