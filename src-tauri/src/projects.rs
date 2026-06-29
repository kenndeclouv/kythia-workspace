use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::{fs, thread};
use tauri::{AppHandle, Emitter};

// ────────────────────────────────────────────────────────────────
// Event payload emitted line-by-line to the frontend
// ────────────────────────────────────────────────────────────────

#[derive(Clone, Serialize)]
pub struct ProjectOutputEvent {
    pub line: String,
    pub is_error: bool,
}

#[derive(Clone, Serialize)]
pub struct ProjectDoneEvent {
    pub success: bool,
    pub message: String,
    pub path: String,
}

// ────────────────────────────────────────────────────────────────
// Helper: find an installed Node/npm binary
// ────────────────────────────────────────────────────────────────

fn find_npm_cmd() -> Option<PathBuf> {
    let base = PathBuf::from("C:\\kythia\\bin\\node");
    if let Ok(entries) = fs::read_dir(&base) {
        let mut versions: Vec<String> = entries
            .flatten()
            .filter(|e| e.path().is_dir())
            .filter_map(|e| e.file_name().to_str().map(|s| s.to_string()))
            .collect();
        versions.sort_by(|a, b| b.cmp(a));
        if let Some(ver) = versions.first() {
            let cmd = base.join(ver).join("npm.cmd");
            if cmd.exists() {
                return Some(cmd);
            }
        }
    }
    None
}

fn find_npx_cmd() -> Option<PathBuf> {
    let base = PathBuf::from("C:\\kythia\\bin\\node");
    if let Ok(entries) = fs::read_dir(&base) {
        let mut versions: Vec<String> = entries
            .flatten()
            .filter(|e| e.path().is_dir())
            .filter_map(|e| e.file_name().to_str().map(|s| s.to_string()))
            .collect();
        versions.sort_by(|a, b| b.cmp(a));
        if let Some(ver) = versions.first() {
            let cmd = base.join(ver).join("npx.cmd");
            if cmd.exists() {
                return Some(cmd);
            }
        }
    }
    None
}

fn find_composer_bat() -> Option<PathBuf> {
    let bat = PathBuf::from("C:\\kythia\\bin\\composer\\composer.bat");
    if bat.exists() {
        Some(bat)
    } else {
        None
    }
}

fn find_php_exe() -> Option<PathBuf> {
    let base = PathBuf::from("C:\\kythia\\bin\\php");
    if let Ok(entries) = fs::read_dir(&base) {
        let mut versions: Vec<String> = entries
            .flatten()
            .filter(|e| e.path().is_dir())
            .filter_map(|e| e.file_name().to_str().map(|s| s.to_string()))
            .collect();
        versions.sort_by(|a, b| b.cmp(a));
        if let Some(ver) = versions.first() {
            let exe = base.join(ver).join("php.exe");
            if exe.exists() {
                return Some(exe);
            }
        }
    }
    None
}

// ────────────────────────────────────────────────────────────────
// Helpers to stream process output via Tauri events
// ────────────────────────────────────────────────────────────────

fn stream_command(app: &AppHandle, mut cmd: Command) -> Result<(), String> {
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    // Merge env so the process can find system tools
    cmd.env("COMPOSER_NO_INTERACTION", "1");
    cmd.env("CI", "true");

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn process: {}", e))?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let app_stdout = app.clone();
    let app_stderr = app.clone();

    let t1 = thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().flatten() {
            let _ = app_stdout.emit(
                "project_output",
                ProjectOutputEvent {
                    line,
                    is_error: false,
                },
            );
        }
    });

    let t2 = thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines().flatten() {
            // Composer / npm write info to stderr too, so we don't treat it as fatal
            let _ = app_stderr.emit(
                "project_output",
                ProjectOutputEvent {
                    line,
                    is_error: false,
                },
            );
        }
    });

    let status = child
        .wait()
        .map_err(|e| format!("Failed to wait for process: {}", e))?;

    let _ = t1.join();
    let _ = t2.join();

    if status.success() {
        Ok(())
    } else {
        Err(format!("Process exited with status: {}", status))
    }
}

// ────────────────────────────────────────────────────────────────
// Main Tauri command
// ────────────────────────────────────────────────────────────────

#[derive(Deserialize, Debug)]
pub struct CreateProjectOptions {
    pub framework: String,
    pub template: String, // sub-template / variant
    pub name: String,     // project folder name
    pub document_root: String,
}

