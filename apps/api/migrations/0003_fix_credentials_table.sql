-- Remove foreign key constraint from credentials table since users are stored in Durable Objects
-- SQLite doesn't support ALTER TABLE DROP CONSTRAINT, so we need to recreate the table
DROP TABLE IF EXISTS credentials;

CREATE TABLE credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  transports TEXT,
  counter INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Recreate indexes
CREATE INDEX idx_credentials_user_id ON credentials(user_id);
