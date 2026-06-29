/** Resolve a stored image value to a URL: direct URL/path as-is, else the R2 media route. */
export function mediaUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  return /^(https?:)?\//.test(key) ? key : `/api/media/${key}`;
}
