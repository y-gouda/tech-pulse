import type { Category } from '@tech-pulse/shared/types';
import type { ReactNode } from 'react';
import type { Section } from './IconBar';
import type { FontSize } from '../hooks/useFontSize';

export type TabKey = Category | 'all' | 'today' | 'bookmarks';

interface SidebarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  activeSection: Section;
  fontSize: FontSize;
  onSectionChange: (section: Section) => void;
  bookmarkCount: number;
  isOpen: boolean;
  onClose: () => void;
}

const icons: Record<string, ReactNode> = {
  today: (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  bookmarks: (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ),
  all: (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  programming: (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  'ai-ml': (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
      <path d="M16 14a4 4 0 0 1 0 8H8a4 4 0 0 1 0-8" />
      <line x1="9" y1="18" x2="9" y2="18.01" /><line x1="15" y1="18" x2="15" y2="18.01" />
    </svg>
  ),
  'infra-cloud': (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  ),
  economy: (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  politics: (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  ),
  science: (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6v8l4 7H5l4-7V3z" /><line x1="8" y1="3" x2="16" y2="3" />
    </svg>
  ),
  sports: (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
};

const techCategories: { key: Category; label: string }[] = [
  { key: 'programming', label: 'プログラミング' },
  { key: 'ai-ml', label: 'AI・ML' },
  { key: 'infra-cloud', label: 'インフラ・クラウド' },
];

const newsCategories: { key: Category; label: string }[] = [
  { key: 'economy', label: '経済・ビジネス' },
  { key: 'politics', label: '政治・社会' },
  { key: 'science', label: '科学' },
  { key: 'sports', label: 'スポーツ' },
];

const navFontPx: Record<FontSize, number> = {
  normal: 13,
  large: 15,
  xlarge: 16,
};

function NavItem({ tabKey, label, isActive, onClick, badge, fontSize = 'normal' }: {
  tabKey: string; label: string; isActive: boolean; onClick: () => void; badge?: number; fontSize?: FontSize;
}) {
  return (
    <button
      onClick={onClick}
      style={{ fontSize: `${navFontPx[fontSize]}px` }}
      className={`mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] transition-colors ${
        isActive
          ? 'bg-accent/10 font-medium text-accent dark:bg-accent/15 dark:text-green-400'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#2a2a2a]'
      }`}
    >
      <span className={isActive ? 'text-accent dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}>
        {icons[tabKey]}
      </span>
      <span className="flex-1 text-left">{label}</span>
      {badge != null && badge > 0 && (
        <span className="min-w-[20px] rounded-full bg-gray-200 px-1.5 text-center text-[11px] font-medium text-gray-600 dark:bg-[#333] dark:text-gray-400">
          {badge}
        </span>
      )}
    </button>
  );
}

export default function Sidebar({ activeTab, onTabChange, activeSection, onSectionChange, bookmarkCount, isOpen, onClose, fontSize }: SidebarProps) {
  const handleClick = (key: TabKey) => {
    onTabChange(key);
    onClose();
  };

  const categories = activeSection === 'tech' ? techCategories : newsCategories;
  const sectionLabel = activeSection === 'tech' ? 'テック' : 'ニュース';

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed left-0 top-12 z-40 flex h-[calc(100vh-48px)] w-56 shrink-0 flex-col border-r border-gray-200 bg-white transition-transform lg:static lg:translate-x-0 dark:border-[#333] dark:bg-[#1e1e1e] ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile section switcher */}
        <div className="flex border-b border-gray-200 lg:hidden dark:border-[#333]">
          <button
            onClick={() => onSectionChange('tech')}
            className={`flex-1 py-2.5 text-center text-[12px] font-semibold ${
              activeSection === 'tech'
                ? 'border-b-2 border-accent text-accent'
                : 'text-gray-400'
            }`}
          >
            テック
          </button>
          <button
            onClick={() => onSectionChange('news')}
            className={`flex-1 py-2.5 text-center text-[12px] font-semibold ${
              activeSection === 'news'
                ? 'border-b-2 border-accent text-accent'
                : 'text-gray-400'
            }`}
          >
            ニュース
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pt-3">
          <NavItem tabKey="today" label="今日" isActive={activeTab === 'today'} onClick={() => handleClick('today')} fontSize={fontSize} />
          <NavItem tabKey="bookmarks" label="ブックマーク" isActive={activeTab === 'bookmarks'} onClick={() => handleClick('bookmarks')} badge={bookmarkCount} fontSize={fontSize} />

          <p className="mt-5 mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {sectionLabel}
          </p>
          <NavItem tabKey="all" label="すべて" isActive={activeTab === 'all'} onClick={() => handleClick('all')} fontSize={fontSize} />
          {categories.map((cat) => (
            <NavItem
              key={cat.key}
              fontSize={fontSize}
              tabKey={cat.key}
              label={cat.label}
              isActive={activeTab === cat.key}
              onClick={() => handleClick(cat.key as TabKey)}
            />
          ))}
        </nav>

        <div className="border-t border-gray-200 px-4 py-3 dark:border-[#333]">
          <p className="text-[11px] text-gray-400 dark:text-gray-600">
            23 ソース &middot; 30分毎に更新
          </p>
        </div>
      </aside>
    </>
  );
}
