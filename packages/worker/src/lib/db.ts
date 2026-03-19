import type { Article, Feed, Pagination, Category } from '@tech-pulse/shared/types';

interface GetArticlesOptions {
  category?: Category;
  categories?: Category[];
  page?: number;
  limit?: number;
}

interface ArticlesResult {
  articles: Article[];
  pagination: Pagination;
}

export async function getArticles(
  db: D1Database,
  opts: GetArticlesOptions = {}
): Promise<ArticlesResult> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  const offset = (page - 1) * limit;

  let query = 'SELECT * FROM articles';
  let countQuery = 'SELECT COUNT(*) as total FROM articles';
  const params: unknown[] = [];
  const countParams: unknown[] = [];

  if (opts.categories && opts.categories.length > 0) {
    const placeholders = opts.categories.map(() => '?').join(',');
    query += ` WHERE category IN (${placeholders})`;
    countQuery += ` WHERE category IN (${placeholders})`;
    params.push(...opts.categories);
    countParams.push(...opts.categories);
  } else if (opts.category) {
    query += ' WHERE category = ?';
    countQuery += ' WHERE category = ?';
    params.push(opts.category);
    countParams.push(opts.category);
  }

  query += ' ORDER BY published_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [articlesResult, countResult] = await Promise.all([
    db.prepare(query).bind(...params).all<Article>(),
    db.prepare(countQuery).bind(...countParams).first<{ total: number }>(),
  ]);

  const total = countResult?.total ?? 0;

  return {
    articles: articlesResult.results,
    pagination: {
      page,
      limit,
      total,
      hasMore: offset + limit < total,
    },
  };
}

export async function searchArticles(
  db: D1Database,
  opts: { q: string; category?: Category; page?: number; limit?: number }
): Promise<ArticlesResult> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  const offset = (page - 1) * limit;

  let query =
    'SELECT a.* FROM articles a JOIN articles_fts f ON a.id = f.rowid WHERE articles_fts MATCH ?';
  let countQuery =
    'SELECT COUNT(*) as total FROM articles a JOIN articles_fts f ON a.id = f.rowid WHERE articles_fts MATCH ?';
  const params: unknown[] = [opts.q];
  const countParams: unknown[] = [opts.q];

  if (opts.category) {
    query += ' AND a.category = ?';
    countQuery += ' AND a.category = ?';
    params.push(opts.category);
    countParams.push(opts.category);
  }

  query += ' ORDER BY a.published_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [articlesResult, countResult] = await Promise.all([
    db.prepare(query).bind(...params).all<Article>(),
    db.prepare(countQuery).bind(...countParams).first<{ total: number }>(),
  ]);

  const total = countResult?.total ?? 0;

  return {
    articles: articlesResult.results,
    pagination: {
      page,
      limit,
      total,
      hasMore: offset + limit < total,
    },
  };
}

export async function insertArticle(
  db: D1Database,
  article: {
    feed_id: number;
    title: string;
    url: string;
    summary: string;
    author: string;
    published_at: string;
    category: string;
    thumbnail_url: string;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO articles (feed_id, title, url, summary, author, published_at, category, thumbnail_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      article.feed_id,
      article.title,
      article.url,
      article.summary,
      article.author,
      article.published_at,
      article.category,
      article.thumbnail_url
    )
    .run();
}

export async function getFeeds(
  db: D1Database,
  category?: string
): Promise<Feed[]> {
  let query = 'SELECT * FROM feeds';
  const params: unknown[] = [];

  if (category) {
    query += ' WHERE category = ?';
    params.push(category);
  }

  query += ' ORDER BY name ASC';

  const result = await db.prepare(query).bind(...params).all<Feed>();
  return result.results;
}

export async function updateFeedLastFetched(
  db: D1Database,
  feedId: number
): Promise<void> {
  await db
    .prepare("UPDATE feeds SET last_fetched_at = datetime('now') WHERE id = ?")
    .bind(feedId)
    .run();
}

export async function deleteOldArticles(
  db: D1Database,
  daysOld: number
): Promise<number> {
  const result = await db
    .prepare(
      "DELETE FROM articles WHERE published_at < datetime('now', ?)"
    )
    .bind(`-${daysOld} days`)
    .run();

  // Rebuild FTS index after deletion
  await db
    .prepare("INSERT INTO articles_fts(articles_fts) VALUES('rebuild')")
    .run();

  return result.meta.changes ?? 0;
}
