// Client-side helpers shared by the admin builder pages (Appearance + Links).
import { renderProfileHTML, type RenderItem } from './profile-render';
import { themeStyle } from './themes';
import { mediaUrl } from './media';

/** One row in the unified ordered list (links + socials share one collection). */
export type BuilderItem = {
  id: number | null;
  type: 'link' | 'social';
  title: string; // social: platform key; link: display title
  url: string;
  is_featured: boolean;
};
export type BuilderState = {
  username: string; display_name: string; subtitle: string; bio: string; theme: string;
  avatar_r2_key: string | null; background_image_r2_key: string | null;
  items: BuilderItem[];
};

/** Map editor items → pure render items (dropping anything not yet fillable). */
export function toRenderItems(items: BuilderItem[]): RenderItem[] {
  const out: RenderItem[] = [];
  for (const it of items) {
    if (it.type === 'social') {
      if (it.title && it.url.trim()) out.push({ type: 'social', name: it.title, url: it.url });
    } else if (it.title.trim() || it.url.trim()) {
      out.push({ type: 'link', title: it.title, url: it.url, featured: it.is_featured });
    }
  }
  return out;
}

/** Re-render the live preview (byte-identical to the public page via renderProfileHTML). */
export function paintPreview(bioEl: HTMLElement, innerEl: HTMLElement, s: BuilderState): void {
  innerEl.innerHTML = renderProfileHTML({
    username: s.username,
    displayName: s.display_name || s.username,
    subtitle: s.subtitle,
    bio: s.bio,
    avatarSrc: mediaUrl(s.avatar_r2_key),
    items: toRenderItems(s.items),
  });
  const bg = mediaUrl(s.background_image_r2_key);
  const base = themeStyle(s.theme);
  bioEl.setAttribute(
    'style',
    bg ? `${base};background:linear-gradient(rgba(0,0,0,.4),rgba(0,0,0,.4)),url('${bg}') center/cover` : base,
  );
  bioEl.classList.toggle('has-bg', !!bg);
}

/** Browser→R2 image upload; resolves to the stored r2 key or null. */
export async function uploadImage(purpose: 'avatar' | 'background'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,image/gif,image/avif';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const initRes = await fetch('/api/uploads/init', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ purpose, contentType: file.type, size: file.size }),
        });
        const init = (await initRes.json()) as any;
        if (!initRes.ok) return resolve(null);
        const put = await fetch(init.uploadUrl, { method: 'PUT', headers: { 'Content-Type': init.contentType }, body: file });
        resolve(put.ok ? init.r2Key : null);
      } catch { resolve(null); }
    };
    input.click();
  });
}

/** Save the profile section (Appearance). Links/socials save per-row via /api/builder/links. */
export async function saveProfile(s: BuilderState): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/builder/profile', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      display_name: s.display_name, subtitle: s.subtitle, bio: s.bio, theme: s.theme,
      avatar_r2_key: s.avatar_r2_key, background_image_r2_key: s.background_image_r2_key,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as any;
  return { ok: res.ok, error: data.error || data.reason };
}
