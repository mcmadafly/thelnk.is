const MIME_BLOCKLIST = new Set(
  [
    'application/ecmascript', 'application/javascript', 'application/jscript',
    'application/vnd.mozilla.xul+xml', 'application/xhtml+xml', 'application/x-javascript',
    'image/svg+xml', 'text/ecmascript', 'text/html', 'text/javascript', 'text/xml',
  ].map((s) => s.toLowerCase()),
);

const MIME_TOKEN_RE = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,127}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,127}$/i;

export function safeFilename(name: string, emptyFallback = 'upload.bin'): string {
  const base = name
    .replace(/^.*[/\\]/, '')
    .replace(/[\p{Cc}<>:"|?*\\]/gu, '')
    .replace(/\.\./g, '')
    .trim()
    .slice(0, 200);
  return base || emptyFallback;
}

/** Normalize + validate a Content-Type; rejects header-injection, non-token forms, executable MIME. */
export function sanitizeUploadContentType(raw: string): string | null {
  const t = raw.trim().slice(0, 128);
  if (!t || /\p{Cc}/u.test(t)) return null;
  if (t.includes(';')) return null;
  if (!MIME_TOKEN_RE.test(t)) return null;
  if (MIME_BLOCKLIST.has(t.toLowerCase())) return null;
  return t;
}
