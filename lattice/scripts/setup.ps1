Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Installing JavaScript dependencies..."
pnpm install

if (Get-Command cargo -ErrorAction SilentlyContinue) {
  Write-Host "Checking Rust workspace..."
  cargo test --workspace
} else {
  Write-Warning "Cargo was not found. Install Rust from https://rustup.rs/ before building the Tauri app."
}
