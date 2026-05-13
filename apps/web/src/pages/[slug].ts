import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isValidSlug } from '../lib/slug';

export const prerender = false;

function limitHtml(origin: string): Response {
  const body = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Link limit reached · thelnk</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:2rem auto;padding:0 1rem">
<h1>Link limit reached</h1>
<p>This short URL has already been used the maximum number of times.</p>
<p><a href="${origin}/">Back to thelnk</a></p>
</body></html>`;
  return new Response(body, { status: 403, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

/** Single-segment short links (`/:slug`) — same D1 behavior as the former edge router worker. */
export const GET: APIRoute = async ({ params, request }) => {
  const slug = params.slug;
  if (!slug || !isValidSlug(slug)) {
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const url = new URL(request.url);

  const meta = await env.DB.prepare(`SELECT type FROM links WHERE slug = ?`).bind(slug).first<{ type: string }>();

  if (!meta) {
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  if (meta.type === 'file') {
    const dest = new URL(`/f/${encodeURIComponent(slug)}`, url.origin);
    return Response.redirect(dest.toString(), 302);
  }

  if (meta.type !== 'url') {
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    `UPDATE links
     SET use_count = use_count + 1, last_used_at = ?
     WHERE slug = ? AND type = 'url' AND (max_uses < 0 OR use_count < max_uses)
     RETURNING target_url`,
  )
    .bind(nowSec, slug)
    .first<{ target_url: string | null }>();

  if (!row?.target_url) {
    const still = await env.DB.prepare(`SELECT slug FROM links WHERE slug = ? AND type = 'url'`).bind(slug).first();
    if (!still) {
      return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
    return limitHtml(url.origin);
  }

  return Response.redirect(row.target_url, 302);
};
