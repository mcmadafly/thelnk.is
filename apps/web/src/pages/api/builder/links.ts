import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { normalizeHttpUrl } from '../../../lib/urls';
import { devDetail } from '../../../lib/dev-detail';

export const prerender = false;

async function profileIdFor(clerkUserId: string): Promise<number | null> {
  const row = await env.DB.prepare(`SELECT id FROM profiles WHERE clerk_user_id = ?`)
    .bind(clerkUserId)
    .first<{ id: number }>();
  return row?.id ?? null;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const auth = await locals.auth();
  const clerkUserId = auth.userId ?? null;
  if (!clerkUserId) return Response.json({ error: 'Sign in' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const b = (body ?? {}) as Record<string, unknown>;
  const op = String(b.op ?? '');

  const profileId = await profileIdFor(clerkUserId);
  if (!profileId) return Response.json({ error: 'No profile' }, { status: 404 });

  const now = Math.floor(Date.now() / 1000);

  try {
    if (op === 'upsert') {
      const title = String(b.title ?? '').trim().slice(0, 120);
      const url = normalizeHttpUrl(String(b.url ?? ''));
      const isFeatured = b.is_featured ? 1 : 0;
      if (!title) return Response.json({ error: 'Title is required' }, { status: 400 });
      if (!url) return Response.json({ error: 'Enter a valid URL' }, { status: 400 });

      const id = Number(b.id ?? 0);
      if (id > 0) {
        const res = await env.DB.prepare(
          `UPDATE profile_links SET title = ?, url = ?, is_featured = ?, type = 'link', updated_at = ?
           WHERE id = ? AND profile_id = ?`,
        ).bind(title, url, isFeatured, now, id, profileId).run();
        if (!res.meta?.changes) return Response.json({ error: 'Link not found' }, { status: 404 });
        return Response.json({ ok: true, id });
      }

      const next = await env.DB.prepare(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM profile_links WHERE profile_id = ?`,
      ).bind(profileId).first<{ n: number }>();
      const sortOrder = next?.n ?? 0;
      const ins = await env.DB.prepare(
        `INSERT INTO profile_links (profile_id, type, title, url, sort_order, is_visible, is_featured, created_at, updated_at)
         VALUES (?, 'link', ?, ?, ?, 1, ?, ?, ?)`,
      ).bind(profileId, title, url, sortOrder, isFeatured, now, now).run();
      return Response.json({ ok: true, id: ins.meta?.last_row_id ?? null });
    }

    if (op === 'delete') {
      const id = Number(b.id ?? 0);
      if (!(id > 0)) return Response.json({ error: 'Bad id' }, { status: 400 });
      await env.DB.prepare(`DELETE FROM profile_links WHERE id = ? AND profile_id = ?`).bind(id, profileId).run();
      return Response.json({ ok: true });
    }

    if (op === 'reorder') {
      const ids = Array.isArray(b.ids) ? (b.ids as unknown[]).map((x) => Number(x)).filter((n) => n > 0) : [];
      if (!ids.length) return Response.json({ error: 'No ids' }, { status: 400 });
      const stmts = ids.map((id, i) =>
        env.DB.prepare(`UPDATE profile_links SET sort_order = ?, updated_at = ? WHERE id = ? AND profile_id = ?`)
          .bind(i, now, id, profileId),
      );
      await env.DB.batch(stmts);
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Unknown op' }, { status: 400 });
  } catch (e) {
    console.error('[builder/links] failed', e);
    const detail = devDetail(e);
    return Response.json({ error: 'Could not save', ...(detail ? { detail } : {}) }, { status: 503 });
  }
};
