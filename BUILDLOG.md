# thelnk.is — Build log

Built in public, one release at a time. Newest first.

---

## v0.3 — Admin redesign (2026-06-29)

A ground-up redesign of the admin into a Linktree-style dashboard, plus a reworked builder.

**Shipped**
- **New admin shell** — sidebar nav (Links, Appearance, Analytics, plus Media kit / Wallet stubs),
  top bar, fully responsive, with a **light/dark toggle** (matches system, remembers your choice).
- **Design system** — Tailwind v4 + shadcn "New-York" tokens (orange primary), an Astro-native UI
  kit (Button, Card, Badge, Select, Tabs, Avatar, icons) — no React.
- **Overview / Analytics page** — metric cards + hand-rolled SVG charts (sample data; real pipeline TBD).
- **Builder re-homed** into the shell, split into **Appearance** (profile, images, themes) and
  **Links**, with the live preview centered alongside the editor.
- **Unified links + socials** — one ordered list; an item's type (link/social) only controls how it
  renders. Consecutive social icons group onto a row; a link between two socials splits them.
  Drag-to-reorder with a dashed drop-zone indicator; edits auto-save.
- Migration `0010_unify_links_socials.sql` — moves legacy `profiles.socials` JSON into the single
  `profile_links` list (`type='social'`).

**Internals:** `profile-render.ts` now renders one ordered `items[]` (byte-identical SSR + live
preview); socials persist as `profile_links` rows instead of a JSON column.

**Next:** Phase B (posts + product blocks), Phase C (Stripe Connect checkout + 6%/4% fees).

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
