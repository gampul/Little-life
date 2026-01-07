import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '../../lib/supabase_ssr';
import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';
import { SwipeNav } from '../components/SwipeNav';

type TxType = 'income' | 'expense' | 'transfer_out' | 'transfer_in';

type TransactionRow = {
  id: string;
  occurred_at: string;
  type: TxType;
  asset_id: string;
  category_id: string | null;
  amount: number;
  currency: string;
  description: string;
  memo: string;
  transfer_pair_id: string | null;
};

function monthStartEndIso(m: string) {
  // m: YYYY-MM. Use Asia/Seoul boundaries for MVP.
  const [y, mo] = m.split('-').map(Number);
  const start = new Date(`${y}-${String(mo).padStart(2, '0')}-01T00:00:00+09:00`);
  const next = new Date(`${y}-${String(mo).padStart(2, '0')}-01T00:00:00+09:00`);
  next.setMonth(next.getMonth() + 1);
  return { startIso: start.toISOString(), nextIso: next.toISOString() };
}

function monthParamFromDate(d: Date) {
  const fmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' });
  return fmt.format(d).slice(0, 7);
}

function dateKeyKST(iso: string) {
  // KST(UTC+9)는 DST가 없어서, +9시간 후 UTC 기준 날짜로 키를 만드는 게 빠르고 충분합니다.
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function prettyDateKST(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return `${m}월 ${d}일`;
}

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; filter?: string }>;
}) {
  const supabase = await createSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) redirect('/login');

  const sp = await searchParams;
  const currentMonth = sp.m || monthParamFromDate(new Date());
  const filter = sp.filter || 'expense'; // income | expense | net

  const { startIso, nextIso } = monthStartEndIso(currentMonth);

  const [{ data: assets }, { data: categories }, { data: transactions, error: txErr }] = await Promise.all([
    supabase
      .from('assets')
      .select('id, name, currency')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    supabase
      .from('categories')
      .select('id, type, name, parent_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    supabase
      .from('transactions')
      .select('id, occurred_at, type, asset_id, category_id, amount, currency, description, memo, transfer_pair_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .gte('occurred_at', startIso)
      .lt('occurred_at', nextIso)
      .order('occurred_at', { ascending: false }),
  ]);

  if (txErr) {
    return (
      <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 p-6">
        <div className="max-w-[720px] mx-auto">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Ledger</h1>
          <p className="text-sm text-red-600">데이터를 불러오지 못했습니다: {txErr.message}</p>
        </div>
      </div>
    );
  }

  const assetMap = new Map((assets || []).map((a: any) => [a.id, a]));
  const categoryMap = new Map((categories || []).map((c: any) => [c.id, c]));

  const txList = (transactions || []) as TransactionRow[];
  const filtered = txList.filter((t) => {
    if (filter === 'income') return t.type === 'income';
    if (filter === 'expense') return t.type === 'expense';
    return false;
  });

  const incomeSum = txList.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
  const expenseSum = txList.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
  const net = incomeSum - expenseSum;

  const grouped = new Map<string, TransactionRow[]>();
  for (const t of filtered) {
    const key = dateKeyKST(t.occurred_at);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(t);
  }
  const dateKeys = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a));

  const [y, m] = currentMonth.split('-').map(Number);
  const prev = (() => {
    const d = new Date(`${y}-${String(m).padStart(2, '0')}-01T00:00:00+09:00`);
    d.setMonth(d.getMonth() - 1);
    return monthParamFromDate(d);
  })();
  const next = (() => {
    const d = new Date(`${y}-${String(m).padStart(2, '0')}-01T00:00:00+09:00`);
    d.setMonth(d.getMonth() + 1);
    return monthParamFromDate(d);
  })();

  return (
    <SwipeNav>
    <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-24">
      <GlobalNav />
      <div className="max-w-[412px] mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Ledger</h1>
        </div>

        {/* Month controls */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Link
              href={`/ledger?m=${prev}&filter=${filter}`}
              className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
            >
              ← 이전
            </Link>
            <div className="text-base font-semibold text-gray-900 dark:text-white">
              {y}년 {m}월
            </div>
            <Link
              href={`/ledger?m=${next}&filter=${filter}`}
              className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
            >
              다음 →
            </Link>
          </div>
          <Link
            href="/transaction/new"
            className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            + 거래 추가
          </Link>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">수입</div>
            <div className="text-blue-600 dark:text-blue-400 font-bold">{incomeSum.toLocaleString()}원</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">지출</div>
            <div className="text-red-500 dark:text-red-400 font-bold">{expenseSum.toLocaleString()}원</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">합계</div>
            <div className="text-gray-900 dark:text-white font-bold">
              {(net >= 0 ? '+' : '') + net.toLocaleString()}원
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Link
            href={`/ledger?m=${currentMonth}&filter=income`}
            className={`px-3 py-1 rounded-lg text-sm border ${
              filter === 'income'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            수입
          </Link>
          <Link
            href={`/ledger?m=${currentMonth}&filter=expense`}
            className={`px-3 py-1 rounded-lg text-sm border ${
              filter === 'expense'
                ? 'bg-red-500 text-white border-red-500'
                : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            지출
          </Link>
          <Link
            href={`/ledger?m=${currentMonth}&filter=net`}
            className={`px-3 py-1 rounded-lg text-sm border ${
              filter === 'net'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            순자산
          </Link>
          <Link
            href="/ledger/import"
            className="ml-auto px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
          >
            CSV
          </Link>
        </div>

        {/* List grouped by date (income/expense only) */}
        {filter !== 'net' ? (
          <div className="space-y-3">
            {dateKeys.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center text-gray-500 dark:text-gray-400">
                이번 달 거래가 없습니다.
              </div>
            ) : (
              dateKeys.map((dk) => (
                <div key={dk} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-900 dark:text-white">
                    {prettyDateKST(dk)}
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {grouped.get(dk)!.map((t) => {
                    const assetName = assetMap.get(t.asset_id)?.name || '자산';
                    const categoryName = t.category_id ? (categoryMap.get(t.category_id)?.name || '카테고리') : '';
                    const isIncome = t.type === 'income';
                    const isExpense = t.type === 'expense';
                    const isTransfer = t.type === 'transfer_out' || t.type === 'transfer_in';
                    const amountColor = isIncome
                      ? 'text-blue-600 dark:text-blue-400'
                      : isExpense
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-gray-700 dark:text-gray-200';

                    return (
                      <Link
                        key={t.id}
                        href={`/transaction/${t.id}`}
                        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                              {isTransfer ? '이체' : (isIncome ? '수입' : '지출')}
                            </span>
                            {categoryName && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">{categoryName}</span>
                            )}
                          </div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {t.description}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {assetName}
                          </div>
                        </div>
                        <div className={`font-bold text-sm whitespace-nowrap ${amountColor}`}>
                          {(isIncome ? '+' : isExpense ? '-' : '') + Number(t.amount).toLocaleString()}원
                        </div>
                      </Link>
                    );
                  })}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">이번 달 순자산(=순현금흐름)</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">수입</div>
                <div className="text-blue-600 dark:text-blue-400 font-bold">{incomeSum.toLocaleString()}원</div>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">지출</div>
                <div className="text-red-500 dark:text-red-400 font-bold">{expenseSum.toLocaleString()}원</div>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">순자산</div>
                <div className="text-gray-900 dark:text-white font-bold">
                  {(net >= 0 ? '+' : '') + net.toLocaleString()}원
                </div>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              순자산은 “총수입 − 총지출”로 계산됩니다. (이체는 제외)
            </div>
          </div>
        )}
      </div>
      <FooterNav />
    </div>
    </SwipeNav>
  );
}


