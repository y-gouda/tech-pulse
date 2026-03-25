import type { Article, Feed, Pagination, Category } from '@tech-pulse/shared/types';

interface GetArticlesOptions {
  category?: Category;
  categories?: Category[];
  page?: number;
  limit?: number;
  since?: string;
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
  const conditions: string[] = [];

  if (opts.categories && opts.categories.length > 0) {
    const placeholders = opts.categories.map(() => '?').join(',');
    conditions.push(`category IN (${placeholders})`);
    params.push(...opts.categories);
    countParams.push(...opts.categories);
  } else if (opts.category) {
    conditions.push('category = ?');
    params.push(opts.category);
    countParams.push(opts.category);
  }

  if (opts.since) {
    conditions.push('published_at >= ?');
    params.push(opts.since);
    countParams.push(opts.since);
  }

  if (conditions.length > 0) {
    const where = ` WHERE ${conditions.join(' AND ')}`;
    query += where;
    countQuery += where;
  }

  query += ' ORDER BY published_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  if (opts.since) {
    const articlesResult = await db.prepare(query).bind(...params).all<Article>();
    return {
      articles: articlesResult.results,
      pagination: { page, limit, total: articlesResult.results.length, hasMore: false },
    };
  }

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

// Escape FTS5 special characters by wrapping query in double quotes
function escapeFtsQuery(q: string): string {
  // Remove characters that are special in FTS5 syntax
  const cleaned = q.replace(/["*(){}[\]^~\\:]/g, '');
  if (!cleaned.trim()) return '';
  return `"${cleaned}"`;
}

export async function searchArticles(
  db: D1Database,
  opts: { q: string; category?: Category; categories?: Category[]; page?: number; limit?: number }
): Promise<ArticlesResult> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  const offset = (page - 1) * limit;

  const ftsQuery = escapeFtsQuery(opts.q);
  if (!ftsQuery) {
    return { articles: [], pagination: { page, limit, total: 0, hasMore: false } };
  }

  let query = `SELECT a.* FROM articles a JOIN articles_fts ON articles_fts.rowid = a.id WHERE articles_fts MATCH ?`;
  let countQuery = `SELECT COUNT(*) as total FROM articles a JOIN articles_fts ON articles_fts.rowid = a.id WHERE articles_fts MATCH ?`;
  const params: unknown[] = [ftsQuery];
  const countParams: unknown[] = [ftsQuery];

  if (opts.categories && opts.categories.length > 0) {
    const placeholders = opts.categories.map(() => '?').join(',');
    query += ` AND a.category IN (${placeholders})`;
    countQuery += ` AND a.category IN (${placeholders})`;
    params.push(...opts.categories);
    countParams.push(...opts.categories);
  } else if (opts.category) {
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

export async function getFeeds(
  db: D1Database,
  category?: string,
  activeOnly?: boolean
): Promise<Feed[]> {
  let query = 'SELECT * FROM feeds';
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }
  if (activeOnly) {
    conditions.push('is_active = 1');
  }
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
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
