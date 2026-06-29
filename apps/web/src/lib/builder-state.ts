import { env } from 'cloudflare:workers';

export type BuilderLink = { id: number | null; title: string; url: string; is_featured: boolean };
export type BuilderState = {
  username: string;
  display_name: string;
  subtitle: string;
  bio: string;
  theme: string;
  avatar_r2_key: string | null;
  background_image_r2_key: string | null;
  socials: { name: string; url: string }[];
  links: BuilderLink[];
};

/** Loads the full editor state (profile + socials + links) for a creator. */
export async function loadBuilderState(clerkUserId: string): Promise<BuilderState | null> {
  const p = await env.DB.prepare(
    `SELECT id, username, display_name, subtitle, bio, avatar_r2_key, background_image_r2_key, theme, socials
     FROM profiles WHERE clerk_user_id = ?`,
  )
    .bind(clerkUserId)
    .first<{
      id: number; username: string; display_name: string | null; subtitle: string | null;
      bio: string | null; avatar_r2_key: string | null; background_image_r2_key: string | null;
      theme: string; socials: string | null;
    }>();
  if (!p) return null;

  const linkRows = (await env.DB.prepare(
    `SELECT id, title, url, is_featured FROM profile_links WHERE profile_id = ? ORDER BY sort_order ASC, id ASC`,
  ).bind(p.id).all<{ id: number; title: string; url: string; is_featured: number }>()).results ?? [];

  let socials: { name: string; url: string }[] = [];
  if (p.socials) {
    try {
      const x = JSON.parse(p.socials);
      if (Array.isArray(x)) socials = x.filter((s) => s && typeof s.name === 'string' && typeof s.url === 'string');
    } catch { /* ignore */ }
  }

  return {
    username: p.username,
    display_name: p.display_name ?? '',
    subtitle: p.subtitle ?? '',
    bio: p.bio ?? '',
    theme: p.theme || 'default',
    avatar_r2_key: p.avatar_r2_key ?? null,
    background_image_r2_key: p.background_image_r2_key ?? null,
    socials,
    links: linkRows.map((l) => ({ id: l.id, title: l.title, url: l.url, is_featured: !!l.is_featured })),
  };
}
