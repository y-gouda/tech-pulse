import { useState } from 'react';

export type Section = 'tech' | 'news';

interface IconBarProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
}

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white shadow-lg">
          {label}
        </div>
      )}
    </div>
  );
}

export default function IconBar({ activeSection, onSectionChange }: IconBarProps) {
  return (
    <div className="hidden h-full w-12 shrink-0 flex-col items-center border-r border-gray-200 bg-gray-50 pt-3 lg:flex dark:border-[#333] dark:bg-[#161616]">
      {/* Tech */}
      <Tooltip label="テクノロジー">
        <button
          onClick={() => onSectionChange('tech')}
          className={`mb-1 flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
            activeSection === 'tech'
              ? 'bg-accent text-white'
              : 'text-gray-400 hover:bg-gray-200 dark:text-gray-500 dark:hover:bg-[#2a2a2a]'
          }`}
          aria-label="テクノロジー"
        >
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
          </svg>
        </button>
      </Tooltip>

      {/* News */}
      <Tooltip label="一般ニュース">
        <button
          onClick={() => onSectionChange('news')}
          className={`mb-1 flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
            activeSection === 'news'
              ? 'bg-accent text-white'
              : 'text-gray-400 hover:bg-gray-200 dark:text-gray-500 dark:hover:bg-[#2a2a2a]'
          }`}
          aria-label="一般ニュース"
        >
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
            <line x1="10" y1="6" x2="18" y2="6" /><line x1="10" y1="10" x2="18" y2="10" /><line x1="10" y1="14" x2="14" y2="14" />
          </svg>
        </button>
      </Tooltip>
    </div>
  );
}
