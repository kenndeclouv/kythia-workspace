use std::fs;
use std::path::PathBuf;
use std::time::SystemTime;

pub fn get_cache_path(key: &str) -> PathBuf {
    let dir = PathBuf::from("C:\\kythia\\data\\cache");
    let _ = fs::create_dir_all(&dir);
    dir.join(format!("{}.json", key))
}

pub fn get_cached(key: &str) -> Option<String> {
    let path = get_cache_path(key);
    if !path.exists() {
        return None;
    }

    if let Ok(metadata) = fs::metadata(&path) {
        if let Ok(modified) = metadata.modified() {
            let now = SystemTime::now();
            if let Ok(duration) = now.duration_since(modified) {
                // 24 hours = 86400 seconds
                if duration.as_secs() < 86400 {
                    if let Ok(content) = fs::read_to_string(&path) {
                        return Some(content);
                    }
                }
            }
        }
    }
    None
}

pub fn set_cached(key: &str, content: &str) {
    let path = get_cache_path(key);
    let _ = fs::write(path, content);
}

pub fn clear_all() {
    let dir = PathBuf::from("C:\\kythia\\data\\cache");
    let _ = fs::remove_dir_all(&dir);
    let _ = fs::create_dir_all(&dir);
}
