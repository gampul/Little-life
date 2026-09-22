'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ComponentProps } from 'react';

/**
 * AI 리포트/채팅용 마크다운 렌더러.
 * - GFM(표, 취소선, 체크리스트) 지원
 * - 표: 좁은 화면(모바일)에서는 행마다 카드로, 넓은 화면에서는 컴팩트한 표로 보여준다
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

// ---- hast 에서 표의 텍스트를 뽑아 카드 뷰를 만들기 위한 도우미 ----
type HastNode = { type: string; tagName?: string; value?: string; children?: HastNode[] };

const textOf = (n: HastNode | undefined): string => {
  if (!n) return '';
  if (n.type === 'text') return n.value || '';
  return (n.children || []).map(textOf).join('');
};

const extractTable = (node: HastNode | undefined): { header: string[]; rows: string[][] } => {
  const header: string[] = [];
  const rows: string[][] = [];
  if (!node) return { header, rows };
  const walkRows = (n: HastNode, isHead: boolean) => {
    for (const c of n.children || []) {
      if (c.tagName === 'thead') walkRows(c, true);
      else if (c.tagName === 'tbody') walkRows(c, false);
      else if (c.tagName === 'tr') {
        const cells = (c.children || []).filter((x) => x.tagName === 'th' || x.tagName === 'td').map((x) => textOf(x).trim());
        if (isHead || (header.length === 0 && (c.children || []).some((x) => x.tagName === 'th'))) header.push(...cells);
        else rows.push(cells);
      }
    }
  };
  walkRows(node, false);
  return { header, rows };
};

const isEmptyCell = (v: string) => !v || v === '-' || v === '—' || v === '없음';

const components: ComponentProps<typeof ReactMarkdown>['components'] = {
  table: ({ node, children }) => {
    const { header, rows } = extractTable(node as unknown as HastNode);
    const showCards = header.length >= 3 && rows.length > 0;
    return (
      <div className="not-prose my-3">
        {/* 모바일: 카드 */}
        {showCards && (
          <ul className="sm:hidden space-y-1.5">
            {rows.map((r, i) => (
              <li key={i} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-700/30 px-3 py-2">
                <div className="text-[13px] font-semibold text-gray-900 dark:text-white leading-snug">{r[0]}</div>
                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[12px]">
                  {header.slice(1).map((h, j) => {
                    const v = r[j + 1];
                    if (isEmptyCell(v)) return null;
                    return [
                      <dt key={`k${j}`} className="text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</dt>,
                      <dd key={`v${j}`} className="text-gray-800 dark:text-gray-100 leading-snug">{v}</dd>,
                    ];
                  })}
                </dl>
              </li>
            ))}
          </ul>
        )}
        {/* 데스크톱(또는 열이 적은 표): 표 */}
        <div className={`${showCards ? 'hidden sm:block' : ''} overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700`}>
          <table className="w-full border-collapse text-[12.5px] leading-snug">{children}</table>
        </div>
      </div>
    );
  },
  thead: ({ children }) => <thead className="bg-gray-50 dark:bg-gray-700/60">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-gray-100 dark:divide-gray-700">{children}</tbody>,
  tr: ({ children }) => <tr className="align-top">{children}</tr>,
  th: ({ children }) => (
    <th className="px-2.5 py-1.5 text-left font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-2.5 py-1.5 text-gray-800 dark:text-gray-100 first:font-medium [&:not(:last-child)]:whitespace-nowrap">{children}</td>
  ),
};
