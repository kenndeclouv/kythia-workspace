use std::collections::HashMap;
use std::sync::Mutex;

/// Holds the PID of each running service (nginx, php, mariadb).
pub struct AppState {
    pub pids: Mutex<HashMap<String, u32>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            pids: Mutex::new(HashMap::new()),
        }
    }
}
