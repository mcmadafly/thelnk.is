import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { presignGet } from '../../../lib/r2-presign';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug;
  if (!slug) {
    return new Response('Not found', { status: 404 });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    `UPDATE links
     SET use_count = use_count + 1, last_used_at = ?
     WHERE slug = ? AND type = 'file' AND (max_uses < 0 OR use_count < max_uses)
     RETURNING r2_key, original_filename`,
  )
    .bind(nowSec, slug)
    .first<{ r2_key: string | null; original_filename: string | null }>();

  if (!row?.r2_key) {
    const exists = await env.DB.prepare(`SELECT slug, type FROM links WHERE slug = ?`).bind(slug).first<{
      type: string;
    }>();
    if (!exists || exists.type !== 'file') {
      return new Response('Not found', { status: 404 });
    }
    return new Response('This file has reached its download limit. Upgrade on thelnk for unlimited storage links.', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const filename = row.original_filename ?? 'download';

  let signedUrl: string;
  try {
    signedUrl = await presignGet(row.r2_key, filename);
  } catch (e) {
    await env.DB.prepare(`UPDATE links SET use_count = use_count - 1, last_used_at = ? WHERE slug = ? AND type = 'file'`)
      .bind(nowSec, slug)
      .run();
    const msg = e instanceof Error ? e.message : 'Download unavailable';
    return Response.json({ error: msg }, { status: 503 });
  }

  return Response.redirect(signedUrl, 302);
};
