'use client';

export interface FilterState {
  period: 'all' | '7days' | '1month' | '3months' | '1year';
  type: 'all' | 'income' | 'expense' | 'transfer';
}

interface TransactionFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

export function TransactionFilters({ filters, onChange }: TransactionFiltersProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {/* 기간 필터 */}
      <select
        value={filters.period}
        onChange={(e) => onChange({ ...filters, period: e.target.value as FilterState['period'] })}
        style={{ fontSize: '14px' }}
        className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-700 dark:text-gray-300 outline-none"
      >
        <option value="all">전체 기간</option>
        <option value="7days">최근 7일</option>
        <option value="1month">최근 1개월</option>
        <option value="3months">최근 3개월</option>
        <option value="1year">최근 1년</option>
      </select>

      {/* 타입 필터 */}
      <select
        value={filters.type}
        onChange={(e) => onChange({ ...filters, type: e.target.value as FilterState['type'] })}
        style={{ fontSize: '14px' }}
        className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-700 dark:text-gray-300 outline-none"
      >
        <option value="all">전체</option>
        <option value="income">수입</option>
        <option value="expense">소비 지출</option>
        <option value="transfer">이체지출</option>
      </select>
    </div>
  );
}
