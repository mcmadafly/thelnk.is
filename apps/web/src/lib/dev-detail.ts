/** Safe-ish diagnostic string for JSON in local development only. */
export function devDetail(e: unknown): string | undefined {
  const dev = import.meta.env.DEV || import.meta.env.MODE === 'development';
  if (!dev) return undefined;
  if (e instanceof Error) return e.message;
  if (e != null && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  return String(e);
}
