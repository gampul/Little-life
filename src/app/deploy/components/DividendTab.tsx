'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  FinanceRow,
  formatKRW,
  formatKRWShort,
  formatMonthAxis,
  formatMonthLabel,
  netDividendByMonth,
} from '../lib';

interface Props {
  rows: FinanceRow[];
  selectedMonth: string;
}

export function DividendTab({ rows, selectedMonth }: Props) {
  const series = netDividendByMonth(rows);
  const chartData = series.map((d) => ({ ...d, label: formatMonthAxis(d.month) }));

  // 선택 월 ticker별 순배당 상세
  const detailMap = new Map<string, number>();
  for (const r of rows) {
    if (r.monthly_date !== selectedMonth) continue;
    const net = Number(r.net_dividend) || 0;
    if (net === 0) continue;
    detailMap.set(r.ticker, (detailMap.get(r.ticker) ?? 0) + net);
  }
  const detail = Array.from(detailMap.entries())
    .map(([ticker, net]) => ({ ticker, net }))
    .sort((a, b) => b.net - a.net);

  const monthNet = series.find((d) => d.month === selectedMonth)?.net ?? 0;

  // 연간 누적 (선택 월의 연도 기준)
  const year = selectedMonth.slice(0, 4);
  const yearlyNet = rows
    .filter((r) => r.monthly_date.startsWith(year))
    .reduce((acc, r) => acc + (Number(r.net_dividend) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">{formatMonthLabel(selectedMonth)} 순배당</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{formatKRW(monthNet)}</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">{year}년 누적 순배당</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{formatKRW(yearlyNet)}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">월별 순배당</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#9CA3AF" strokeOpacity={0.2} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={{ stroke: '#374151', strokeOpacity: 0.3 }} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => formatKRWShort(Number(v))} />
              <Tooltip
                formatter={(v: number) => [formatKRW(Number(v)), '순배당']}
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 12, color: '#fff' }}
                labelStyle={{ color: '#9CA3AF' }}
                cursor={{ fill: '#9CA3AF', fillOpacity: 0.1 }}
              />
              <Bar dataKey="net" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
          {formatMonthLabel(selectedMonth)} 배당 상세
        </p>
        {detail.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">해당 월 배당 내역이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {detail.map((d) => (
              <div key={d.ticker} className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700 dark:text-gray-200 truncate pr-2">{d.ticker}</span>
                <span className="font-semibold text-gray-900 dark:text-white shrink-0">{formatKRW(d.net)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
