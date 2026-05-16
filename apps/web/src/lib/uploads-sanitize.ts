/** Staging object keys from `init` — must stay in sync with `customAlphabet` there. */
const STAGING_KEY_RE = /^obj\/[23456789abcdefghijkmnopqrstuvwxyz]{26}$/;

const MIME_BLOCKLIST = new Set(
  [
    'application/ecmascript',
    'application/javascript',
    'application/jscript',
    'application/vnd.mozilla.xul+xml',
    'application/xhtml+xml',
    'application/x-javascript',
    'image/svg+xml',
    'text/ecmascript',
    'text/html',
    'text/javascript',
    'text/xml',
  ].map((s) => s.toLowerCase()),
);

/** `type/subtype` per RFC 6838–style tokens (no parameters, no spaces). */
const MIME_TOKEN_RE = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,127}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,127}$/i;

export function isStagingObjectKey(key: string): boolean {
  return STAGING_KEY_RE.test(key);
}

export function safeFilename(name: string, emptyFallback = 'upload.bin'): string {
  const base = name
    .replace(/^.*[/\\]/, '')
    .replace(/[\u0000-\u001f<>:"|?*\\]/g, '')
    .replace(/\.\./g, '')
    .trim()
    .slice(0, 200);
  return base || emptyFallback;
}

/**
 * Normalizes and validates Content-Type for presigned PUT / DB.
 * Rejects header-injection characters, non-token forms, and browser-executable MIME classes.
 */
export function sanitizeUploadContentType(raw: string): string | null {
  const t = raw.trim().slice(0, 128);
  if (!t || /[\u0000-\u001f\u007f]/.test(t)) return null;
  if (t.includes(';')) return null;
  if (!MIME_TOKEN_RE.test(t)) return null;
  if (MIME_BLOCKLIST.has(t.toLowerCase())) return null;
  return t;
}
