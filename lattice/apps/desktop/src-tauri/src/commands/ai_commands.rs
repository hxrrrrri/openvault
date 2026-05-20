use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::state::AppState;

const DEFAULT_TIMEOUT: Duration = Duration::from_secs(300);

#[derive(Debug, Clone)]
struct CliAdapter {
    id: &'static str,
    label: &'static str,
    command: &'static str,
    args: &'static [&'static str],
    env_var: Option<&'static str>,
    install_hint: &'static str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCliAdapterStatus {
    pub id: String,
    pub label: String,
    pub available: bool,
    pub command: String,
    pub install_hint: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCliRunRequest {
    pub adapter_id: String,
    pub prompt: String,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCliRunResult {
    pub adapter_id: String,
    pub command: String,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub elapsed_ms: u128,
}

#[tauri::command]
pub async fn list_ai_cli_adapters() -> Result<Vec<AiCliAdapterStatus>, String> {
    Ok(adapters()
        .into_iter()
        .map(|adapter| {
            let command = resolve_command(&adapter);
            AiCliAdapterStatus {
                id: adapter.id.to_string(),
                label: adapter.label.to_string(),
                available: command_available(&command),
                command,
                install_hint: adapter.install_hint.to_string(),
            }
        })
        .collect())
}

#[tauri::command]
pub async fn run_ai_cli(
    request: AiCliRunRequest,
    state: State<'_, AppState>,
) -> Result<AiCliRunResult, String> {
    state.with_workspace(|workspace| {
        let adapter = adapters()
            .into_iter()
            .find(|adapter| adapter.id == request.adapter_id)
            .ok_or_else(|| format!("unknown AI CLI adapter: {}", request.adapter_id))?;

        let command = resolve_command(&adapter);
        if !command_available(&command) {
            return Err(format!(
                "{} was not found. {}",
                adapter.label, adapter.install_hint
            ));
        }

        let prompt = build_prompt(&request.prompt);
        let mut cleanup: Option<PathBuf> = None;
        let args = args_for(
            &adapter,
            request.model.as_deref(),
            &workspace.vault.root,
            &prompt,
            &mut cleanup,
        )?;
        let start = Instant::now();
        let output = run_process(
            &command,
            &args,
            &prompt,
            &workspace.vault.root,
            DEFAULT_TIMEOUT,
        );

        if let Some(path) = cleanup {
            let _ = fs::remove_file(path);
        }

        let output = output?;
        Ok(AiCliRunResult {
            adapter_id: adapter.id.to_string(),
            command: format!("{} {}", command, args.join(" ")),
            exit_code: output.exit_code,
            stdout: output.stdout,
            stderr: output.stderr,
            elapsed_ms: start.elapsed().as_millis(),
        })
    })
}

struct ProcessOutput {
    exit_code: i32,
    stdout: String,
    stderr: String,
}

fn adapters() -> Vec<CliAdapter> {
    vec![
        CliAdapter {
            id: "claude-code",
            label: "Claude Code",
            command: "claude",
            args: &["-p"],
            env_var: Some("CLAUDE_CLI_PATH"),
            install_hint: "Install with: npm install -g @anthropic-ai/claude-code",
        },
        CliAdapter {
            id: "codex",
            label: "Codex CLI",
            command: "codex",
            args: &[
                "exec",
                "--skip-git-repo-check",
                "--ephemeral",
                "--color",
                "never",
                "-s",
                "read-only",
                "-",
            ],
            env_var: Some("CODEX_CLI_PATH"),
            install_hint: "Install with: npm install -g @openai/codex",
        },
        CliAdapter {
            id: "gemini-cli",
            label: "Gemini CLI",
            command: "gemini",
            args: &["--skip-trust", "--approval-mode", "auto_edit"],
            env_var: Some("GEMINI_CLI_PATH"),
            install_hint: "Install with: npm install -g @google/gemini-cli",
        },
        CliAdapter {
            id: "copilot-cli",
            label: "GitHub Copilot CLI",
            command: "copilot",
            args: &[
                "-p",
                "@.lattice/tmp/copilot-prompt.txt",
                "--silent",
                "--no-color",
                "--no-auto-update",
                "--no-custom-instructions",
                "--stream",
                "off",
                "--output-format",
                "text",
                "--available-tools=",
            ],
            env_var: Some("COPILOT_CLI_PATH"),
            install_hint: "Install with: npm install -g @github/copilot",
        },
        CliAdapter {
            id: "ollama",
            label: "Ollama",
            command: "ollama",
            args: &["run", "llama3.2"],
            env_var: Some("OLLAMA_CLI_PATH"),
            install_hint: "Install Ollama, then run: ollama pull llama3.2",
        },
    ]
}

fn resolve_command(adapter: &CliAdapter) -> String {
    adapter
        .env_var
        .and_then(|key| std::env::var(key).ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| adapter.command.to_string())
}

fn command_available(command: &str) -> bool {
    if looks_like_path(command) {
        return Path::new(command).exists();
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("where.exe")
            .arg(command)
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
            .arg(format!("command -v {}", shell_quote(command)))
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
    }
}

fn looks_like_path(command: &str) -> bool {
    command.contains('/') || command.contains('\\') || command.chars().nth(1) == Some(':')
}

fn args_for(
    adapter: &CliAdapter,
    model: Option<&str>,
    vault_root: &Path,
    prompt: &str,
    cleanup: &mut Option<PathBuf>,
) -> Result<Vec<String>, String> {
    let mut args = adapter
        .args
        .iter()
        .map(|value| value.to_string())
        .collect::<Vec<_>>();
    match adapter.id {
        "claude-code" => {
            if let Some(model) = safe_model(model) {
                args.push("--model".to_string());
                args.push(model.to_string());
            }
        }
        "codex" => {
            if let Some(model) = safe_model(model) {
                let insert_at = args.len().saturating_sub(1);
                args.insert(insert_at, "--model".to_string());
                args.insert(insert_at + 1, model.to_string());
            }
        }
        "gemini-cli" => {
            if let Some(model) = safe_model(model) {
                args.push("--model".to_string());
                args.push(model.to_string());
            }
        }
        "copilot-cli" => {
            let tmp_dir = vault_root.join(".lattice").join("tmp");
            fs::create_dir_all(&tmp_dir).map_err(|error| error.to_string())?;
            let prompt_file = tmp_dir.join("copilot-prompt.txt");
            fs::write(&prompt_file, prompt).map_err(|error| error.to_string())?;
            *cleanup = Some(prompt_file);
            if let Some(model) = safe_model(model) {
                args.push("--model".to_string());
                args.push(model.to_string());
            }
        }
        "ollama" => {
            let selected = safe_model(model).map(ToOwned::to_owned).or_else(|| {
                std::env::var("OLLAMA_MODEL")
                    .ok()
                    .filter(|value| safe_model(Some(value.as_str())).is_some())
            });
            if let Some(model) = selected {
                args = vec!["run".to_string(), model];
            }
        }
        _ => {}
    }
    Ok(args)
}

fn safe_model(model: Option<&str>) -> Option<&str> {
    let model = model?.trim();
    if model.is_empty() {
        return None;
    }
    model
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-' | ':' | '/' | '@'))
        .then_some(model)
}

fn build_prompt(prompt: &str) -> String {
    [
        "You are running inside LATTICE, a local-first Markdown knowledge graph app.",
        "Use Obsidian-compatible Markdown, [[wiki-links]], frontmatter, tags, tasks, and image/file embeds when helpful.",
        "Treat the current working directory as the user's active vault. Do not modify files unless the user explicitly asked for file changes in this prompt.",
        "",
        "## User Request",
        prompt,
    ]
    .join("\n")
}

fn run_process(
    command: &str,
    args: &[String],
    stdin_text: &str,
    cwd: &Path,
    timeout: Duration,
) -> Result<ProcessOutput, String> {
    let mut child = if cfg!(target_os = "windows") {
        let mut cmd = Command::new("cmd.exe");
        cmd.arg("/d")
            .arg("/s")
            .arg("/c")
            .arg(windows_command_line(command, args))
            .current_dir(cwd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|error| error.to_string())?
    } else {
        let mut cmd = Command::new(command);
        cmd.args(args)
            .current_dir(cwd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|error| error.to_string())?
    };

    if let Some(stdin) = child.stdin.as_mut() {
        stdin
            .write_all(stdin_text.as_bytes())
            .map_err(|error| error.to_string())?;
    }
    drop(child.stdin.take());

    let start = Instant::now();
    loop {
        if let Some(status) = child.try_wait().map_err(|error| error.to_string())? {
            let output = child
                .wait_with_output()
                .map_err(|error| error.to_string())?;
            return Ok(ProcessOutput {
                exit_code: status.code().unwrap_or_default(),
                stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            });
        }
        if start.elapsed() > timeout {
            let _ = child.kill();
            return Err(format!("CLI timed out after {} seconds", timeout.as_secs()));
        }
        std::thread::sleep(Duration::from_millis(80));
    }
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
