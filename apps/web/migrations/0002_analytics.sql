-- Creator plan (premium = unlimited uses on links they create).
CREATE TABLE IF NOT EXISTS users (
  clerk_user_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);

-- use_count: for type=url, incremented on short-domain redirect; for type=file, on each download.
-- max_uses: default 10 for free/anonymous; -1 means unlimited (premium creator at link creation).
ALTER TABLE links ADD COLUMN use_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE links ADD COLUMN max_uses INTEGER NOT NULL DEFAULT 10;
ALTER TABLE links ADD COLUMN last_used_at INTEGER;
