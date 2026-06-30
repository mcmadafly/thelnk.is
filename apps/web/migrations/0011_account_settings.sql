-- 0011: account settings + soft delete.
-- deleted_at: NULL = active; set to a unix ts when the owner deletes their account.
--   The row (and its username) is kept, so the handle stays reserved and data is recoverable.
-- share_enabled: 1 = show the public Share button/modal (default on); 0 = hide it.
ALTER TABLE profiles ADD COLUMN deleted_at INTEGER;
ALTER TABLE profiles ADD COLUMN share_enabled INTEGER NOT NULL DEFAULT 1;
