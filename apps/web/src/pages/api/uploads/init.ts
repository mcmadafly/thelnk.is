import type { APIRoute } from 'astro';
import { customAlphabet } from 'nanoid';
import { presignPut } from '../../../lib/r2-presign';
import { sanitizeUploadContentType } from '../../../lib/uploads-sanitize';
import { devDetail } from '../../../lib/dev-detail';

export const prerender = false;

const nano = customAlphabet('23456789abcdefghijkmnopqrstuvwxyz', 24);
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);
const MAX_BYTES = 5 * 1024 * 1024;
const PURPOSES = new Set(['avatar', 'background', 'product']);

export const POST: APIRoute = async ({ request, locals }) => {
  const auth = await locals.auth();
  if (!auth.userId) return Response.json({ error: 'Sign in to upload' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const b = (body ?? {}) as Record<string, unknown>;

  const purpose = String(b.purpose ?? '');
  const contentType = sanitizeUploadContentType(String(b.contentType ?? ''));
  const size = Number(b.size ?? 0);

  if (!PURPOSES.has(purpose)) return Response.json({ error: 'Invalid purpose' }, { status: 400 });
  if (!contentType || !ALLOWED.has(contentType)) {
    return Response.json({ error: 'Only PNG, JPEG, WebP, GIF or AVIF images are allowed' }, { status: 400 });
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) {
    return Response.json({ error: 'Image must be between 1 byte and 5 MB' }, { status: 400 });
  }

  const r2Key = `${purpose}/${nano()}`;
  try {
    const uploadUrl = await presignPut(r2Key, contentType, Math.trunc(size));
    return Response.json({ uploadUrl, r2Key, contentType });
  } catch (e) {
    console.error('[uploads/init] presign failed', e);
    const detail = devDetail(e);
    return Response.json({ error: 'Could not start upload', ...(detail ? { detail } : {}) }, { status: 503 });
  }
};
