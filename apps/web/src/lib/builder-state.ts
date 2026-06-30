import { env } from 'cloudflare:workers';

/** One row in the unified ordered list. For `social`, `title` holds the platform key
 *  (e.g. "instagram"); for `link`, `title` holds the display title. */
export type BuilderItem = {
  id: number | null;
  type: 'link' | 'social';
  title: string;
  url: string;
  is_featured: boolean;
};

export type BuilderColors = {
  primary: string | null;
  secondary: string | null;
  text: string | null;
  background: string | null;
};
export type BuilderState = {
  username: string;
  display_name: string;
  subtitle: string;
  bio: string;
  theme: string;
  corners: string;
  colors: BuilderColors;
  avatar_r2_key: string | null;
  background_image_r2_key: string | null;
  items: BuilderItem[];
};

function parseColors(raw: string | null): BuilderColors {
  const empty: BuilderColors = { primary: null, secondary: null, text: null, background: null };
  if (!raw) return empty;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const pick = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : null);
    return { primary: pick('primary'), secondary: pick('secondary'), text: pick('text'), background: pick('background') };
  } catch { return empty; }
}

/** Loads the full editor state (profile + the single ordered links/socials list) for a creator. */
export async function loadBuilderState(clerkUserId: string): Promise<BuilderState | null> {
  const p = await env.DB.prepare(
    `SELECT id, username, display_name, subtitle, bio, avatar_r2_key, background_image_r2_key, theme, corners, colors
     FROM profiles WHERE clerk_user_id = ?`,
  )
    .bind(clerkUserId)
    .first<{
      id: number; username: string; display_name: string | null; subtitle: string | null;
      bio: string | null; avatar_r2_key: string | null; background_image_r2_key: string | null;
      theme: string; corners: string | null; colors: string | null;
    }>();
  if (!p) return null;

  const rows = (await env.DB.prepare(
    `SELECT id, type, title, url, is_featured FROM profile_links
     WHERE profile_id = ? ORDER BY sort_order ASC, id ASC`,
  ).bind(p.id).all<{ id: number; type: string; title: string; url: string; is_featured: number }>()).results ?? [];

  return {
    username: p.username,
    display_name: p.display_name ?? '',
    subtitle: p.subtitle ?? '',
    bio: p.bio ?? '',
    theme: p.theme || 'default',
    corners: p.corners || 'rounded',
    colors: parseColors(p.colors),
    avatar_r2_key: p.avatar_r2_key ?? null,
    background_image_r2_key: p.background_image_r2_key ?? null,
    items: rows.map((r) => ({
      id: r.id,
      type: r.type === 'social' ? 'social' : 'link',
      title: r.title ?? '',
      url: r.url ?? '',
      is_featured: !!r.is_featured,
    })),
  };
}
