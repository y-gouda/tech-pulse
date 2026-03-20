// packages/web/src/components/TrendingBar.tsx
import { useState, useEffect } from 'react';
import type { TrendingKeyword } from '@tech-pulse/shared/types';
import type { FontSize } from '../hooks/useFontSize';
import { fetchTrending } from '../api/client';

interface TrendingBarProps {
  section: 'tech' | 'news';
  onKeywordClick: (keyword: string) => void;
  fontSize: FontSize;
}

export default function TrendingBar({ section, onKeywordClick, fontSize }: TrendingBarProps) {
  const [keywords, setKeywords] = useState<TrendingKeyword[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchTrending(section)
      .then((res) => {
        if (!cancelled) setKeywords(res.data?.keywords ?? []);
      })
      .catch((err) => {
        console.error('Failed to fetch trending:', err);
        if (!cancelled) setKeywords([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [section]);

  if (loading) {
    return (
      <div className="border-b border-gray-200 px-6 py-3 dark:border-[#333]">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium tracking-wide text-gray-400 uppercase dark:text-gray-500">
            🔥 トレンド
          </span>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 w-16 animate-pulse rounded-full bg-gray-100 dark:bg-[#2a2a2a]" />
          ))}
        </div>
      </div>
    );
  }

  if (keywords.length === 0) return null;

  const badgeTextSize = fontSize === 'normal' ? 'text-[13px]' : fontSize === 'large' ? 'text-[14px]' : 'text-[15px]';
  const labelTextSize = fontSize === 'normal' ? 'text-[12px]' : fontSize === 'large' ? 'text-[13px]' : 'text-[14px]';

  return (
    <div className="border-b border-gray-200 px-6 py-3 dark:border-[#333]">
      <div className="scrollbar-hide flex items-center gap-2 overflow-x-auto">
        <span className={`${labelTextSize} shrink-0 font-medium tracking-wide text-gray-400 uppercase dark:text-gray-500`}>
          🔥 トレンド
        </span>
        {keywords.map((kw) => (
          <button
            key={kw.keyword}
            onClick={() => onKeywordClick(kw.keyword)}
            className={`${badgeTextSize} shrink-0 cursor-pointer rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-600 transition-colors hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40`}
          >
            {kw.keyword}
            <span className="ml-1 text-blue-400 dark:text-blue-500">{kw.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
