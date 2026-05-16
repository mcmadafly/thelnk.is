#!/usr/bin/env bash
# Run Astro dev + graphify watch; Ctrl+C stops both.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Export wrangler auth token from .env so remote bindings (D1, R2) work in dev.
if [[ -f apps/web/.env ]]; then
  export CLOUDFLARE_API_TOKEN="$(grep '^CLOUDFLARE_API_TOKEN=' apps/web/.env | cut -d= -f2-)"
fi

trap 'kill $(jobs -p) 2>/dev/null || true' EXIT INT TERM
bun run --cwd apps/web dev &
graphify watch .
wait
