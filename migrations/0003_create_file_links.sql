-- Migration: create file_links table for hidden-ID file download links
-- Maps a short code to a Google Drive file so the file ID never appears in shared URLs.
CREATE TABLE IF NOT EXISTS file_links (
  code TEXT PRIMARY KEY,
  file_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
