'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ComponentProps } from 'react';

/**
 * AI 리포트/채팅용 마크다운 렌더러.
 * - GFM(표, 취소선, 체크리스트) 지원
 * - 표: 모바일에서 깨지지 않도록 가로 스크롤 + 컴팩트 스타일, 첫 열 고정
 */
export function ReportMarkdown({ children, compact = false }: { children: string; compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? 'text-sm leading-relaxed [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:font-semibold'
          : 'prose prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-white leading-relaxed [&_h2]:text-base [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-sm [&_ul]:my-2 [&_li]:my-0.5'
      }
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

const components: ComponentProps<typeof ReactMarkdown>['components'] = {
  table: ({ children }) => (
    <div className="not-prose my-3 -mx-1 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="w-full min-w-[320px] border-collapse text-[12.5px] leading-snug">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-50 dark:bg-gray-700/60">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-gray-100 dark:divide-gray-700">{children}</tbody>,
  tr: ({ children }) => <tr className="align-top">{children}</tr>,
  th: ({ children }) => (
    <th className="px-2.5 py-1.5 text-left font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap first:sticky first:left-0 first:bg-gray-50 dark:first:bg-gray-700">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-2.5 py-1.5 text-gray-800 dark:text-gray-100 first:font-medium first:whitespace-nowrap first:sticky first:left-0 first:bg-white dark:first:bg-gray-800 [&:not(:first-child):not(:last-child)]:whitespace-nowrap">
      {children}
    </td>
  ),
};
