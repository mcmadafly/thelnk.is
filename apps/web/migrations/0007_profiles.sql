-- Link-in-bio public profiles. One profile per Clerk account (first ship).
-- `users` (clerk_user_id PK, plan, stripe_*) is unchanged and still owns billing.

CREATE TABLE IF NOT EXISTS profiles (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  clerk_user_id   TEXT NOT NULL UNIQUE,
  -- Stored lowercase (canonical). Public URL is /:username. Unique case-insensitively via NOCASE.
  username        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name    TEXT,
  bio             TEXT,
  avatar_r2_key   TEXT,          -- R2 object key; populated in a later ship
  theme           TEXT NOT NULL DEFAULT 'default',
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_profiles_clerk ON profiles(clerk_user_id);

CREATE TABLE IF NOT EXISTS profile_links (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id    INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  url           TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_visible    INTEGER NOT NULL DEFAULT 1,  -- 0/1 boolean
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profile_links_profile ON profile_links(profile_id, sort_order);
