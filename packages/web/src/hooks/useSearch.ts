import { useState, useEffect, useRef, useCallback } from 'react';
import type { Article, Category, Pagination as PaginationType } from '@tech-pulse/shared/types';
import { searchArticles } from '../api/client';

export function useSearch() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<Article[] | null>(null);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchCategory, setSearchCategory] = useState<Category | 'all'>('all');
  const [searchPage, setSearchPage] = useState(1);
  const abortRef = useRef<AbortController | null>(null);

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setSearchPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Execute search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults(null);
      setPagination(null);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    searchArticles({
      q: debouncedQuery,
      category: searchCategory,
      page: searchPage,
    })
      .then((res) => {
        if (!cancelled) {
          setResults(res.data.articles);
          setPagination(res.data.pagination);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Search failed:', err);
          setResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, searchCategory, searchPage]);

  const setSearchPageCb = useCallback((page: number) => {
    setSearchPage(page);
  }, []);

  return {
    query,
    setQuery,
    results,
    pagination,
    isSearching,
    searchCategory,
    setSearchCategory,
    searchPage,
    setSearchPage: setSearchPageCb,
  } as const;
}
