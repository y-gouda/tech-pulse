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
  return (code >= 0x30A0 && code <= 0x30FF)
    || code === 0x30FC   // ー (prolonged sound mark)
    || code === 0x30FB;  // ・ (middle dot, used in katakana compounds)
}

function isLatin(char: string): boolean {
  const code = char.codePointAt(0)!;
  return (code >= 0x0041 && code <= 0x005A) || (code >= 0x0061 && code <= 0x007A)
    || (code >= 0x0030 && code <= 0x0039) || code === 0x002D || code === 0x002E;
  // A-Z, a-z, 0-9, hyphen, dot
}

// --- Character type classification ---

function isKanji(char: string): boolean {
  const code = char.codePointAt(0)!;
  return (code >= 0x4E00 && code <= 0x9FFF) || (code >= 0xF900 && code <= 0xFAFF)
    || (code >= 0x3400 && code <= 0x4DBF);
}

// --- Run splitting ---

type RunType = 'latin' | 'katakana' | 'kanji';

interface TextRun {
  type: RunType;
  text: string;
}

function charRunType(char: string): RunType | null {
  if (isLatin(char)) return 'latin';
  if (isKatakana(char)) return 'katakana';
  if (isKanji(char)) return 'kanji';
  return null; // hiragana, punctuation, spaces, etc.
}

function splitRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let currentType: RunType | null = null;
  let currentText = '';

  for (const char of text) {
    const type = charRunType(char);

    if (type !== null) {
      if (type === currentType) {
        currentText += char;
      } else if (type === 'latin' && currentType === 'latin') {
        // shouldn't reach here, but just in case
        currentText += char;
      } else {
        // Type changed — flush previous run
        if (currentType && currentText) {
          runs.push({ type: currentType, text: currentText.trim() });
        }
        currentType = type;
        currentText = char;
      }
    } else {
      // Space within a Latin run: keep it (enables multi-word N-grams like "Claude Code")
      if (char === ' ' && currentType === 'latin') {
        currentText += char;
      } else {
        // Other separators (hiragana, punctuation): flush current run
        if (currentType && currentText) {
          runs.push({ type: currentType, text: currentText.trim() });
          currentText = '';
        }
        currentType = null;
      }
    }
  }

  if (currentType && currentText) {
    runs.push({ type: currentType, text: currentText.trim() });
  }

  return runs;
}

// --- Stopwords ---

