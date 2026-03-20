-- Migration: Add 'sports' category
-- Must recreate feeds table (CHECK constraint) and handle FK from articles

PRAGMA foreign_keys=OFF;

-- 1. Recreate feeds with updated CHECK
CREATE TABLE feeds_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  url             TEXT NOT NULL UNIQUE,
  category        TEXT NOT NULL CHECK (category IN ('programming','ai-ml','infra-cloud','economy','politics','science','sports')),
  last_fetched_at TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO feeds_new (id, name, url, category, last_fetched_at, is_active, created_at)
  SELECT id, name, url, category, last_fetched_at, is_active, created_at FROM feeds;

DROP TABLE feeds;
ALTER TABLE feeds_new RENAME TO feeds;

-- 2. Insert new sports feeds
INSERT OR IGNORE INTO feeds (name, url, category) VALUES
  ('Number Web', 'https://number.bunshun.jp/list/rss', 'sports'),
  ('スポニチ', 'https://www.sponichi.co.jp/rss/all.xml', 'sports'),
  ('日刊スポーツ', 'https://www.nikkansports.com/rss/sports/atom.xml', 'sports');

PRAGMA foreign_keys=ON;
