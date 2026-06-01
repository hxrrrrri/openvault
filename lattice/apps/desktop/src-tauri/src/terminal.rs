use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::{engine::general_purpose, Engine as _};
use portable_pty::{native_pty_system, Child, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

static NEXT_SESSION_ID: AtomicU64 = AtomicU64::new(1);

const TERMINAL_OUTPUT_EVENT: &str = "lattice://terminal-output";
const TERMINAL_EXIT_EVENT: &str = "lattice://terminal-exit";

#[derive(Default)]
pub struct TerminalRegistry {
    sessions: Mutex<HashMap<String, Arc<Mutex<TerminalSession>>>>,
}

struct TerminalSession {
    id: String,
    cli_id: String,
    cli_label: String,
    alive: bool,
    started_at: String,
    history: Vec<String>,
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    killer: Box<dyn ChildKiller + Send + Sync>,
}

#[derive(Debug, Clone)]
pub struct CliAdapter {
    pub id: &'static str,
    pub label: &'static str,
    pub command: &'static str,
    pub args: Vec<String>,
    pub env_var: Option<&'static str>,
    pub install_hint: &'static str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalAdapterStatus {
    pub id: String,
    pub label: String,
    pub available: bool,
    pub command: String,
    pub install_hint: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSessionInfo {
    pub id: String,
    pub cli_id: String,
    pub cli_label: String,
    pub alive: bool,
    pub started_at: String,
    pub history_size: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalOutputEvent {
    pub session_id: String,
    pub chunk: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalExitEvent {
    pub session_id: String,
    pub code: Option<i32>,
}

impl TerminalRegistry {
    pub fn list_sessions(&self) -> Result<Vec<TerminalSessionInfo>, String> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| "terminal sessions lock poisoned".to_string())?;
        Ok(sessions
            .values()
            .filter_map(|session| session.lock().ok().map(|session| session.info()))
            .collect())
    }

    pub fn history(&self, session_id: &str) -> Result<Vec<String>, String> {
        let session = self.get_session(session_id)?;
        let session = session
            .lock()
            .map_err(|_| "terminal session lock poisoned".to_string())?;
        Ok(session.history.clone())
    }

    pub fn create_session(
        &self,
        cli_id: String,
        cwd: PathBuf,
        vault_root: PathBuf,
        app: AppHandle,
        size: PtySize,
    ) -> Result<TerminalSessionInfo, String> {
        let adapter =
            adapter_by_id(&cli_id).ok_or_else(|| format!("unknown terminal adapter: {cli_id}"))?;

        if adapter.id != "shell" && !command_available(&adapter) {
            return self.create_shell_fallback(
                adapter.id,
                adapter.label,
                unavailable_message(&adapter),
                cwd,
                vault_root,
                app,
                size,
            );
        }

        match self.create_pty_session(
            &adapter,
            adapter.id,
            adapter.label,
            cwd.clone(),
            vault_root.clone(),
            app.clone(),
            size,
        ) {
            Ok(info) => {
                self.push_system_message(
                    &info.id,
                    &app,
                    &automation_banner(&adapter, &cwd, &vault_root),
                );
                Ok(info)
            }
            Err(error) if adapter.id != "shell" => self.create_shell_fallback(
                adapter.id,
                adapter.label,
                format!("Could not start {}: {error}", adapter.label),
                cwd,
                vault_root,
                app,
                size,
            ),
            Err(error) => Err(error),
        }
    }

    pub fn write_input(&self, session_id: &str, data: &str) -> Result<bool, String> {
        let session = self.get_session(session_id)?;
        let mut session = session
            .lock()
            .map_err(|_| "terminal session lock poisoned".to_string())?;
        if !session.alive {
            return Err("terminal session has exited".to_string());
        }
        session
            .writer
            .write_all(data.as_bytes())
            .map_err(|error| error.to_string())?;
        session.writer.flush().map_err(|error| error.to_string())?;
        Ok(true)
    }

    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<bool, String> {
        let session = self.get_session(session_id)?;
        let session = session
            .lock()
            .map_err(|_| "terminal session lock poisoned".to_string())?;
        if !session.alive {
            return Ok(false);
        }
        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|error| error.to_string())?;
        Ok(true)
    }

    pub fn kill(&self, session_id: &str) -> Result<bool, String> {
        let session = {
            let mut sessions = self
                .sessions
                .lock()
                .map_err(|_| "terminal sessions lock poisoned".to_string())?;
            sessions.remove(session_id)
        };

        if let Some(session) = session {
            let mut session = session
                .lock()
                .map_err(|_| "terminal session lock poisoned".to_string())?;
            session.alive = false;
            let _ = session.killer.kill();
            return Ok(true);
        }

        Ok(false)
    }

    pub fn kill_all(&self) -> Result<bool, String> {
        let ids = {
            let sessions = self
                .sessions
                .lock()
                .map_err(|_| "terminal sessions lock poisoned".to_string())?;
            sessions.keys().cloned().collect::<Vec<_>>()
        };
        for id in ids {
            let _ = self.kill(&id);
        }
        Ok(true)
    }

    #[allow(clippy::too_many_arguments)]
    fn create_shell_fallback(
        &self,
        requested_id: &str,
        requested_label: &str,
        message: String,
        cwd: PathBuf,
        vault_root: PathBuf,
        app: AppHandle,
        size: PtySize,
    ) -> Result<TerminalSessionInfo, String> {
        let shell = shell_adapter();
        let info = self.create_pty_session(
            &shell,
            requested_id,
            requested_label,
            cwd.clone(),
            vault_root.clone(),
            app.clone(),
            size,
        )?;
        self.push_system_message(
            &info.id,
            &app,
            &format!(
                "\r\n[{requested_label} unavailable]\r\n{message}\r\n[Opened a shell in {} instead.]\r\n\r\n",
                cwd.display()
            ),
        );
        self.push_system_message(
            &info.id,
            &app,
            &automation_banner(&shell, &cwd, &vault_root),
        );
        Ok(info)
    }

    #[allow(clippy::too_many_arguments)]
    fn create_pty_session(
        &self,
        adapter: &CliAdapter,
        requested_id: &str,
        requested_label: &str,
        cwd: PathBuf,
        vault_root: PathBuf,
        app: AppHandle,
        size: PtySize,
    ) -> Result<TerminalSessionInfo, String> {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(size)
            .map_err(|error| error.to_string())?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|error| error.to_string())?;
        let child = pair
            .slave
            .spawn_command(build_command(adapter, &cwd, &vault_root))
            .map_err(|error| error.to_string())?;
        let killer = child.clone_killer();

        let id = create_session_id();
        let started_at = chrono::Utc::now().to_rfc3339();
        let session = Arc::new(Mutex::new(TerminalSession {
            id: id.clone(),
            cli_id: requested_id.to_string(),
            cli_label: requested_label.to_string(),
            alive: true,
            started_at: started_at.clone(),
            history: Vec::new(),
            master: pair.master,
            writer,
            killer,
        }));

        {
            let mut sessions = self
                .sessions
                .lock()
                .map_err(|_| "terminal sessions lock poisoned".to_string())?;
            sessions.insert(id.clone(), Arc::clone(&session));
        }

        spawn_output_reader(id.clone(), Arc::clone(&session), app.clone());
        spawn_child_waiter(
            id.clone(),
            requested_label.to_string(),
            Arc::clone(&session),
            child,
            app,
        );

        Ok(TerminalSessionInfo {
            id,
            cli_id: requested_id.to_string(),
            cli_label: requested_label.to_string(),
            alive: true,
            started_at,
            history_size: 0,
        })
    }

    fn push_system_message(&self, session_id: &str, app: &AppHandle, message: &str) {
        let chunk = general_purpose::STANDARD.encode(message.as_bytes());
        if let Ok(session) = self.get_session(session_id) {
            if let Ok(mut session) = session.lock() {
                session.push_history(chunk.clone());
            }
        }
        let _ = app.emit(
            TERMINAL_OUTPUT_EVENT,
            TerminalOutputEvent {
                session_id: session_id.to_string(),
                chunk,
            },
        );
    }

    fn get_session(&self, session_id: &str) -> Result<Arc<Mutex<TerminalSession>>, String> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| "terminal sessions lock poisoned".to_string())?;
        sessions
            .get(session_id)
            .cloned()
            .ok_or_else(|| "terminal session not found".to_string())
    }
}

