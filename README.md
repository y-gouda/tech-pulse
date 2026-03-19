# RSS Reader

Feedly風UIのRSSニュースアグリゲーター。Cloudflare Workers + Pages で無料・24時間稼働。

テック系（プログラミング・AI・インフラ）とニュース系（経済・政治・科学）を左のアイコンバーで切り替え、カテゴリ別にニュースを閲覧できます。

## 機能

- **カテゴリ別閲覧** — 6カテゴリ（プログラミング / AI・ML / インフラ・クラウド / 経済・ビジネス / 政治・社会 / 科学）
- **今日のニュース** — セクションごとの最新記事をまとめて表示
- **全文検索** — FTS5によるキーワード検索（300msデバウンス）
- **ブックマーク** — localStorageに保存（認証不要）
- **ダークモード** — OS設定に追従 + 手動切替
- **レスポンシブ** — モバイル対応
- **30分ごと自動更新** — Cron Triggersで20ソースから記事を収集

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React 19 + Vite 6 + TypeScript + Tailwind CSS v4 |
| バックエンド | Hono (Cloudflare Workers) |
| データベース | Cloudflare D1 (SQLite + FTS5) |
| キャッシュ | Cloudflare KV |
| 定期実行 | Cloudflare Cron Triggers |
| ホスティング | Cloudflare Pages (フロント) + Workers (API) |

## RSSソース（20ソース）

| カテゴリ | ソース |
|---------|--------|
| プログラミング | Zenn, Qiita, gihyo.jp, CodeZine |
| AI・ML | Zenn AI, Zenn LLM |
| インフラ・クラウド | Publickey, AWS Blog, Google Cloud Blog, Azure Blog |
| 経済・ビジネス | 日本経済新聞, 日経ビジネス, 東洋経済オンライン |
| 政治・社会 | 共同通信, 時事通信, BBC News Japan |
| 科学 | Nature Japan, ナゾロジー, 日経サイエンス, MIT Tech Review 日本版 |

## アーキテクチャ

詳細は [docs/architecture.md](docs/architecture.md) を参照。

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  ブラウザ    │────▶│ Cloudflare Pages │     │  RSSソース   │
│  (React SPA) │     │  (静的配信)       │     │  (20サイト)  │
└──────┬──────┘     └──────────────────┘     └──────┬──────┘
       │ /api/*                                      │
       ▼                                             ▼
┌──────────────────────────────────────────────────────────┐
│                  Cloudflare Workers (Hono)                │
│  ┌─────────┐  ┌───────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Articles │  │  Search   │  │  Feeds   │  │  Cron   │ │
│  │  API     │  │   API     │  │   API    │  │ Handler │ │
│  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └────┬────┘ │
└───────┼──────────────┼──────────────┼─────────────┼──────┘
        │              │              │             │
   ┌────▼──────────────▼──────────────▼─────┐  ┌───▼───┐
   │         Cloudflare D1 (SQLite)          │  │  KV   │
   │  articles / feeds / articles_fts        │  │ Cache │
   └─────────────────────────────────────────┘  └───────┘
```

## セットアップ

### 前提条件

- Node.js 18+
- Cloudflareアカウント（無料プラン）
- Wrangler CLI (`npm install -g wrangler`)

### 1. リポジトリクローン・依存関係インストール

```bash
git clone <repository-url>
cd tech-pulse
npm install
```

### 2. ローカル開発

```bash
# ローカルD1にスキーマ適用
npx wrangler d1 execute tech-pulse-db --local --file=./db/schema.sql

# Worker起動（ターミナル1）
npx wrangler dev --local --test-scheduled

# RSSフィード取得（別ターミナル）
curl "http://localhost:8787/__scheduled?cron=0+*/2+*+*+*"

