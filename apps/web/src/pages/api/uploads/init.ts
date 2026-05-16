import type { APIRoute } from 'astro';
import { customAlphabet } from 'nanoid';
import { presignPut } from '../../../lib/r2-presign';
import { UPLOAD_FILE_SIZE_INVALID_MESSAGE, uploadFileTooLargeMessage } from '../../../lib/constants';
import { maxUploadLimitForClerkUser } from '../../../lib/plan';
import { safeFilename, sanitizeUploadContentType } from '../../../lib/uploads-sanitize';

export const prerender = false;

const stagingId = customAlphabet('23456789abcdefghijkmnopqrstuvwxyz', 26);

export const POST: APIRoute = async ({ request, locals }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }

  const auth = await locals.auth();
  const { maxBytes, isPremium } = await maxUploadLimitForClerkUser(auth.userId ?? null);

  const { filename, contentType, size } = body as Record<string, unknown>;
  const name = safeFilename(String(filename ?? ''));
  const mime = sanitizeUploadContentType(String(contentType ?? ''));
  const n = typeof size === 'number' ? size : Number(size);

  if (!mime) {
    return Response.json({ error: 'Invalid or disallowed contentType' }, { status: 400 });
  }
  if (!Number.isFinite(n) || n <= 0) {
    return Response.json({ error: UPLOAD_FILE_SIZE_INVALID_MESSAGE }, { status: 400 });
  }
  if (n > maxBytes) {
    return Response.json({ error: uploadFileTooLargeMessage(maxBytes, isPremium) }, { status: 400 });
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
