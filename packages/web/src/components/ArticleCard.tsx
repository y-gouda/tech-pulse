import type { Article, Category } from '@tech-pulse/shared/types';
import type { FontSize } from '../hooks/useFontSize';

interface ArticleCardProps {
  article: Article;
  isBookmarked: boolean;
  onToggleBookmark: (article: Article) => void;
  fontSize: FontSize;
}

const categoryBadge: Record<Category, { label: string; className: string }> = {
  programming: { label: 'Dev', className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  'ai-ml': { label: 'AI', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' },
  'infra-cloud': { label: 'Infra', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
  economy: { label: '経済', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  politics: { label: '社会', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  science: { label: '科学', className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400' },
  sports: { label: 'スポーツ', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
};

const fontPx = {
  title:   { normal: 16, large: 18, xlarge: 21 },
  meta:    { normal: 12, large: 13, xlarge: 15 },
  badge:   { normal: 10, large: 11, xlarge: 13 },
  summary: { normal: 14, large: 16, xlarge: 18 },
} as const;

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

export default function ArticleCard({ article, isBookmarked, onToggleBookmark, fontSize }: ArticleCardProps) {
  const domain = getDomain(article.url);

  return (
    <article className="group border-b border-gray-100 px-5 py-3 dark:border-[#2a2a2a]">
      {/* Title */}
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: `${fontPx.title[fontSize]}px` }}
        className="mb-1 block font-semibold leading-snug text-gray-900 group-hover:text-accent dark:text-gray-100 dark:group-hover:text-green-400"
      >
        {article.title}
      </a>

      {/* Meta + summary line */}
      <div style={{ fontSize: `${fontPx.meta[fontSize]}px` }} className="flex items-center gap-1.5">
        <span style={{ fontSize: `${fontPx.badge[fontSize]}px` }} className={`rounded px-1.5 py-0.5 font-semibold leading-none ${categoryBadge[article.category].className}`}>
          {categoryBadge[article.category].label}
        </span>
        <span className="text-gray-500 dark:text-gray-400">{domain}</span>
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
        <p style={{ fontSize: `${fontPx.summary[fontSize]}px` }} className="mt-1 line-clamp-1 text-gray-400 dark:text-gray-500">
          {article.summary}
        </p>
      )}
    </article>
  );
}
