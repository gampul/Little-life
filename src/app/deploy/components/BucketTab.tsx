'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import {
  FinanceRow,
  BUCKETS,
  BUCKET_LABELS,
  BUCKET_COLORS,
  BUCKET_TARGETS,
  formatKRW,
  sumBalanceByKey,
} from '../lib';

interface Props {
  rows: FinanceRow[];
  selectedMonth: string;
}

export function BucketTab({ rows, selectedMonth }: Props) {
  const sums = sumBalanceByKey(rows, selectedMonth, 'bucket');
  const total = Object.values(sums).reduce((a, b) => a + b, 0);

  const pieData = BUCKETS.map((b) => ({
    name: BUCKET_LABELS[b],
    bucket: b,
    value: sums[b] ?? 0,
  })).filter((d) => d.value > 0);

  if (total <= 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Bucket 구성</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2}>
                {pieData.map((d) => (
                  <Cell key={d.bucket} fill={BUCKET_COLORS[d.bucket]} />
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
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">목표 vs 실제 비율</p>
        <div className="space-y-2">
          {BUCKETS.map((b) => {
            const actual = total > 0 ? ((sums[b] ?? 0) / total) * 100 : 0;
            const target = BUCKET_TARGETS[b] ?? 0;
            const diff = actual - target;
            const warn = Math.abs(diff) >= 5;
            return (
              <div key={b} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ background: BUCKET_COLORS[b] }} />
                  <span className="font-medium text-gray-700 dark:text-gray-200">{BUCKET_LABELS[b]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 dark:text-gray-500">목표 {target}%</span>
                  <span className={`font-semibold ${warn ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                    실제 {actual.toFixed(1)}%
                  </span>
                  <span className={`text-xs ${warn ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                    ({diff >= 0 ? '+' : ''}{diff.toFixed(1)}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-3">차이가 ±5% 이상이면 빨간색으로 표시됩니다.</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-8 text-center text-sm text-gray-400">
      선택한 월의 Bucket 데이터가 없습니다.
    </div>
  );
}
