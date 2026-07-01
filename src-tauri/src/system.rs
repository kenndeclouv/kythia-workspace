use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use sysinfo::System;
use tauri::State;

pub struct SysState(pub Mutex<System>);

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct ProcessStats {
    pub memory: u64,
    pub cpu: f32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SystemStats {
    pub total_memory: u64,
    pub used_memory: u64,
    pub cpu_usage: f32,
    pub services_usage: HashMap<String, ProcessStats>,
}

#[tauri::command]
pub async fn get_system_stats(state: State<'_, SysState>) -> Result<SystemStats, ()> {
    let mut sys = state.0.lock().unwrap();
    sys.refresh_all();

    let cpu_usage = sys.global_cpu_usage();
    let total_memory = sys.total_memory();
    let used_memory = sys.used_memory();
    
    let mut services_usage = HashMap::new();
    let keys = vec!["nginx", "php", "mariadb", "mysql", "postgres", "mongodb", "redis", "mailpit"];
    for k in keys {
        services_usage.insert(k.to_string(), ProcessStats::default());
    }

    for (_pid, process) in sys.processes() {
        let name = process.name().to_string_lossy().to_lowercase();
        let mem = process.memory();
        let cpu = process.cpu_usage();

        let mut target_keys = Vec::new();
        
        if name.contains("nginx") { target_keys.push("nginx"); }
        if name.contains("php") { target_keys.push("php"); }
        if name.contains("mariadbd") { target_keys.push("mariadb"); }
        if name.contains("mysqld") { 
            target_keys.push("mysql");
            target_keys.push("mariadb"); 
        }
        if name.contains("postgres") { target_keys.push("postgres"); }
        if name.contains("mongod") { target_keys.push("mongodb"); }
        if name.contains("redis") { target_keys.push("redis"); }
        if name.contains("mailpit") { target_keys.push("mailpit"); }

        for key in target_keys {
            if let Some(stats) = services_usage.get_mut(key) {
                stats.memory += mem;
                stats.cpu += cpu;
            }
        }
    }
    
    Ok(SystemStats {
        total_memory,
        used_memory,
        cpu_usage,
        services_usage,
    })
}
