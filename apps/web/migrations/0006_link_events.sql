-- Per-link usage analytics events (URL redirects + file downloads).
CREATE TABLE IF NOT EXISTS link_events (
  slug TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('url_redirect', 'file_download')),
  occurred_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_link_events_slug_time ON link_events(slug, occurred_at);
CREATE INDEX IF NOT EXISTS idx_link_events_time ON link_events(occurred_at);
