/**
 * Single source of truth for the public profile body (`.bio-inner`).
 * Pure (no env, no Astro) so it runs identically server-side ([username].astro)
 * and client-side (builder live preview). Returns an HTML string — all
 * user-provided values are escaped here since callers inject via set:html/innerHTML.
 */
import {
  siInstagram, siTiktok, siX, siYoutube, siSpotify, siGithub,
  siThreads, siBluesky, siTwitch, siDiscord, siSubstack, siPatreon,
} from 'simple-icons';
import { avatarBackground, avatarInitial } from './avatar';

const ICONS: Record<string, { path: string; title: string }> = {
  instagram: siInstagram, tiktok: siTiktok, x: siX, youtube: siYoutube,
  spotify: siSpotify, github: siGithub, threads: siThreads, bluesky: siBluesky,
  twitch: siTwitch, discord: siDiscord, substack: siSubstack, patreon: siPatreon,
};

export const SOCIAL_NAMES = Object.keys(ICONS);

/** One entry in the single ordered list. `social` renders as an icon, `link` as a button
 *  (or a featured card when `featured`). Consecutive socials group onto one row. */
export type RenderItem =
  | { type: 'social'; name: string; url: string }
  | { type: 'link'; title: string; url: string; featured?: boolean };

export type RenderState = {
  username: string;
  displayName: string;
  subtitle?: string | null;
  bio?: string | null;
  /** Resolved image URL (media route or direct) or null → gradient avatar. */
  avatarSrc?: string | null;
  items: RenderItem[];
};

const isSocial = (x: RenderItem): x is Extract<RenderItem, { type: 'social' }> => x.type === 'social';
const isFeatured = (x: RenderItem): x is Extract<RenderItem, { type: 'link' }> => x.type === 'link' && !!x.featured;

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function socialIconSvg(name: string, size = 17): string {
  const icon = ICONS[name];
  if (!icon) return '';
  return `<svg role="img" viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-label="${esc(icon.title)}"><path d="${icon.path}"/></svg>`;
}

function linkAttrs(url: string): string {
  return `href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow"`;
}

export function renderProfileHTML(state: RenderState): string {
  const displayName = (state.displayName || state.username || '').trim() || state.username;
  const avatar = state.avatarSrc
    ? `<div class="bio-avatar" style="background:url('${esc(state.avatarSrc)}') center/cover no-repeat"></div>`
    : `<div class="bio-avatar" style="background:${avatarBackground(state.username)}">${esc(avatarInitial(displayName))}</div>`;

  const subtitle = state.subtitle?.trim()
    ? `<div class="bio-subtitle">${esc(state.subtitle.trim())}</div>` : '';
  const bio = state.bio?.trim()
    ? `<p class="bio-text">${esc(state.bio.trim())}</p>` : '';

  const items = state.items ?? [];
  let body: string;
  if (items.length === 0) {
    body = `<div class="bio-empty"><p class="bio-empty-title">No links yet</p><p class="bio-empty-sub">This page is just getting started.</p></div>`;
  } else {
    // Walk the ordered list, batching consecutive socials into one icon row and
    // consecutive plain links into one nav; featured links stand alone in place.
    const parts: string[] = [];
    let i = 0;
    while (i < items.length) {
      const it = items[i];
      if (isSocial(it)) {
        const run: typeof it[] = [];
        while (i < items.length && isSocial(items[i])) { run.push(items[i] as typeof it); i++; }
        parts.push(`<div class="bio-socials">${run
          .map((s) => `<a class="bio-social" ${linkAttrs(s.url)} aria-label="${esc(s.name)}">${socialIconSvg(s.name)}</a>`)
          .join('')}</div>`);
      } else if (isFeatured(it)) {
        parts.push(`<a class="bio-featured" ${linkAttrs(it.url)}><span class="bio-featured-kicker">Featured</span><span class="bio-featured-title">${esc(it.title)}</span></a>`);
        i++;
      } else {
        const run: Extract<RenderItem, { type: 'link' }>[] = [];
        while (i < items.length && items[i].type === 'link' && !isFeatured(items[i])) {
          run.push(items[i] as Extract<RenderItem, { type: 'link' }>); i++;
        }
        parts.push(`<nav class="bio-links" aria-label="Links">${run
          .map((l) => `<a class="bio-link" ${linkAttrs(l.url)}><span>${esc(l.title)}</span><span class="bio-link-arr" aria-hidden="true">↗</span></a>`)
          .join('')}</nav>`);
      }
    }
    body = parts.join('');
  }

  const footer = `<a class="bio-footer" href="/">Join ${esc(state.username)} on thelnk<span class="dot">.is</span></a>`;

  return `${avatar}<h1 class="bio-name">${esc(displayName)}</h1>${subtitle}<div class="bio-handle">@${esc(state.username)}</div>${bio}${body}${footer}`;
}
