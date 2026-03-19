# アーキテクチャ

## 全体構成図

```
                              ┌──────────────────────────────────────┐
                              │        外部 RSS ソース (20サイト)      │
                              │  Zenn, Qiita, 日経, BBC, Nature...   │
                              └─────────────────┬────────────────────┘
                                                │
                                    Cron (2時間毎) で取得
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Cloudflare Edge Network                              │
│                                                                             │
│  ┌─────────────────────────┐       ┌──────────────────────────────────────┐ │
│  │   Cloudflare Pages      │       │     Cloudflare Workers (Hono)        │ │
│  │                         │       │                                      │ │
│  │  ┌───────────────────┐  │       │  ┌────────────────────────────────┐  │ │
│  │  │  React SPA        │  │ /api  │  │  API レイヤー                   │  │ │
│  │  │  (静的HTML/JS/CSS) │──┼──────▶│  │  GET /api/articles             │  │ │
│  │  │                   │  │       │  │  GET /api/articles/search       │  │ │
│  │  │  index.html       │  │       │  │  GET /api/feeds                │  │ │
│  │  │  assets/*.js      │  │       │  │  GET /api/health               │  │ │
│  │  │  assets/*.css     │  │       │  └────────────┬───────────────────┘  │ │
│  │  │  _headers (CSP)   │  │       │               │                      │ │
│  │  └───────────────────┘  │       │  ┌────────────▼───────────────────┐  │ │
│  │                         │       │  │  ミドルウェア                    │  │ │
│  │  リクエスト: カウント外   │       │  │  ├─ CORS (GET only)            │  │ │
│  │  帯域: 無制限           │       │  │  └─ レート制限 (60req/分/IP)    │  │ │
│  └─────────────────────────┘       │  └────────────┬───────────────────┘  │ │
│                                    │               │                      │ │
│                                    │  ┌────────────▼───────────────────┐  │ │
│                                    │  │  Cron ハンドラー                │  │ │
│                                    │  │  ├─ 0 */2 * * *  RSS一括取得   │  │ │
│                                    │  │  └─ 5 0 * * *    古記事削除    │  │ │
│                                    │  └────────────┬───────────────────┘  │ │
│                                    └───────────────┼──────────────────────┘ │
│                                                    │                        │
│              ┌─────────────────────────────────────┼────────────────┐       │
│              │                                     │                │       │
│              ▼                                     ▼                │       │
│  ┌───────────────────────┐          ┌──────────────────────┐       │       │
│  │   Cloudflare D1       │          │   Cloudflare KV      │       │       │
│  │   (SQLite)            │          │   (Key-Value Store)  │       │       │
│  │                       │          │                      │       │       │
│  │  feeds (20レコード)    │          │  APIレスポンスキャッシュ │       │       │
│  │  articles (数千件)    │          │  (TTL: 5分)          │       │       │
│  │  articles_fts (FTS5)  │          │                      │       │       │
│  │                       │          │  レート制限カウンター   │       │       │
│  │  5GB上限              │          │  (TTL: 2分)          │       │       │
│  └───────────────────────┘          └──────────────────────┘       │       │
│                                                                    │       │
└────────────────────────────────────────────────────────────────────────────┘
```

## データフロー

### 1. RSS取得フロー（Cron: 2時間毎）

```
Cron Trigger
    │
    ▼
handleFetchFeeds()
    │
    ├─ DB から全 active feeds を取得
    │
    ├─ Promise.allSettled() で全フィードを並列取得
    │   │
    │   ├─ fetch(feed.url) ── 10秒タイムアウト / 5MB制限
    │   │
    │   ├─ parseRssFeed(xml) ── RSS 2.0 / Atom / RDF 対応
    │   │   ├─ URL検証 (http/https のみ)
    │   │   ├─ HTML除去 (script/style/comment)
    │   │   └─ サマリー300文字制限
    │   │
    │   └─ INSERT OR IGNORE ── URL重複は自動スキップ
    │
    ├─ feed.last_fetched_at を更新
    │
    └─ KVキャッシュを無効化
```

### 2. 記事取得フロー（ユーザーリクエスト）

```
ブラウザ
    │
    ├─ GET /api/articles?categories=programming,ai-ml,infra-cloud&page=1
    │
    ▼
Worker ミドルウェア
    │
    ├─ CORS チェック
    ├─ レート制限チェック (KV)
    │
    ▼
articles ルート
    │
    ├─ パラメータ検証 (limit ≤ 100, page > 0)
    ├─ KVキャッシュ確認 → ヒットならそのまま返却
    │
    ├─ D1 クエリ (WHERE category IN (...) ORDER BY published_at DESC)
    ├─ COUNT クエリ (ページネーション用)
    │
    ├─ KVにキャッシュ保存 (TTL: 5分)
    │
    └─ JSON レスポンス → ブラウザ
```

### 3. 検索フロー

```
ブラウザ (300ms デバウンス)
    │
    ├─ GET /api/articles/search?q=キーワード
    │
    ▼
Worker
    │
    ├─ FTSクエリ サニタイズ (ダブルクォートエスケープ)
    ├─ D1 FTS5 MATCH クエリ (キャッシュなし)
    │
    └─ JSON レスポンス → ブラウザ
```

