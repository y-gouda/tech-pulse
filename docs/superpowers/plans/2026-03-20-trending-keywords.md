# 話題のキーワード機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** メインコンテンツ上部にセクション別トレンドキーワードバーを表示し、クリックで検索を実行する

**Architecture:** Cron内でN-gramベースのキーワード抽出を行いKVに保存。軽量なAPIでKVから読み取り、フロントのTrendingBarコンポーネントで表示。既存の検索機能と連携。

**Tech Stack:** Hono (Worker API), Cloudflare KV, React 19, TypeScript, Tailwind CSS v4

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `packages/worker/src/lib/keywords.ts` | N-gramキーワード抽出ロジック（トークン化、ストップワード、サブサンプション、ランキング） |
| `packages/worker/src/routes/trending.ts` | `GET /api/trending` エンドポイント（KVから読み取り） |
| `packages/web/src/components/TrendingBar.tsx` | トレンドキーワードバーUIコンポーネント |

### Modified Files
| File | Change |
|------|--------|
| `shared/types.ts` | `TrendingKeyword`, `TrendingData` 型追加 |
| `packages/worker/src/index.ts` | trending ルートマウント |
| `packages/worker/src/cron/fetch-feeds.ts` | キーワード抽出処理を末尾に追加 |
| `packages/web/src/api/client.ts` | `fetchTrending()` 関数追加 |
| `packages/web/src/App.tsx` | TrendingBar 配置 + onKeywordClick ハンドラ |
| `packages/web/src/index.css` | `scrollbar-hide` ユーティリティ追加 |

**注意: `Section` 型について** — `Section = 'tech' | 'news'` は既に `packages/web/src/components/IconBar.tsx` で定義・exportされている。`shared/types.ts` には追加しない。バックエンド（trending route, cron）ではインラインリテラル `'tech' | 'news'` を使用する。

---

### Task 1: shared/types.ts に型定義を追加

**Files:**
- Modify: `shared/types.ts`

- [ ] **Step 1: TrendingKeyword, TrendingData 型を追加**

`shared/types.ts` の末尾（`CATEGORIES` の後）に以下を追加:

```typescript
export interface TrendingKeyword {
  keyword: string;
  count: number;
}

export interface TrendingData {
  keywords: TrendingKeyword[];
  updatedAt: string | null;
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc -p packages/worker/tsconfig.json --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add shared/types.ts
git commit -m "feat: add TrendingKeyword and TrendingData types to shared types"
```

---

### Task 2: キーワード抽出ロジック (keywords.ts)

**Files:**
- Create: `packages/worker/src/lib/keywords.ts`

- [ ] **Step 1: keywords.ts を新規作成**

完全な実装コード:

