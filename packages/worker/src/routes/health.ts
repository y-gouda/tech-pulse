import { Hono } from 'hono';
import type { Env } from '../index';

const health = new Hono<{ Bindings: Env }>();

health.get('/api/health', (c) => {
  return c.json({
    ok: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  });
});

export default health;
