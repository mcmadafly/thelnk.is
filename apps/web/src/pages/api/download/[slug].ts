import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { presignGet } from '../../../lib/r2-presign';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug;
  if (!slug) {
    return new Response('Not found', { status: 404 });
  }

  const row = await env.DB.prepare(
    `SELECT type, r2_key, original_filename FROM links WHERE slug = ?`,
  )
    .bind(slug)
    .first<{ type: string; r2_key: string | null; original_filename: string | null }>();

  if (!row || row.type !== 'file' || !row.r2_key) {
    return new Response('Not found', { status: 404 });
  }

  const filename = row.original_filename ?? 'download';

  let url: string;
  try {
    url = await presignGet(row.r2_key, filename);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Download unavailable';
    return Response.json({ error: msg }, { status: 503 });
  }

  return Response.redirect(url, 302);
};
