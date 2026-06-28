import { env } from 'cloudflare:workers';

/** Wall-clock minute bucket (stable per UTC minute). */
function currentBucket(): number {
  return Math.floor(Date.now() / 60_000);
}

/** POST rate limits per route key (per IP per minute). */
export const RATE_LIMITS: Record<string, number> = {
  '/api/profile/claim': 10,
};

/**
 * Increments the counter for this route+IP in the current minute bucket.
 * Returns whether the request is still under the limit (inclusive).
 */
export async function checkPostRateLimit(route: string, ip: string, maxPerWindow: number): Promise<boolean> {
  const bucket = currentBucket();
  const row = await env.DB.prepare(
    `INSERT INTO rate_limit_hits (route, ip, bucket, hits) VALUES (?, ?, ?, 1)
     ON CONFLICT(route, ip, bucket) DO UPDATE SET hits = rate_limit_hits.hits + 1
     RETURNING hits`,
  )
    .bind(route, ip, bucket)
    .first<{ hits: number }>();

  const hits = row?.hits ?? 1;
  if (Math.random() < 0.02) {
    void env.DB.prepare(`DELETE FROM rate_limit_hits WHERE bucket < ?`).bind(bucket - 120).run();
  }
  return hits <= maxPerWindow;
}