#[tauri::command]
pub async fn create_project(app: AppHandle, options: CreateProjectOptions) -> Result<(), String> {
    let root = PathBuf::from(&options.document_root);
    let project_path = root.join(&options.name);

    if project_path.exists() {
        return Err(format!(
            "Folder '{}' already exists in document root.",
            options.name
        ));
    }

    let path_str = project_path.to_string_lossy().to_string();

    // Emit "starting" message
    let _ = app.emit(
        "project_output",
        ProjectOutputEvent {
            line: format!("Creating project '{}' at {}", options.name, path_str),
            is_error: false,
        },
    );

    let result = match options.framework.as_str() {
        "laravel" => create_laravel(&app, &options, &project_path),
        "react-vite" => create_vite(&app, &options.name, "react-ts", &root),
        "react-vite-js" => create_vite(&app, &options.name, "react", &root),
        "vue-vite" => create_vite(&app, &options.name, "vue-ts", &root),
        "vue-vite-js" => create_vite(&app, &options.name, "vue", &root),
        "next" => create_next(&app, &options, &root),
        "nuxt" => create_nuxt(&app, &options.name, &root),
        "svelte-vite" => create_vite(&app, &options.name, "svelte-ts", &root),
        "blank-php" => create_blank_php(&options.name, &project_path),
        "blank" => create_blank(&project_path),
        _ => Err(format!("Unknown framework: {}", options.framework)),
    };

    match result {
        Ok(()) => {
            let _ = app.emit(
                "project_done",
                ProjectDoneEvent {
                    success: true,
                    message: format!("Project '{}' created successfully!", options.name),
                    path: path_str,
                },
            );
            Ok(())
        }
        Err(e) => {
            // Clean up: if the process failed midway, delete the partially created folder
            // We know it didn't exist before this function started because we checked at the beginning.
            if project_path.exists() {
                let _ = app.emit(
                    "project_output",
                    ProjectOutputEvent {
                        line: "→ Creation failed. Cleaning up incomplete folder...".to_string(),
                        is_error: true,
                    },
                );
                let _ = fs::remove_dir_all(&project_path);
            }

            let _ = app.emit(
                "project_done",
                ProjectDoneEvent {
                    success: false,
                    message: e.clone(),
                    path: path_str,
                },
            );
            Err(e)
        }
    }
}

// ────────────────────────────────────────────────────────────────
// Per-framework scaffolders
// ────────────────────────────────────────────────────────────────

fn create_laravel(
    app: &AppHandle,
    opts: &CreateProjectOptions,
    project_path: &PathBuf,
) -> Result<(), String> {
    let composer = find_composer_bat()
        .ok_or("Composer is not installed. Please install it from the Packages tab first.")?;
    let php = find_php_exe()
        .ok_or("PHP is not installed. Please install it from the Packages tab first.")?;

    let root = project_path.parent().unwrap();

    // Step 1: composer create-project
    let _ = app.emit(
        "project_output",
        ProjectOutputEvent {
            line: "→ Running composer create-project ...".to_string(),
            is_error: false,
        },
    );
    let mut cmd = Command::new(&composer);
    cmd.args([
        "create-project",
        "laravel/laravel",
        &opts.name,
        "--no-interaction",
        "--prefer-dist",
    ])
    .current_dir(root);
    stream_command(app, cmd)?;

    // Step 2: Starter kit
    match opts.template.as_str() {
        "breeze-blade" | "breeze-react" | "breeze-vue" | "breeze-livewire" | "breeze-api" => {
            let variant = opts.template.trim_start_matches("breeze-");
            install_laravel_breeze(app, &php, project_path, variant)?;
        }
        "jetstream-livewire" | "jetstream-inertia" => {
            let variant = opts.template.trim_start_matches("jetstream-");
            install_laravel_jetstream(app, &php, &composer, project_path, variant)?;
        }
        _ => {} // "none" — no starter kit
    }

    // Step 3: npm install + build (if needed)
    if opts.template != "none" && opts.template != "breeze-api" {
        if let Some(npm) = find_npm_cmd() {
            let _ = app.emit(
                "project_output",
                ProjectOutputEvent {
                    line: "→ Running npm install ...".to_string(),
                    is_error: false,
                },
            );
            let mut cmd = Command::new(&npm);
            cmd.args(["install"]).current_dir(project_path);
            let _ = stream_command(app, cmd); // non-fatal if fails

            let _ = app.emit(
                "project_output",
                ProjectOutputEvent {
                    line: "→ Running npm run build ...".to_string(),
                    is_error: false,
                },
            );
            let mut cmd = Command::new(&npm);
            cmd.args(["run", "build"]).current_dir(project_path);
            let _ = stream_command(app, cmd); // non-fatal
        }
    }

    Ok(())
}

fn install_laravel_breeze(
    app: &AppHandle,
    php: &PathBuf,
    project_path: &PathBuf,
    variant: &str,
) -> Result<(), String> {
    let _ = app.emit(
        "project_output",
        ProjectOutputEvent {
            line: format!("→ Installing Laravel Breeze ({}) ...", variant),
            is_error: false,
        },
    );

    let composer = find_composer_bat().ok_or("Composer not found")?;

    // composer require laravel/breeze --dev
    let mut cmd = Command::new(&composer);
    cmd.args(["require", "laravel/breeze", "--dev", "--no-interaction"])
        .current_dir(project_path);
    stream_command(app, cmd)?;

    // php artisan breeze:install {variant}
    let mut cmd = Command::new(php);
    cmd.args(["artisan", "breeze:install", variant, "--no-interaction"])
        .current_dir(project_path);
    stream_command(app, cmd)?;

    // php artisan migrate
    let _ = app.emit(
        "project_output",
        ProjectOutputEvent {
            line: "→ Running php artisan migrate ...".to_string(),
            is_error: false,
        },
    );
    let mut cmd = Command::new(php);
    cmd.args(["artisan", "migrate", "--force"])
        .current_dir(project_path);
    let _ = stream_command(app, cmd); // non-fatal (DB might not be running)

    Ok(())
}

