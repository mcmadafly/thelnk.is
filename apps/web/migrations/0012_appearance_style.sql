-- 0012: per-profile style overrides layered on top of the chosen preset theme.
-- corners: link/card corner shape — 'rounded' | 'square' | 'pill' (maps to --link-radius).
-- colors: JSON of optional hex overrides { primary, secondary, text, background }; null = use the theme's.
ALTER TABLE profiles ADD COLUMN corners TEXT NOT NULL DEFAULT 'rounded';
ALTER TABLE profiles ADD COLUMN colors TEXT;
