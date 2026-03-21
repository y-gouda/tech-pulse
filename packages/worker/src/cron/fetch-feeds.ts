import type { Env } from '../index';
import { getFeeds, insertArticle, updateFeedLastFetched, deleteOldArticles } from '../lib/db';
import { parseRssFeed } from '../lib/rss-parser';
import type { Feed } from '@tech-pulse/shared/types';
import { extractKeywords } from '../lib/keywords';
import type { Category } from '@tech-pulse/shared/types';

const MAX_FEED_SIZE = 5 * 1024 * 1024; // 5MB
const FETCH_TIMEOUT_MS = 10_000; // 10s

export async function handleFetchFeeds(env: Env): Promise<void> {
  const activeFeeds = await getFeeds(env.DB, undefined, true);

  console.log(`Fetching ${activeFeeds.length} active feeds...`);

  const BATCH_SIZE = 5;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < activeFeeds.length; i += BATCH_SIZE) {
    const batch = activeFeeds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (feed) => {
        // Validate feed URL before fetching (SSRF prevention)
        try {
          const parsed = new URL(feed.url);
          if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            throw new Error(`Unsafe protocol: ${feed.url}`);
          }
        } catch {
          throw new Error(`Invalid feed URL: ${feed.url}`);
        }

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

        // Batch insert articles using D1 batch API for efficiency
        const stmts = parsedArticles.map((article) =>
          env.DB.prepare(
            `INSERT OR IGNORE INTO articles (feed_id, title, url, summary, author, published_at, category, thumbnail_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            feed.id,
            article.title,
            article.url,
            article.summary,
            article.author,
            article.publishedAt,
            feed.category,
            article.thumbnailUrl
          )
        );
        if (stmts.length > 0) {
          await env.DB.batch(stmts);
        }

        await updateFeedLastFetched(env.DB, feed.id);

        return { feedName: feed.name, articleCount: stmts.length };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        successCount++;
        console.log(`OK: ${result.value.feedName} - ${result.value.articleCount} articles`);
      } else {
        failCount++;
        console.error(`FAIL: ${result.reason}`);
      }
    }
  }

  console.log(`Feed fetch complete: ${successCount} success, ${failCount} failed`);
}

export async function handleTrending(env: Env): Promise<void> {
  const TECH_CATS: Category[] = ['programming', 'ai-ml', 'infra-cloud'];
  const NEWS_CATS: Category[] = ['economy', 'politics', 'science', 'sports'];

  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  for (const [section, cats] of [['tech', TECH_CATS], ['news', NEWS_CATS]] as const) {
    const placeholders = cats.map(() => '?').join(',');
    const stmt = env.DB.prepare(
      `SELECT title FROM articles WHERE category IN (${placeholders}) AND published_at > ? ORDER BY published_at DESC LIMIT 500`
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
}

export async function handleCleanup(env: Env): Promise<void> {
  const deleted = await deleteOldArticles(env.DB, 30);
  console.log(`Cleanup: deleted ${deleted} articles older than 30 days`);
}
