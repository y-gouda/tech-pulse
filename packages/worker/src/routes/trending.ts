// packages/worker/src/routes/trending.ts
import { Hono } from 'hono';
import type { Env } from '../index';
import type { TrendingData } from '@tech-pulse/shared/types';

const trending = new Hono<{ Bindings: Env }>();

trending.get('/api/trending', async (c) => {
  const section = c.req.query('section');

  if (!section || (section !== 'tech' && section !== 'news')) {
    return c.json({ ok: false, error: 'Query parameter "section" must be "tech" or "news"' }, 400);
  }

  const key = `trending:${section}`;
  const cached = await c.env.CACHE.get(key, 'text');

  if (!cached) {
    return c.json({
      ok: true,
      data: { keywords: [], updatedAt: null } satisfies TrendingData,
    });
  }

  try {
    const data = JSON.parse(cached) as TrendingData;
    return c.json({ ok: true, data });
  } catch {
    return c.json({
      ok: true,
      data: { keywords: [], updatedAt: null } satisfies TrendingData,
    });
  }
});

export default trending;
