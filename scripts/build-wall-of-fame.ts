#!/usr/bin/env bun
/**
 * Refresh homepage Wall of fame from production D1.
 *
 * Ranks by **hostname** (not raw link rows): number of short links to that site, then recency.
 * One card per destination (preview slug = busiest row for that host by visits, for display only).
 *
 * Requires Cloudflare auth (`wrangler login` or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID).
 *
 *   bun run wall-of-fame:build
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { WallOfFameData, WallOfFameEntry } from '../apps/web/src/lib/wall-of-fame.ts';

const WEB_ROOT = join(import.meta.dir, '..', 'apps', 'web');
const OUT_PATH = join(WEB_ROOT, 'src', 'data', 'wall-of-fame.json');
const SHORT_ORIGIN = (process.env.PUBLIC_SHORT_ORIGIN ?? 'https://thelnk.is').replace(/\/+$/, '');
const POOL_LIMIT = Number(process.env.WALL_OF_FAME_POOL_LIMIT ?? 250);
const FEATURED_COUNT = 2;
const MORE_COUNT = 3;
const TOTAL = FEATURED_COUNT + MORE_COUNT;

const SQL = `
SELECT slug, target_url, use_count, last_used_at, preview_r2_key
FROM links
WHERE type = 'url'
  AND preview_r2_key IS NOT NULL
  AND target_url IS NOT NULL
ORDER BY created_at DESC
LIMIT ${POOL_LIMIT}
`.trim();

type D1Row = {
  slug: string;
  target_url: string;
  use_count: number;
  last_used_at: number | null;
  preview_r2_key: string;
};

type HostAgg = {
  hostname: string;
  totalUses: number;
  linkCount: number;
  lastUsedAt: number | null;
  bestRow: D1Row;
};

function isIpLiteral(host: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(':') && /^[\da-f:.]+$/i.test(host);
}

function isSafePublicUrl(targetUrl: string): boolean {
  try {
    const u = new URL(targetUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.localhost')) return false;
    if (isIpLiteral(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function hostnameKey(targetUrl: string): string | null {
  try {
    const u = new URL(targetUrl);
    if (!isSafePublicUrl(targetUrl)) return null;
    return u.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
}

function displayFromTarget(slug: string, targetUrl: string): { hostname: string; title: string } {
  try {
    const u = new URL(targetUrl);
    const hostname = u.hostname.replace(/^www\./i, '');
    const path = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '');
    const title = path ? `${hostname}${path}` : hostname;
    return { hostname, title };
  } catch {
    return { hostname: slug, title: slug };
  }
}

function aggregateByHost(rows: D1Row[]): HostAgg[] {
  const map = new Map<string, HostAgg>();

  for (const row of rows) {
    if (!row.preview_r2_key) continue;
    const key = hostnameKey(row.target_url);
    if (!key) continue;

    const uses = Number(row.use_count) || 0;
    const last = row.last_used_at == null ? null : Number(row.last_used_at);
    const cur = map.get(key);

    if (!cur) {
      map.set(key, {
        hostname: key,
        totalUses: uses,
        linkCount: 1,
        lastUsedAt: last,
        bestRow: row,
      });
      continue;
    }

    cur.totalUses += uses;
    cur.linkCount += 1;
    if (last != null && (cur.lastUsedAt == null || last > cur.lastUsedAt)) {
      cur.lastUsedAt = last;
    }

    const bestUses = Number(cur.bestRow.use_count) || 0;
    const bestLast = cur.bestRow.last_used_at == null ? null : Number(cur.bestRow.last_used_at);
    if (
      uses > bestUses ||
      (uses === bestUses && last != null && (bestLast == null || last > bestLast))
    ) {
      cur.bestRow = row;
    }
  }

  return [...map.values()].sort((a, b) => {
    if (b.linkCount !== a.linkCount) return b.linkCount - a.linkCount;
    return (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0);
  });
}

function entryFromAgg(agg: HostAgg): WallOfFameEntry {
  const { hostname, title } = displayFromTarget(agg.bestRow.slug, agg.bestRow.target_url);
  const entry: WallOfFameEntry = {
    slug: agg.bestRow.slug,
    shortUrl: `${SHORT_ORIGIN}/${agg.bestRow.slug}`,
    hostname,
    title,
    previewUrl: `/api/preview/${encodeURIComponent(agg.bestRow.slug)}?v=desktop`,
    useCount: agg.totalUses,
    lastUsedAt: agg.lastUsedAt,
  };
  entry.linkCount = agg.linkCount;
  return entry;
}

async function executeD1(sql: string): Promise<void> {
  const proc = Bun.spawn(
    ['bunx', 'wrangler', 'd1', 'execute', 'thelnk', '--remote', '--command', sql],
    { cwd: WEB_ROOT, stdout: 'pipe', stderr: 'pipe' },
  );
  const [stderr, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0) {
    console.warn(`D1 execute warning (exit ${code}): ${stderr}`);
  }
}

async function fetchRows(): Promise<D1Row[]> {
  const proc = Bun.spawn(
    ['bunx', 'wrangler', 'd1', 'execute', 'thelnk', '--remote', '--json', '--command', SQL],
    { cwd: WEB_ROOT, stdout: 'pipe', stderr: 'pipe' },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) {
    const out = `${stderr}\n${stdout}`;
    console.error(stderr || stdout);
    if (/Authentication error|Invalid access token|code: 10000|code: 9109/i.test(out)) {
      throw new Error(
        'Cloudflare auth failed. Run `cd apps/web && bunx wrangler login`, or set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID, then retry.',
      );
    }
    throw new Error(`wrangler d1 execute failed (exit ${code})`);
  }
  const parsed = JSON.parse(stdout) as Array<{ results?: D1Row[]; success?: boolean }>;
  const batch = parsed[0];
  if (!batch?.success || !Array.isArray(batch.results)) {
    throw new Error('Unexpected wrangler d1 JSON shape');
  }
  return batch.results;
}

function statLabel(entry: WallOfFameEntry): string {
  const n = entry.linkCount ?? 1;
  return n === 1 ? '1 link' : `${n} links`;
}

async function main() {
  const rows = await fetchRows();
  const ranked = aggregateByHost(rows);
  const entries = ranked.slice(0, TOTAL).map(entryFromAgg);

  const data: WallOfFameData = {
    generatedAt: new Date().toISOString(),
    featured: entries.slice(0, FEATURED_COUNT),
    more: entries.slice(FEATURED_COUNT, FEATURED_COUNT + MORE_COUNT),
  };

  // Ensure all wall-of-fame slugs are never view-limited.
  const wofSlugs = [...data.featured, ...data.more].map((e) => e.slug);
  if (wofSlugs.length > 0) {
    const slugList = wofSlugs.map((s) => `'${s.replace(/'/g, "''")}'`).join(', ');
    await executeD1(`UPDATE links SET max_uses = -1 WHERE slug IN (${slugList}) AND max_uses != -1`);
    console.log(`  Promoted ${wofSlugs.length} slugs to max_uses = -1: ${wofSlugs.join(', ')}`);
  }

  writeFileSync(OUT_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`  generatedAt: ${data.generatedAt}`);
  console.log(`  source: production D1 (wrangler d1 execute --remote)`);
  console.log(`  pool: ${rows.length} link rows → ${ranked.length} hostnames`);
  console.log(`  featured: ${data.featured.length}, more: ${data.more.length}`);
  for (const e of [...data.featured, ...data.more]) {
    console.log(`    ${e.slug}  ${statLabel(e)}  ${e.hostname}`);
  }
  console.log('  Dev: hard-refresh the homepage (JSON is re-read on each request).');
  console.log('  Production: commit this file and redeploy (astro build bundles it).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
