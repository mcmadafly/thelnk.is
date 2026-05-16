/// <reference path="../../worker-configuration.d.ts" />

/**
 * Map a URL path segment to the `links.slug` primary key (exact match, else case-insensitive).
 * Keeps short links working when the stored slug casing differs from the requested URL.
 */
export async function canonicalSlugForPath(db: D1Database, raw: string | undefined): Promise<string | null> {
  if (!raw) return null;
  let s = raw;
  try {
    s = decodeURIComponent(s);
  } catch {
    /* keep raw */
  }
  s = s.trim();
  if (!s) return null;

  const exact = await db.prepare('SELECT slug FROM links WHERE slug = ?').bind(s).first<{ slug: string }>();
  if (exact?.slug) return exact.slug;

  const folded = await db
    .prepare('SELECT slug FROM links WHERE lower(slug) = lower(?) LIMIT 1')
    .bind(s)
    .first<{ slug: string }>();
  return folded?.slug ?? null;
}
