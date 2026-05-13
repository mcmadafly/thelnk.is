const RESERVED = new Set([
  'api',
  'f',
  'sign-in',
  'sign-up',
  'robots.txt',
  'favicon.ico',
  'sitemap.xml',
]);

function isSlugToken(s: string): boolean {
  return /^[a-zA-Z0-9_-]{4,32}$/.test(s) && !RESERVED.has(s.toLowerCase());
}

function notFound(): Response {
  return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

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

function pathParts(pathname: string): string[] {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/') return [];
  return p.slice(1).split('/').filter(Boolean);
}

/** Single-segment path that might be a stored short slug (not /api, /f, etc.). */
function isShortSlugOnlyPath(pathname: string): boolean {
  const parts = pathParts(pathname);
  return parts.length === 1 && isSlugToken(parts[0]!);
}

async function fetchWeb(req: Request, env: Env): Promise<Response> {
  if (env.WEB) {
    return env.WEB.fetch(req);
  }
  const url = new URL(req.url);
  return Response.redirect(new URL(url.pathname + url.search, env.APP_ORIGIN).toString(), 302);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (!isShortSlugOnlyPath(path)) {
      return fetchWeb(req, env);
    }

    const slug = pathParts(path)[0]!;

    const meta = await env.DB.prepare(`SELECT type FROM links WHERE slug = ?`).bind(slug).first<{ type: string }>();

    if (!meta) {
      return fetchWeb(req, env);
    }

    if (meta.type === 'file') {
      const dest = new URL(`/f/${encodeURIComponent(slug)}`, url.origin);
      return Response.redirect(dest.toString(), 302);
    }

    if (meta.type !== 'url') {
      return notFound();
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
        return notFound();
      }
      return limitHtml(url.origin);
    }

    return Response.redirect(row.target_url, 302);
  },
};
