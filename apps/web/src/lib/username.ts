/**
 * Username rules for public profiles at thelnk.is/:username.
 * Distinct from link-slug rules — usernames are user-chosen, lowercase-canonical,
 * and must never collide with a real top-level route.
 */

/** Canonical source of truth for names that can't be claimed (must mirror real top-level paths). */
export const RESERVED_USERNAMES = new Set([
  // route/segment collisions
  'api', 'dashboard', 'sign-in', 'sign-up', 'signin', 'signup', 'login', 'logout',
  'health', 'terms', 'privacy', 'changelog', 'onboarding', 'claim', 'settings', 'account', 'admin',
  'f',
  // static assets
  'favicon.ico', 'favicon.svg', 'favicon.png', 'robots.txt', 'sitemap.xml',
  // brand / safety
  'thelnk', 'www', 'support', 'help', 'about', 'pricing', 'status', 'blog', 'docs',
]);

/** Lowercase + trim + Unicode-normalize so one canonical form is stored and looked up. */
export function normalizeUsername(raw: string): string {
  return raw.normalize('NFKC').trim().toLowerCase();
}

/** Letters/numbers, with single internal hyphens or underscores only (no leading/trailing/double separators). */
const USERNAME_RE = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

export type UsernameCheck =
  | { ok: true; username: string }
  | { ok: false; reason: string };

export function validateUsername(raw: string): UsernameCheck {
  const u = normalizeUsername(raw ?? '');
  if (u.length < 3) return { ok: false, reason: 'Username must be at least 3 characters.' };
  if (u.length > 30) return { ok: false, reason: 'Username must be 30 characters or fewer.' };
  if (!USERNAME_RE.test(u)) {
    return { ok: false, reason: 'Use letters and numbers, with single hyphens or underscores between them.' };
  }
  if (RESERVED_USERNAMES.has(u)) return { ok: false, reason: 'That username is reserved.' };
  return { ok: true, username: u };
}
