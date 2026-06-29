-- v0.2 builder: profile extras, typed links, Stripe Connect, orders.

-- Profile: subtitle line + background image. (profiles.bio is REUSED as the "description" field.)
ALTER TABLE profiles ADD COLUMN subtitle TEXT;
ALTER TABLE profiles ADD COLUMN background_image_r2_key TEXT;

-- Typed links: link | post | product.
ALTER TABLE profile_links ADD COLUMN type TEXT NOT NULL DEFAULT 'link';
ALTER TABLE profile_links ADD COLUMN description TEXT;     -- post/product body
ALTER TABLE profile_links ADD COLUMN cta_label TEXT;       -- post CTA button label
ALTER TABLE profile_links ADD COLUMN image_r2_key TEXT;    -- product image
ALTER TABLE profile_links ADD COLUMN price_cents INTEGER;  -- product price
ALTER TABLE profile_links ADD COLUMN currency TEXT;        -- ISO 4217 lowercase, e.g. 'usd'

-- Stripe Connect on the account (inert until Phase C).
ALTER TABLE users ADD COLUMN stripe_account_id TEXT;
ALTER TABLE users ADD COLUMN stripe_charges_enabled INTEGER NOT NULL DEFAULT 0;

-- Purchase fulfillment + idempotency (Phase C).
CREATE TABLE IF NOT EXISTS orders (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  stripe_session_id     TEXT NOT NULL UNIQUE,
  profile_id            INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_link_id       INTEGER REFERENCES profile_links(id) ON DELETE SET NULL,
  amount_cents          INTEGER NOT NULL,
  currency              TEXT NOT NULL,
  application_fee_cents INTEGER NOT NULL,
  buyer_email           TEXT,
  status                TEXT NOT NULL DEFAULT 'paid',
  created_at            INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_profile ON orders(profile_id, created_at);
