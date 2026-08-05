-- Migration: convert legacy shortlinks table to the new schema,
-- preserving any existing folder short links.
CREATE TABLE IF NOT EXISTS shortlinks_new (
  code TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO shortlinks_new (code, folder_id, name)
  SELECT short_id, long_id, name FROM shortlinks WHERE type = 'folder';

DROP TABLE shortlinks;

ALTER TABLE shortlinks_new RENAME TO shortlinks;
