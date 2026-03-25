export type Section = 'tech' | 'news';

interface IconBarProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
}

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="group relative">
      {children}
      <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-gray-800 px-2 py-1 text-xs text-gray-100 opacity-0 shadow-md transition-opacity group-hover:opacity-100 dark:bg-gray-700">
        {label}
      </div>
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
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
            <line x1="9" y1="2" x2="9" y2="4" /><line x1="15" y1="2" x2="15" y2="4" />
            <line x1="9" y1="20" x2="9" y2="22" /><line x1="15" y1="20" x2="15" y2="22" />
            <line x1="2" y1="9" x2="4" y2="9" /><line x1="2" y1="15" x2="4" y2="15" />
            <line x1="20" y1="9" x2="22" y2="9" /><line x1="20" y1="15" x2="22" y2="15" />
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
