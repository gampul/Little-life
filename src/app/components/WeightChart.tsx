'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';

interface DailyRecord {
  id?: string;
  date: string;
  weight: number | null;
  meal_breakfast: boolean;
  meal_lunch: boolean;
  meal_dinner: boolean;
  meal_memo: string;
  daily_memo: string;
}

interface WeightChartProps {
  chartData: Array<{ date: string; weight: number }>;
  interval: number | 'preserveStartEnd';
  allRecords: DailyRecord[];
  onDateClick: (date: string, mealMemo: string | null) => void;
}

// 커스텀 툴팁 컴포넌트
const CustomTooltip = ({ 
  active, 
  payload,
  allRecords 
}: TooltipProps<number, string> & { allRecords: DailyRecord[] }) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  const date = data.date;
  const weight = payload[0].value;

  // 해당 날짜의 레코드 찾기 (날짜 정규화)
  const record = allRecords.find((r: DailyRecord) => {
    let recordDate = r.date;
    if (recordDate.includes('T')) {
      recordDate = recordDate.split('T')[0];
    } else if (recordDate.includes(' ')) {
      recordDate = recordDate.split(' ')[0];
    }
    
    let normalizedDate = date;
    if (date.includes('T')) {
      normalizedDate = date.split('T')[0];
    } else if (date.includes(' ')) {
      normalizedDate = date.split(' ')[0];
    }
    
    return recordDate === normalizedDate;
  });

  // 날짜 포맷팅
  const dateObj = new Date(date);
  const formattedDate = `${dateObj.getFullYear()}년 ${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일`;

  return (
    <div 
      className="bg-gray-900 dark:bg-gray-800 text-white rounded-xl shadow-2xl border-2 border-gray-700"
      style={{ 
        padding: '12px 16px',
        minWidth: '200px',
        maxWidth: '320px'
      }}
    >
      <p className="font-bold text-sm mb-2 text-gray-200">{formattedDate}</p>
      <p className="text-lg font-bold text-red-400 mb-2">🏋️ {weight} kg</p>
      {record?.meal_memo && record.meal_memo.trim() !== '' && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <p className="text-xs text-gray-400 mb-1">🍽️ 식사 메모</p>
          <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
            {record.meal_memo}
          </p>
        </div>
      )}
    </div>
  );
};

export default function WeightChart({
  chartData,
  interval,
  allRecords,
  onDateClick,
}: WeightChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart 
        data={chartData}
        margin={{ top: 10, right: 10, left: 0, bottom: 25 }}
      >
        <defs>
          <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid 
          strokeDasharray="3 3" 
          stroke="#374151" 
          strokeOpacity={0.3}
          vertical={false}
        />
        <XAxis 
          dataKey="date" 
          stroke="#6B7280"
          tick={{ fontSize: 10, fill: '#9CA3AF' }}
          tickLine={false}
          axisLine={{ stroke: '#374151' }}
          padding={{ left: 0, right: 0 }}
          interval={interval}
          tickFormatter={(value) => {
            if (!value) return '';
            const date = new Date(value);
            return `${date.getMonth() + 1}/${date.getDate()}`;
          }}
        />
        <YAxis 
          stroke="#6B7280"
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          tickLine={false}
          axisLine={false}
          domain={['dataMin - 1', 'dataMax + 1']}
          tickFormatter={(value) => `${value}kg`}
          width={45}
        />
        <Tooltip 
          content={<CustomTooltip allRecords={allRecords} />}
          cursor={{ stroke: '#EF4444', strokeWidth: 2, strokeDasharray: '5 5' }}
          wrapperStyle={{ zIndex: 1000 }}
        />
        <Line 
          type="monotone" 
          dataKey="weight" 
          stroke="#EF4444" 
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 6, fill: '#EF4444', stroke: '#fff', strokeWidth: 2 }}
          fill="url(#colorWeight)"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

