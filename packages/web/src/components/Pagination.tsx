import type { Pagination as PaginationType } from '@tech-pulse/shared/types';

interface PaginationProps {
  pagination: PaginationType;
  onPageChange: (page: number) => void;
}

export default function Pagination({ pagination, onPageChange }: PaginationProps) {
  const { page, total, limit, hasMore } = pagination;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-gray-100 px-2 py-3 dark:border-[#2a2a2a]">
      <span className="text-[12px] text-gray-400 dark:text-gray-600">
        {total.toLocaleString()} 件中 {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} 件
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded px-2.5 py-1 text-[12px] font-medium text-gray-600 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-30 dark:text-gray-400 dark:hover:bg-[#2a2a2a]"
        >
          前へ
        </button>
        <span className="px-2 text-[12px] text-gray-400 dark:text-gray-500">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!hasMore}
          className="rounded px-2.5 py-1 text-[12px] font-medium text-gray-600 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-30 dark:text-gray-400 dark:hover:bg-[#2a2a2a]"
        >
          次へ
        </button>
      </div>
    </div>
  );
}