const EN_STOPWORDS = new Set([
  // Grammar
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
  'in', 'for', 'and', 'or', 'to', 'of', 'with', 'on', 'at',
  'by', 'from', 'it', 'its', 'this', 'that', 'how', 'what',
  'why', 'new', 'your', 'you', 'can', 'will', 'has', 'have',
  'not', 'but', 'all', 'more', 'about', 'up', 'out', 'so',
  'no', 'just', 'than', 'into', 'over', 'after', 'also',
  // Generic tech/content terms (only filtered as 1-grams; kept in multi-word N-grams)
  'use', 'using', 'guide', 'tool', 'tools', 'app',
  'update', 'release', 'version', 'dev', 'build', 'test',
  'data', 'web', 'get', 'set', 'run', 'make',
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

/** Returns [lowercaseKey, originalForm] pairs for Latin N-grams */
function tokenizeLatin(text: string): [string, string][] {
  const rawWords = text
    .split(/[\s.]+/)
    .map((w) => w.replace(/[^a-zA-Z0-9\-]/g, ''))
    .filter((w) => w.length >= 2 && !EN_STOPWORDS.has(w.toLowerCase()) && !/^\d+$/.test(w));

  const ngrams: [string, string][] = [];

  // 1-grams
  for (const w of rawWords) {
    ngrams.push([w.toLowerCase(), w]);
  }

  // 2-grams
  for (let i = 0; i < rawWords.length - 1; i++) {
    const original = `${rawWords[i]} ${rawWords[i + 1]}`;
    ngrams.push([original.toLowerCase(), original]);
  }

  // 3-grams
  for (let i = 0; i < rawWords.length - 2; i++) {
    const original = `${rawWords[i]} ${rawWords[i + 1]} ${rawWords[i + 2]}`;
    ngrams.push([original.toLowerCase(), original]);
  }

  return ngrams;
}

/** Katakana stopwords — common/generic words that don't indicate a trend */
const KATAKANA_STOPWORDS = new Set([
  // Particles / functional
  'オン', 'ザ', 'アン', 'フォー', 'ウィズ', 'イン',
  // Generic tech/news terms
  'ツール', 'ガイド', 'モデル', 'リリース', 'アップデート', 'バージョン',
  'サービス', 'プロジェクト', 'システム', 'アプリ', 'コード', 'データ',
  'テスト', 'レビュー', 'ニュース', 'オンライン', 'サイト', 'ページ',
  'メソッド', 'ライブラリ', 'フレームワーク', 'プラットフォーム',
  'スキル', 'リーダーシップ', 'ビジネス', 'マネジメント',
]);

/** Kanji stopwords — common/generic words that don't indicate a trend */
const KANJI_STOPWORDS = new Set([
  '開発', '機能', '解説', '紹介', '活用', '実装', '設計', '構築',
  '入門', '基本', '方法', '手法', '技術', '完全', '最新', '徹底',
  '実践', '比較', '対応', '環境', '管理', '利用', '導入', '公開',
  '記事', '情報', '世界', '日本', '企業', '市場', '問題', '政府',
  '生成', '発表', '提供', '対策', '強化', '影響', '変更', '改善',
  '搭載', '連携', '自動', '注目', '話題', '可能', '支援', '戦略',
  '東洋経済',
]);

/** Returns [key, originalForm] pairs for katakana */
function tokenizeKatakana(text: string): [string, string][] {
  const trimmed = text.replace(/^・+|・+$/g, '');
  if ([...trimmed].length < 2) return [];
  if (KATAKANA_STOPWORDS.has(trimmed)) return [];
  return [[trimmed, trimmed]];
}

/** Returns [key, originalForm] pairs for kanji */
function tokenizeKanji(text: string): [string, string][] {
  if ([...text].length < 2) return [];
  if (KANJI_STOPWORDS.has(text)) return [];
  return [[text, text]];
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

  // Map: lowercaseKey -> { articleIndices, originalForms (track most common casing) }
  const ngramMap = new Map<string, { articleIndices: Set<number>; forms: Map<string, number> }>();

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    const runs = splitRuns(title);
    const seenInThisTitle = new Set<string>();

    for (const run of runs) {
      const ngrams = run.type === 'latin'
        ? tokenizeLatin(run.text)
        : run.type === 'katakana'
          ? tokenizeKatakana(run.text)
          : tokenizeKanji(run.text);

      for (const [key, original] of ngrams) {
        if (seenInThisTitle.has(key)) continue;
        seenInThisTitle.add(key);

        const existing = ngramMap.get(key);
        if (existing) {
          existing.articleIndices.add(i);
          existing.forms.set(original, (existing.forms.get(original) ?? 0) + 1);
        } else {
          ngramMap.set(key, {
            articleIndices: new Set([i]),
            forms: new Map([[original, 1]]),
          });
        }
      }
    }
  }

  // Filter: must appear in 2+ articles but not in >15% of all articles (too generic/source names),
  // exclude pure-digit ngrams and single-char ngrams
  const maxArticles = Math.max(Math.floor(titles.length * 0.15), 5);
  const occurrences: NgramOccurrence[] = [];
  for (const [key, data] of ngramMap) {
    if (data.articleIndices.size < 2) continue;
    if (data.articleIndices.size > maxArticles) continue;
    if (/^\d+$/.test(key)) continue;
    if ([...key].length < 2) continue;
    occurrences.push({ ngram: key, articleIndices: data.articleIndices });
  }

  const ranked = applySubsumption(occurrences, limit);

  // Resolve display form: use the most common original casing
  return ranked.map((r) => {
    const data = ngramMap.get(r.keyword)!;
    let bestForm = r.keyword;
    let bestCount = 0;
    for (const [form, count] of data.forms) {
      if (count > bestCount) {
        bestForm = form;
        bestCount = count;
      }
    }
    return { keyword: bestForm, count: r.count };
  });
}
