export type Category = 'programming' | 'ai-ml' | 'infra-cloud' | 'economy' | 'politics' | 'science';

export interface Feed {
  id: number;
  name: string;
  url: string;
  category: Category;
  last_fetched_at: string | null;
  is_active: number;
  created_at: string;
}

export interface Article {
  id: number;
  feed_id: number;
  title: string;
  url: string;
  summary: string;
  author: string;
  published_at: string;
  category: Category;
  thumbnail_url: string;
  created_at: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface ApiResponse<T> {
  ok: boolean;
  data: T;
  error?: string;
}

export interface ArticlesData {
  articles: Article[];
  pagination: Pagination;
}

export interface FeedsData {
  feeds: Feed[];
}

export interface HealthData {
  status: string;
  timestamp: string;
}

export const CATEGORIES: { key: Category | 'all'; label: string }[] = [
  { key: 'all', label: '全て' },
  { key: 'programming', label: 'プログラミング' },
  { key: 'ai-ml', label: 'AI・ML' },
  { key: 'infra-cloud', label: 'インフラ・クラウド' },
  { key: 'economy', label: '経済・ビジネス' },
  { key: 'politics', label: '政治・社会' },
  { key: 'science', label: '科学' },
];
