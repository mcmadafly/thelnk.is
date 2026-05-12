import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { customAlphabet } from 'nanoid';
import { presignPut } from '../../../lib/r2-presign';
import { MAX_UPLOAD_BYTES } from '../../../lib/constants';

export const prerender = false;

const stagingId = customAlphabet('23456789abcdefghijkmnopqrstuvwxyz', 26);

function safeFilename(name: string): string {
  const base = name
    .replace(/^.*[/\\]/, '')
    .replace(/[\u0000-\u001f<>:"|?*\\]/g, '')
    .trim()
    .slice(0, 200);
  return base || 'upload.bin';
}

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { filename, contentType, size } = body as Record<string, unknown>;
  const name = safeFilename(String(filename ?? ''));
  const mime = String(contentType ?? '').trim().slice(0, 128);
  const n = typeof size === 'number' ? size : Number(size);

  if (!mime) {
    return Response.json({ error: 'contentType is required' }, { status: 400 });
  }
  if (!Number.isFinite(n) || n <= 0 || n > MAX_UPLOAD_BYTES) {
    return Response.json({ error: `size must be between 1 and ${MAX_UPLOAD_BYTES}` }, { status: 400 });
  }

  const r2Key = `obj/${stagingId()}`;

  let uploadUrl: string;
  try {
    uploadUrl = await presignPut(r2Key, mime, Math.trunc(n));
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'R2 configuration error';
    return Response.json({ error: msg }, { status: 503 });
  }

  return Response.json({
    uploadUrl,
    r2Key,
    filename: name,
    contentType: mime,
    size: Math.trunc(n),
  });
};
