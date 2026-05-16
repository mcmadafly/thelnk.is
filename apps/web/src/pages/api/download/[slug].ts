import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { trackLinkEvent } from '../../../lib/link-analytics';
import { isPremiumClerkUser } from '../../../lib/plan';
import { presignGet } from '../../../lib/r2-presign';
import { canonicalSlugForPath } from '../../../lib/resolve-link-slug';
import { isValidSlug } from '../../../lib/slug';

export const prerender = false;

type LocalsCf = { cfContext?: { waitUntil: (p: Promise<unknown>) => void } };

export const GET: APIRoute = async ({ params, locals }) => {
  const raw = params.slug;
  if (!raw || !isValidSlug(raw)) {
    return new Response('Not found', { status: 404 });
  }

  const slug = await canonicalSlugForPath(env.DB, raw);
  if (!slug) {
    return new Response('Not found', { status: 404 });
  }

  const base = await env.DB.prepare(
    `SELECT r2_key, original_filename, clerk_user_id
     FROM links
     WHERE slug = ? AND type = 'file'
     LIMIT 1`,
  )
    .bind(slug)
    .first<{ r2_key: string | null; original_filename: string | null; clerk_user_id: string | null }>();

  if (!base?.r2_key) {
    return new Response('Not found', { status: 404 });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const premium = await isPremiumClerkUser(base.clerk_user_id ?? null);
  const row = premium
    ? await env.DB.prepare(
      `UPDATE links
       SET use_count = use_count + 1, last_used_at = ?
       WHERE slug = ? AND type = 'file'
       RETURNING r2_key, original_filename`,
    )
      .bind(nowSec, slug)
      .first<{ r2_key: string | null; original_filename: string | null }>()
    : await env.DB.prepare(
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
    if (!exists || String(exists.type ?? '').toLowerCase() !== 'file') {
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

  const analyticsJob = trackLinkEvent(slug, 'file_download', nowSec);
  const cfContext = (locals as LocalsCf).cfContext;
  if (cfContext) cfContext.waitUntil(analyticsJob);
  else void analyticsJob;

  return Response.redirect(signedUrl, 302);
};
