import { useState, useCallback, useMemo } from 'react';
import type { Article } from '@tech-pulse/shared/types';

const STORAGE_KEY = 'tech-pulse-bookmarks';

function isValidArticle(obj: unknown): obj is Article {
  if (typeof obj !== 'object' || obj === null) return false;
  const a = obj as Record<string, unknown>;
  return (
    typeof a.id === 'number' &&
    typeof a.title === 'string' &&
    typeof a.url === 'string' &&
    (a.url.startsWith('https://') || a.url.startsWith('http://')) &&
    typeof a.category === 'string' &&
    typeof a.published_at === 'string'
  );
}

function loadBookmarks(): Article[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidArticle);
  } catch {
    return [];
  }
}

function saveBookmarks(bookmarks: Article[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Article[]>(loadBookmarks);

  const bookmarkUrls = useMemo(() => new Set(bookmarks.map((b) => b.url)), [bookmarks]);

  const isBookmarked = useCallback(
    (id: number, url?: string) => url ? bookmarkUrls.has(url) : bookmarks.some((b) => b.id === id),
    [bookmarkUrls, bookmarks],
  );

  const toggleBookmark = useCallback((article: Article) => {
    setBookmarks((prev) => {
      const exists = prev.some((b) => b.url === article.url);
      const next = exists ? prev.filter((b) => b.url !== article.url) : [...prev, article];
      saveBookmarks(next);
      return next;
    });
  }, []);

  const clearBookmarks = useCallback(() => {
    setBookmarks([]);
    saveBookmarks([]);
  }, []);

  return { bookmarks, isBookmarked, toggleBookmark, clearBookmarks } as const;
}
