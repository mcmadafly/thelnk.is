/**
 * Theme registry. A theme is just a bundle of CSS custom properties applied to the
 * `.bio` root (server) or the builder preview frame (client) — no per-theme CSS files.
 * profile.css is authored entirely in terms of these vars.
 */

export type Theme = {
  id: string;
  name: string;
  isPro: boolean;
  /** CSS custom properties (without the leading `--`). */
  vars: Record<string, string>;
};

const COVER_DEFAULT = 'linear-gradient(135deg, #f97316 0%, #d946ef 60%, #6d28d9 100%)';

export const THEMES: Theme[] = [
  // ── Free (4) ──
  {
    id: 'default',
    name: 'Ember',
    isPro: false,
    vars: {
      bg: '#100f0d', surface: '#1a1815', 'surface-2': '#211d18',
      text: '#f6f3ee', 'text-dim': '#ede8de', muted: '#a39c92', 'muted-2': '#8c867c', 'muted-3': '#6f6a62',
      border: 'rgba(255,255,255,0.07)', 'border-hi': 'rgba(255,255,255,0.16)',
      accent: '#f97316', 'bio-cover': COVER_DEFAULT,
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    isPro: false,
    vars: {
      bg: '#0b1020', surface: '#141b33', 'surface-2': '#1b2440',
      text: '#eef2ff', 'text-dim': '#dbe3ff', muted: '#9aa6c8', 'muted-2': '#7e8aad', 'muted-3': '#5f6a8a',
      border: 'rgba(255,255,255,0.08)', 'border-hi': 'rgba(255,255,255,0.18)',
      accent: '#6ea8fe', 'bio-cover': 'linear-gradient(135deg, #6ea8fe 0%, #8b5cf6 60%, #0b1020 100%)',
    },
  },
  {
    id: 'cream',
    name: 'Cream',
    isPro: false,
    vars: {
      bg: '#f7f3ec', surface: '#ffffff', 'surface-2': '#f1ece1',
      text: '#1c1a17', 'text-dim': '#2b2823', muted: '#6b6459', 'muted-2': '#8a8276', 'muted-3': '#a9a193',
      border: 'rgba(0,0,0,0.08)', 'border-hi': 'rgba(0,0,0,0.18)',
      accent: '#e0632d', 'bio-cover': 'linear-gradient(135deg, #ffb38a 0%, #f6d365 100%)',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    isPro: false,
    vars: {
      bg: '#1a0f17', surface: '#2a1622', 'surface-2': '#341a2a',
      text: '#fff0f3', 'text-dim': '#ffe0e8', muted: '#caa0b0', 'muted-2': '#a87f90', 'muted-3': '#855f70',
      border: 'rgba(255,255,255,0.08)', 'border-hi': 'rgba(255,255,255,0.18)',
      accent: '#ff5d8f', 'bio-cover': 'linear-gradient(135deg, #ff5d8f 0%, #ff9a3c 100%)',
    },
  },

  // ── Pro ──
  {
    id: 'neon',
    name: 'Neon',
    isPro: true,
    vars: {
      bg: '#06070a', surface: '#0e1117', 'surface-2': '#141821',
      text: '#e8fff7', 'text-dim': '#cdfff0', muted: '#7fae9f', 'muted-2': '#5f8a7c', 'muted-3': '#456558',
      border: 'rgba(57,255,184,0.12)', 'border-hi': 'rgba(57,255,184,0.35)',
      accent: '#39ffb8', 'bio-cover': 'linear-gradient(135deg, #39ffb8 0%, #00b3ff 100%)',
    },
  },
  {
    id: 'mono',
    name: 'Mono',
    isPro: true,
    vars: {
      bg: '#000000', surface: '#0f0f0f', 'surface-2': '#161616',
      text: '#ffffff', 'text-dim': '#e6e6e6', muted: '#9a9a9a', 'muted-2': '#777777', 'muted-3': '#555555',
      border: 'rgba(255,255,255,0.1)', 'border-hi': 'rgba(255,255,255,0.25)',
      accent: '#ffffff', 'bio-cover': 'linear-gradient(135deg, #2a2a2a 0%, #000000 100%)',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    isPro: true,
    vars: {
      bg: '#0c150f', surface: '#13201a', 'surface-2': '#192a21',
      text: '#eafff0', 'text-dim': '#d4f7e0', muted: '#8fb8a0', 'muted-2': '#6f9580', 'muted-3': '#527060',
      border: 'rgba(255,255,255,0.08)', 'border-hi': 'rgba(255,255,255,0.18)',
      accent: '#4ade80', 'bio-cover': 'linear-gradient(135deg, #4ade80 0%, #166534 100%)',
    },
  },
  {
    id: 'aurora',
    name: 'Aurora',
    isPro: true,
    vars: {
      bg: '#0a0a14', surface: '#13132099', 'surface-2': '#1a1a2e',
      text: '#f2f0ff', 'text-dim': '#e2deff', muted: '#a8a2cf', 'muted-2': '#857fae', 'muted-3': '#635d8a',
      border: 'rgba(255,255,255,0.1)', 'border-hi': 'rgba(255,255,255,0.22)',
      accent: '#c084fc', 'bio-cover': 'linear-gradient(135deg, #22d3ee 0%, #c084fc 50%, #f472b6 100%)',
    },
  },
];

const BY_ID = new Map(THEMES.map((t) => [t.id, t]));

export function getTheme(id: string | null | undefined): Theme {
  return (id && BY_ID.get(id)) || THEMES[0]!;
}

export function isThemeAllowed(id: string, isPro: boolean): boolean {
  const t = BY_ID.get(id);
  if (!t) return false;
  return isPro || !t.isPro;
}

/** Theme-independent base vars so `.bio` is self-contained anywhere (e.g. the admin preview,
 * which doesn't load the public global.css). */
const BASE_VARS =
  "--font:'Manrope',system-ui,-apple-system,sans-serif;" +
  "--font-display:'Alexandria',system-ui,sans-serif;" +
  "--font-mono:'Space Mono',ui-monospace,monospace;" +
  '--link-radius:16px;--radius:16px;--radius-sm:11px';

/** Per-profile style tweaks layered over the chosen preset theme. */
export type StyleOverrides = {
  corners?: string | null;
  colors?: { primary?: string | null; secondary?: string | null; text?: string | null; background?: string | null } | null;
};

const CORNER_RADIUS: Record<string, string> = { rounded: '16px', square: '4px', pill: '999px' };
const HEX = /^#[0-9a-f]{6}$/i;

/** Map the user's color choices onto theme CSS vars; only valid, set values apply. */
function overrideVars(colors?: StyleOverrides['colors']): Record<string, string> {
  const out: Record<string, string> = {};
  if (!colors) return out;
  if (colors.primary && HEX.test(colors.primary)) out.accent = colors.primary;
  if (colors.background && HEX.test(colors.background)) out.bg = colors.background;
  if (colors.text && HEX.test(colors.text)) { out.text = colors.text; out['text-dim'] = colors.text; }
  if (colors.secondary && HEX.test(colors.secondary)) { out.surface = colors.secondary; out['surface-2'] = colors.secondary; }
  return out;
}

/** The resolved CSS-var map for a theme + overrides (used by the public page and the OG image). */
export function resolvedThemeVars(id: string | null | undefined, ov?: StyleOverrides): Record<string, string> {
  return { ...getTheme(id).vars, ...overrideVars(ov?.colors) };
}

/** Inline `style` value (CSS custom properties) for a theme — apply on the `.bio` root. */
export function themeStyle(id: string | null | undefined, ov?: StyleOverrides): string {
  const vars = resolvedThemeVars(id, ov);
  const radius = CORNER_RADIUS[ov?.corners ?? 'rounded'] ?? CORNER_RADIUS.rounded;
  // --link-radius is appended last so it wins over BASE_VARS.
  return BASE_VARS + ';' + Object.entries(vars).map(([k, v]) => `--${k}:${v}`).join(';') + `;--link-radius:${radius}`;
}
