#!/usr/bin/env bash
set -euo pipefail

pnpm install
if command -v cargo >/dev/null 2>&1; then
  cargo test --workspace
else
  echo "Cargo was not found. Install Rust from https://rustup.rs/ before building the Tauri app." >&2
fi
