import { useState, useEffect } from 'react';

interface HeaderProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
  query: string;
  onQueryChange: (query: string) => void;
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isDesktop;
}

export default function Header({ theme, onToggleTheme, onToggleSidebar, query, onQueryChange }: HeaderProps) {
  const isDesktop = useIsDesktop();

  return (
    <header className="sticky top-0 z-50 flex h-12 items-center border-b border-gray-200 bg-white dark:border-[#333] dark:bg-[#1a1a1a]">
      {/* Left area */}
      <div className="flex h-full shrink-0 items-center gap-2 border-r border-gray-200 px-3 lg:w-[272px] lg:gap-3 lg:px-4 dark:border-[#333]">
        {!isDesktop && (
          <button
            onClick={onToggleSidebar}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#333]"
            aria-label="メニュー"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent">
          <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
            <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
            <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.4" />
            <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1" />
          </svg>
        </div>

        {isDesktop && (
          <span className="text-[14px] font-semibold text-gray-800 dark:text-gray-100">RSS Reader</span>
        )}
      </div>

      {/* Search */}
      <div className="flex flex-1 items-center px-4">
        <div className="relative w-full max-w-md">
          <svg
            className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="記事を検索..."
            className="h-8 w-full rounded-md border border-gray-300 bg-gray-50 pl-8 pr-8 text-[13px] text-gray-700 placeholder-gray-400 focus:border-accent focus:bg-white focus:outline-none dark:border-[#444] dark:bg-[#252525] dark:text-gray-200 dark:placeholder-gray-500 dark:focus:border-accent dark:focus:bg-[#2a2a2a]"
          />
          {query && (
            <button
              onClick={() => onQueryChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Theme toggle */}
      <div className="flex items-center px-4">
        <button
          onClick={onToggleTheme}
          className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#333]"
          aria-label="テーマ切替"
        >
          {theme === 'dark' ? (
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
