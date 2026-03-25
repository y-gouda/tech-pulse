import { Hono } from 'hono';
import type { Env } from '../index';
import { getFeeds } from '../lib/db';
import { isValidCategory } from '@tech-pulse/shared/types';

const feeds = new Hono<{ Bindings: Env }>();

feeds.get('/api/feeds', async (c) => {
  try {
    const category = c.req.query('category');
    if (category && !isValidCategory(category)) {
      return c.json({ ok: false, error: 'Invalid "category" parameter' }, 400);
    }
    const result = await getFeeds(c.env.DB, category);

    return c.json({ ok: true, data: { feeds: result } });
  } catch (err) {
    console.error('GET /api/feeds failed:', err);
    return c.json({ ok: false, error: 'Internal server error' }, 500);
  }
});

export default feeds;
