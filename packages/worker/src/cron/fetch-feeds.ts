import type { Env } from '../index';
import { getFeeds, insertArticle, updateFeedLastFetched, deleteOldArticles } from '../lib/db';
import { parseRssFeed } from '../lib/rss-parser';
import { invalidateCache } from '../lib/cache';
import type { Feed } from '@tech-pulse/shared/types';
import { extractKeywords } from '../lib/keywords';
import type { Category } from '@tech-pulse/shared/types';

const MAX_FEED_SIZE = 5 * 1024 * 1024; // 5MB
const FETCH_TIMEOUT_MS = 10_000; // 10s

export async function handleFetchFeeds(env: Env): Promise<void> {
  const feeds = await getFeeds(env.DB);
  const activeFeeds = feeds.filter((f) => f.is_active === 1);

  console.log(`Fetching ${activeFeeds.length} active feeds...`);

  const results = await Promise.allSettled(
    activeFeeds.map(async (feed) => {
      const response = await fetch(feed.url, {
        headers: { 'User-Agent': 'TechPulse RSS Aggregator/1.0' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${feed.url}`);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_FEED_SIZE) {
        throw new Error(`Feed too large: ${feed.url}`);
      }

      const xml = await response.text();
      if (xml.length > MAX_FEED_SIZE) {
        throw new Error(`Feed body too large: ${feed.url}`);
      }
      const parsedArticles = parseRssFeed(xml);

      let insertedCount = 0;
      for (const article of parsedArticles) {
        await insertArticle(env.DB, {
          feed_id: feed.id,
          title: article.title,
          url: article.url,
          summary: article.summary,
          author: article.author,
          published_at: article.publishedAt,
          category: feed.category,
          thumbnail_url: article.thumbnailUrl,
        });
        insertedCount++;
      }

      await updateFeedLastFetched(env.DB, feed.id);

      return { feedName: feed.name, articleCount: insertedCount };
    })
  );

  let successCount = 0;
  let failCount = 0;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      successCount++;
      console.log(`OK: ${result.value.feedName} - ${result.value.articleCount} articles`);
    } else {
      failCount++;
      console.error(`FAIL: ${result.reason}`);
    }
  }

  console.log(`Feed fetch complete: ${successCount} success, ${failCount} failed`);

  // Invalidate all article caches after inserting new data
  await invalidateCache(env.CACHE, '/api/articles');

  // Extract trending keywords (failure here must not affect feed fetching)
  try {
    const TECH_CATS: Category[] = ['programming', 'ai-ml', 'infra-cloud'];
    const NEWS_CATS: Category[] = ['economy', 'politics', 'science'];

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    for (const [section, cats] of [['tech', TECH_CATS], ['news', NEWS_CATS]] as const) {
      const placeholders = cats.map(() => '?').join(',');
      const stmt = env.DB.prepare(
        `SELECT title FROM articles WHERE category IN (${placeholders}) AND published_at > ? ORDER BY published_at DESC`
      );
      const { results } = await stmt.bind(...cats, since).all<{ title: string }>();
      const titles = (results ?? []).map((r) => r.title);
      const keywords = extractKeywords(titles, 10);

      await env.CACHE.put(
        `trending:${section}`,
        JSON.stringify({ keywords, updatedAt: new Date().toISOString() }),
        { expirationTtl: 7200 }
      );
    }

    console.log('Trending keywords updated');
  } catch (err) {
    console.error('Trending keyword extraction failed:', err);
  }
}

export async function handleCleanup(env: Env): Promise<void> {
  const deleted = await deleteOldArticles(env.DB, 30);
  console.log(`Cleanup: deleted ${deleted} articles older than 30 days`);

  // Invalidate caches after cleanup
  await invalidateCache(env.CACHE, '/api/articles');
}
