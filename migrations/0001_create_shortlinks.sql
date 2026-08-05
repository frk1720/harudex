-- Migration: create shortlinks table for folder short URLs
CREATE TABLE IF NOT EXISTS shortlinks (
  code TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
