import bundledWallOfFame from '../data/wall-of-fame.json';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const WALL_OF_FAME_JSON_PATH = fileURLToPath(new URL('../data/wall-of-fame.json', import.meta.url));

const EMPTY_WALL_OF_FAME: WallOfFameData = {
  generatedAt: '1970-01-01T00:00:00.000Z',
  featured: [],
  more: [],
};

export type WallOfFameEntry = {
  slug: string;
  shortUrl: string;
  hostname: string;
  title: string;
  previewUrl: string;
  /** Total successful opens across all short links to this hostname (not used for ranking). */
  useCount: number;
  /** Short links pointing at this hostname (wall ranking). */
  linkCount: number;
  lastUsedAt: number | null;
};

export type WallOfFameData = {
  generatedAt: string;
  featured: WallOfFameEntry[];
  more: WallOfFameEntry[];
};

export function isWallOfFameData(value: unknown): value is WallOfFameData {
  if (!value || typeof value !== 'object') return false;
  const v = value as WallOfFameData;
  return (
    typeof v.generatedAt === 'string' &&
    Array.isArray(v.featured) &&
    Array.isArray(v.more)
  );
}

/** Dev: read JSON from disk on each request so `wall-of-fame:build` shows up without restart. Prod: bundled at build. */
export function loadWallOfFameData(): WallOfFameData {
  if (import.meta.env.DEV) {
    try {
      const raw: unknown = JSON.parse(readFileSync(WALL_OF_FAME_JSON_PATH, 'utf8'));
      if (isWallOfFameData(raw)) return raw;
    } catch {
      /* fall through */
    }
  }
  return isWallOfFameData(bundledWallOfFame) ? bundledWallOfFame : EMPTY_WALL_OF_FAME;
}
