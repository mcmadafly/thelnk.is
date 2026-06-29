import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isPremiumClerkUser } from '../../../lib/plan';
import { isThemeAllowed, getTheme } from '../../../lib/themes';
import { normalizeHttpUrl } from '../../../lib/urls';
import { SOCIAL_NAMES } from '../../../lib/profile-render';
import { devDetail } from '../../../lib/dev-detail';
import { devClerkUserId } from '../../../lib/dev-auth';

export const prerender = false;

const ALLOWED_SOCIALS = new Set(SOCIAL_NAMES);
const MEDIA_KEY_RE = /^(avatar|background)\/[a-z0-9]{24}$/;

function clip(v: unknown, max: number): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

/** Accepts null (clear), a media key we issued, or an existing direct URL/path; else null. */
function mediaValue(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v);
  return MEDIA_KEY_RE.test(s) || /^(https?:)?\//.test(s) ? s : null;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const auth = typeof locals.auth === 'function' ? await locals.auth() : { userId: null };
  const clerkUserId = (auth.userId ?? null) || (await devClerkUserId());
  if (!clerkUserId) return Response.json({ error: 'Sign in' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const b = (body ?? {}) as Record<string, unknown>;

  const displayName = clip(b.display_name, 80);
  const subtitle = clip(b.subtitle, 80);
  const bio = clip(b.bio, 500);
  const avatarKey = mediaValue(b.avatar_r2_key);
  const backgroundKey = mediaValue(b.background_image_r2_key);

  // Theme must exist and be allowed for this user's plan.
  const themeId = String(b.theme ?? 'default');
  const isPro = await isPremiumClerkUser(clerkUserId);
  if (!isThemeAllowed(themeId, isPro)) {
    return Response.json({ error: 'That theme is Pro-only', reason: 'pro_theme' }, { status: 403 });
  }
  const theme = getTheme(themeId).id;

  // Socials: known platform + valid URL, capped at 8.
  let socialsJson: string | null = null;
  if (Array.isArray(b.socials)) {
    const clean = (b.socials as unknown[])
      .map((s) => (s ?? {}) as Record<string, unknown>)
      .map((s) => ({ name: String(s.name ?? ''), url: normalizeHttpUrl(String(s.url ?? '')) }))
      .filter((s): s is { name: string; url: string } => ALLOWED_SOCIALS.has(s.name) && !!s.url)
      .slice(0, 8);
    socialsJson = clean.length ? JSON.stringify(clean) : null;
  }

  const now = Math.floor(Date.now() / 1000);
  try {
    const res = await env.DB.prepare(
      `UPDATE profiles SET
         display_name = ?, subtitle = ?, bio = ?, theme = ?, socials = ?,
         avatar_r2_key = ?, background_image_r2_key = ?, updated_at = ?
       WHERE clerk_user_id = ?`,
    )
      .bind(displayName, subtitle, bio, theme, socialsJson, avatarKey, backgroundKey, now, clerkUserId)
      .run();

    if (!res.meta?.changes) {
      const exists = await env.DB.prepare(`SELECT 1 AS x FROM profiles WHERE clerk_user_id = ?`).bind(clerkUserId).first();
      if (!exists) return Response.json({ error: 'No profile' }, { status: 404 });
    }
    return Response.json({ ok: true, theme });
  } catch (e) {
    console.error('[builder/profile] update failed', e);
    const detail = devDetail(e);
    return Response.json({ error: 'Could not save', ...(detail ? { detail } : {}) }, { status: 503 });
  }
};
