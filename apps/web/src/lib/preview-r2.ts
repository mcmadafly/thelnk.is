/** Desktop captures — bump path when Microlink params change so stale PNGs are replaced. */
export const PREVIEW_R2_PREFIX = 'preview/desktop/';

export function previewR2Key(slug: string): string {
  return `${PREVIEW_R2_PREFIX}${slug}.png`;
}

/** Keys under `preview/{slug}.png` from before desktop viewport (mobile / legacy). */
export function isLegacyPreviewKey(key: string | null | undefined): boolean {
  if (!key) return false;
  return key.startsWith('preview/') && !key.startsWith(PREVIEW_R2_PREFIX);
}
