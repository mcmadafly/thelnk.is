import { env } from 'cloudflare:workers';

/** Free / anonymous links: this many successful uses (URL redirects or file downloads). */
export const DEFAULT_MAX_USES = 10;

/** Stored in `links.max_uses` when the creator has an active premium plan. */
export const UNLIMITED_MAX_USES = -1;

/**
 * Ensures a `users` row exists and returns the max-use cap for **new** links for this creator.
 * Anonymous → default cap. Premium → unlimited (-1).
 */
export async function maxUsesForNewLink(clerkUserId: string | null): Promise<number> {
  if (!clerkUserId) {
    return DEFAULT_MAX_USES;
  }

  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `INSERT INTO users (clerk_user_id, plan, updated_at) VALUES (?, 'free', ?)
     ON CONFLICT(clerk_user_id) DO NOTHING`,
  )
    .bind(clerkUserId, now)
    .run();

  const row = await env.DB.prepare(`SELECT plan FROM users WHERE clerk_user_id = ?`)
    .bind(clerkUserId)
    .first<{ plan: string }>();

  if (row?.plan === 'premium') {
    return UNLIMITED_MAX_USES;
  }
  return DEFAULT_MAX_USES;
}
