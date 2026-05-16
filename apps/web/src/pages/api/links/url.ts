import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { captureUrlPreviewToR2 } from '../../../lib/capture-url-preview';
import { notifyDiscordLinkSaved } from '../../../lib/discord-webhook';
import { devDetail } from '../../../lib/dev-detail';
import { maxUsesForNewLink } from '../../../lib/plan';
import { newSlugCandidate } from '../../../lib/slug';
import { normalizeHttpUrl } from '../../../lib/urls';

export const prerender = false;

type LocalsCf = { cfContext?: { waitUntil: (p: Promise<unknown>) => void } };

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
  let maxUses: number;
  try {
    maxUses = await maxUsesForNewLink(clerkUserId);
  } catch (e) {
    console.error('[api/links/url] maxUsesForNewLink failed', e);
    const detail = devDetail(e);
    return Response.json(
      {
        error: 'Could not read creator plan (D1)',
        reason: 'db_plan',
        ...(detail ? { detail } : {}),
      },
      { status: 503 },
    );
  }

  let lastInsertError: unknown;
  for (let attempt = 0; attempt < 10; attempt++) {
    const slug = newSlugCandidate();
    try {
      await env.DB.prepare(
        `INSERT INTO links (slug, type, target_url, r2_key, original_filename, mime, size_bytes, clerk_user_id, created_at, use_count, max_uses, last_used_at)
         VALUES (?, 'url', ?, NULL, NULL, NULL, 0, ?, ?, 0, ?, NULL)`,
      )
        .bind(slug, normalized, clerkUserId, createdAt, maxUses)
        .run();

      const job = captureUrlPreviewToR2(slug, normalized);
      const short = `${env.PUBLIC_SHORT_ORIGIN.replace(/\/+$/, '')}/${slug}`;
      const discordJob = notifyDiscordLinkSaved({
        type: 'url',
        slug,
        shortUrl: short,
        clerkUserId,
        targetUrl: normalized,
      });
      // Must call as `cfContext.waitUntil(p)` — extracting `waitUntil` loses `this` (illegal invocation).
      const cfContext = (locals as LocalsCf).cfContext;
      if (cfContext) {
        cfContext.waitUntil(job);
        cfContext.waitUntil(discordJob);
      } else {
        void job;
        void discordJob;
      }

      return Response.json({ slug, shortUrl: short, maxUses });
    } catch (e) {
      lastInsertError = e;
      console.error('[api/links/url] insert failed', e);
    }
  }

  const detail = devDetail(lastInsertError);
  return Response.json(
    {
      error: 'Could not allocate slug',
      reason: 'db_insert',
      ...(detail ? { detail } : {}),
    },
    { status: 503 },
  );
};
