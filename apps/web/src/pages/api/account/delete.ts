import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { devDetail } from '../../../lib/dev-detail';
import { devClerkUserId } from '../../../lib/dev-auth';

export const prerender = false;

// Soft delete: mark the profile deleted_at (keeps the row + reserves the username).
// The public page 404s and admin access stops; data is retained for recovery.
export const POST: APIRoute = async ({ locals }) => {
  const auth = typeof locals.auth === 'function' ? await locals.auth() : { userId: null };
  const clerkUserId = (auth.userId ?? null) || (await devClerkUserId());
  if (!clerkUserId) return Response.json({ error: 'Sign in' }, { status: 401 });

  const now = Math.floor(Date.now() / 1000);
  try {
    const res = await env.DB.prepare(
      `UPDATE profiles SET deleted_at = ?, share_enabled = 0, updated_at = ?
       WHERE clerk_user_id = ? AND deleted_at IS NULL`,
    ).bind(now, now, clerkUserId).run();
    if (!res.meta?.changes) return Response.json({ error: 'No active account' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    console.error('[account/delete] failed', e);
    const detail = devDetail(e);
    return Response.json({ error: 'Could not delete account', ...(detail ? { detail } : {}) }, { status: 503 });
  }
};