# フロントエンド起動（ターミナル2）
npm run dev:web
# → http://localhost:5173/ でアクセス
```

ローカルでは Vite のプロキシ設定により `/api/*` が自動的に `localhost:8787` に転送されます。

### 3. DB再作成（カテゴリ変更時）

SQLiteの CHECK 制約は ALTER TABLE で変更できないため、DB を再作成します。

```bash
rm -rf .wrangler/state/v3/d1
npx wrangler d1 execute tech-pulse-db --local --file=./db/schema.sql
```

## デプロイ

### 初回セットアップ

```bash
# 1. Cloudflare認証
npx wrangler login

# 2. D1データベース作成
npx wrangler d1 create tech-pulse-db
# → wrangler.toml の database_id を出力値で更新

# 3. KVネームスペース作成
npx wrangler kv namespace create "CACHE"
# → wrangler.toml の id を出力値で更新

# 4. リモートD1にスキーマ適用
npx wrangler d1 execute tech-pulse-db --remote --file=./db/schema.sql

# 5. Worker デプロイ
npx wrangler deploy

# 6. Pages プロジェクト作成
npx wrangler pages project create rss-reader --production-branch main

# 7. フロントエンドビルド＆デプロイ
npm run build:web
npx wrangler pages deploy packages/web/dist --project-name rss-reader --commit-dirty=true
```

### 更新デプロイ

```bash
# Worker + フロントエンドを一括デプロイ
npm run deploy

# 個別デプロイ
npm run deploy:worker    # Workerのみ
npm run deploy:web       # フロントのみ（ビルド含む）
```

### 環境変数

| ファイル | 変数 | 説明 |
|---------|------|------|
| `packages/web/.env.production` | `VITE_API_URL` | 本番APIのURL |

ローカル開発時は未設定（Viteプロキシで `/api` → `localhost:8787`）。

### 本番URL

| サービス | URL |
|---------|-----|
| フロントエンド | `https://rss-reader-5z2.pages.dev/` |
| API | `https://tech-pulse-worker.rss-reader.workers.dev/api` |

## コマンド一覧

```bash
# 開発
npm run dev:worker          # Worker起動 (localhost:8787)
npm run dev:web             # Vite起動 (localhost:5173)

# ビルド
npm run build:web           # フロントエンドビルド (.env.production を自動読み込み)

# 型チェック
npx tsc -p packages/worker/tsconfig.json --noEmit
npx tsc -p packages/web/tsconfig.json --noEmit

# デプロイ
npm run deploy              # Worker + フロントエンドを一括デプロイ
npm run deploy:worker       # Workerのみ
npm run deploy:web          # フロントのみ（ビルド含む）

# DB操作
npm run db:local            # ローカルDBにスキーマ適用
npm run db:local:reset      # ローカルDB再作成（CHECK制約変更時）
npm run db:remote           # リモートDBにスキーマ適用

# Cronの手動トリガー (ローカルのみ、--test-scheduled が必要)
curl "http://localhost:8787/__scheduled?cron=0+*/2+*+*+*"    # RSS取得
curl "http://localhost:8787/__scheduled?cron=5+0+*+*+*"      # 古記事削除
```

## カテゴリ・ソース変更手順

1. `shared/types.ts` の `Category` 型と `CATEGORIES` 配列を更新
2. `db/schema.sql` の CHECK制約 + INSERT シードを更新
3. `packages/worker/src/config/feeds.ts` にソース追加
4. `packages/web/src/components/Sidebar.tsx` にアイコン追加
5. `packages/web/src/components/ArticleCard.tsx` の `categoryColors` に色追加
6. `packages/web/src/components/TodayView.tsx` の `sectionConfig` に追加
7. `packages/web/src/App.tsx` の `tabLabels` と `TECH_CATEGORIES` or `NEWS_CATEGORIES` に追加
8. ローカルDB再作成 → リモートDB再作成 → Worker再デプロイ

## セキュリティ

- URL検証: `http://` `https://` のみ許可（`javascript:` XSS防止）
- FTS5インジェクション防止: 検索クエリをダブルクォートでエスケープ
- パラメータ制限: `limit` 最大100（DoS防止）
- レート制限: KVベースのIP別制限（60req/分）
- RSS取得制限: 10秒タイムアウト + 5MBサイズ制限
- localStorage検証: デシリアライズ時にスキーマ検証
- セキュリティヘッダー: CSP / X-Frame-Options / X-Content-Type-Options（`public/_headers`）

## Cloudflare無料枠

| リソース | 上限 | 現在の使用量 |
|---------|------|-------------|
| Worker リクエスト | 10万/日 | 余裕あり |
| D1 ストレージ | 5GB | ~100MB/年 |
| KV reads | 10万/日 | 余裕あり |
| KV writes | 1,000/日 | ~130/日 |
| Cron Triggers | 5 | 2 |

## ライセンス

MIT