```typescript
// packages/worker/src/lib/keywords.ts

// --- Unicode character classification ---

function isCJK(char: string): boolean {
  const code = char.codePointAt(0)!;
  return (code >= 0x3000 && code <= 0x9FFF) || (code >= 0xF900 && code <= 0xFAFF);
}

function isHiragana(char: string): boolean {
  const code = char.codePointAt(0)!;
  return code >= 0x3040 && code <= 0x309F;
}

function isKatakana(char: string): boolean {
  const code = char.codePointAt(0)!;
  return code >= 0x30A0 && code <= 0x30FF;
}

function isLatin(char: string): boolean {
  const code = char.codePointAt(0)!;
  return (code >= 0x0041 && code <= 0x005A) || (code >= 0x0061 && code <= 0x007A)
    || (code >= 0x0030 && code <= 0x0039) || code === 0x002D || code === 0x002E;
  // A-Z, a-z, 0-9, hyphen, dot
}

// --- Run splitting ---

interface TextRun {
  type: 'cjk' | 'latin';
  text: string;
}

function splitRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let currentType: 'cjk' | 'latin' | null = null;
  let currentText = '';

  for (const char of text) {
    if (isCJK(char)) {
      if (currentType === 'latin' && currentText) {
        runs.push({ type: 'latin', text: currentText });
        currentText = '';
      }
      currentType = 'cjk';
      currentText += char;
    } else if (isLatin(char)) {
      if (currentType === 'cjk' && currentText) {
        runs.push({ type: 'cjk', text: currentText });
        currentText = '';
      }
      currentType = 'latin';
      currentText += char;
    } else {
      // Separator (space, punctuation, etc.) — flush current run
      if (currentType && currentText) {
        runs.push({ type: currentType, text: currentText });
        currentText = '';
      }
      // For latin, space is a word separator — keep it
      if (char === ' ' && currentType === 'latin') {
        // We already flushed; next latin char starts fresh
      }
      currentType = null;
    }
  }

  if (currentType && currentText) {
    runs.push({ type: currentType, text: currentText });
  }

  return runs;
}

// --- Stopwords ---

const EN_STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
  'in', 'for', 'and', 'or', 'to', 'of', 'with', 'on', 'at',
  'by', 'from', 'it', 'its', 'this', 'that', 'how', 'what',
  'why', 'new', 'your', 'you', 'can', 'will', 'has', 'have',
  'not', 'but', 'all', 'more', 'about', 'up', 'out', 'so',
  'no', 'just', 'than', 'into', 'over', 'after', 'also',
]);

const JA_STOPWORDS = new Set([
  'の', 'は', 'が', 'を', 'で', 'に', 'と', 'も', 'へ',
  'から', 'まで', 'より', 'など', 'した', 'する', 'ある',
  'いる', 'この', 'その', 'それ', 'これ', 'あの', 'どの',
  'って', 'という', 'として', 'について', 'における',
  'ため', 'こと', 'もの', 'ところ', 'よう', 'ない',
  'なく', 'れる', 'られ', 'せる', 'させ', 'ている',
]);

// --- Tokenizers ---

function tokenizeLatin(text: string): string[] {
  // Split on spaces, clean punctuation, lowercase
  const words = text
    .split(/[\s.]+/)
    .map((w) => w.replace(/[^a-zA-Z0-9\-]/g, '').toLowerCase())
    .filter((w) => w.length >= 2 && !EN_STOPWORDS.has(w) && !/^\d+$/.test(w));

  const ngrams: string[] = [];

  // 1-grams
  for (const w of words) {
    ngrams.push(w);
  }

  // 2-grams
  for (let i = 0; i < words.length - 1; i++) {
    ngrams.push(`${words[i]} ${words[i + 1]}`);
  }

  // 3-grams
  for (let i = 0; i < words.length - 2; i++) {
    ngrams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }

  return ngrams;
}

function isKanaOnly(text: string): boolean {
  for (const char of text) {
    if (!isHiragana(char) && !isKatakana(char)) return false;
  }
  return true;
}

function tokenizeCJK(text: string): string[] {
  const chars = [...text]; // handle surrogate pairs
  const ngrams: string[] = [];

  // 2-grams
  for (let i = 0; i < chars.length - 1; i++) {
    const gram = chars[i] + chars[i + 1];
    if (!(isKanaOnly(gram) && gram.length <= 2 && JA_STOPWORDS.has(gram))) {
      ngrams.push(gram);
    }
  }

  // 3-grams
  for (let i = 0; i < chars.length - 2; i++) {
    const gram = chars[i] + chars[i + 1] + chars[i + 2];
    if (!JA_STOPWORDS.has(gram)) {
      ngrams.push(gram);
    }
  }

  return ngrams.filter((g) => !JA_STOPWORDS.has(g));
}

// --- Subsumption ---

interface NgramOccurrence {
  ngram: string;
  articleIndices: Set<number>;
}

function applySubsumption(
  occurrences: NgramOccurrence[],
  limit: number,
): { keyword: string; count: number }[] {
  // Sort: article count DESC, then ngram length DESC, then lexicographic ASC
  const sorted = [...occurrences].sort((a, b) => {
    const countDiff = b.articleIndices.size - a.articleIndices.size;
    if (countDiff !== 0) return countDiff;
    const lenDiff = b.ngram.length - a.ngram.length;
    if (lenDiff !== 0) return lenDiff;
    return a.ngram.localeCompare(b.ngram);
  });

  const accepted: NgramOccurrence[] = [];

  for (const candidate of sorted) {
    if (accepted.length >= limit) break;

    // Check if this candidate is subsumed by any already-accepted longer ngram
    let subsumed = false;
    for (const existing of accepted) {
      if (existing.ngram.length <= candidate.ngram.length) continue;
      if (!existing.ngram.includes(candidate.ngram)) continue;

      // Count how many of candidate's articles also appear in existing
      let overlap = 0;
      for (const idx of candidate.articleIndices) {
        if (existing.articleIndices.has(idx)) overlap++;
      }

      const overlapRatio = overlap / candidate.articleIndices.size;
      if (overlapRatio >= 0.8) {
        subsumed = true;
        break;
      }
    }

    if (!subsumed) {
      accepted.push(candidate);
    }
  }

  return accepted.map((o) => ({
    keyword: o.ngram,
    count: o.articleIndices.size,
  }));
}

// --- Main export ---

export function extractKeywords(
  titles: string[],
  limit: number = 10,
): { keyword: string; count: number }[] {
  if (titles.length === 0) return [];

  // Map: ngram -> set of article indices
  const ngramMap = new Map<string, Set<number>>();

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    const runs = splitRuns(title);
    const seenInThisTitle = new Set<string>();

    for (const run of runs) {
      const ngrams = run.type === 'latin'
        ? tokenizeLatin(run.text)
        : tokenizeCJK(run.text);

      for (const ngram of ngrams) {
        // Dedupe within same title
        if (seenInThisTitle.has(ngram)) continue;
        seenInThisTitle.add(ngram);

        const existing = ngramMap.get(ngram);
        if (existing) {
          existing.add(i);
        } else {
          ngramMap.set(ngram, new Set([i]));
        }
      }
    }
  }

  // Filter: must appear in at least 2 articles, exclude pure-digit ngrams
  const occurrences: NgramOccurrence[] = [];
  for (const [ngram, indices] of ngramMap) {
    if (indices.size < 2) continue;
    if (/^\d+$/.test(ngram)) continue;
    occurrences.push({ ngram, articleIndices: indices });
  }

  return applySubsumption(occurrences, limit);
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc -p packages/worker/tsconfig.json --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add packages/worker/src/lib/keywords.ts
git commit -m "feat: add N-gram keyword extraction with CJK/Latin hybrid support"
```

