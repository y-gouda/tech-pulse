import type { Article, Category } from '@tech-pulse/shared/types';

interface ArticleCardProps {
  article: Article;
  isBookmarked: boolean;
  onToggleBookmark: (article: Article) => void;
}

const categoryColors: Record<Category, string> = {
  programming: 'text-green-600 dark:text-green-400',
  'ai-ml': 'text-purple-600 dark:text-purple-400',
  'infra-cloud': 'text-orange-600 dark:text-orange-400',
  economy: 'text-amber-600 dark:text-amber-400',
  politics: 'text-red-600 dark:text-red-400',
  science: 'text-cyan-600 dark:text-cyan-400',
};

function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const date = new Date(dateString).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHour = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return 'たった今';
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;
  if (diffDay < 7) return `${diffDay}日前`;

  const d = new Date(dateString);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

export default function ArticleCard({ article, isBookmarked, onToggleBookmark }: ArticleCardProps) {
  const domain = getDomain(article.url);

  return (
    <article className="group border-b border-gray-100 px-5 py-3 dark:border-[#2a2a2a]">
      {/* Title */}
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-1 block text-[15px] font-semibold leading-snug text-gray-900 group-hover:text-accent dark:text-gray-100 dark:group-hover:text-green-400"
      >
        {article.title}
      </a>

      {/* Meta + summary line */}
      <div className="flex items-center gap-1.5 text-[12px]">
        <span className={`font-medium ${categoryColors[article.category]}`}>{domain}</span>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <time className="text-gray-400 dark:text-gray-500">{formatRelativeTime(article.published_at)}</time>
        {article.author && (
          <>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="truncate text-gray-400 dark:text-gray-500">{article.author}</span>
          </>
        )}

        {/* Spacer + bookmark */}
        <span className="flex-1" />
        <button
          onClick={(e) => {
            e.preventDefault();
            onToggleBookmark(article);
          }}
          className={`rounded p-0.5 transition-colors ${
            isBookmarked
              ? 'text-accent'
              : 'text-gray-300 opacity-0 group-hover:opacity-100 dark:text-gray-600'
          }`}
          aria-label={isBookmarked ? 'ブックマーク解除' : 'ブックマーク'}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24"
            fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>

      {/* Summary */}
      {article.summary && (
        <p className="mt-1 line-clamp-1 text-[13px] text-gray-400 dark:text-gray-500">
          {article.summary}
        </p>
      )}
    </article>
  );
}
