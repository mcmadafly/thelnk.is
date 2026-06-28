# thelnk.is — Build log

Built in public, one release at a time. Newest first.

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
