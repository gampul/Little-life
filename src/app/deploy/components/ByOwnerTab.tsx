'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  FinanceRow,
  OWNER_COLORS,
  formatKRW,
  formatKRWShort,
  formatMonthAxis,
  getSortedMonths,
} from '../lib';

interface Props {
  rows: FinanceRow[];
}

export function ByOwnerTab({ rows }: Props) {
  const months = getSortedMonths(rows);

  // 데이터에 존재하는 owner 목록
  const owners = Array.from(new Set(rows.map((r) => r.owner)));

  const chartData = months.map((month) => {
    const entry: Record<string, number | string> = { month, label: formatMonthAxis(month) };
    for (const owner of owners) {
      entry[owner] = rows
        .filter((r) => r.monthly_date === month && r.owner === owner)
        .reduce((acc, r) => acc + (Number(r.balance) || 0), 0);
    }
    return entry;
  });

  const latestMonth = months[months.length - 1];
  const latestByOwner = owners
    .map((owner) => ({
      owner,
      balance: rows
        .filter((r) => r.monthly_date === latestMonth && r.owner === owner)
        .reduce((acc, r) => acc + (Number(r.balance) || 0), 0),
    }))
    .sort((a, b) => b.balance - a.balance);

  const colorFor = (owner: string, i: number) => OWNER_COLORS[owner] ?? ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'][i % 4];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">유저별 자산 추이</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#9CA3AF" strokeOpacity={0.2} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={{ stroke: '#374151', strokeOpacity: 0.3 }} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => formatKRWShort(Number(v))} />
              <Tooltip
                formatter={(v: number, name: string) => [formatKRW(Number(v)), name]}
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 12, color: '#fff' }}
                labelStyle={{ color: '#9CA3AF' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {owners.map((owner, i) => (
                <Line key={owner} type="monotone" dataKey={owner} stroke={colorFor(owner, i)} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {chartData.length <= 1 && (
          <p className="text-xs text-gray-400 mt-2 text-center">월 데이터가 쌓이면 추이 그래프가 채워집니다.</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {latestByOwner.map((o, i) => (
          <div key={o.owner} className="flex items-center justify-between rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: colorFor(o.owner, i) }} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{o.owner}</span>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatKRW(o.balance)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