fn install_laravel_jetstream(
    app: &AppHandle,
    php: &PathBuf,
    composer: &PathBuf,
    project_path: &PathBuf,
    variant: &str,
) -> Result<(), String> {
    let _ = app.emit(
        "project_output",
        ProjectOutputEvent {
            line: format!("→ Installing Laravel Jetstream ({}) ...", variant),
            is_error: false,
        },
    );

    // composer require laravel/jetstream
    let mut cmd = Command::new(composer);
    cmd.args(["require", "laravel/jetstream", "--no-interaction"])
        .current_dir(project_path);
    stream_command(app, cmd)?;

    // php artisan jetstream:install {variant}
    let mut cmd = Command::new(php);
    cmd.args(["artisan", "jetstream:install", variant, "--no-interaction"])
        .current_dir(project_path);
    stream_command(app, cmd)?;

    Ok(())
}

fn create_vite(app: &AppHandle, name: &str, template: &str, root: &PathBuf) -> Result<(), String> {
    let npm = find_npm_cmd()
        .ok_or("Node.js is not installed. Please install it from the Packages tab first.")?;

    let _ = app.emit(
        "project_output",
        ProjectOutputEvent {
            line: format!("→ Running npm create vite (template: {}) ...", template),
            is_error: false,
        },
    );

    let mut cmd = Command::new(&npm);
    cmd.args(["create", "vite@latest", name, "--", "--template", template])
        .current_dir(root)
        .env("npm_config_yes", "true");
    stream_command(app, cmd)?;

    // npm install
    let project_path = root.join(name);
    if project_path.exists() {
        let _ = app.emit(
            "project_output",
            ProjectOutputEvent {
                line: "→ Running npm install ...".to_string(),
                is_error: false,
            },
        );
        let mut cmd = Command::new(&npm);
        cmd.args(["install"]).current_dir(&project_path);
        let _ = stream_command(app, cmd);
    }

    Ok(())
}

fn create_next(app: &AppHandle, opts: &CreateProjectOptions, root: &PathBuf) -> Result<(), String> {
    let npx = find_npx_cmd()
        .ok_or("Node.js is not installed. Please install it from the Packages tab first.")?;

    let _ = app.emit(
        "project_output",
        ProjectOutputEvent {
            line: "→ Running create-next-app ...".to_string(),
            is_error: false,
        },
    );

    let use_ts = opts.template != "js";

    let mut args = vec![
        "create-next-app@latest".to_string(),
        opts.name.clone(),
        "--no-git".to_string(),
    ];

    if use_ts {
        args.push("--typescript".to_string());
    } else {
        args.push("--no-typescript".to_string());
    }

    // Non-interactive defaults
    args.extend([
        "--tailwind".to_string(),
        "--eslint".to_string(),
        "--app".to_string(),
        "--src-dir".to_string(),
        "--import-alias".to_string(),
        "@/*".to_string(),
        "--yes".to_string(),
    ]);

    let mut cmd = Command::new(&npx);
    cmd.args(&args).current_dir(root);
    stream_command(app, cmd)
}

fn create_nuxt(app: &AppHandle, name: &str, root: &PathBuf) -> Result<(), String> {
    let npx = find_npx_cmd()
        .ok_or("Node.js is not installed. Please install it from the Packages tab first.")?;

    let _ = app.emit(
        "project_output",
        ProjectOutputEvent {
            line: "→ Running nuxi init ...".to_string(),
            is_error: false,
        },
    );

    let mut cmd = Command::new(&npx);
    cmd.args(["nuxi@latest", "init", name, "--no-git-init"])
        .current_dir(root)
        .env("NUXI_TELEMETRY_DISABLED", "1");
    stream_command(app, cmd)?;

    // npm install
    let project_path = root.join(name);
    if project_path.exists() {
        if let Some(npm) = find_npm_cmd() {
            let _ = app.emit(
                "project_output",
                ProjectOutputEvent {
                    line: "→ Running npm install ...".to_string(),
                    is_error: false,
                },
            );
            let mut cmd = Command::new(&npm);
            cmd.args(["install"]).current_dir(&project_path);
            let _ = stream_command(app, cmd);
        }
    }

    Ok(())
}

fn create_blank_php(name: &str, project_path: &PathBuf) -> Result<(), String> {
    fs::create_dir_all(project_path).map_err(|e| format!("Failed to create folder: {}", e))?;

    let index_content = format!(
        "<?php\n// {name}\n\necho '<h1>Welcome to {name}</h1>';\n",
        name = name
    );

    fs::write(project_path.join("index.php"), index_content)
        .map_err(|e| format!("Failed to create index.php: {}", e))?;

    Ok(())
}

fn create_blank(project_path: &PathBuf) -> Result<(), String> {
    fs::create_dir_all(project_path).map_err(|e| format!("Failed to create folder: {}", e))?;
    Ok(())
}
