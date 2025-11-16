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
        className="w-10 h-10 bg-gray-600 dark:bg-gray-700 text-white rounded-lg flex items-center justify-center min-h-[44px]"
        aria-label="Toggle theme"
      >
        <span className="text-base">🌙</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="w-10 h-10 bg-gray-600 dark:bg-gray-700 hover:bg-gray-500 dark:hover:bg-gray-600 text-white rounded-lg flex items-center justify-center min-h-[44px]"
      aria-label="Toggle theme"
    >
      <span className="text-base">{theme === 'dark' ? '☀️' : '🌙'}</span>
    </button>
  );
}

