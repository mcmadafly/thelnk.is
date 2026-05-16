import { env } from 'cloudflare:workers';
import { MAX_UPLOAD_BYTES_FREE, MAX_UPLOAD_BYTES_PREMIUM } from './constants';

function forceProEnvEnabled(): boolean {
  const raw = env.FORCE_PRO;
  if (raw == null || raw === '') return false;
  const s = String(raw).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

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

/** Pro / Lifetime in D1 (`users.plan`). Billing and link-owner behavior — not dev overrides. */
export async function isPremiumClerkUser(clerkUserId: string | null): Promise<boolean> {
  if (!clerkUserId) return false;
  const row = await env.DB.prepare(`SELECT plan FROM users WHERE clerk_user_id = ?`)
    .bind(clerkUserId)
    .first<{ plan: string }>();
  return row?.plan === 'premium';
}

/**
 * Premium for UI / upload limits: real `premium` plan, or any signed-in user when `FORCE_PRO` is set (local dev).
 * Outbound redirects for **links** still use `isPremiumClerkUser(link owner)` only.
 */
export async function effectiveIsPremiumClerkUser(clerkUserId: string | null): Promise<boolean> {
  if (await isPremiumClerkUser(clerkUserId)) return true;
  if (clerkUserId && forceProEnvEnabled()) return true;
  return false;
}

/** Per-file upload cap for direct-to-R2 browser uploads (see `constants.ts`). */
export async function maxUploadLimitForClerkUser(
  clerkUserId: string | null,
): Promise<{ maxBytes: number; isPremium: boolean }> {
  const isPremium = await effectiveIsPremiumClerkUser(clerkUserId);
  return {
    maxBytes: isPremium ? MAX_UPLOAD_BYTES_PREMIUM : MAX_UPLOAD_BYTES_FREE,
    isPremium,
  };
}
