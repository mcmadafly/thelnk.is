import { env } from 'cloudflare:workers';

export {
  LINKS_SERVED_GAG_MILLIONS,
  LINKS_SERVED_TICKER_MIN_WIDTH,
  formatTickerLabel,
  padTickerCount,
  tickerGagStartValue,
} from './links-served-ticker';

/** Total successful URL opens + file downloads across all links. */
export async function loadLinksServedCount(): Promise<number> {
  try {
    const row = await env.DB.prepare(
      `SELECT COALESCE(SUM(use_count), 0) AS total FROM links`,
    ).first<{ total: number }>();
    return Math.max(0, Number(row?.total ?? 0));
  } catch {
    return 0;
  }
}
