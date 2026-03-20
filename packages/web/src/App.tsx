import { useState, useEffect, useCallback, useRef } from 'react';
import type { Article, Pagination as PaginationType, Category } from '@tech-pulse/shared/types';
import { fetchArticles } from './api/client';
import { useTheme } from './hooks/useTheme';
import { useFontSize } from './hooks/useFontSize';
import { useBookmarks } from './hooks/useBookmarks';
import { useSearch } from './hooks/useSearch';
import Header from './components/Header';
import IconBar from './components/IconBar';
import type { Section } from './components/IconBar';
import Sidebar from './components/Sidebar';
import type { TabKey } from './components/Sidebar';
import ArticleList from './components/ArticleList';
import TodayView from './components/TodayView';
import LoadingSpinner from './components/LoadingSpinner';

const TECH_CATEGORIES: Category[] = ['programming', 'ai-ml', 'infra-cloud'];
const NEWS_CATEGORIES: Category[] = ['economy', 'politics', 'science'];

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { fontSize, cycleFontSize, label: fontSizeLabel } = useFontSize();
  const { bookmarks, isBookmarked, toggleBookmark } = useBookmarks();
  const {
    query, setQuery,
    results: searchResults, pagination: searchPagination,
    isSearching, searchPage, setSearchPage,
  } = useSearch();

  const [activeSection, setActiveSection] = useState<Section>('tech');
  const [activeTab, setActiveTab] = useState<TabKey>('today');
  const [articles, setArticles] = useState<Article[]>([]);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [todayArticles, setTodayArticles] = useState<Article[]>([]);
  const [todayLoading, setTodayLoading] = useState(false);

  const mainRef = useRef<HTMLElement>(null);

  const sectionCategories = activeSection === 'tech' ? TECH_CATEGORIES : NEWS_CATEGORIES;

  // Fetch today's articles
  useEffect(() => {
    if (activeTab !== 'today') return;
    if (query.trim()) return;

    let cancelled = false;
    setTodayLoading(true);
    setError(null);

    fetchArticles({ categories: sectionCategories, page: 1, limit: 60 })
      .then((res) => {
        if (!cancelled) setTodayArticles(res.data.articles);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || '記事の取得に失敗しました');
      })
      .finally(() => {
        if (!cancelled) setTodayLoading(false);
      });

    return () => { cancelled = true; };
  }, [activeTab, activeSection, query]);

  // Fetch articles (page 1 = fresh load, page > 1 = append)
  useEffect(() => {
    if (activeTab === 'bookmarks' || activeTab === 'today') return;
    if (query.trim()) return;

    let cancelled = false;
    if (page === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    const isAll = activeTab === 'all';
    const params = isAll
      ? { categories: sectionCategories, page }
      : { category: activeTab as Category, page };

    fetchArticles(params)
      .then((res) => {
        if (!cancelled) {
          if (page === 1) {
            setArticles(res.data.articles);
          } else {
            setArticles((prev) => [...prev, ...res.data.articles]);
          }
          setPagination(res.data.pagination);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || '記事の取得に失敗しました');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      });

    return () => { cancelled = true; };
  }, [activeTab, activeSection, page, query]);

  // Infinite scroll handler
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (loadingMore || loading) return;
      if (!pagination?.hasMore) return;
      if (query.trim()) return;
      if (activeTab === 'bookmarks' || activeTab === 'today') return;

      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight - scrollTop - clientHeight < 300) {
        setPage((prev) => prev + 1);
      }
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [loadingMore, loading, pagination, query, activeTab]);

  const handleSectionChange = useCallback((section: Section) => {
    setActiveSection(section);
    setActiveTab('today');
    setPage(1);
    setArticles([]);
  }, []);

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    setPage(1);
    setArticles([]);
  }, []);

  const isSearchActive = query.trim().length > 0;

  const tabLabels: Record<string, string> = {
    all: 'すべて',
    programming: 'プログラミング',
    'ai-ml': 'AI・ML',
    'infra-cloud': 'インフラ・クラウド',
    economy: '経済・ビジネス',
    politics: '政治・社会',
    science: '科学',
    bookmarks: 'ブックマーク',
  };

  const sectionSubtitle = activeSection === 'tech'
    ? '最新のテックニュースをチェック'
    : '最新のニュースをチェック';

  const renderContent = () => {
    if (isSearchActive) {
      return (
        <>
          <div className="border-b border-gray-200 px-6 py-4 dark:border-[#333]">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              &ldquo;{query}&rdquo; の検索結果
            </h2>
            {searchPagination && (
              <p className="mt-0.5 text-[13px] text-gray-400 dark:text-gray-500">
                {searchPagination.total.toLocaleString()} 件の記事
              </p>
            )}
          </div>
          <div>
            {isSearching ? <LoadingSpinner /> : (
              <ArticleList articles={searchResults ?? []} isBookmarked={isBookmarked} onToggleBookmark={toggleBookmark} fontSize={fontSize} />
            )}
          </div>
        </>
      );
    }

    if (activeTab === 'today') {
      return (
        <>
          <div className="border-b border-gray-200 px-6 pt-6 pb-4 dark:border-[#333]">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">今日</h2>
            <p className="mt-1 text-[14px] text-gray-400 dark:text-gray-500">{sectionSubtitle}</p>
          </div>
          {todayLoading ? <LoadingSpinner /> : (
            <TodayView articles={todayArticles} isBookmarked={isBookmarked} onToggleBookmark={toggleBookmark} fontSize={fontSize} />
          )}
        </>
      );
    }

    if (activeTab === 'bookmarks') {
      return (
        <>
          <div className="border-b border-gray-200 px-6 pt-6 pb-4 dark:border-[#333]">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">ブックマーク</h2>
            <p className="mt-1 text-[14px] text-gray-400 dark:text-gray-500">保存した記事</p>
          </div>
          <ArticleList articles={bookmarks} isBookmarked={isBookmarked} onToggleBookmark={toggleBookmark} fontSize={fontSize} />
        </>
      );
    }

    return (
      <>
        <div className="border-b border-gray-200 px-6 pt-6 pb-4 dark:border-[#333]">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{tabLabels[activeTab]}</h2>
          {pagination && (
            <p className="mt-1 text-[14px] text-gray-400 dark:text-gray-500">
              {pagination.total.toLocaleString()} 件の記事
            </p>
          )}
        </div>
        {loading ? <LoadingSpinner /> : (
          <>
            <ArticleList articles={articles} isBookmarked={isBookmarked} onToggleBookmark={toggleBookmark} fontSize={fontSize} />
            {loadingMore && (
              <div className="flex justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-accent dark:border-[#333] dark:border-t-green-400" />
              </div>
            )}
            {pagination && !pagination.hasMore && articles.length > 0 && (
              <p className="py-6 text-center text-[12px] text-gray-400 dark:text-gray-600">
                すべての記事を表示しました
              </p>
            )}
          </>
        )}
      </>
    );
  };

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-[#1a1a1a]">
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        query={query}
        onQueryChange={setQuery}
        fontSize={fontSize}
        fontSizeLabel={fontSizeLabel}
        onCycleFontSize={cycleFontSize}
      />

      <div className="flex flex-1 overflow-hidden">
        <IconBar activeSection={activeSection} onSectionChange={handleSectionChange} />

        <Sidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          bookmarkCount={bookmarks.length}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          fontSize={fontSize}
        />

        <main ref={mainRef} className="flex-1 overflow-y-auto bg-white dark:bg-[#1a1a1a]">
          {error && (
            <div className="mx-5 mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-600 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