---

### Task 3: Trending API エンドポイント (trending.ts)

**Files:**
- Create: `packages/worker/src/routes/trending.ts`
- Modify: `packages/worker/src/index.ts`

- [ ] **Step 1: trending.ts ルートを作成**

既存の `articles.ts` のパターンに従い、Honoルートを作成:

```typescript
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
```

- [ ] **Step 2: index.ts にルートをマウント**

`packages/worker/src/index.ts` に以下の変更を加える:

import 追加（既存の health import の後）:
```typescript
import trending from './routes/trending';
```

ルートマウント追加（既存の `app.route('/', health);` の後）:
```typescript
app.route('/', trending);
```

- [ ] **Step 3: 型チェック**

Run: `npx tsc -p packages/worker/tsconfig.json --noEmit`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add packages/worker/src/routes/trending.ts packages/worker/src/index.ts
git commit -m "feat: add GET /api/trending endpoint reading from KV"
```

---

### Task 4: Cron にキーワード抽出処理を統合

**Files:**
- Modify: `packages/worker/src/cron/fetch-feeds.ts`

- [ ] **Step 1: handleFetchFeeds() の末尾にキーワード抽出を追加**

`fetch-feeds.ts` の `handleFetchFeeds()` 関数の末尾（`invalidateCache` の後）に以下を追加。

import 追加:
```typescript
import { extractKeywords } from '../lib/keywords';
import type { Category } from '@tech-pulse/shared/types';
```

`handleFetchFeeds()` の末尾、`await invalidateCache(env.CACHE, '/api/articles');` の後に追加:

```typescript
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
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc -p packages/worker/tsconfig.json --noEmit`
Expected: エラーなし

- [ ] **Step 3: ローカルで手動テスト**

以下の手順でキーワード抽出が動くか確認:

```bash
# Worker起動（スケジュールテストモード）
npx wrangler dev --local --test-scheduled

