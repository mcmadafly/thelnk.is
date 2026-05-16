import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { effectiveIsPremiumClerkUser } from '../../../../lib/plan';
import { canonicalSlugForPath } from '../../../../lib/resolve-link-slug';
import { isValidSlug } from '../../../../lib/slug';

export const prerender = false;

type LocalsCf = { cfContext?: { waitUntil: (p: Promise<unknown>) => void } };

type LinkRow = {
  slug: string;
  type: 'url' | 'file';
  r2_key: string | null;
  preview_r2_key: string | null;
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const raw = params.slug;
  if (!raw || !isValidSlug(raw)) {
    return Response.json({ error: 'Invalid slug' }, { status: 400 });
  }

  const auth = await locals.auth();
  const clerkUserId = auth.userId ?? null;
  if (!clerkUserId) {
    return Response.json({ error: 'Sign in required' }, { status: 401 });
  }

  const canDelete = await effectiveIsPremiumClerkUser(clerkUserId);
  if (!canDelete) {
    return Response.json({ error: 'Upgrade to Pro to delete links and files' }, { status: 403 });
  }

  const slug = await canonicalSlugForPath(env.DB, raw);
  if (!slug) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const row = await env.DB.prepare(
    `SELECT slug, type, r2_key, preview_r2_key
     FROM links
     WHERE slug = ? AND clerk_user_id = ?
     LIMIT 1`,
  )
    .bind(slug, clerkUserId)
    .first<LinkRow>();

  if (!row) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  await env.DB.prepare(`DELETE FROM links WHERE slug = ? AND clerk_user_id = ?`)
    .bind(row.slug, clerkUserId)
    .run();

  const keys = [row.r2_key, row.preview_r2_key].filter((x): x is string => Boolean(x && x.length));
  if (keys.length) {
    const cleanup = (async () => {
      for (const key of keys) {
        try {
          await env.FILES.delete(key);
        } catch (e) {
          console.error('[api/dashboard/links/[slug]] R2 cleanup failed', key, e);
        }
      }
    })();
    const cfContext = (locals as LocalsCf).cfContext;
    if (cfContext) cfContext.waitUntil(cleanup);
    else void cleanup;
  }

  return Response.json({ ok: true, slug: row.slug, type: row.type });
};
