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
   - 想定データ量: 20ソース × 30分毎 × 24時間 ≒ 数百〜千タイトル程度。D1 free tier（5M reads/日）に余裕あり
2. 各タイトルをトークン化（日本語・英語ハイブリッド対応）
   - **言語判定**: Unicode文字クラスで判定。CJK文字（`\u3000-\u9FFF`, `\uF900-\uFAFF`）を含むランをCJK、Latin文字ランを英語として分離処理
   - **英語テキスト**: スペース区切りでトークン化。句読点を除去。小文字化
   - **日本語テキスト**: 文字レベルbi-gram/tri-gramを生成（形態素解析不要でCF Workers上で動作可能）。ひらがな・カタカナのみの2文字以下トークンは除外（助詞ノイズ防止）
   - **混合テキスト**: ラン単位で分離処理（例: "Rustで作るWebアプリ" → Latin "Rust" + CJK "で作る", "作るW" はスキップ + Latin "Web" + CJK "アプリ"）
   - **ストップワード除外**:
     - 英語: "the", "a", "an", "is", "are", "was", "were", "in", "for", "and", "or", "to", "of", "with", "on", "at", "by", "from", "it", "its", "this", "that", "how", "what", "why", "new", "your", "you" 等
     - 日本語（ひらがなのみの短いトークン）: "の", "は", "が", "を", "で", "に", "と", "も", "へ", "から", "まで", "より", "など", "した", "する", "ある", "いる", "この", "その", "それ" 等
   - **英語N-gram**: 1語、2語連続、3語連続を生成
3. 出現頻度でソートし上位10個を選出
   - 1文字のみのトークン、数字のみのトークンは除外
   - **サブサンプション（包含除去）アルゴリズム**:
     1. 全N-gramを出現回数降順でソート
     2. 上位から順に確定リストに追加
     3. 追加時に、既に確定済みのより長いN-gramに80%以上包含されているか判定（短いN-gramの出現回数のうち80%以上が長いN-gramと同じ記事に出現）
     4. 80%以上包含されていれば、短い方をスキップ（独立した出現が少ないため）
     5. 80%未満なら両方を残す（例: "Claude" が "Claude Code" 以外にも独立して多く出現する場合）
   - **同数時のタイブレーク**: N-gramの長さ降順（長い方が具体的で有用）。同長なら辞書順
4. 結果をKVに保存
   - キー: `trending:tech`, `trending:news`
   - 値: `{ keywords: [{ keyword: string, count: number }], updatedAt: string }`
   - TTL: 7200秒（2時間。Cronが30分毎だが、複数回失敗してもデータが消えないよう余裕を持たせる）

**実装場所:** `packages/worker/src/cron/fetch-feeds.ts` の `handleFetchFeeds()` 末尾。try/catchで囲み、キーワード抽出の失敗が既存の記事取得処理に影響しないようにする

**キーワード抽出ロジック:** `packages/worker/src/lib/keywords.ts`（新規作成）

### 新APIエンドポイント

**`GET /api/trending`**

- ルートファイル: `packages/worker/src/routes/trending.ts`（新規作成）
- クエリパラメータ: `section` (必須, `tech` | `news`)
- バリデーション: `section` が未指定または `tech`/`news` 以外の場合は 400 エラーを返す
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
- 先頭に「トレンド」ラベル（UIは日本語で統一）

**動作:**

- `section` prop変更時にAPIを再取得
- キーワードクリック → `onKeywordClick(keyword)` を呼び出し
- ローディング中はスケルトン表示
- データなしの場合はバー自体を非表示

### App.tsx への統合

- `TrendingBar` を Header と記事一覧の間に配置
- `activeSection` を `section` propとして渡す
- `onKeywordClick` で `setQuery(keyword)` を呼び出し、`useSearch` フックの検索フローをトリガー。検索は現在のセクションのカテゴリにスコープされる

### APIクライアント

**ファイル:** `packages/web/src/api/client.ts` に追加

```typescript
// 型は shared/types.ts から import（重複定義しない）
import type { TrendingData } from '../../../shared/types'

function fetchTrending(section: 'tech' | 'news'): Promise<TrendingData>
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
  → onKeywordClick → setQuery(keyword) → useSearch による検索実行（現セクションにスコープ）
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

## 注意事項

- **Cron失敗時の分離**: キーワード抽出処理は try/catch で囲む。失敗しても既存の記事取得フローには影響しない
- **KVキャッシュの独立性**: trending KVキー（`trending:*`）は既存の `invalidateCache` の対象外。TTL自然消滅 + Cronによる上書きで管理
- **Section型の共有**: `Section` 型（`'tech' | 'news'`）を `shared/types.ts` に追加し、フロント・バック双方で利用
- **初回デプロイ**: Cronが初回実行されるまで（最大30分）TrendingBarは非表示

## テスト方針

- キーワード抽出ロジック: 単体テスト（N-gram生成、ストップワード除外、日本語/英語/混合テキスト、サブサンプション、ランキング）
- 手動確認: Cronトリガー後にAPIレスポンスを確認、フロントで表示を確認
