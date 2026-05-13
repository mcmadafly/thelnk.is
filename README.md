# thelnk.is

Monorepo for **thelnk** — **apex** `https://thelnk.is`: Astro app (Clerk, D1, R2) plus short links `/:slug` on the same host.

## Workers (Cloudflare)

| Wrangler `name` | Directory | Role |
|-----------------|-----------|------|
| **`thelnk-web`** | `apps/web` | Astro SSR + APIs + static assets. |
| **`thelnk-short`** | `apps/worker` | Edge router: proxies `/`, `/api/*`, `/f/*`, etc. to **`thelnk-web`** via a **service binding** (`WEB`); single-segment short slugs hit D1 and redirect. |

Deploy **thelnk-web** before **thelnk-short** (the short worker binds to `thelnk-web`). After renaming, delete obsolete scripts **`apps-web`** and **`thelnk-redirect`** in the Cloudflare dashboard if they still exist.

**Custom domain:** attach **`thelnk.is`** (and `www` if you use it) only to **`thelnk-short`**. Do not attach the same hostname to **`thelnk-web`**; traffic reaches Astro through the service binding.

**Clerk:** add **`https://thelnk.is`** (and dev origins) under allowed origins / redirect URLs in the Clerk dashboard.

## Development workflow

**Work only on `main`.** Commit and push changes directly to `main`. Do not use long-lived feature branches for this repository.

## Prerequisites

- [Bun](https://bun.sh/) (used for installs and scripts).
- Cloudflare account: D1 database, R2 bucket, R2 API token (S3-compatible) with read/write on that bucket.
- [Clerk](https://clerk.com/) application (publishable + secret keys).

## One-time Cloudflare setup

1. **D1**: `cd apps/web && bunx wrangler d1 create thelnk` — copy the `database_id` into:
   - `apps/web/wrangler.jsonc` → `d1_databases[0].database_id`
   - `apps/worker/wrangler.toml` → `database_id` under `[[d1_databases]]`
2. **Apply migrations** (local): `bunx wrangler d1 migrations apply thelnk --local`  
   Production: `bunx wrangler d1 migrations apply thelnk --remote`
3. **R2**: create bucket **`thelnk`** (or set `bucket_name` / `R2_BUCKET_NAME` consistently in `wrangler.jsonc`). Create **R2 API tokens** (Access Key ID + Secret Access Key).
4. **R2 CORS** (browser `PUT`): allow origin **`https://thelnk.is`** (and `http://localhost:4321` for dev). From `apps/web`:  
   `bunx wrangler r2 bucket cors set thelnk --file r2-cors.json -y`
5. **Deploy** `apps/web` then `apps/worker` (`bunx wrangler deploy` in each directory).
6. **DNS / routes**: point **`thelnk.is`** at **`thelnk-short`** (Workers custom domain or zone route `thelnk.is/*`).

After changing `wrangler.jsonc` bindings, refresh TypeScript env types:

`cd apps/web && bun run generate-types` (uses `wrangler types --include-runtime=false`).

## Local development

```bash
cd apps/web
cp .dev.vars.example .dev.vars   # then fill in real values
bun install
bunx wrangler d1 migrations apply thelnk --local
PUBLIC_CLERK_PUBLISHABLE_KEY=... CLERK_SECRET_KEY=... bun run dev
```

**Short worker** (`apps/worker`): with a **service binding** to `thelnk-web`, `wrangler dev` expects the Astro worker to exist in the account. For a quick local loop without the binding, set **`APP_ORIGIN=http://localhost:4321`** in `.dev.vars` there; **`/`** will redirect to the dev server instead of `env.WEB.fetch` when the binding is absent (see `src/index.ts`).

**Note:** local D1 is per Wrangler project unless you use `--remote` on both. For full local E2E, use remote D1 or test against deployed workers.

## Environment variables

See `apps/web/.dev.vars.example`. Production: set `CLERK_SECRET_KEY`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` as Wrangler secrets (`wrangler secret put` or `secrets.cf.env` + `wrangler secret bulk`). Use `wrangler.jsonc` `vars` for `R2_ACCOUNT_ID`, `PUBLIC_*` origins, and `PUBLIC_CLERK_PUBLISHABLE_KEY` (do not duplicate binding names as both var and secret).

## Root scripts (optional)

```bash
bun install   # if using root package.json workspaces
```

## Analytics and use limits

- Each **URL** short link stores `use_count` / `max_uses` in D1. A successful hit on `thelnk.is/:slug` increments `use_count` on **thelnk-short** before redirecting. Default **`max_uses` = 10** for anonymous and free signed-in creators.
- Each **file** short link counts a use on **each completed download** (`GET /api/download/:slug`), not when opening the branded landing page. Premium creators get **`max_uses = -1`** (unlimited) on links created while they are premium.
- **`users`** table: `clerk_user_id`, `plan` (`free` \| `premium`). New links read the creator’s plan at insert time and store `max_uses` on the row.

### Upgrading a user (manual until billing is wired)

After you set a Clerk user to premium in your own process, mark them in D1 and optionally lift existing links:

```sql
UPDATE users SET plan = 'premium', updated_at = unixepoch('now') WHERE clerk_user_id = 'user_xxx';
UPDATE links SET max_uses = -1 WHERE clerk_user_id = 'user_xxx';
```

## License

Private / all rights reserved unless you add a license.