impl TerminalSession {
    fn info(&self) -> TerminalSessionInfo {
        TerminalSessionInfo {
            id: self.id.clone(),
            cli_id: self.cli_id.clone(),
            cli_label: self.cli_label.clone(),
            alive: self.alive,
            started_at: self.started_at.clone(),
            history_size: self.history.len(),
        }
    }

    fn push_history(&mut self, chunk: String) {
        self.history.push(chunk);
        if self.history.len() > 4000 {
            self.history.remove(0);
        }
    }
}

fn spawn_output_reader(session_id: String, session: Arc<Mutex<TerminalSession>>, app: AppHandle) {
    thread::spawn(move || {
        let mut reader = match session
            .lock()
            .map_err(|_| "terminal session lock poisoned".to_string())
            .and_then(|session| {
                session
                    .master
                    .try_clone_reader()
                    .map_err(|error| error.to_string())
            }) {
            Ok(reader) => reader,
            Err(error) => {
                let chunk = general_purpose::STANDARD
                    .encode(format!("\r\n[terminal error: {error}]\r\n").as_bytes());
                let _ = app.emit(
                    TERMINAL_OUTPUT_EVENT,
                    TerminalOutputEvent {
                        session_id: session_id.clone(),
                        chunk,
                    },
                );
                return;
            }
        };

        let mut buffer = [0u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(size) => {
                    let chunk = general_purpose::STANDARD.encode(&buffer[..size]);
                    if let Ok(mut session) = session.lock() {
                        session.push_history(chunk.clone());
                    }
                    let _ = app.emit(
                        TERMINAL_OUTPUT_EVENT,
                        TerminalOutputEvent {
                            session_id: session_id.clone(),
                            chunk,
                        },
                    );
                }
                Err(_) => break,
            }
        }
    });
}

