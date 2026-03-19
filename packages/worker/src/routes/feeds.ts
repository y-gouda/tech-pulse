import { Hono } from 'hono';
import type { Env } from '../index';
import { getFeeds } from '../lib/db';

const feeds = new Hono<{ Bindings: Env }>();

feeds.get('/api/feeds', async (c) => {
  const category = c.req.query('category');
  const result = await getFeeds(c.env.DB, category);

  return c.json({ ok: true, data: { feeds: result } });
});

export default feeds;
