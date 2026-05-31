'use client';

import {
  LineChart,
  Line,
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
  totalBalanceByMonth,
  getSortedMonths,
} from '../lib';

interface Props {
  rows: FinanceRow[];
  selectedMonth: string;
}

export function TotalBalanceTab({ rows, selectedMonth }: Props) {
  const series = totalBalanceByMonth(rows);
  const chartData = series.map((d) => ({ ...d, label: formatMonthAxis(d.month) }));

  const months = getSortedMonths(rows);
  const idx = months.indexOf(selectedMonth);
  const current = series.find((d) => d.month === selectedMonth)?.balance ?? 0;
  const prev = idx > 0 ? series.find((d) => d.month === months[idx - 1])?.balance ?? null : null;
  const delta = prev != null ? current - prev : null;
  const deltaRate = prev != null && prev !== 0 ? (delta! / prev) * 100 : null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
        <p className="text-xs text-gray-500 dark:text-gray-400">{formatMonthLabel(selectedMonth)} 총자산</p>
        <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{formatKRW(current)}</p>
        {delta != null && (
          <p className={`text-sm mt-1 font-medium ${delta >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
            전월 대비 {delta >= 0 ? '+' : ''}{formatKRW(delta)}
            {deltaRate != null && ` (${delta >= 0 ? '+' : ''}${deltaRate.toFixed(1)}%)`}
          </p>
        )}
      </div>

      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">월별 총자산 추이</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#9CA3AF" strokeOpacity={0.2} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={{ stroke: '#374151', strokeOpacity: 0.3 }} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => formatKRWShort(Number(v))} />
              <Tooltip
                formatter={(v: number) => [formatKRW(Number(v)), '총자산']}
                labelFormatter={(l) => String(l)}
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 12, color: '#fff' }}
                labelStyle={{ color: '#9CA3AF' }}
              />
              <Line type="monotone" dataKey="balance" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3, fill: '#3B82F6' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {chartData.length <= 1 && (
          <p className="text-xs text-gray-400 mt-2 text-center">월 데이터가 쌓이면 추이 그래프가 채워집니다.</p>
        )}
      </div>
    </div>
  );
}
