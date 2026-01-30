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
} from 'recharts';

interface DailyRecord {
  id?: string;
  date: string;
  weight: number | null;
  meal_breakfast: boolean;
  meal_lunch: boolean;
  meal_dinner: boolean;
  meal_memo: string;
  meal_images?: string[];
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
}: {
  active?: boolean;
  payload?: Array<{
    payload: { date: string; weight: number };
    value?: number;
  }>;
  allRecords: DailyRecord[];
}) => {
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
        padding: '14px 18px',
        minWidth: '180px',
        maxWidth: '280px'
      }}
    >
      {/* 날짜 & 체중 */}
      <p className="font-bold text-sm text-gray-300 mb-1">{formattedDate}</p>
      <p className="font-bold text-red-400" style={{ fontSize: '16px' }}>{weight} kg</p>
      
      {/* 사진 썸네일 (2배 크기) */}
      {record?.meal_images && record.meal_images.length > 0 && (
        <div className="mt-3 flex gap-2 flex-wrap">
          {record.meal_images.slice(0, 2).map((url, idx) => (
            <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-600">
              <img 
                src={url} 
                alt=""
                className="w-full h-full object-cover"
              />
              {idx === 1 && record.meal_images && record.meal_images.length > 2 && (
                <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">+{record.meal_images.length - 2}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* 메모 텍스트만 표시 */}
      {record?.meal_memo && record.meal_memo.trim() !== '' && (
        <p className="mt-3 text-sm text-gray-300 leading-relaxed line-clamp-2">
          {record.meal_memo}
        </p>
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
  // 클릭한 날짜의 meal_memo 찾기
  const getMealMemo = (date: string): string | null => {
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
    return record?.meal_memo || null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart 
        data={chartData}
        margin={{ top: 10, right: 10, left: 0, bottom: 25 }}
        onClick={(data, event) => {
          console.log('📊 차트 클릭됨:', data);
          if (data && data.activePayload && data.activePayload.length > 0) {
            const clickedData = data.activePayload[0].payload;
            const date = clickedData.date;
            const mealMemo = getMealMemo(date);
            console.log('🎯 날짜 선택:', date, '메모:', mealMemo);
            onDateClick(date, mealMemo);
          } else if (data && data.activeLabel) {
            // activePayload가 없어도 activeLabel로 날짜 찾기
            const date = data.activeLabel;
            const mealMemo = getMealMemo(date);
            console.log('🎯 날짜 선택 (label):', date, '메모:', mealMemo);
            onDateClick(date, mealMemo);
          } else {
            console.log('⚠️ 유효한 데이터 포인트가 아님');
          }
        }}
        style={{ cursor: 'pointer' }}
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
          activeDot={{ 
            r: 6, 
            fill: '#EF4444', 
            stroke: '#fff', 
            strokeWidth: 2,
            cursor: 'pointer',
          }}
          fill="url(#colorWeight)"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

