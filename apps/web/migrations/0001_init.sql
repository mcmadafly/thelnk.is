-- Links: short URLs and file metadata (bytes live in R2).
CREATE TABLE IF NOT EXISTS links (
  slug TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('url', 'file')),
  target_url TEXT,
  r2_key TEXT,
  original_filename TEXT,
  mime TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  clerk_user_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_links_clerk ON links(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_links_created ON links(created_at);
