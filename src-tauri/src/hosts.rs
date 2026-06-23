use std::fs;
use std::path::Path;
use std::process::Command;
use crate::settings;

/// Generates the lines to insert into the hosts file.
fn generate_hosts_entries(doc_root: &Path, domain_suffix: &str) -> Vec<String> {
    let mut entries = Vec::new();
    
    // Read directories in doc_root
    if let Ok(rd) = fs::read_dir(doc_root) {
        for entry in rd.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_dir() {
                    let folder_name = entry.file_name();
                    let name = folder_name.to_string_lossy();
                    // Skip hidden folders or special folders
                    if !name.starts_with('.') {
                        entries.push(format!("127.0.0.1 {}.{}", name, domain_suffix));
                    }
                }
            }
        }
    }
    
    entries
}

/// Syncs the local document_root folders with the Windows hosts file.
/// Because editing hosts requires Admin privileges, we use an elevated PowerShell command.
pub fn sync_hosts() -> Result<(), String> {
    let app_settings = settings::get_settings().unwrap_or_default();
    let doc_root = Path::new(&app_settings.document_root);
    
    // Ensure document root exists
    let _ = fs::create_dir_all(doc_root);
    
    let entries = generate_hosts_entries(doc_root, &app_settings.local_domain);
    let block_content = entries.join("\n");
    
    let marker_start = "# --- KYTHIA LOCAL DOMAINS START ---";
    let marker_end = "# --- KYTHIA LOCAL DOMAINS END ---";
    
    let new_block = format!("{}\n{}\n{}", marker_start, block_content, marker_end);
    
    // Check if the current hosts file already has this exact block
    let hosts_path = Path::new("C:\\Windows\\System32\\drivers\\etc\\hosts");
    if let Ok(content) = fs::read_to_string(hosts_path) {
        let normalized_content = content.replace("\r\n", "\n");
        if normalized_content.contains(&new_block) {
            // Already synced, skip elevation prompt
            return Ok(());
        }
    }
    
    // Create a temporary powershell script that will do the replacement safely
    let script_content = format!(r#"
$hostsPath = "C:\Windows\System32\drivers\etc\hosts"
$content = Get-Content $hostsPath -Raw
if ($null -eq $content) {{ $content = "" }}

$newBlock = "{}"

# Regex to match the existing block
$pattern = "(?ms){}.*?{}"

if ($content -match $pattern) {{
    $content = $content -replace $pattern, $newBlock
}} else {{
    $content = $content + "`r`n" + $newBlock
}}

Set-Content -Path $hostsPath -Value $content -Encoding UTF8
"#, new_block.replace("\n", "`r`n"), marker_start, marker_end);

    let temp_dir = std::env::temp_dir();
    let script_path = temp_dir.join("kythia_update_hosts.ps1");
    fs::write(&script_path, script_content).map_err(|e| format!("Failed to write temp script: {}", e))?;

    // Execute script with elevated privileges
    let status = Command::new("powershell")
        .args(&[
            "-WindowStyle", "Hidden",
            "-Command",
            &format!("Start-Process powershell -Verb RunAs -WindowStyle Hidden -ArgumentList '-ExecutionPolicy Bypass -File \"{}\"'", script_path.display())
        ])
        .status()
        .map_err(|e| format!("Failed to launch elevated powershell: {}", e))?;

    if status.success() {
        Ok(())
    } else {
        Err("Failed to execute elevated powershell command.".to_string())
    }
}
