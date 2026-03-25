-- feeds: RSSフィードソース管理
CREATE TABLE IF NOT EXISTS feeds (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  url             TEXT NOT NULL UNIQUE,
  category        TEXT NOT NULL CHECK (category IN ('programming','ai-ml','infra-cloud','economy','politics','science','sports')),
  last_fetched_at TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- articles: 記事データ
CREATE TABLE IF NOT EXISTS articles (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  feed_id       INTEGER NOT NULL REFERENCES feeds(id),
  title         TEXT NOT NULL,
  url           TEXT NOT NULL UNIQUE,
  summary       TEXT DEFAULT '',
  author        TEXT DEFAULT '',
  published_at  TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('programming','ai-ml','infra-cloud','economy','politics','science','sports')),
  thumbnail_url TEXT DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);

-- FTS5: 全文検索用
CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(title, summary, content='articles', content_rowid='id');

-- FTS同期トリガー
CREATE TRIGGER IF NOT EXISTS articles_ai AFTER INSERT ON articles BEGIN
  INSERT INTO articles_fts(rowid, title, summary) VALUES (new.id, new.title, new.summary);
END;

CREATE TRIGGER IF NOT EXISTS articles_ad AFTER DELETE ON articles BEGIN
  INSERT INTO articles_fts(articles_fts, rowid, title, summary) VALUES('delete', old.id, old.title, old.summary);
END;

CREATE TRIGGER IF NOT EXISTS articles_au AFTER UPDATE ON articles BEGIN
  INSERT INTO articles_fts(articles_fts, rowid, title, summary) VALUES('delete', old.id, old.title, old.summary);
  INSERT INTO articles_fts(rowid, title, summary) VALUES (new.id, new.title, new.summary);
END;

-- フィードソースのシードデータ
INSERT OR IGNORE INTO feeds (name, url, category) VALUES
  -- プログラミング
  ('Zenn', 'https://zenn.dev/feed', 'programming'),
  ('Qiita', 'https://qiita.com/popular-items/feed', 'programming'),

  ('gihyo.jp', 'https://gihyo.jp/feed/rss2', 'programming'),
  ('CodeZine', 'https://codezine.jp/rss/new/20/index.xml', 'programming'),
  -- AI・ML
  ('Zenn AI', 'https://zenn.dev/topics/ai/feed', 'ai-ml'),
  ('Zenn LLM', 'https://zenn.dev/topics/llm/feed', 'ai-ml'),
  -- インフラ・クラウド
  ('Publickey', 'https://www.publickey1.jp/atom.xml', 'infra-cloud'),
  ('AWS Blog', 'https://aws.amazon.com/blogs/aws/feed/', 'infra-cloud'),
  ('Google Cloud Blog', 'https://cloud.google.com/blog/feed', 'infra-cloud'),
  ('Azure Blog', 'https://azure.microsoft.com/en-us/blog/feed/', 'infra-cloud'),
  -- 経済・ビジネス
  ('日本経済新聞', 'https://assets.wor.jp/rss/rdf/nikkei/news.rdf', 'economy'),
  ('日経ビジネス', 'https://business.nikkei.com/rss/sns/nb.rdf', 'economy'),
  ('東洋経済オンライン', 'https://toyokeizai.net/list/feed/rss', 'economy'),
  ('Reuters', 'https://assets.wor.jp/rss/rdf/reuters/top.rdf', 'economy'),
  ('Yahoo!ビジネス', 'https://news.yahoo.co.jp/rss/topics/business.xml', 'economy'),
  -- 政治・社会
  ('共同通信', 'https://www.kyodo.co.jp/feed/', 'politics'),
  ('時事通信', 'https://www.jiji.com/rss/ranking.rdf', 'politics'),
  ('BBC News Japan', 'https://feeds.bbci.co.uk/japanese/rss.xml', 'politics'),
  ('毎日新聞', 'https://mainichi.jp/rss/etc/mainichi-flash.rss', 'politics'),
  ('Yahoo!国際', 'https://news.yahoo.co.jp/rss/topics/world.xml', 'politics'),
  -- 科学
  ('Nature Japan', 'https://www.natureasia.com/ja-jp/rss/nature', 'science'),
  ('ナゾロジー', 'https://nazology.kusuguru.co.jp/feed', 'science'),
  ('日経サイエンス', 'https://www.nikkei-science.com/?feed=rss2', 'science'),
  ('MIT Tech Review 日本版', 'https://www.technologyreview.jp/feed', 'science'),
  -- スポーツ
  ('Yahoo!スポーツ', 'https://news.yahoo.co.jp/rss/topics/sports.xml', 'sports'),
  ('Full-Count', 'https://full-count.jp/feed/', 'sports'),
  ('THE ANSWER', 'https://the-ans.jp/feed/', 'sports');
