import { env } from 'cloudflare:workers';

/**
 * DEV-ONLY auth bypass for local preview.
 *
 * When running `astro dev` AND `DEV_BUILDER_USERNAME` is set in apps/web/.env, the app
 * treats you as that profile's owner without Clerk — so the builder/onboarding render and
 * save without a real sign-in. This also lets us skip Clerk's client JS in dev (its
 * frontend-API domain is blocked inside the localhost-only preview), removing the
 * "Link to …clerk.accounts.dev was blocked" message.
 *
 * Hard-gated on `import.meta.env.DEV` → this is dead code in production builds, and
 * `.env` is never deployed, so it can never bypass auth on prod.
 */
export function devBypassEnabled(): boolean {
  return Boolean(import.meta.env.DEV && (env as unknown as Record<string, unknown>).DEV_BUILDER_USERNAME);
}

export async function devClerkUserId(): Promise<string | null> {
  if (!devBypassEnabled()) return null;
  const uname = String((env as unknown as Record<string, unknown>).DEV_BUILDER_USERNAME);
  const row = await env.DB.prepare(`SELECT clerk_user_id FROM profiles WHERE username = ? COLLATE NOCASE`)
    .bind(uname)
    .first<{ clerk_user_id: string }>();
  return row?.clerk_user_id ?? null;
}
