/**
 * Deterministic gradient avatars — same username always gets the same look,
 * so profiles have a distinct identity before a photo is uploaded.
 */

const GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ['#f97316', '#ff9a4d'], // brand orange
  ['#fb7185', '#f97316'], // rose → orange
  ['#f59e0b', '#ef4444'], // amber → red
  ['#f97316', '#d946ef'], // orange → fuchsia
  ['#22c55e', '#0ea5e9'], // green → sky
  ['#06b6d4', '#6366f1'], // cyan → indigo
  ['#8b5cf6', '#ec4899'], // violet → pink
  ['#eab308', '#f97316'], // gold → orange
];

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function avatarGradient(seed: string): { from: string; to: string } {
  const [from, to] = GRADIENTS[hash(seed) % GRADIENTS.length]!;
  return { from, to };
}

/** CSS `background` value for an avatar derived from a seed. */
export function avatarBackground(seed: string): string {
  const { from, to } = avatarGradient(seed);
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}

export function avatarInitial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}
