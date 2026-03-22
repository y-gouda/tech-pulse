import { Hono } from 'hono';
import type { Env } from '../index';
import { getArticles, searchArticles } from '../lib/db';
import { getCachedResponse, setCachedResponse, buildCacheKey } from '../lib/cache';
import type { Category, ArticlesData } from '@tech-pulse/shared/types';

const articles = new Hono<{ Bindings: Env }>();

articles.get('/api/articles', async (c) => {
  try {
    const category = c.req.query('category') as Category | undefined;
    const categoriesParam = c.req.query('categories');
    const categories = categoriesParam ? categoriesParam.split(',') as Category[] : undefined;
    const sinceRaw = c.req.query('since');
    let since: string | undefined;
    if (sinceRaw) {
      const parsed = Date.parse(sinceRaw);
      if (!Number.isFinite(parsed)) {
        return c.json({ ok: false, error: 'Invalid "since" parameter' }, 400);
      }
      since = new Date(parsed).toISOString();
    }
    const rawPage = parseInt(c.req.query('page') ?? '1', 10);
    const rawLimit = parseInt(c.req.query('limit') ?? '20', 10);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const maxLimit = since ? 500 : 100;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : 20;

    const cacheKey = buildCacheKey('/api/articles', {
      category: category ?? '',
      categories: categoriesParam ?? '',
      page: String(page),
      limit: String(limit),
      since: since ?? '',
    });

    const cached = await getCachedResponse<ArticlesData>(c.env.CACHE, cacheKey);
    if (cached) {
      return c.json({ ok: true, data: cached });
    }

    const result = await getArticles(c.env.DB, { category, categories, page, limit, since });

    await setCachedResponse(c.env.CACHE, cacheKey, result);

    return c.json({ ok: true, data: result });
  } catch (err) {
    console.error('GET /api/articles failed:', err);
    return c.json({ ok: false, error: 'Internal server error' }, 500);
  }
});

articles.get('/api/articles/search', async (c) => {
  try {
    const q = c.req.query('q') ?? '';
    if (!q) {
      return c.json({ ok: false, error: 'Query parameter "q" is required' }, 400);
    }

    const category = c.req.query('category') as Category | undefined;
    const categoriesParam = c.req.query('categories');
    const categories = categoriesParam ? categoriesParam.split(',') as Category[] : undefined;
    const rawPage = parseInt(c.req.query('page') ?? '1', 10);
    const rawLimit = parseInt(c.req.query('limit') ?? '20', 10);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;

    const result = await searchArticles(c.env.DB, { q, category, categories, page, limit });

    return c.json({ ok: true, data: result });
  } catch (err) {
    console.error('GET /api/articles/search failed:', err);
    return c.json({ ok: false, error: 'Internal server error' }, 500);
  }
});

export default articles;