fn spawn_child_waiter(
    session_id: String,
    label: String,
    session: Arc<Mutex<TerminalSession>>,
    mut child: Box<dyn Child + Send + Sync>,
    app: AppHandle,
) {
    thread::spawn(move || {
        let code = child.wait().ok().map(|status| status.exit_code() as i32);
        let exit_message = format!(
            "\r\n[{label} exited: code {}]\r\n",
            code.unwrap_or_default()
        );
        let chunk = general_purpose::STANDARD.encode(exit_message.as_bytes());

        if let Ok(mut session) = session.lock() {
            session.alive = false;
            session.push_history(chunk.clone());
        }
        let _ = app.emit(
            TERMINAL_OUTPUT_EVENT,
            TerminalOutputEvent {
                session_id: session_id.clone(),
                chunk,
            },
        );
        let _ = app.emit(TERMINAL_EXIT_EVENT, TerminalExitEvent { session_id, code });
    });
}

pub fn adapter_statuses() -> Vec<TerminalAdapterStatus> {
    terminal_adapters()
        .into_iter()
        .map(|adapter| TerminalAdapterStatus {
            id: adapter.id.to_string(),
            label: adapter.label.to_string(),
            available: adapter.id == "shell" || command_available(&adapter),
            command: resolve_command(&adapter),
            install_hint: adapter.install_hint.to_string(),
        })
        .collect()
}

pub fn terminal_adapters() -> Vec<CliAdapter> {
    vec![
        CliAdapter {
            id: "claude-code",
            label: "Claude Code",
            command: "claude",
            args: Vec::new(),
            env_var: Some("CLAUDE_CLI_PATH"),
            install_hint: "Install with: npm install -g @anthropic-ai/claude-code",
        },
        CliAdapter {
            id: "codex",
            label: "Codex CLI",
            command: "codex",
            args: Vec::new(),
            env_var: Some("CODEX_CLI_PATH"),
            install_hint: "Install with: npm install -g @openai/codex",
        },
        CliAdapter {
            id: "gemini-cli",
            label: "Gemini CLI",
            command: "gemini",
            args: Vec::new(),
            env_var: Some("GEMINI_CLI_PATH"),
            install_hint: "Install with: npm install -g @google/gemini-cli",
        },
        CliAdapter {
            id: "copilot-cli",
            label: "GitHub Copilot",
            command: "copilot",
            args: Vec::new(),
            env_var: Some("COPILOT_CLI_PATH"),
            install_hint: "Install with: npm install -g @github/copilot",
        },
        CliAdapter {
            id: "ollama",
            label: "Ollama",
            command: "ollama",
            args: vec![
                "run".to_string(),
                std::env::var("OLLAMA_MODEL").unwrap_or_else(|_| "llama3.2".to_string()),
            ],
            env_var: Some("OLLAMA_CLI_PATH"),
            install_hint: "Install Ollama, then run: ollama pull llama3.2",
        },
        CliAdapter {
            id: "aider",
            label: "Aider",
            command: "aider",
            args: Vec::new(),
            env_var: Some("AIDER_CLI_PATH"),
            install_hint: "Install with: pipx install aider-chat",
        },
        CliAdapter {
            id: "amp",
            label: "Amp",
            command: "amp",
            args: Vec::new(),
            env_var: Some("AMP_CLI_PATH"),
            install_hint: "Install Amp and ensure amp is on PATH.",
        },
        shell_adapter(),
    ]
}

