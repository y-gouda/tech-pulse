import { Hono } from 'hono';
import { cors } from 'hono/cors';
import articles from './routes/articles';
import feeds from './routes/feeds';
import health from './routes/health';
import trending from './routes/trending';
import { handleFetchFeeds, handleTrending, handleCleanup } from './cron/fetch-feeds';

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  CRON_SECRET?: string;
}

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return origin;
    if (origin === 'http://localhost:5173') return origin;
    if (origin.endsWith('.rss-reader-5z2.pages.dev') || origin === 'https://rss-reader-5z2.pages.dev') return origin;
    return undefined;
  },
  allowMethods: ['GET', 'POST'],
  allowHeaders: ['Content-Type'],
}));

// Rate limiting middleware (KV-backed, per IP, 60 req/min)
// Probabilistic write: ~1/10 chance per request to minimize KV writes (1,000/day free tier)
app.use('/api/*', async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  const key = `ratelimit:${ip}`;
  const now = Math.floor(Date.now() / 60_000); // current minute
  const stored = await c.env.CACHE.get(key);
  const data = stored ? JSON.parse(stored) as { minute: number; count: number } : null;

  if (data && data.minute === now) {
    if (data.count >= 60) {
      return c.json({ ok: false, error: 'Rate limit exceeded' }, 429);
    }
    // Write with ~1/10 probability, incrementing by 10 to approximate real count
    if (Math.random() < 0.1) {
      await c.env.CACHE.put(key, JSON.stringify({ minute: now, count: data.count + 10 }), { expirationTtl: 120 });
    }
  } else {
    await c.env.CACHE.put(key, JSON.stringify({ minute: now, count: 1 }), { expirationTtl: 120 });
  }

  await next();
});

// Manual cron trigger (protected by secret)
app.post('/api/cron/fetch', async (c) => {
  if (!c.env.CRON_SECRET) {
    return c.json({ ok: false, error: 'Server misconfiguration' }, 500);
  }
  const secret = c.req.header('X-Cron-Secret');
  if (secret !== c.env.CRON_SECRET) {
    return c.json({ ok: false, error: 'Unauthorized' }, 401);
  }
  c.executionCtx.waitUntil(handleFetchFeeds(c.env));
  return c.json({ ok: true, data: { message: 'Feed fetch started' } });
});

app.post('/api/cron/trending', async (c) => {
  if (!c.env.CRON_SECRET) {
    return c.json({ ok: false, error: 'Server misconfiguration' }, 500);
  }
  const secret = c.req.header('X-Cron-Secret');
  if (secret !== c.env.CRON_SECRET) {
    return c.json({ ok: false, error: 'Unauthorized' }, 401);
  }
  c.executionCtx.waitUntil(handleTrending(c.env));
  return c.json({ ok: true, data: { message: 'Trending update started' } });
});

// Mount route groups
app.route('/', articles);
app.route('/', feeds);
app.route('/', health);
app.route('/', trending);

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    switch (event.cron) {
      case '*/30 * * * *':
        ctx.waitUntil(handleFetchFeeds(env));
        break;
      case '15,45 * * * *':
        ctx.waitUntil(handleTrending(env));
        break;
      case '5 0 * * *':
        ctx.waitUntil(handleCleanup(env));
        break;
      case '52 23 * * sun,mon,tue,wed,thu':
        ctx.waitUntil(handleFetchFeeds(env));
        break;
      default:
        console.log(`Unknown cron: ${event.cron}`);
    }
  },
};
