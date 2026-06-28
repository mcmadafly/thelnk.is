-- Profile polish: social icon row + a featured (highlighted) link.
ALTER TABLE profiles ADD COLUMN socials TEXT;            -- JSON array: [{ "name": "x", "url": "..." }, ...]
ALTER TABLE profile_links ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0;  -- 1 = render as the orange featured card