## フロントエンド構成

```
App.tsx
 ├─ Header ─────────── ロゴ / 検索バー / テーマ切替
 │
 ├─ IconBar ─────────── セクション切替 (テック / ニュース)
 │
 ├─ Sidebar ─────────── カテゴリナビゲーション
 │   ├─ 今日
 │   ├─ ブックマーク
 │   ├─ すべて
 │   └─ 各カテゴリ (セクションに応じて切替)
 │
 └─ Main Content
     ├─ TodayView ───── カテゴリ別セクション表示
     ├─ ArticleList ─── 記事リスト (ArticleCard × N)
     ├─ Pagination ──── ページネーション
     └─ LoadingSpinner
```

### カスタムフック

| フック | 役割 |
|-------|------|
| `useTheme` | ダークモード管理 (localStorage + prefers-color-scheme) |
| `useBookmarks` | ブックマーク管理 (localStorage + スキーマ検証) |
| `useSearch` | 検索管理 (300msデバウンス + API呼び出し) |

### セクションとカテゴリの対応

```
┌─────────────────────────────────────────────────┐
│  IconBar                                         │
│                                                  │
│  [</>] テック                 [新聞] ニュース      │
│    │                           │                 │
│    ├─ programming              ├─ economy        │
│    ├─ ai-ml                    ├─ politics       │
│    └─ infra-cloud              └─ science        │
│                                                  │
│  「今日」「すべて」は選択中のセクションにスコープ    │
└─────────────────────────────────────────────────┘
```

## データベーススキーマ

```
┌─────────────────────────────────────────┐
│  feeds                                   │
├─────────────────────────────────────────┤
│  id              INTEGER PK AUTO        │
│  name            TEXT NOT NULL           │
│  url             TEXT NOT NULL UNIQUE    │
│  category        TEXT NOT NULL (CHECK)   │
│  last_fetched_at TEXT                    │
│  is_active       INTEGER DEFAULT 1      │
│  created_at      TEXT DEFAULT now()      │
└────────────────┬────────────────────────┘
                 │ 1:N
                 ▼
┌─────────────────────────────────────────┐        ┌─────────────────────┐
│  articles                                │        │  articles_fts       │
├─────────────────────────────────────────┤        │  (FTS5仮想テーブル)  │
│  id              INTEGER PK AUTO        │◀──────▶│                     │
│  feed_id         INTEGER FK → feeds.id  │  rowid │  title              │
│  title           TEXT NOT NULL           │        │  summary            │
│  url             TEXT NOT NULL UNIQUE    │        │                     │
│  summary         TEXT                    │        │  トリガーで自動同期  │
│  author          TEXT                    │        └─────────────────────┘
│  published_at    TEXT NOT NULL           │
│  category        TEXT NOT NULL           │
│  thumbnail_url   TEXT                    │
│  created_at      TEXT DEFAULT now()      │
│                                          │
│  INDEX: (category, published_at DESC)    │
│  INDEX: (published_at DESC)              │
└─────────────────────────────────────────┘
```

## API 仕様

| メソッド | パス | パラメータ | 説明 |
|---------|------|-----------|------|
| GET | `/api/articles` | `category`, `categories` (カンマ区切り), `page`, `limit` | 記事一覧 |
| GET | `/api/articles/search` | `q`, `category`, `page`, `limit` | 全文検索 |
| GET | `/api/feeds` | `category` | フィード一覧 |
| GET | `/api/health` | - | ヘルスチェック |

### レスポンス形式

```json
{
  "ok": true,
  "data": {
    "articles": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 342,
      "hasMore": true
    }
  }
}
```

## セキュリティレイヤー

```
リクエスト
    │
    ▼
┌─ CSP ヘッダー (_headers) ──────────── ブラウザ側XSS緩和
│
├─ CORS (GET only) ──────────────────── 不要なHTTPメソッド拒否
│
├─ レート制限 (60req/分/IP) ──────────── DoS緩和
│
├─ パラメータ検証 ────────────────────── limit ≤ 100, NaN防止
│
├─ FTS5クエリサニタイズ ──────────────── インジェクション防止
│
├─ URL検証 (http/https only) ─────────── javascript: XSS防止
│
├─ HTML除去 (多段処理) ──────────────── script/style/comment除去
│
├─ RSS取得制限 ───────────────────────── 10秒タイムアウト + 5MB上限
│
└─ localStorage検証 ─────────────────── デシリアライズ時スキーマ検証
```

## 環境構成

```
┌──────────────────────────────────┐
│  ローカル開発                      │
│                                    │
│  Vite (5173) ──proxy──▶ Wrangler (8787)
│                          ├─ Miniflare (D1 ローカル)
│                          └─ Miniflare (KV ローカル)
│                                    │
│  .wrangler/state/v3/d1/  ← ローカルDB
└──────────────────────────────────┘

┌──────────────────────────────────┐
│  本番環境                          │
│                                    │
│  Pages (rss-reader-5z2.pages.dev)
│       │
│       │ VITE_API_URL (.env.production)
│       ▼
│  Workers (tech-pulse-worker.rss-reader.workers.dev)
│       ├─ D1 (リモート)
│       ├─ KV (リモート)
│       └─ Cron Triggers
└──────────────────────────────────┘
```
