import { useState, useCallback } from 'react';

export type FontSize = 'normal' | 'large' | 'xlarge';

const STORAGE_KEY = 'rss-reader-font-size';

const FONT_SIZE_LABELS: Record<FontSize, string> = {
  normal: '標準',
  large: '大',
  xlarge: '特大',
};

const FONT_SIZE_ORDER: FontSize[] = ['normal', 'large', 'xlarge'];

function getInitialFontSize(): FontSize {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'normal' || stored === 'large' || stored === 'xlarge') return stored;
  return 'normal';
}

export function useFontSize() {
  const [fontSize, setFontSize] = useState<FontSize>(getInitialFontSize);

  const cycleFontSize = useCallback(() => {
    setFontSize((prev) => {
      const idx = FONT_SIZE_ORDER.indexOf(prev);
      const next = FONT_SIZE_ORDER[(idx + 1) % FONT_SIZE_ORDER.length];
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { fontSize, cycleFontSize, label: FONT_SIZE_LABELS[fontSize] } as const;
}
