-- Per-minute POST rate limiting (route + IP + unix minute bucket).
CREATE TABLE IF NOT EXISTS rate_limit_hits (
  route TEXT NOT NULL,
  ip TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (route, ip, bucket)
);

-- Idempotent Stripe Checkout fulfillment (webhook retries).
CREATE TABLE IF NOT EXISTS stripe_checkout_fulfillments (
  checkout_session_id TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  fulfilled_at INTEGER NOT NULL,
  amount_total INTEGER
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_bucket ON rate_limit_hits(bucket);
