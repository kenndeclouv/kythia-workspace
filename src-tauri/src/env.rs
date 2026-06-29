use std::os::windows::process::CommandExt;
use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_WRITE};
use winreg::RegKey;

fn get_user_path() -> Result<String, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let env = hkcu
        .open_subkey_with_flags("Environment", KEY_READ)
        .map_err(|e| e.to_string())?;

    let path: String = env.get_value("Path").unwrap_or_default();
    Ok(path)
}

fn set_user_path(path: &str) -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let env = hkcu
        .open_subkey_with_flags("Environment", KEY_READ | KEY_WRITE)
        .map_err(|e| e.to_string())?;

    env.set_value("Path", &path).map_err(|e| e.to_string())?;

    // Trigger environment update broadcast by calling setx with a dummy variable
    let _ = std::process::Command::new("setx")
        .args(["KYTHIA_ENV_SYNC", "1"])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .status();

    Ok(())
}

#[tauri::command]
pub fn add_to_path(service: &str, exact_path: &str) -> Result<(), String> {
    let current_path = get_user_path()?;

    let service_prefix = format!("C:\\kythia\\bin\\{}", service).to_lowercase();

    // Filter out old kythia paths for this service
    let mut paths: Vec<String> = current_path
        .split(';')
        .filter(|p| !p.trim().is_empty())
        .map(|p| p.to_string())
        .filter(|p| !p.to_lowercase().starts_with(&service_prefix))
        .collect();

    // Prepend the new path
    paths.insert(0, exact_path.to_string());

    let new_path = paths.join(";");
    set_user_path(&new_path)?;

    Ok(())
}

#[tauri::command]
pub fn remove_from_path(service: &str) -> Result<(), String> {
    let current_path = get_user_path()?;
    let service_prefix = format!("C:\\kythia\\bin\\{}", service).to_lowercase();

    let paths: Vec<String> = current_path
        .split(';')
        .filter(|p| !p.trim().is_empty())
        .map(|p| p.to_string())
        .filter(|p| !p.to_lowercase().starts_with(&service_prefix))
        .collect();

    let new_path = paths.join(";");
    set_user_path(&new_path)?;

    Ok(())
}

#[tauri::command]
pub fn get_path_status(exact_path: &str) -> Result<bool, String> {
    let current_path = get_user_path()?;
    let exact_lower = exact_path.to_lowercase();

    let exists = current_path
        .split(';')
        .any(|p| p.to_lowercase().trim() == exact_lower.trim());

    Ok(exists)
}
