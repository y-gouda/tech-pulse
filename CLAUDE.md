# RSS Reader

Feedly風UIのRSSニュースアグリゲーター。Cloudflare Workers + Pages で無料・24時間稼働。

## 技術スタック

- **フロントエンド**: React 19 + Vite 6 + TypeScript + Tailwind CSS v4
- **バックエンド**: Hono (Cloudflare Workers)
- **データベース**: Cloudflare D1 (SQLite + FTS5全文検索)
- **キャッシュ**: Cloudflare KV
- **定期実行**: Cloudflare Cron Triggers (30分毎)

## プロジェクト構成

```
tech-pulse/
├── package.json              # npm workspaces ルート
├── wrangler.toml             # Worker設定 (D1, KV, Cron)
├── db/schema.sql             # DBスキーマ + シードデータ
├── shared/types.ts           # フロント・バック共用の型定義
├── packages/
│   ├── worker/               # Cloudflare Worker (API + Cron)
│   │   └── src/
│   │       ├── index.ts      # Honoアプリ + CORS + レート制限 + Cronルーター
│   │       ├── routes/       # articles, feeds, health
│   │       ├── cron/         # fetch-feeds.ts (RSS取得 + 古記事削除)
│   │       ├── lib/          # rss-parser, db, cache
│   │       └── config/       # feeds.ts (20ソース定義)
│   └── web/                  # React SPA (Cloudflare Pages)
│       └── src/
│           ├── App.tsx        # ルートコンポーネント
│           ├── components/    # IconBar, Sidebar, Header, ArticleCard, TodayView 等
│           ├── hooks/         # useTheme, useBookmarks, useSearch
│           └── api/           # client.ts (APIクライアント)
```

## コマンド

```bash
# 開発
npm run dev:worker        # Worker起動 (localhost:8787)
npm run dev:web           # Vite起動 (localhost:5173, /apiはWorkerにプロキシ)

# ローカルDB操作
npx wrangler d1 execute tech-pulse-db --local --file=./db/schema.sql  # スキーマ適用
# DB再作成時: rm -rf .wrangler/state/v3/d1 してから上記実行

# Cronの手動トリガー (--test-scheduled フラグ必要)
npx wrangler dev --local --test-scheduled
curl "http://localhost:8787/__scheduled?cron=0+*/2+*+*+*"   # RSS取得
curl "http://localhost:8787/__scheduled?cron=5+0+*+*+*"     # 古記事削除

# ビルド
npm run build:web         # フロントエンドビルド

# 型チェック
npx tsc -p packages/worker/tsconfig.json --noEmit
npx tsc -p packages/web/tsconfig.json --noEmit

# デプロイ
npm run deploy:worker
```

## アーキテクチャ上の注意

- **セクション分離**: テック (programming, ai-ml, infra-cloud) とニュース (economy, politics, science) は左IconBarで切り替え。「今日」「すべて」はセクションにスコープされる
- **Tailwind CSS v4 ダークモード**: `@custom-variant dark (&:where(.dark, .dark *));` が `index.css` に必要。`dark:` クラスが `<html>` の `.dark` クラスで制御される
- **DB CHECK制約**: feeds テーブルに `category IN (...)` 制約あり。カテゴリ追加時は `db/schema.sql` の CHECK制約 + シードデータ + `shared/types.ts` の Category型 + フロント各コンポーネントの更新が必要
- **DB再作成**: ローカルでCHECK制約やカテゴリを変更した場合、`rm -rf .wrangler/state/v3/d1` してスキーマ再適用が必要（ALTER TABLE不可）
- **tsc ビルド副作用**: `npm run build:web` が `tsc -b` を実行し `.js` ファイルと `.tsbuildinfo` を生成する。コミット前に削除すること

## セキュリティ対策

- URLは `http://` `https://` のみ許可（`javascript:` XSS防止）
- FTS5検索クエリはダブルクォートでエスケープ（FTSインジェクション防止）
- `limit` パラメータは最大100に制限（DoS防止）
- KVベースのIPレート制限（60req/分）
- RSS取得に10秒タイムアウト + 5MBサイズ制限
- localStorage読み込み時にスキーマ検証
- CSP / X-Frame-Options / X-Content-Type-Options ヘッダー設定済み（`public/_headers`）

## Cloudflare無料枠の制約

- Worker: 10万リクエスト/日、CPU 10ms/リクエスト
- D1: 5GB ストレージ
- KV: 10万reads/日、1,000writes/日
- Cron: 最大5つ
- 現在20ソース、30分毎取得で十分余裕あり

## カテゴリ・ソース変更手順

1. `shared/types.ts` の `Category` 型と `CATEGORIES` 配列を更新
2. `db/schema.sql` の CHECK制約 + INSERTシードを更新
3. `packages/worker/src/config/feeds.ts` にソース追加
4. `packages/web/src/components/Sidebar.tsx` にアイコン追加
5. `packages/web/src/components/ArticleCard.tsx` の `categoryColors` に色追加
6. `packages/web/src/components/TodayView.tsx` の `sectionConfig` に追加
7. `packages/web/src/App.tsx` の `tabLabels` と `TECH_CATEGORIES` or `NEWS_CATEGORIES` に追加
8. ローカルDB再作成 + Cron再実行
