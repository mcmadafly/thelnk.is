# thelnk.is

Monorepo for **thelnk** — short links on `thelnk.is/:slug` (Cloudflare Worker) and the app on `app.thelnk.is` (Astro + Clerk + D1 + R2).

## Packages

| Directory | What it does |
|-----------|----------------|
| `apps/worker` | Resolves `/:slug` in D1: URL → `302` to target; file → `302` to `app.thelnk.is/f/:slug`. |
| `apps/web` | Astro (Bun) app: shorten URLs, presigned R2 uploads, branded download page, Clerk auth. |

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
3. **R2**: create a bucket (e.g. `thelnk-files`) and set `bucket_name` / `R2_BUCKET_NAME` to match in `wrangler.jsonc`. Create an **Account API token** with R2 read/write and note **Access Key ID** and **Secret Access Key**.
4. **R2 CORS** (for browser `PUT`): allow origin `https://app.thelnk.is` (and `http://localhost:4321` for dev), method `PUT`, headers `Content-Type`, `Content-Length`.
5. **Worker route**: deploy `apps/worker` and attach a route `thelnk.is/*` (or zone apex) to that worker. Set worker var `APP_ORIGIN` to `https://app.thelnk.is` (or your real app origin).
6. **Pages / Workers** for Astro: deploy `apps/web` (Cloudflare Pages with this repo’s `apps/web` as root). Bind the **same** D1 and R2 bucket as in `wrangler.jsonc`.

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

In another terminal (short-link redirects while testing the worker):

```bash
cd apps/worker
# Point APP_ORIGIN at the Astro dev server; use .dev.vars or:
APP_ORIGIN=http://localhost:4321 bunx wrangler dev
```

**Note:** local D1 is per Wrangler project, so the worker and the Astro app each have their own SQLite file unless you use `--remote` for D1 on both. For full local E2E redirects, point both at the same remote D1 or run migrations on both locals and insert only in one (simplest is to test redirects against a deployed worker + remote D1).

## Environment variables

See `apps/web/.dev.vars.example`. Production: set `CLERK_SECRET_KEY`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` as Wrangler secrets; keep public keys and account/bucket IDs in `vars` as needed.

## Root scripts (optional)

```bash
bun install   # if using root package.json workspaces
```

## License

Private / all rights reserved unless you add a license.
