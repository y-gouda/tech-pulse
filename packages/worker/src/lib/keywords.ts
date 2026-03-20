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
      // Space within a Latin run: keep it (enables multi-word N-grams like "Claude Code")
      if (char === ' ' && currentType === 'latin') {
        currentText += char;
      } else {
        // Other separators: flush current run
        if (currentType && currentText) {
          runs.push({ type: currentType, text: currentText.trim() });
          currentText = '';
        }
        currentType = null;
      }
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
