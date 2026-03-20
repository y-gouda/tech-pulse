import type { Article, Category } from '@tech-pulse/shared/types';
import type { FontSize } from '../hooks/useFontSize';
import ArticleCard from './ArticleCard';

interface TodayViewProps {
  articles: Article[];
  isBookmarked: (id: number) => boolean;
  onToggleBookmark: (article: Article) => void;
  fontSize: FontSize;
}

const sectionConfig: { key: Category; label: string }[] = [
  { key: 'economy', label: '経済・ビジネス' },
  { key: 'politics', label: '政治・社会' },
  { key: 'ai-ml', label: 'AI・ML' },
  { key: 'programming', label: 'プログラミング' },
  { key: 'infra-cloud', label: 'インフラ・クラウド' },
  { key: 'science', label: '科学' },
  { key: 'sports', label: 'スポーツ' },
];

export default function TodayView({ articles, isBookmarked, onToggleBookmark, fontSize }: TodayViewProps) {
  const grouped = new Map<Category, Article[]>();
  for (const article of articles) {
    const list = grouped.get(article.category) ?? [];
    list.push(article);
    grouped.set(article.category, list);
  }

  return (
    <div>
      {sectionConfig.map(({ key, label }) => {
        const items = grouped.get(key);
        if (!items || items.length === 0) return null;

        return (
          <section key={key}>
            <div className="sticky top-0 z-10 border-b border-gray-100 bg-gray-50/90 px-6 py-2 backdrop-blur-sm dark:border-[#2a2a2a] dark:bg-[#1e1e1e]/90">
              <h3 className="text-[12px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {label}
              </h3>
            </div>
            {items.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                isBookmarked={isBookmarked(article.id)}
                onToggleBookmark={onToggleBookmark}
                fontSize={fontSize}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
