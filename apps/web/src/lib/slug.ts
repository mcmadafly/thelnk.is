import { customAlphabet } from 'nanoid';

const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const nanoidSlug = customAlphabet(alphabet, 7);

const RESERVED = new Set([
  'api',
  'f',
  'sign-in',
  'sign-up',
  'robots.txt',
  'favicon.ico',
  'sitemap.xml',
]);

export function isValidSlug(s: string): boolean {
  return /^[a-zA-Z0-9_-]{4,32}$/.test(s) && !RESERVED.has(s.toLowerCase());
}

export function newSlugCandidate(): string {
  let s = nanoidSlug();
  while (!isValidSlug(s)) {
    s = nanoidSlug();
  }
  return s;
}
