'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { FinanceRow, PIE_PALETTE, formatKRW, sumBalanceByKey } from '../lib';

interface Props {
  rows: FinanceRow[];
  selectedMonth: string;
}

export function AssetClassTab({ rows, selectedMonth }: Props) {
  const sums = sumBalanceByKey(rows, selectedMonth, 'asset_class');
  const total = Object.values(sums).reduce((a, b) => a + b, 0);

  const data = Object.entries(sums)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  if (total <= 0) {
    return (
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-8 text-center text-sm text-gray-400">
        선택한 월의 자산군 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">자산군 구성</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2}>
                {data.map((d, i) => (
                  <Cell key={d.name} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, n: string) => [formatKRW(Number(v)), n]}
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 12, color: '#fff' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">자산군별 금액</p>
        <div className="space-y-2">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ background: PIE_PALETTE[i % PIE_PALETTE.length] }} />
                <span className="font-medium text-gray-700 dark:text-gray-200 truncate">{d.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-semibold text-gray-900 dark:text-white">{formatKRW(d.value)}</span>
                <span className="text-xs text-gray-400 w-12 text-right">{((d.value / total) * 100).toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
