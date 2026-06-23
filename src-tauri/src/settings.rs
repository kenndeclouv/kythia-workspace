use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NginxSettings {
    pub port: u16,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PhpSettings {
    pub port: u16,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MariaDbSettings {
    pub port: u16,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PostgresSettings {
    pub port: u16,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MongodbSettings {
    pub port: u16,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RedisSettings {
    pub port: u16,
    pub user: Option<String>,
    pub password: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MailpitSettings {
    pub smtp_port: u16,
    pub ui_port: u16,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default)]
pub struct AppSettings {
    pub document_root: String,
    pub nginx: NginxSettings,
    pub php: PhpSettings,
    pub mariadb: MariaDbSettings,
    pub postgres: PostgresSettings,
    pub mongodb: MongodbSettings,
    pub redis: RedisSettings,
    pub mailpit: MailpitSettings,
    pub appearance: String,
    pub autostart: bool,
    pub close_to_tray: bool,
    pub minimize_to_tray: bool,
    pub active_database_engine: String,
    pub active_php_version: Option<String>,
    pub active_mariadb_version: Option<String>,
    pub active_mysql_version: Option<String>,
    pub active_postgres_version: Option<String>,
    pub active_mongodb_version: Option<String>,
    pub active_redis_version: Option<String>,
    pub local_domain: String,
    pub ngrok_auth_token: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            document_root: "C:\\kythia\\www".to_string(),
            nginx: NginxSettings {
                port: 80,
            },
            php: PhpSettings {
                port: 8080,
            },
            mariadb: MariaDbSettings {
                port: 3306,
            },
            postgres: PostgresSettings {
                port: 5432,
            },
            mongodb: MongodbSettings {
                port: 27017,
            },
            redis: RedisSettings {
                port: 6379,
                user: None,
                password: None,
            },
            mailpit: MailpitSettings {
                smtp_port: 1025,
                ui_port: 8025,
            },
            appearance: "dark".to_string(),
            autostart: false,
            close_to_tray: true,
            minimize_to_tray: false,
            active_database_engine: "mysql".to_string(),
            active_php_version: None,
            active_mariadb_version: None,
            active_mysql_version: None,
            active_postgres_version: None,
            active_mongodb_version: None,
            active_redis_version: None,
            local_domain: "test".to_string(),
            ngrok_auth_token: None,
        }
    }
}

pub fn get_settings_path() -> PathBuf {
    PathBuf::from("C:\\kythia\\data\\settings.json")
}

#[tauri::command]
pub fn get_settings() -> Result<AppSettings, String> {
    let path = get_settings_path();
    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let content = fs::read_to_string(&path).map_err(|e| format!("Failed to read settings: {}", e))?;
    let settings: AppSettings = serde_json::from_str(&content).unwrap_or_default();
    Ok(settings)
}

use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = get_settings_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    
    fs::write(&path, content).map_err(|e| format!("Failed to write settings: {}", e))?;

    // Apply autostart logic
    let autolaunch = app.autolaunch();
    if settings.autostart {
        let _ = autolaunch.enable();
    } else {
        let _ = autolaunch.disable();
    }

    Ok(())
}
