import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { devDetail } from '../../../lib/dev-detail';
import { devClerkUserId } from '../../../lib/dev-auth';

export const prerender = false;

// Account/page settings. Currently: share_enabled (show the public Share button).
export const POST: APIRoute = async ({ request, locals }) => {
  const auth = typeof locals.auth === 'function' ? await locals.auth() : { userId: null };
  const clerkUserId = (auth.userId ?? null) || (await devClerkUserId());
  if (!clerkUserId) return Response.json({ error: 'Sign in' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const b = (body ?? {}) as Record<string, unknown>;

  if (typeof b.share_enabled !== 'boolean') {
    return Response.json({ error: 'share_enabled (boolean) required' }, { status: 400 });
  }
  const now = Math.floor(Date.now() / 1000);
  try {
    const res = await env.DB.prepare(
      `UPDATE profiles SET share_enabled = ?, updated_at = ? WHERE clerk_user_id = ? AND deleted_at IS NULL`,
    ).bind(b.share_enabled ? 1 : 0, now, clerkUserId).run();
    if (!res.meta?.changes) return Response.json({ error: 'No account' }, { status: 404 });
    return Response.json({ ok: true, share_enabled: b.share_enabled });
  } catch (e) {
    console.error('[account/settings] failed', e);
    const detail = devDetail(e);
    return Response.json({ error: 'Could not save', ...(detail ? { detail } : {}) }, { status: 503 });
  }
};