fn shell_adapter() -> CliAdapter {
    #[cfg(target_os = "windows")]
    {
        CliAdapter {
            id: "shell",
            label: "PowerShell",
            command: "powershell.exe",
            args: vec!["-NoLogo".to_string()],
            env_var: Some("SHELL_CLI_PATH"),
            install_hint: "Windows PowerShell should be available by default.",
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        CliAdapter {
            id: "shell",
            label: "Shell",
            command: "bash",
            args: vec!["--norc".to_string()],
            env_var: Some("SHELL"),
            install_hint: "Set SHELL to a valid interactive shell.",
        }
    }
}

fn adapter_by_id(id: &str) -> Option<CliAdapter> {
    terminal_adapters()
        .into_iter()
        .find(|adapter| adapter.id == id)
}

fn build_command(adapter: &CliAdapter, cwd: &Path, vault_root: &Path) -> CommandBuilder {
    let command = resolve_command(adapter);
    let args = adapter.args.clone();

    let (command, args) = if cfg!(target_os = "windows") && adapter.id != "shell" {
        (
            "cmd.exe".to_string(),
            vec![
                "/d".to_string(),
                "/s".to_string(),
                "/c".to_string(),
                windows_command_line(&command, &args),
            ],
        )
    } else {
        (command, args)
    };

    let mut builder = CommandBuilder::new(command);
    for arg in args {
        builder.arg(arg);
    }
    builder.cwd(cwd);
    for (key, value) in std::env::vars() {
        builder.env(key, value);
    }
    builder.env("FORCE_COLOR", "3");
    builder.env("COLORTERM", "truecolor");
    builder.env("TERM", "xterm-256color");
    builder.env("TERM_PROGRAM", "LATTICE");
    builder.env("LATTICE_WORKSPACE_ROOT", cwd.to_string_lossy().to_string());
    builder.env(
        "LATTICE_VAULT_ROOT",
        vault_root.to_string_lossy().to_string(),
    );
    if let Some(policy) = automation_policy_path(cwd) {
        builder.env(
            "LATTICE_AUTOMATION_POLICY",
            policy.to_string_lossy().to_string(),
        );
    }
    builder
}

fn automation_banner(adapter: &CliAdapter, cwd: &Path, vault_root: &Path) -> String {
    let policy = automation_policy_path(cwd)
        .map(|path| path.display().to_string())
        .unwrap_or_else(|| "not found".to_string());
    format!(
        "\r\n[LATTICE automation profile]\r\nCLI: {}\r\nWorkspace root: {}\r\nVault root: {}\r\nPolicy: {}\r\nCritical operations require explicit user approval: destructive file changes, dependency installs, networked writes, credential access, git history rewrites, and production-impacting commands.\r\n\r\n",
        adapter.label,
        cwd.display(),
        vault_root.display(),
        policy
    )
}

fn automation_policy_path(cwd: &Path) -> Option<PathBuf> {
    let candidates = [
        cwd.join("AGENTS.md"),
        cwd.join("lattice/docs/llm-automation.md"),
        cwd.join("docs/llm-automation.md"),
    ];
    candidates.into_iter().find(|path| path.exists())
}

fn command_available(adapter: &CliAdapter) -> bool {
    let command = resolve_command(adapter);
    if command.trim().is_empty() {
        return false;
    }

    if looks_like_path(&command) {
        return Path::new(&command).exists();
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("where.exe")
            .arg(&command)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new("sh")
            .arg("-lc")
            .arg(format!("command -v {}", shell_quote(&command)))
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
    }
}

fn resolve_command(adapter: &CliAdapter) -> String {
    adapter
        .env_var
        .and_then(|key| std::env::var(key).ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| adapter.command.to_string())
}

fn unavailable_message(adapter: &CliAdapter) -> String {
    let env_name = adapter.env_var.unwrap_or("CLI_PATH");
    format!(
        "Command not found: {}.\r\nInstall it or set {env_name}.\r\nSuggested install: {}",
        resolve_command(adapter),
        adapter.install_hint
    )
}

fn looks_like_path(command: &str) -> bool {
    command.contains('/') || command.contains('\\') || command.chars().nth(1) == Some(':')
}

fn windows_command_line(command: &str, args: &[String]) -> String {
    std::iter::once(quote_windows_arg(command))
        .chain(args.iter().map(|arg| quote_windows_arg(arg)))
        .collect::<Vec<_>>()
        .join(" ")
}

fn quote_windows_arg(value: &str) -> String {
    if !value.chars().any(|ch| {
        matches!(
            ch,
            ' ' | '\t' | '&' | '(' | ')' | '^' | '|' | '<' | '>' | '"'
        )
    }) {
        return value.to_string();
    }
    format!("\"{}\"", value.replace('"', "\\\""))
}

#[cfg(not(target_os = "windows"))]
fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn create_session_id() -> String {
    let counter = NEXT_SESSION_ID.fetch_add(1, Ordering::Relaxed);
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    format!("term-{millis:x}-{counter:x}")
}
