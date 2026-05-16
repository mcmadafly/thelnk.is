#!/usr/bin/env bun
/**
 * Re-capture Microlink full-page previews for Wall of fame slugs and upload to production R2.
 *
 *   bun run wall-of-fame:refresh-previews
 *
 * Reads `apps/web/src/data/wall-of-fame.json`, loads target URLs from production D1,
 * fetches full-page desktop screenshots (same params as `capture-url-preview.ts`), then:
 *   wrangler r2 object put thelnk/preview/{slug}.png --remote
 *
 * Optional: MICROLINK_API_KEY in apps/web/.env (or env) for higher rate limits.
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { WallOfFameData } from '../apps/web/src/lib/wall-of-fame.ts';
import {
  PREVIEW_IMAGE_FETCH_TIMEOUT_MS,
  PREVIEW_MICROLINK_TIMEOUT_MS,
  buildMicrolinkScreenshotUrl,
} from '../apps/web/src/lib/microlink-preview.ts';
import { previewR2Key } from '../apps/web/src/lib/preview-r2.ts';

const WEB_ROOT = join(import.meta.dir, '..', 'apps', 'web');
const WOF_PATH = join(WEB_ROOT, 'src', 'data', 'wall-of-fame.json');
const BUCKET = 'thelnk';

function loadMicrolinkApiKey(): string | undefined {
  const fromEnv = process.env.MICROLINK_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  const envPath = join(WEB_ROOT, '.env');
  if (!existsSync(envPath)) return undefined;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^MICROLINK_API_KEY=(.*)$/.exec(line.trim());
    if (m) return m[1].replace(/^["']|["']$/g, '').trim() || undefined;
  }
  return undefined;
}

function slugsFromWall(data: WallOfFameData): string[] {
  const slugs = [...data.featured, ...data.more].map((e) => e.slug);
  return [...new Set(slugs)];
}

async function fetchTargets(slugs: string[]): Promise<Map<string, string>> {
  const quoted = slugs.map((s) => `'${s.replace(/'/g, "''")}'`).join(', ');
  const sql = `SELECT slug, target_url FROM links WHERE slug IN (${quoted}) AND type = 'url'`;
  const proc = Bun.spawn(
    ['bunx', 'wrangler', 'd1', 'execute', 'thelnk', '--remote', '--json', '--command', sql],
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
  const parsed = JSON.parse(stdout) as Array<{ results?: { slug: string; target_url: string }[] }>;
  const rows = parsed[0]?.results ?? [];
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.slug && row.target_url) map.set(row.slug, row.target_url);
  }
  return map;
}

async function captureToFile(targetUrl: string, apiKey?: string): Promise<string | null> {
  const api = buildMicrolinkScreenshotUrl(targetUrl, { apiKey, force: true });
  const metaRes = await fetch(api.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(PREVIEW_MICROLINK_TIMEOUT_MS),
  });
  if (!metaRes.ok) {
    console.warn('  microlink meta', metaRes.status, targetUrl);
    return null;
  }
  const meta = (await metaRes.json()) as { data?: { screenshot?: { url?: string } } };
  const shotUrl = meta.data?.screenshot?.url;
  if (!shotUrl) {
    console.warn('  no screenshot url', targetUrl);
    return null;
  }

  const imgRes = await fetch(shotUrl, { signal: AbortSignal.timeout(PREVIEW_IMAGE_FETCH_TIMEOUT_MS) });
  if (!imgRes.ok) {
    console.warn('  screenshot fetch', imgRes.status);
    return null;
  }
  const buf = Buffer.from(await imgRes.arrayBuffer());
  if (buf.byteLength < 2_000) {
    console.warn('  image too small', buf.byteLength);
    return null;
  }

  const file = join(tmpdir(), `thelnk-preview-${Date.now()}.png`);
  writeFileSync(file, buf);
  return file;
}

async function putR2(key: string, file: string): Promise<boolean> {
  const proc = Bun.spawn(
    ['bunx', 'wrangler', 'r2', 'object', 'put', `${BUCKET}/${key}`, '--file', file, '--remote', '--content-type', 'image/png'],
    { cwd: WEB_ROOT, stdout: 'pipe', stderr: 'pipe' },
  );
  const [stderr, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0) {
    console.error('  r2 put failed:', stderr.trim() || `exit ${code}`);
    return false;
  }
  return true;
}

async function main() {
  const raw = readFileSync(WOF_PATH, 'utf8');
  const data = JSON.parse(raw) as WallOfFameData;
  const slugs = slugsFromWall(data);
  if (!slugs.length) {
    console.log('No wall-of-fame slugs in', WOF_PATH);
    return;
  }

  const apiKey = loadMicrolinkApiKey();
  const targets = await fetchTargets(slugs);
  console.log(`Refreshing ${slugs.length} preview(s) → R2 bucket "${BUCKET}" (remote)`);
  if (apiKey) console.log('  Using MICROLINK_API_KEY from env/.env');

  let ok = 0;
  let fail = 0;

  for (const slug of slugs) {
    const targetUrl = targets.get(slug);
    if (!targetUrl) {
      console.warn(`  skip ${slug}: no target_url in D1`);
      fail++;
      continue;
    }
    console.log(`  ${slug}  ${targetUrl}`);
    const file = await captureToFile(targetUrl, apiKey);
    if (!file) {
      fail++;
      continue;
    }
    try {
      const key = previewR2Key(slug);
      if (await putR2(key, file)) {
        ok++;
        console.log(`    → ${key}`);
      } else {
        fail++;
      }
    } finally {
      try {
        unlinkSync(file);
      } catch {
        /* ignore */
      }
    }
    await Bun.sleep(1_500);
  }

  console.log(`Done: ${ok} ok, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
