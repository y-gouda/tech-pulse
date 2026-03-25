import type { Article } from '@tech-pulse/shared/types';
import type { FontSize } from '../hooks/useFontSize';
import ArticleCard from './ArticleCard';

interface ArticleListProps {
  articles: Article[];
  isBookmarked: (id: number, url?: string) => boolean;
  onToggleBookmark: (article: Article) => void;
  fontSize: FontSize;
}

export default function ArticleList({ articles, isBookmarked, onToggleBookmark, fontSize }: ArticleListProps) {
  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400 dark:text-gray-600">
        <svg className="mb-3 h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <p className="text-[13px]">記事が見つかりませんでした</p>
      </div>
    );
  }

  return (
    <div>
      {articles.map((article) => (
        <ArticleCard
          key={article.id}
          article={article}
          isBookmarked={isBookmarked(article.id, article.url)}
          onToggleBookmark={onToggleBookmark}
          fontSize={fontSize}
        />
      ))}
    </div>
  );
}
