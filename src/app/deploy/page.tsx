'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';
import { AuthGuard } from '../components/AuthGuard';
import { SwipeNav } from '../components/SwipeNav';
import { APP_CONTENT_CONTAINER } from '../components/container';
import { getSupabase } from '../../lib/supabase';
import { FinanceRow, getSortedMonths, formatMonthLabel } from './lib';
import { TotalBalanceTab } from './components/TotalBalanceTab';
import { ByOwnerTab } from './components/ByOwnerTab';
import { BucketTab } from './components/BucketTab';
import { AssetClassTab } from './components/AssetClassTab';
import { DividendTab } from './components/DividendTab';
import { AddInvestmentModal } from './components/AddInvestmentModal';

type TabId = 'total' | 'owner' | 'bucket' | 'asset' | 'dividend';

const TABS: { id: TabId; label: string }[] = [
  { id: 'total', label: '총자산' },
  { id: 'owner', label: '유저별' },
  { id: 'bucket', label: 'Bucket' },
  { id: 'asset', label: '자산군' },
  { id: 'dividend', label: '배당' },
];

export default function DeployPage() {
  const supabase = getSupabase();
  const [rows, setRows] = useState<FinanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('total');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [showModal, setShowModal] = useState(false);

  const months = useMemo(() => getSortedMonths(rows), [rows]);
  const monthsDesc = useMemo(() => [...months].reverse(), [months]);

  const loadData = useCallback(async () => {
    if (!supabase) {
      setError('Supabase 클라이언트를 초기화할 수 없습니다.');
      setIsLoading(false);
      return;
    }
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        setError('로그인이 필요합니다.');
        setIsLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from('finance_investments')
        .select('*')
        .eq('user_id', userId)
        .order('monthly_date', { ascending: true });

      if (queryError) {
        setError(queryError.message);
        setIsLoading(false);
        return;
      }

      const fetched = (data ?? []) as FinanceRow[];
      setRows(fetched);

      const sorted = getSortedMonths(fetched);
      setSelectedMonth((prev) => (prev && sorted.includes(prev) ? prev : sorted[sorted.length - 1] ?? ''));
    } catch (e: any) {
      setError(e?.message ?? '데이터를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showMonthSelector = activeTab !== 'owner';
  const hasData = rows.length > 0;

  return (
    <AuthGuard>
      <SwipeNav>
        <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900">
          <GlobalNav />

          <main className={`${APP_CONTENT_CONTAINER} pb-28`}>
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">투자현황</h1>
            </div>

            {/* 탭 바 */}
            <div className="flex gap-1 overflow-x-auto -mx-1 px-1 mb-4 scrollbar-hide">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`shrink-0 px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                    activeTab === t.id
                      ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* 월 선택 */}
            {showMonthSelector && hasData && (
              <div className="mb-4">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {monthsDesc.map((m) => (
                    <option key={m} value={m}>{formatMonthLabel(m)}</option>
                  ))}
                </select>
              </div>
            )}

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">불러오는 중...</p>
              </div>
            ) : error ? (
              <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-8 text-center text-sm text-red-500">
                {error}
              </div>
            ) : !hasData ? (
              <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-8 text-center">
                <p className="text-sm text-gray-400">아직 투자 데이터가 없습니다.</p>
                <p className="text-xs text-gray-400 mt-1">우측 하단 + 버튼으로 데이터를 추가하세요.</p>
              </div>
            ) : (
              <>
                {activeTab === 'total' && <TotalBalanceTab rows={rows} selectedMonth={selectedMonth} />}
                {activeTab === 'owner' && <ByOwnerTab rows={rows} />}
                {activeTab === 'bucket' && <BucketTab rows={rows} selectedMonth={selectedMonth} />}
                {activeTab === 'asset' && <AssetClassTab rows={rows} selectedMonth={selectedMonth} />}
                {activeTab === 'dividend' && <DividendTab rows={rows} selectedMonth={selectedMonth} />}
              </>
            )}
          </main>

          {/* FAB */}
          <button
            onClick={() => setShowModal(true)}
            className="fixed bottom-24 right-4 sm:right-[calc(50%-206px+16px)] z-[120] w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center text-3xl leading-none hover:bg-blue-700 transition-colors"
            aria-label="투자 데이터 추가"
          >
            +
          </button>

          <FooterNav />

          {showModal && supabase && (
            <AddInvestmentModal
              supabase={supabase}
              defaultMonth={selectedMonth}
              onClose={() => setShowModal(false)}
              onSaved={loadData}
            />
          )}
        </div>
      </SwipeNav>
    </AuthGuard>
  );
}
