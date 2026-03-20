# 話題のキーワード機能 — 設計仕様

## 概要

メインコンテンツ上部に横スクロール可能なトレンドキーワードバーを表示する。セクション（テック/ニュース）ごとに直近24時間の記事タイトルからN-gramベースでキーワードを抽出し、上位10個を表示する。キーワードクリックで既存の検索機能を実行する。

## 決定事項

| 項目 | 決定 |
|------|------|
| 集計スコープ | セクション単位（tech / news）。IconBar選択に連動 |
| 表示場所 | メインコンテンツ上部バー（Header直下、記事一覧の上） |
| クリック挙動 | 既存の検索機能を実行 |
| 抽出方法 | N-gram（1〜3語）+ 出現頻度ベース。ストップワード除外 |
| 表示数 | 上位10個 |
| 時間範囲 | 直近24時間分の記事タイトル |
| 集計タイミング | Cron 30分毎（記事取得と同タイミング） |

## バックエンド

### キーワード抽出（Cron内）

記事取得Cronの最後のステップとして実行する。

**処理フロー:**

1. D1から直近24時間の記事タイトルをセクション別に取得
   - tech: `category IN ('programming', 'ai-ml', 'infra-cloud')`
   - news: `category IN ('economy', 'politics', 'science')`
2. 各タイトルからN-gram（1〜3語）を生成
   - 英語: スペース区切りでトークン化
   - ストップワード（"the", "a", "is", "in", "for", "and", "or", "to", "of", "with", "on", "at", "by", "from" 等）を除外
   - 1語、2語連続、3語連続の組み合わせを生成
3. 出現頻度でソートし上位10個を選出
   - 1文字のみのトークン、数字のみのトークンは除外
   - 短いN-gramが長いN-gramに完全包含される場合、長い方を優先（例: "Claude" < "Claude Code"）
4. 結果をKVに保存
   - キー: `trending:tech`, `trending:news`
   - 値: `{ keywords: [{ keyword: string, count: number }], updatedAt: string }`
   - TTL: 3600秒（1時間。Cronが30分毎なので十分）

**実装場所:** `packages/worker/src/cron/fetch-feeds.ts` の `handleFetchFeeds()` 末尾

**キーワード抽出ロジック:** `packages/worker/src/lib/keywords.ts`（新規作成）

### 新APIエンドポイント

**`GET /api/trending`**

- ルートファイル: `packages/worker/src/routes/trending.ts`（新規作成）
- クエリパラメータ: `section` (必須, `tech` | `news`)
- KVから該当セクションの結果を返すのみ（DB問い合わせなし、軽量）
- レスポンス:

```json
{
  "ok": true,
  "data": {
    "keywords": [
      { "keyword": "Claude Code", "count": 42 },
      { "keyword": "Rust", "count": 28 }
    ],
    "updatedAt": "2026-03-20T12:00:00Z"
  }
}
```

- KVにデータがない場合: `{ "ok": true, "data": { "keywords": [], "updatedAt": null } }`

### Cloudflare制約との整合性

- キーワード抽出はCron内で実行。CronはCPU制限が緩い（30秒）ためN-gram処理は問題なし
- APIはKV読み取りのみ。KV reads無料枠10万/日に対し、十分余裕あり
- KV writes: Cron 30分毎 × 2キー = 96writes/日。無料枠1,000writes/日に余裕あり

## フロントエンド

### TrendingBar コンポーネント

**ファイル:** `packages/web/src/components/TrendingBar.tsx`（新規作成）

**Props:**

```typescript
interface TrendingBarProps {
  section: 'tech' | 'news'
  onKeywordClick: (keyword: string) => void
}
```

**表示:**

- 横スクロール可能なバー（`overflow-x: auto`, スクロールバー非表示）
- 各キーワードはバッジ形式（ピル型、背景色付き）
- キーワード名 + 件数を表示
- 先頭に「Trending」ラベル

**動作:**

- `section` prop変更時にAPIを再取得
- キーワードクリック → `onKeywordClick(keyword)` を呼び出し
- ローディング中はスケルトン表示
- データなしの場合はバー自体を非表示

### App.tsx への統合

- `TrendingBar` を Header と記事一覧の間に配置
- `activeSection` を `section` propとして渡す
- `onKeywordClick` で既存の `handleSearch` を呼び出し（検索クエリをセット）

### APIクライアント

**ファイル:** `packages/web/src/api/client.ts` に追加

```typescript
interface TrendingKeyword {
  keyword: string
  count: number
}

interface TrendingResponse {
  keywords: TrendingKeyword[]
  updatedAt: string | null
}

function fetchTrending(section: 'tech' | 'news'): Promise<TrendingResponse>
```

## 共有型定義

**ファイル:** `shared/types.ts` に追加

```typescript
interface TrendingKeyword {
  keyword: string
  count: number
}

interface TrendingData {
  keywords: TrendingKeyword[]
  updatedAt: string | null
}
```

## データフロー

```
Cron(30分毎)
  → 記事取得・DB挿入（既存処理）
  → D1から直近24時間のタイトル取得
  → N-gram抽出・頻度集計
  → KVに保存（trending:tech, trending:news）

ユーザーアクセス
  → App.tsx が activeSection に基づき fetchTrending() 呼び出し
  → GET /api/trending?section=tech → KVから返却
  → TrendingBar にキーワード表示

キーワードクリック
  → onKeywordClick → handleSearch(keyword) → 検索結果表示
```

## ファイル変更一覧

### 新規作成
- `packages/worker/src/lib/keywords.ts` — N-gramキーワード抽出ロジック
- `packages/worker/src/routes/trending.ts` — GET /api/trending エンドポイント
- `packages/web/src/components/TrendingBar.tsx` — トレンドバーUI

### 既存変更
- `packages/worker/src/cron/fetch-feeds.ts` — Cron末尾にキーワード抽出処理を追加
- `packages/worker/src/index.ts` — trending ルートをマウント
- `packages/web/src/App.tsx` — TrendingBar の配置、onKeywordClick ハンドラ
- `packages/web/src/api/client.ts` — fetchTrending() 追加
- `shared/types.ts` — TrendingKeyword, TrendingData 型追加

## テスト方針

- キーワード抽出ロジック: 単体テスト（N-gram生成、ストップワード除外、ランキング）
- 手動確認: Cronトリガー後にAPIレスポンスを確認、フロントで表示を確認
