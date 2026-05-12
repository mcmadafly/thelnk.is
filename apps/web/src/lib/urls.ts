/** Normalize user input into an absolute http(s) URL, or null if invalid. */
export function normalizeHttpUrl(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    try {
      const u = new URL(`https://${t}`);
      if (!u.hostname.includes('.')) return null;
      return u.toString();
    } catch {
      return null;
    }
  }
}
