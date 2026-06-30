import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { resolvedThemeVars } from '../../../lib/themes';
import { avatarBackground, avatarInitial } from '../../../lib/avatar';

export const prerender = false;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = async ({ params }) => {
  const origin = env.PUBLIC_APP_ORIGIN.replace(/\/+$/, '');
  const fallback = () => Response.redirect(`${origin}/og.png`, 302);

  const username = (params.username ?? '').toString();
  if (!/^[a-z0-9_]{1,40}$/i.test(username)) return fallback();

  const p = await env.DB.prepare(
    `SELECT username, display_name, avatar_r2_key, theme, colors FROM profiles
     WHERE username = ? COLLATE NOCASE AND deleted_at IS NULL`,
  )
    .bind(username)
    .first<{ username: string; display_name: string | null; avatar_r2_key: string | null; theme: string; colors: string | null }>();
  if (!p) return fallback();

  try {
    const { ImageResponse, loadGoogleFont } = await import('workers-og');

    const name = (p.display_name?.trim() || p.username).slice(0, 40);
    let colors: Record<string, string> | null = null;
    try { colors = p.colors ? JSON.parse(p.colors) : null; } catch { colors = null; }
    const v = resolvedThemeVars(p.theme, { colors });
    const bg = v.bg ?? '#100f0d';
    const text = v.text ?? '#f6f3ee';
    const accent = v.accent ?? '#f97316';
    const muted = v.muted ?? '#a39c92';
    const cover = v['bio-cover'] ?? 'linear-gradient(135deg,#f97316,#d946ef 60%,#6d28d9)';

    // satori fetches images by URL, so the avatar must be absolute.
    const key = p.avatar_r2_key;
    let avatarUrl: string | null = null;
    if (key) {
      if (/^https?:\/\//.test(key)) avatarUrl = key;
      else if (key.startsWith('/')) avatarUrl = `${origin}${key}`;
      else avatarUrl = `${origin}/api/media/${key}`;
    }
    const avatar = avatarUrl
      ? `<img src="${esc(avatarUrl)}" style="width:200px;height:200px;border-radius:100px;border:6px solid ${bg};object-fit:cover" />`
      : `<div style="display:flex;align-items:center;justify-content:center;width:200px;height:200px;border-radius:100px;border:6px solid ${bg};background:${avatarBackground(p.username)};font-family:Alexandria;font-size:88px;font-weight:800;color:#fff">${esc(avatarInitial(name))}</div>`;

    const html = `
      <div style="display:flex;flex-direction:column;width:1200px;height:630px;background:${bg};color:${text}">
        <div style="display:flex;width:100%;height:240px;background:${cover}"></div>
        <div style="display:flex;flex-direction:column;align-items:center;flex:1;margin-top:-130px;padding:0 60px">
          ${avatar}
          <div style="display:flex;font-family:Alexandria;font-size:68px;font-weight:800;margin-top:30px">${esc(name)}</div>
          <div style="display:flex;font-family:Manrope;font-size:34px;font-weight:600;margin-top:6px;color:${accent}">@${esc(p.username)}</div>
        </div>
        <div style="display:flex;align-items:center;justify-content:center;height:96px;font-family:Alexandria;font-size:30px;font-weight:700;color:${muted}"><span>thelnk</span><span style="color:${accent}">.is</span></div>
      </div>`;

    const sample = `${name} @${p.username} thelnk.is abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`;
    const [alexandria, manrope] = await Promise.all([
      loadGoogleFont({ family: 'Alexandria', weight: 800, text: sample }),
      loadGoogleFont({ family: 'Manrope', weight: 600, text: sample }),
    ]);

    return new ImageResponse(html, {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Alexandria', data: alexandria, weight: 800, style: 'normal' },
        { name: 'Manrope', data: manrope, weight: 600, style: 'normal' },
      ],
      headers: { 'cache-control': 'public, max-age=3600, s-maxage=86400' },
    });
  } catch (e) {
    console.error('[api/og] generation failed', e);
    return fallback();
  }
};
