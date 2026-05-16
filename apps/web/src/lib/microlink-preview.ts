/** Microlink query defaults: full-page desktop screenshot (marketing / wall-of-fame style). */
export const MICROLINK_API = 'https://api.microlink.io/';
export const PREVIEW_VIEWPORT_WIDTH = 1440;
export const PREVIEW_VIEWPORT_HEIGHT = 900;
export const PREVIEW_MICROLINK_TIMEOUT_MS = 90_000;
export const PREVIEW_IMAGE_FETCH_TIMEOUT_MS = 120_000;

export type MicrolinkScreenshotOptions = {
  apiKey?: string;
  /** Bypass Microlink CDN cache when re-capturing an existing preview. */
  force?: boolean;
};

export function buildMicrolinkScreenshotUrl(
  targetUrl: string,
  options?: MicrolinkScreenshotOptions,
): URL {
  const api = new URL(MICROLINK_API);
  api.searchParams.set('url', targetUrl);
  api.searchParams.set('screenshot', 'true');
  api.searchParams.set('screenshot.fullPage', 'true');
  api.searchParams.set('viewport.width', String(PREVIEW_VIEWPORT_WIDTH));
  api.searchParams.set('viewport.height', String(PREVIEW_VIEWPORT_HEIGHT));
  api.searchParams.set('viewport.isMobile', 'false');
  api.searchParams.set('waitForTimeout', '3000');
  api.searchParams.set('timeout', String(PREVIEW_MICROLINK_TIMEOUT_MS));
  api.searchParams.set('meta', 'false');
  if (options?.force) {
    api.searchParams.set('force', 'true');
  }
  const token = options?.apiKey;
  if (typeof token === 'string' && token) {
    api.searchParams.set('apiKey', token);
  }
  return api;
}
