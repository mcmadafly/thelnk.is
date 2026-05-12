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

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/') {
      return Response.redirect(new URL('/', env.APP_ORIGIN).toString(), 302);
    }

    const slug = path.slice(1).split('/')[0] ?? '';
    if (!slug || !isSlugToken(slug)) {
      return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }

    const row = await env.DB.prepare(
      'SELECT type, target_url FROM links WHERE slug = ?',
    )
      .bind(slug)
      .first<{ type: string; target_url: string | null }>();

    if (!row) {
      return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }

    if (row.type === 'url' && row.target_url) {
      return Response.redirect(row.target_url, 302);
    }

    if (row.type === 'file') {
      const dest = new URL(`/f/${encodeURIComponent(slug)}`, env.APP_ORIGIN);
      return Response.redirect(dest.toString(), 302);
    }

    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },
};
