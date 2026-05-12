import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { maxUsesForNewLink } from '../../../lib/plan';
import { newSlugCandidate } from '../../../lib/slug';
import { normalizeHttpUrl } from '../../../lib/urls';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const targetUrl =
    typeof body === 'object' && body !== null && 'targetUrl' in body
      ? String((body as { targetUrl: unknown }).targetUrl)
      : '';

  const normalized = normalizeHttpUrl(targetUrl);
  if (!normalized) {
    return Response.json({ error: 'Invalid or missing targetUrl' }, { status: 400 });
  }

  const auth = await locals.auth();
  const clerkUserId = auth.userId ?? null;
  const createdAt = Math.floor(Date.now() / 1000);
  const maxUses = await maxUsesForNewLink(clerkUserId);

  for (let attempt = 0; attempt < 10; attempt++) {
    const slug = newSlugCandidate();
    try {
      await env.DB.prepare(
        `INSERT INTO links (slug, type, target_url, r2_key, original_filename, mime, size_bytes, clerk_user_id, created_at, use_count, max_uses, last_used_at)
         VALUES (?, 'url', ?, NULL, NULL, NULL, 0, ?, ?, 0, ?, NULL)`,
      )
        .bind(slug, normalized, clerkUserId, createdAt, maxUses)
        .run();

      const short = `${env.PUBLIC_SHORT_ORIGIN.replace(/\/+$/, '')}/${slug}`;
      return Response.json({ slug, shortUrl: short, maxUses });
    } catch {
      /* slug collision — retry */
    }
  }

  return Response.json({ error: 'Could not allocate slug' }, { status: 503 });
};
