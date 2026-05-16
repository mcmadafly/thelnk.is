#!/usr/bin/env bash
# Run Astro dev + graphify watch; Ctrl+C stops both.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
trap 'kill $(jobs -p) 2>/dev/null || true' EXIT INT TERM
bun run --cwd apps/web dev &
graphify watch .
wait
