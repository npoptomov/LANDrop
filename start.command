#!/bin/bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
cd "$script_dir"

if ! command -v node >/dev/null 2>&1; then
  echo "LAN Drop needs Node.js 18 or newer."
  echo "Install Node.js, then double-click start.command again."
  read -r -p "Press Return to close…"
  exit 1
fi

node server.mjs
