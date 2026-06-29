-- 0010: unify social icons and links into one ordered list.
-- Socials previously lived in profiles.socials (JSON array). Move each into a
-- profile_links row (type='social', title=platform key, url=link), placed BEFORE
-- existing links so current pages keep their socials-on-top look. The JSON column
-- is then cleared so there is a single source of truth.

-- Push existing rows down to make room for socials at the top.
UPDATE profile_links SET sort_order = sort_order + 1000;

-- Expand the JSON array into rows. json_each(...).key is the array index → sort_order.
-- Guard json_each against NULL/invalid/non-array socials by feeding it '[]' in those cases.
INSERT INTO profile_links (profile_id, type, title, url, sort_order, is_visible, is_featured, created_at, updated_at)
SELECT p.id,
       'social',
       json_extract(je.value, '$.name'),
       json_extract(je.value, '$.url'),
       je.key,
       1,
       0,
       CAST(strftime('%s','now') AS INTEGER),
       CAST(strftime('%s','now') AS INTEGER)
FROM profiles p
JOIN json_each(
       CASE WHEN json_valid(p.socials) AND json_type(p.socials) = 'array' THEN p.socials ELSE '[]' END
     ) je
WHERE json_extract(je.value, '$.name') IS NOT NULL
  AND TRIM(COALESCE(json_extract(je.value, '$.url'), '')) <> '';

-- Retire the JSON column as a source of truth (kept in schema, just emptied).
UPDATE profiles SET socials = NULL WHERE socials IS NOT NULL;
