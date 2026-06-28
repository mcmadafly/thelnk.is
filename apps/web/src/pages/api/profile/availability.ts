import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { validateUsername } from '../../../lib/username';

export const prerender = false;

// GET so it bypasses POST rate-limiting; the client debounces. Advisory only —
// the unique index on profiles.username is the real arbiter at claim time.
export const GET: APIRoute = async ({ url }) => {
  const raw = url.searchParams.get('username') ?? '';
  const check = validateUsername(raw);
  if (!check.ok) {
    return Response.json({ available: false, reason: check.reason });
  }

  try {
    const row = await env.DB.prepare(`SELECT 1 AS one FROM profiles WHERE username = ? COLLATE NOCASE`)
      .bind(check.username)
      .first<{ one: number }>();
    return Response.json({ available: !row, username: check.username });
  } catch (e) {
    console.error('[api/profile/availability] query failed', e);
    return Response.json({ available: false, reason: 'Could not check availability right now.' }, { status: 503 });
  }
};
