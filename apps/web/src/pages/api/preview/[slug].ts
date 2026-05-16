import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { captureUrlPreviewToR2 } from '../../../lib/capture-url-preview';
import { isLegacyPreviewKey, previewR2Key } from '../../../lib/preview-r2';
import { canonicalSlugForPath } from '../../../lib/resolve-link-slug';
import { isValidSlug } from '../../../lib/slug';

export const prerender = false;

export const GET: APIRoute = async ({ params, url }) => {
  const raw = params.slug;
  if (!raw || !isValidSlug(raw)) {
    return new Response('Not found', { status: 404 });
  }

  const slug = await canonicalSlugForPath(env.DB, raw);
  if (!slug) {
    return new Response('Not found', { status: 404 });
  }

  const row = await env.DB.prepare(
    `SELECT type, target_url, preview_r2_key FROM links WHERE slug = ?`,
  )
    .bind(slug)
    .first<{ type: string; target_url: string | null; preview_r2_key: string | null }>();

  if (!row || String(row.type ?? '').toLowerCase() !== 'url' || !row.target_url) {
    return new Response('Not found', { status: 404 });
  }

  const targetUrl = row.target_url;
  let previewKey: string | null = row.preview_r2_key;
  if (!previewKey) {
    return new Response('Not found', { status: 404 });
  }

  const allowRefresh = import.meta.env.DEV && url.searchParams.get('refresh') === '1';
  const needsDesktopCapture = isLegacyPreviewKey(previewKey);

  let obj = await env.FILES.get(previewKey);
  if (allowRefresh || needsDesktopCapture) {
    await captureUrlPreviewToR2(slug, targetUrl, { force: true });
    previewKey = previewR2Key(slug);
    obj = await env.FILES.get(previewKey);
  }
  // DB key without an R2 object (e.g. D1 remote + local Miniflare R2 during dev) — re-capture on prod R2.
  if (!obj) {
    await captureUrlPreviewToR2(slug, targetUrl, { force: true });
    previewKey = previewR2Key(slug);
    obj = await env.FILES.get(previewKey);
    if (!obj) {
      const keyAfter = await env.DB.prepare(`SELECT preview_r2_key FROM links WHERE slug = ?`)
        .bind(slug)
        .first<{ preview_r2_key: string | null }>();
      const k = keyAfter?.preview_r2_key;
      previewKey = k ?? null;
      obj = k ? await env.FILES.get(k) : null;
    }
    if (!obj) {
      await env.DB.prepare(`UPDATE links SET preview_r2_key = NULL WHERE slug = ?`).bind(slug).run();
      return new Response('Not found', { status: 404 });
    }
  }

  if (!obj.body) {
    return new Response('Not found', { status: 404 });
  }

  const ct = obj.httpMetadata?.contentType ?? 'image/png';
  return new Response(obj.body, {
    headers: {
      'content-type': ct,
      'cache-control': needsDesktopCapture || allowRefresh ? 'no-store' : 'public, max-age=86400',
    },
  });
};
