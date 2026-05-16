import { env } from 'cloudflare:workers';
import {
  PREVIEW_IMAGE_FETCH_TIMEOUT_MS,
  PREVIEW_MICROLINK_TIMEOUT_MS,
  buildMicrolinkScreenshotUrl,
} from './microlink-preview';
import { previewR2Key } from './preview-r2';

export { isLegacyPreviewKey, previewR2Key, PREVIEW_R2_PREFIX } from './preview-r2';

export type CaptureUrlPreviewOptions = {
  /** Bypass Microlink cache when replacing an existing R2 object. */
  force?: boolean;
};

/**
 * Screenshot destination URL via Microlink (full-page, desktop viewport), store PNG in R2, persist key on `links`.
 * Safe to run in `waitUntil` — failures are logged only.
 */
export async function captureUrlPreviewToR2(
  slug: string,
  targetUrl: string,
  options?: CaptureUrlPreviewOptions,
): Promise<void> {
  const key = previewR2Key(slug);
  try {
    const token = env.MICROLINK_API_KEY;
    const api = buildMicrolinkScreenshotUrl(targetUrl, {
      apiKey: typeof token === 'string' ? token : undefined,
      force: options?.force,
    });

    const metaRes = await fetch(api.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(PREVIEW_MICROLINK_TIMEOUT_MS),
    });
    if (!metaRes.ok) {
      console.warn('[captureUrlPreview] microlink meta', metaRes.status, slug);
      return;
    }
    const meta = (await metaRes.json()) as {
      status?: string;
      data?: { screenshot?: { url?: string } };
    };
    const shotUrl = meta.data?.screenshot?.url;
    if (!shotUrl) {
      console.warn('[captureUrlPreview] no screenshot in response', slug, meta.status);
      return;
    }
    if (meta.status && meta.status !== 'success') {
      console.warn('[captureUrlPreview] microlink non-success status, trying screenshot anyway', meta.status, slug);
    }

    const imgRes = await fetch(shotUrl, { signal: AbortSignal.timeout(PREVIEW_IMAGE_FETCH_TIMEOUT_MS) });
    if (!imgRes.ok || !imgRes.body) {
      console.warn('[captureUrlPreview] screenshot fetch', imgRes.status, slug);
      return;
    }

    const buf = await imgRes.arrayBuffer();
    if (buf.byteLength < 2_000) {
      console.warn('[captureUrlPreview] image too small', buf.byteLength, slug);
      return;
    }

    await env.FILES.put(key, buf, {
      httpMetadata: { contentType: imgRes.headers.get('content-type') ?? 'image/png', cacheControl: 'public, max-age=31536000' },
    });

    await env.DB.prepare(`UPDATE links SET preview_r2_key = ? WHERE slug = ? AND type = 'url'`).bind(key, slug).run();
  } catch (e) {
    console.warn('[captureUrlPreview] failed', slug, e);
  }
}
