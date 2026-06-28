#!/usr/bin/env bash
# Push the Clerk PRODUCTION secret to Cloudflare (Worker: thelnk-web).
#
# The publishable key (pk_live) is PUBLIC and already lives in apps/web/wrangler.jsonc,
# so it ships automatically on the next deploy. Only the SECRET needs `wrangler secret put`.
#
# This script never stores the secret — you provide it at runtime (env var or prompt),
# so it stays out of the repo and out of git history.
#
# Usage:
#   ./scripts/set-clerk-prod.sh                 # prompts you to paste the secret
#   CLERK_SECRET_KEY=sk_live_xxx ./scripts/set-clerk-prod.sh   # or pass via env
set -euo pipefail

cd "$(dirname "$0")/../apps/web"

# Load CLOUDFLARE_API_TOKEN so wrangler can authenticate (token-only auth, no `wrangler login`).
set -a
[ -f .env ] && source .env
set +a

if [ -z "${CLERK_SECRET_KEY:-}" ]; then
  read -rs -p "Paste the (rotated) CLERK_SECRET_KEY [sk_live_...]: " CLERK_SECRET_KEY
  echo
fi

case "$CLERK_SECRET_KEY" in
  sk_live_*) : ;;
  *) echo "Refusing: that doesn't look like a production secret key (sk_live_...)." >&2; exit 1 ;;
esac

printf '%s' "$CLERK_SECRET_KEY" | bunx wrangler secret put CLERK_SECRET_KEY

echo "✓ CLERK_SECRET_KEY set on thelnk-web."
echo "  Publishable key (pk_live) is in wrangler.jsonc and applies on next deploy."
echo "  Do NOT deploy until clerk.thelnk.is resolves (DNS verified in Clerk)."
