import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

// Streams an object from the R2 (FILES) binding. Keys are unguessable nanoids under
// avatar/ background/ product/. Long-cache + ETag; honors If-None-Match.
export const GET: APIRoute = async ({ params, request }) => {
  const key = params.key;
  if (!key) return new Response('Not found', { status: 404 });

  const obj = await env.FILES.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  const etag = obj.httpEtag;
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { etag } });
  }

  const headers = new Headers();
  obj.writeHttpMetadata(headers); // Content-Type from stored R2 metadata
  if (!headers.has('content-type')) headers.set('content-type', 'application/octet-stream');
  headers.set('etag', etag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(obj.body, { headers });
};