# 別ターミナルで: まずDB初期化（必要なら）
npx wrangler d1 execute tech-pulse-db --local --file=./db/schema.sql

# Cronトリガー（RSS取得 — wrangler.toml の cron と一致させること）
curl "http://localhost:8787/__scheduled?cron=*/30+*+*+*+*"

# トレンドAPI確認
curl "http://localhost:8787/api/trending?section=tech" | jq
curl "http://localhost:8787/api/trending?section=news" | jq

# バリデーション確認
curl "http://localhost:8787/api/trending" | jq          # 400 error expected
curl "http://localhost:8787/api/trending?section=bad" | jq  # 400 error expected
```

Expected: keywords 配列にキーワードが返る（記事が取得されていれば）

- [ ] **Step 4: コミット**

```bash
git add packages/worker/src/cron/fetch-feeds.ts
git commit -m "feat: integrate keyword extraction into feed fetch cron"
```

---

### Task 5: フロントエンド API クライアント (client.ts)

**Files:**
- Modify: `packages/web/src/api/client.ts`

- [ ] **Step 1: fetchTrending() を追加**

`packages/web/src/api/client.ts` に以下を追加:

import に `TrendingData` を追加:
```typescript
import type { ApiResponse, ArticlesData, FeedsData, Category, TrendingData } from '@tech-pulse/shared/types';
```

ファイル末尾に関数追加:
```typescript
export function fetchTrending(section: 'tech' | 'news'): Promise<ApiResponse<TrendingData>> {
  return request<TrendingData>(`${BASE_URL}/trending`, { section });
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc -p packages/web/tsconfig.json --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add packages/web/src/api/client.ts
git commit -m "feat: add fetchTrending API client function"
```

---

### Task 6: TrendingBar コンポーネント + scrollbar-hide CSS

**Files:**
- Create: `packages/web/src/components/TrendingBar.tsx`
- Modify: `packages/web/src/index.css`

**注意:** `fontSize` は `FontSize` 型（`'normal' | 'large' | 'xlarge'`）。`packages/web/src/hooks/useFontSize.ts` から import する。

- [ ] **Step 1: index.css に scrollbar-hide ユーティリティを追加**

`packages/web/src/index.css` の末尾に追加:

```css
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

- [ ] **Step 2: TrendingBar.tsx を新規作成**

```tsx
// packages/web/src/components/TrendingBar.tsx
import { useState, useEffect } from 'react';
import type { TrendingKeyword } from '@tech-pulse/shared/types';
import type { FontSize } from '../hooks/useFontSize';
import { fetchTrending } from '../api/client';

interface TrendingBarProps {
  section: 'tech' | 'news';
  onKeywordClick: (keyword: string) => void;
  fontSize: FontSize;
}

export default function TrendingBar({ section, onKeywordClick, fontSize }: TrendingBarProps) {
  const [keywords, setKeywords] = useState<TrendingKeyword[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchTrending(section)
      .then((res) => {
        if (!cancelled) setKeywords(res.data?.keywords ?? []);
      })
      .catch((err) => {
        console.error('Failed to fetch trending:', err);
        if (!cancelled) setKeywords([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [section]);

  if (loading) {
    return (
      <div className="border-b border-gray-200 px-6 py-3 dark:border-[#333]">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium tracking-wide text-gray-400 uppercase dark:text-gray-500">
            トレンド
          </span>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 w-16 animate-pulse rounded-full bg-gray-100 dark:bg-[#2a2a2a]" />
          ))}
        </div>
      </div>
    );
  }

  if (keywords.length === 0) return null;

  const badgeTextSize = fontSize === 'normal' ? 'text-[11px]' : fontSize === 'large' ? 'text-[12px]' : 'text-[13px]';
  const labelTextSize = fontSize === 'normal' ? 'text-[10px]' : fontSize === 'large' ? 'text-[11px]' : 'text-[12px]';

  return (
    <div className="border-b border-gray-200 px-6 py-3 dark:border-[#333]">
      <div className="scrollbar-hide flex items-center gap-2 overflow-x-auto">
        <span className={`${labelTextSize} shrink-0 font-medium tracking-wide text-gray-400 uppercase dark:text-gray-500`}>
          トレンド
        </span>
        {keywords.map((kw) => (
          <button
            key={kw.keyword}
            onClick={() => onKeywordClick(kw.keyword)}
            className={`${badgeTextSize} shrink-0 cursor-pointer rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-600 transition-colors hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40`}
          >
            {kw.keyword}
            <span className="ml-1 text-blue-400 dark:text-blue-500">{kw.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 型チェック**

Run: `npx tsc -p packages/web/tsconfig.json --noEmit`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add packages/web/src/components/TrendingBar.tsx packages/web/src/index.css
git commit -m "feat: add TrendingBar component with keyword badges and scrollbar-hide"
```

---

### Task 7: App.tsx に TrendingBar を統合

**Files:**
- Modify: `packages/web/src/App.tsx`

- [ ] **Step 1: TrendingBar を import し配置**

`packages/web/src/App.tsx` に以下の変更:

import 追加（既存の LoadingSpinner import の後）:
```typescript
import TrendingBar from './components/TrendingBar';
```

`<main>` タグ内、`{error && ...}` ブロックの直後、`{renderContent()}` の直前に TrendingBar を配置:
```tsx
          {!isSearchActive && (
            <TrendingBar
              section={activeSection}
              onKeywordClick={(keyword) => setQuery(keyword)}
              fontSize={fontSize}
            />
          )}
```

**動作説明:**
- 検索アクティブ時は非表示（検索結果画面にトレンドバーは不要）
- `onKeywordClick` は `setQuery(keyword)` を呼ぶ → `useSearch` フックのデバウンス（300ms）→ `searchArticles()` 実行
- 検索はデフォルトで `searchCategory: 'all'` でグローバル検索になる。セクションスコープはv2で検討
- `activeSection` 変更時に TrendingBar 内の useEffect が自動再取得

- [ ] **Step 2: 型チェック**

Run: `npx tsc -p packages/web/tsconfig.json --noEmit`
Expected: エラーなし

- [ ] **Step 3: ローカルで E2E 確認**

```bash
# ターミナル1: Worker起動（スケジュールテストモード）
npx wrangler dev --local --test-scheduled

# ターミナル2: Web起動
npm run dev:web

# ターミナル3: Cronトリガーして記事取得＋キーワード抽出
curl "http://localhost:8787/__scheduled?cron=*/30+*+*+*+*"
```

ブラウザで http://localhost:5173 を開き以下を確認:
1. Header 直下にトレンドバーが表示される（Cronトリガー後）
2. テック/ニュースのセクション切り替えでキーワードが変わる
3. キーワードクリックで検索が実行される
4. 検索中はトレンドバーが非表示になる
5. ダークモードでスタイルが崩れない
6. フォントサイズ切り替えでバッジサイズが変わる
7. KVにデータがない初回状態ではスケルトン→非表示

- [ ] **Step 4: コミット**

```bash
git add packages/web/src/App.tsx
git commit -m "feat: integrate TrendingBar into main layout"
```
