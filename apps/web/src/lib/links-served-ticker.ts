/** Client-safe ticker formatting (no Cloudflare imports). */

export const LINKS_SERVED_GAG_MILLIONS = 3_098_130;
export const LINKS_SERVED_TICKER_MIN_WIDTH = 6;

export function tickerGagStartValue(gag: number, width: number): number {
  const cap = 10 ** width;
  return Math.max(0, Math.floor(gag) % cap);
}

export function padTickerCount(n: number, width: number): string {
  const cap = 10 ** width;
  const v = Math.max(0, Math.floor(n)) % cap;
  return String(v).padStart(width, '0');
}

/** US-style grouping: `000032` → `000,032`. */
export function formatTickerLabel(n: number, width: number): string {
  const padded = padTickerCount(n, width);
  const digits = padded.split('');
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ',';
    out += digits[i];
  }
  return out;
}
