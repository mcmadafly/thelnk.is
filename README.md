# thelnk.is

Monorepo for **thelnk** — **apex** `https://thelnk.is`: one Cloudflare Worker (**`thelnk-web`**) runs Astro (Clerk, D1, R2) and handles short links `/:slug` on the same host.

## Workers (Cloudflare)

| Wrangler `name` | Directory | Role |
|-----------------|-----------|------|
| **`thelnk-web`** | `apps/web` | Astro SSR + APIs + static assets + **URL short redirects** at `GET /:slug` (D1). |

Deploy **`thelnk-web`** only. Obsolete scripts **`apps-web`**, **`thelnk-redirect`**, and the old **`thelnk-short`** router can be removed with `bunx wrangler delete <name> --force` once DNS no longer points at them.

**Custom domain:** attach **`thelnk.is`** (and `www` if you use it) to **`thelnk-web`**. You do **not** need a second Worker or service binding for slugs.

**Clerk (production):** use a **production** Clerk application. Add **`https://thelnk.is`** (and dev origins) under allowed origins / redirect URLs in the Clerk dashboard.

## Development workflow

**Work only on `main`.** Commit and push changes directly to `main`. Do not use long-lived feature branches for this repository.

## Prerequisites

- [Bun](https://bun.sh/) (used for installs and scripts).
- Cloudflare account: D1 database, R2 bucket, R2 API token (S3-compatible) with read/write on that bucket.
- [Clerk](https://clerk.com/) application (publishable + secret keys).
- [Stripe](https://stripe.com/) account (for **lifetime** checkout; optional until you enable billing env vars).

## One-time Cloudflare setup

1. **D1**: `cd apps/web && bunx wrangler d1 create thelnk` — copy the `database_id` into `apps/web/wrangler.jsonc` → `d1_databases[0].database_id`.
2. **Apply migrations** (local): `bunx wrangler d1 migrations apply thelnk --local`  
   Production: `bunx wrangler d1 migrations apply thelnk --remote`  
   Migration **`0003_rate_limit_and_stripe.sql`** adds POST rate-limit buckets and idempotent Stripe checkout fulfillment rows. **`0004_users_stripe_subscription.sql`** adds Stripe subscription columns on **`users`** for monthly billing — apply before enabling Pro monthly checkout.
3. **R2**: create bucket **`thelnk`** (or set `bucket_name` / `R2_BUCKET_NAME` consistently in `wrangler.jsonc`). Create **R2 API tokens** (Access Key ID + Secret Access Key).
4. **R2 CORS** (browser `PUT`): allow origin **`https://thelnk.is`** (and `http://localhost:4321` for dev). From `apps/web`:  
   `bunx wrangler r2 bucket cors set thelnk --file r2-cors.json -y`
5. **Deploy** from `apps/web`: **`bun run deploy`** (runs **`astro build`** then **`wrangler deploy`**). Do **not** run `wrangler deploy` alone without a fresh build, or production can serve stale HTML/worker code.
6. **DNS / routes**: point **`thelnk.is`** at **`thelnk-web`** (Workers custom domain or zone route `thelnk.is/*`).

After changing `wrangler.jsonc` bindings, refresh TypeScript env types:

`cd apps/web && bun run generate-types` (uses `wrangler types --include-runtime=false`). Re-add optional **`STRIPE_*`** fields in `worker-configuration.d.ts` if the generator omits them.

## CI deploy (GitHub Actions)

Workflow: [`.github/workflows/deploy-web.yml`](.github/workflows/deploy-web.yml).

On every **push to `main`**, the workflow checks out the repo, runs **`bun install --frozen-lockfile`** at the monorepo root, then **`cd apps/web && bun run deploy`**.

**Repository secrets** (GitHub → Settings → Secrets and variables → Actions):

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | API token with permission to deploy Workers for this account (tighten per Cloudflare least-privilege guidance). |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account id (Wrangler often needs this in CI). |

Clerk, R2, and Stripe **runtime** secrets stay in Cloudflare (`wrangler secret put`); CI only uploads the Worker bundle and static assets.

Use branch protection on `main` if you want PRs instead of direct pushes.

## Stripe (Pro monthly + lifetime)

1. **Dashboard — Lifetime:** Create a **one-time Price** for **$75 USD**. Copy **`STRIPE_LIFETIME_PRICE_ID`** (`price_...`).
2. **Dashboard — Pro monthly:** Create a **recurring Price** at **$4.99 USD / month** (marketed vs **$9.99** list on the site). Copy **`STRIPE_MONTHLY_PRICE_ID`**.
3. **Worker vars:** Set **`STRIPE_LIFETIME_PRICE_ID`** and **`STRIPE_MONTHLY_PRICE_ID`** on `thelnk-web` (Wrangler **vars** or dashboard).
4. **Worker secrets:** `wrangler secret put STRIPE_SECRET_KEY` and `wrangler secret put STRIPE_WEBHOOK_SECRET` (Stripe **Signing secret** for the webhook endpoint).
5. **Webhook:** Stripe → Developers → Webhooks → endpoint **`https://thelnk.is/api/billing/webhook`** (live mode). Subscribe to:
   - **`checkout.session.completed`**
   - **`customer.subscription.updated`**
   - **`customer.subscription.deleted`**

**Checkout:** **`POST /api/billing/checkout`** with JSON **`{ "tier": "monthly" }`** or **`{ "tier": "lifetime" }`** (defaults to **`lifetime`** if `tier` is omitted). User must be **signed in**.

**After successful payment:** `users.plan` becomes **`premium`**, **`stripe_checkout_fulfillments`** records the Checkout session (idempotent), and **`links.max_uses`** is set to **`-1`** for that Clerk user’s rows.

**Monthly lifecycle:** On subscription **`updated`**, the Worker sets **`premium`** only while Stripe status is **`active`** or **`trialing`**; otherwise **`free`**, clears **`stripe_subscription_id`**, and keeps **`stripe_customer_id`** when present. **`deleted`** downgrades the same way. Existing links are **not** rewritten on downgrade (new links pick up the free cap again).

**Lifetime checkout** clears **`stripe_subscription_id`** / **`subscription_status`** so a prior monthly sub does not linger beside a lifetime purchase.

## Local development

```bash
cd apps/web
cp .dev.vars.example .dev.vars   # then fill in real values
bun install
bunx wrangler d1 migrations apply thelnk --local
PUBLIC_CLERK_PUBLISHABLE_KEY=... CLERK_SECRET_KEY=... bun run dev
```

Short links in dev: open `http://localhost:4321/<slug>` after creating a link; the same `[slug]` route runs as in production.

**Note:** local D1 is per Wrangler project unless you use `--remote` on both. For full local E2E, use remote D1 or test against deployed workers.

## Environment variables

See [`apps/web/.dev.vars.example`](apps/web/.dev.vars.example). Production: set `CLERK_SECRET_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` as Wrangler secrets (`wrangler secret put` or `secrets.cf.env` + `wrangler secret bulk`). Use `wrangler.jsonc` **vars** for `R2_ACCOUNT_ID`, `PUBLIC_*` origins, `PUBLIC_CLERK_PUBLISHABLE_KEY`, **`STRIPE_LIFETIME_PRICE_ID`**, and **`STRIPE_MONTHLY_PRICE_ID`** (do not duplicate binding names as both var and secret).

## Root scripts (optional)

```bash
bun install   # if using root package.json workspaces
```

## Analytics and use limits

- Each **URL** short link stores `use_count` / `max_uses` in D1. A successful hit on `thelnk.is/:slug` increments `use_count` in **`apps/web/src/pages/[slug].ts`** before redirecting. Default **`max_uses` = 10** for anonymous and free signed-in creators.
- Each **file** short link counts a use on **each completed download** (`GET /api/download/:slug`), not when opening the branded landing page. Premium creators get **`max_uses = -1`** (unlimited) on links created while they are premium.
- **`users`** table: `clerk_user_id`, `plan` (`free` \| `premium`), optional Stripe fields (`stripe_customer_id`, `stripe_subscription_id`, `subscription_status`) for monthly Pro. New links read the creator’s plan at insert time and store `max_uses` on the row.
- **POST rate limits:** Middleware uses D1 table **`rate_limit_hits`** (per route, IP, minute bucket) for **`/api/links/url`**, **`/api/uploads/init`**, **`/api/uploads/complete`**, and **`/api/billing/checkout`**.

### Upgrading a user manually (support / comp)

Stripe checkout does this automatically. For one-off support cases you can still run:

```sql
UPDATE users SET plan = 'premium', updated_at = unixepoch('now') WHERE clerk_user_id = 'user_xxx';
UPDATE links SET max_uses = -1 WHERE clerk_user_id = 'user_xxx';
```

## Health check

- **`GET https://thelnk.is/health`** returns `200` and body `ok` (for uptime monitors).

## Release tagging (optional)

When the v1 checklist is done: `git tag v1.0.0 && git push origin v1.0.0`.

## License

Private / all rights reserved unless you add a license.
