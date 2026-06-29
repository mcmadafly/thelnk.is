# thelnk.is — Build log

Built in public, one release at a time. Newest first.

---

## v0.2 — The builder (2026-06-28)

The core tool: a visual builder that replaces the placeholder dashboard. Edit on the left,
live preview on the right.

**Shipped (Phase A)**
- **Builder** at `/builder` (now the post-claim home) — left editor / right mobile+desktop live preview.
- **Live preview via a shared render** (`lib/profile-render.ts`) so the preview is byte-identical to
  the public page; profile styles extracted to `styles/profile.css`.
- **Profile fields** — name, subtitle, description (`bio`), avatar + background image (R2 upload via
  presigned PUT; served through `/api/media/[...key]`).
- **Themes** (`lib/themes.ts`) — CSS-variable bundles; 4 free, rest Pro-gated server-side.
- **Social links** + **regular links** — add, edit, feature, drag-reorder; saved via `/api/builder/*`.
- Migration `0009_builder.sql` (profile extras, typed-link columns, Stripe Connect columns, `orders`).

**Next:** Phase B (posts + product blocks), Phase C (Stripe Connect checkout + 6%/4% fees).

---

## v0.1 — Claim your username (2026-06-28)

The pivot release: **thelnk.is** went from a URL shortener to a **link-in-bio** product.
Sign up, claim a username, and get a public page at `thelnk.is/you`.

**Shipped**
- **Link-in-bio core** — new D1 schema (`profiles`, `profile_links`), username validation +
  reserved-word list, claim + availability APIs, public profile route `/[username]`.
- **Claim flow** — homepage `thelnk.is/____` bar → sign-up → onboarding (prefilled, live
  availability) → dashboard → live public page. Username persists across the Clerk auth
  round-trip.
- **Design** — full reskin to a warm dark theme (`#100f0d` / `#1a1815`, orange `#f97316`),
  Alexandria (display) + Manrope (body) + Space Mono (labels). Centered marketing hero with
  a phone preview.
- **Avatars & icons** — deterministic gradient avatars (seeded per username) and a
  `SocialIcon` component backed by `simple-icons` (X, GitHub, Bluesky, Threads, etc.).
- **Persona** — homepage demo profile is Maya Chen (`mayabuilds`), the build-in-public voice.
- **Legal** — rewritten Privacy + Terms for the link-in-bio product.
- **Branding** — orange favicon (SVG/PNG/ICO).

**Removed** — the old shortener/file-share/wall-of-fame surfaces (infra kept: Clerk, D1, R2,
Stripe, Cloudflare Workers).

**Stack** — Astro 6 SSR on Cloudflare Workers · D1 · R2 · Clerk auth.
