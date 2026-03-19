import type { ApiResponse, ArticlesData, FeedsData, Category } from '@tech-pulse/shared/types';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function request<T>(path: string, params?: Record<string, string | number | undefined>): Promise<ApiResponse<T>> {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export function fetchArticles(params: {
  category?: Category | 'all';
  categories?: Category[];
  page?: number;
  limit?: number;
}): Promise<ApiResponse<ArticlesData>> {
  const { category, categories, page, limit } = params;
  return request<ArticlesData>(`${BASE_URL}/articles`, {
    category: category === 'all' ? undefined : category,
    categories: categories?.join(','),
    page,
    limit,
  });
}

export function searchArticles(params: {
  q: string;
  category?: Category | 'all';
  page?: number;
  limit?: number;
}): Promise<ApiResponse<ArticlesData>> {
  const { q, category, page, limit } = params;
  return request<ArticlesData>(`${BASE_URL}/articles/search`, {
    q,
    category: category === 'all' ? undefined : category,
    page,
    limit,
  });
}

export function fetchFeeds(category?: Category | 'all'): Promise<ApiResponse<FeedsData>> {
  return request<FeedsData>(`${BASE_URL}/feeds`, {
    category: category === 'all' ? undefined : category,
  });
}
