import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { MAX_UPLOAD_BYTES } from '../../../lib/constants';
import { maxUsesForNewLink } from '../../../lib/plan';
import { newSlugCandidate } from '../../../lib/slug';

export const prerender = false;

function safeFilename(name: string): string {
  const base = name
    .replace(/^.*[/\\]/, '')
    .replace(/[\u0000-\u001f<>:"|?*\\]/g, '')
    .trim()
    .slice(0, 200);
  return base || 'download.bin';
}

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

  const { r2Key, filename, contentType, size } = body as Record<string, unknown>;
  const key = String(r2Key ?? '');
  const name = safeFilename(String(filename ?? ''));
  const mime = String(contentType ?? '').trim().slice(0, 128);
  const n = typeof size === 'number' ? size : Number(size);

  if (!key.startsWith('obj/') || key.length > 512) {
    return Response.json({ error: 'Invalid r2Key' }, { status: 400 });
  }
  if (!mime) {
    return Response.json({ error: 'contentType is required' }, { status: 400 });
  }
  if (!Number.isFinite(n) || n <= 0 || n > MAX_UPLOAD_BYTES) {
    return Response.json({ error: 'Invalid size' }, { status: 400 });
  }
  const sizeInt = Math.trunc(n);

  const head = await env.FILES.head(key);
  if (!head) {
    return Response.json({ error: 'Object not found in storage (finish upload first)' }, { status: 400 });
  }
  if (head.size !== sizeInt) {
    return Response.json({ error: 'Size mismatch with stored object' }, { status: 400 });
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
         VALUES (?, 'file', NULL, ?, ?, ?, ?, ?, ?, 0, ?, NULL)`,
      )
        .bind(slug, key, name, mime, sizeInt, clerkUserId, createdAt, maxUses)
        .run();

      const short = `${env.PUBLIC_SHORT_ORIGIN.replace(/\/+$/, '')}/${slug}`;
      return Response.json({ slug, shortUrl: short, maxUses });
    } catch {
      /* slug collision */
    }
  }

  return Response.json({ error: 'Could not allocate slug' }, { status: 503 });
};
