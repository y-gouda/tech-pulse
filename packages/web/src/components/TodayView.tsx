import type { Article } from '@tech-pulse/shared/types';
import type { FontSize } from '../hooks/useFontSize';
import ArticleCard from './ArticleCard';

interface TodayViewProps {
  articles: Article[];
  isBookmarked: (id: number, url?: string) => boolean;
  onToggleBookmark: (article: Article) => void;
  fontSize: FontSize;
}

export default function TodayView({ articles, isBookmarked, onToggleBookmark, fontSize }: TodayViewProps) {
  if (articles.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
        直近24時間の記事はありません
      </p>
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
