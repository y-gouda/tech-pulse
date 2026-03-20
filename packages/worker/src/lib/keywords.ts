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

/** Katakana stopwords (common but meaningless katakana words) */
const KATAKANA_STOPWORDS = new Set([
  'オン', 'ザ', 'アン', 'フォー', 'ウィズ', 'イン',
]);

/** Tokenize a katakana run: treat as a whole word (like Latin unigrams) */
function tokenizeKatakana(text: string): string[] {
  // Katakana runs are whole words (e.g., "オンライン", "リリース", "コンテナ")
  // Only include if 2+ characters and not a stopword
  if (text.length < 2) return [];
  if (KATAKANA_STOPWORDS.has(text)) return [];
  return [text];
}

/** Tokenize a kanji run: treat as whole word (compound noun) */
function tokenizeKanji(text: string): string[] {
  const chars = [...text];
  if (chars.length < 2) return [];

  // Kanji runs are compound nouns: 開発, 生成, 人工知能, 東洋経済
  // Treat as whole word. For long runs (5+), also extract 2-3 char sub-compounds.
  // For 4-char runs, only the whole word (e.g., 東洋経済, 人工知能)
  const ngrams: string[] = [text];

  if (chars.length >= 5) {
    for (let i = 0; i < chars.length - 1; i++) {
      ngrams.push(chars[i] + chars[i + 1]);
    }
    for (let i = 0; i < chars.length - 2; i++) {
      ngrams.push(chars[i] + chars[i + 1] + chars[i + 2]);
    }
  }

  return ngrams;
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
        : run.type === 'katakana'
          ? tokenizeKatakana(run.text)
          : tokenizeKanji(run.text);

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

  // Filter: must appear in 2+ articles but not in >15% of all articles (too generic/source names),
  // exclude pure-digit ngrams and single-char ngrams
  const maxArticles = Math.max(Math.floor(titles.length * 0.15), 5);
  const occurrences: NgramOccurrence[] = [];
  for (const [ngram, indices] of ngramMap) {
    if (indices.size < 2) continue;
    if (indices.size > maxArticles) continue;
    if (/^\d+$/.test(ngram)) continue;
    if ([...ngram].length < 2) continue;
    occurrences.push({ ngram, articleIndices: indices });
  }

  return applySubsumption(occurrences, limit);
}
