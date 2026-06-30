import { env } from 'cloudflare:workers';
import { devClerkUserId } from './dev-auth';

export type AdminProfile = {
  clerkUserId: string;
  username: string;
  avatar_r2_key: string | null;
};

/**
 * Resolve the signed-in creator's profile for admin pages (Clerk, or the dev bypass).
 * Returns null when not signed in OR when signed in without a profile — the page decides
 * the redirect (`/sign-up` vs `/onboarding`).
 */
export async function getAdminProfile(locals: App.Locals): Promise<AdminProfile | null> {
  let uid: string | null = null;
  try {
    if (typeof locals.auth === 'function') uid = (await locals.auth()).userId ?? null;
  } catch { /* clerk unavailable (dev bypass) */ }
  if (!uid) uid = await devClerkUserId();
  if (!uid) return null;

  const p = await env.DB.prepare(
    `SELECT username, avatar_r2_key FROM profiles WHERE clerk_user_id = ? AND deleted_at IS NULL`,
  )
    .bind(uid)
    .first<{ username: string; avatar_r2_key: string | null }>();
  if (!p) return null;
  return { clerkUserId: uid, username: p.username, avatar_r2_key: p.avatar_r2_key };
}
