'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className="w-10 h-10 hover:bg-gray-500/20 dark:hover:bg-gray-400/20 rounded-lg flex items-center justify-center min-h-[44px] transition-colors"
        aria-label="Toggle theme"
      >
        <span className="text-base">🌙</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="w-10 h-10 hover:bg-gray-500/20 dark:hover:bg-gray-400/20 rounded-lg flex items-center justify-center min-h-[44px] transition-colors"
      aria-label="Toggle theme"
    >
      <span className="text-base">{theme === 'dark' ? '☀️' : '🌙'}</span>
    </button>
  );
}

