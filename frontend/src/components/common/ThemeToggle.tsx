import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export const ThemeToggle: React.FC = () => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return (
    <button
      type="button"
      onClick={() => setIsDark((prev) => !prev)}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-button border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark hover:bg-header-light dark:hover:bg-header-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-light dark:focus-visible:ring-brand-primary-dark transition-colors min-h-control whitespace-nowrap"
      title={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Obsidian Data Mode'}
      aria-label={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Obsidian Data Mode'}
      aria-pressed={isDark}
    >
      {isDark ? (
        <>
          <Sun className="w-4 h-4 text-brand-primary-dark" />
          <span className="hidden sm:inline">Mode Terang</span>
        </>
      ) : (
        <>
          <Moon className="w-4 h-4 text-brand-primary-light" />
          <span className="hidden sm:inline">Obsidian Data Mode</span>
        </>
      )}
    </button>
  );
};
