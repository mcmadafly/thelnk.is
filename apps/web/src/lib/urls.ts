import tlds from 'tlds';

/** Lowercase IANA TLD labels (ASCII + punycode A-labels), from the `tlds` package. */
const KNOWN_TLDS = new Set(tlds.map((x) => x.toLowerCase()));

const HAS_SCHEME = /^[a-zA-Z][a-zA-Z\d+.-]*:/;

function hostnameHasKnownTld(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.+$/, '');
  if (!host || host.startsWith('[')) return false;
  const labels = host.split('.').filter(Boolean);
  if (labels.length < 2) return false;
  const tld = labels[labels.length - 1]!;
  return KNOWN_TLDS.has(tld);
}

/**
 * Normalize user input into an absolute http(s) URL, or null if invalid.
 * Scheme is optional in input (defaults to https). Only http/https are accepted
 * when a scheme is present. Hostname must be `labels…tld` where the last label
 * is an IANA-listed TLD (via npm `tlds`, aligned with IANA’s `tlds-alpha-by-domain.txt`).
 */
export function normalizeHttpUrl(input: string): string | null {
  const t = input.trim();
  if (!t) return null;

  let u: URL;
  try {
    if (HAS_SCHEME.test(t)) {
      u = new URL(t);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    } else {
      u = new URL(`https://${t}`);
    }
  } catch {
    return null;
  }

  if (!hostnameHasKnownTld(u.hostname)) return null;

  return u.toString();
}
