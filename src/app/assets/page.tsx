'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { IconAdjustmentsHorizontal, IconChevronDown } from '@tabler/icons-react';
import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';
import { AuthGuard } from '../components/AuthGuard';
import { useAuth } from '../components/AuthProvider';
import { getSupabase } from '../../lib/supabase';
import { APP_HORIZONTAL_CONTAINER } from '../components/container';
import { CategoryManager } from './components/CategoryManager';
import { kstTimeLabel, kstYmd, won } from '../ledger/ledgerUtils';

interface AssetBalance {
  asset_name: string;
  balance: number;
  is_debt: boolean;
}

interface Category {
  id: string;
  name: string;
  type: 'asset' | 'debt';
  sort_order: number;
}

interface Mapping {
  asset_name: string;
  category_id: string | null;
}

interface Group {
  key: string;
  name: string;
  icon: string;
  debt: boolean;
  order: number;
  items: AssetBalance[];
  total: number;
}

interface AssetTx {
  id: string;
  date: string;
  transaction_type: string;
  category: string | null;
  amount: number;
  memo: string | null;
  asset: string;
  transfer_asset: string | null;
}

/** 그룹 설정이 없는 계좌는 이름으로 자동 분류 */
const AUTO_GROUPS: { key: string; name: string; icon: string; debt: boolean; test: (n: string, a: AssetBalance) => boolean }[] = [
  { key: 'auto-card', name: '카드', icon: '💳', debt: true, test: (n) => /카드/.test(n) },
  { key: 'auto-loan', name: '대출', icon: '🏦', debt: true, test: (n, a) => a.is_debt || /대출|마이너스/.test(n) },
  { key: 'auto-cash', name: '현금·예금', icon: '🪣', debt: false, test: (n) => /은행|통장|예금|적금|청약|cma|토스|현금|cash|제세공과|생활비/i.test(n) },
  { key: 'auto-point', name: '포인트·페이', icon: '🎟️', debt: false, test: (n) => /point|포인트|pay|페이|상품권|payco/i.test(n) },
  { key: 'auto-us', name: '미국', icon: '🗽', debt: false, test: (n) => /미국|s&p|나스닥|nasdaq/i.test(n) },
  { key: 'auto-invest', name: '투자', icon: '📈', debt: false, test: (n) => /etf|tiger|kodex|ace |rise|sol |krx|리츠|금현물|crypto|spec|키움|isa|irp/i.test(n) },
  { key: 'auto-estate', name: '부동산', icon: '🏠', debt: false, test: (n) => /단지|아파트|운정|갈매|\d+동|\d+호/.test(n) },
];
const AUTO_ETC = { key: 'auto-etc', name: '기타', icon: '📦', debt: false };

function amountColor(v: number) {
  if (v > 0) return 'text-blue-600 dark:text-blue-400';
  if (v < 0) return 'text-red-500 dark:text-red-400';
  return 'text-gray-900 dark:text-gray-100';
}

export default function AssetsPage() {
  const supabase = getSupabase();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [balances, setBalances] = useState<AssetBalance[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hideZero, setHideZero] = useState(false);
  const [openAsset, setOpenAsset] = useState<string | null>(null);
  const [assetTx, setAssetTx] = useState<Record<string, AssetTx[] | 'loading'>>({});
  const [showGroups, setShowGroups] = useState(false);

  useEffect(() => {
    try { setHideZero(localStorage.getItem('little-life:assets-hide-zero') === '1'); } catch {}
  }, []);

  const load = useCallback(async () => {
    if (!supabase || !userId) return;
    setIsLoading(true);
    const [balRes, catRes, mapRes] = await Promise.all([
      supabase.rpc('get_asset_balances', { p_user_id: userId }),
      supabase.from('asset_categories').select('id, name, type, sort_order').eq('user_id', userId).order('sort_order'),
      supabase.from('asset_category_mappings').select('asset_name, category_id').eq('user_id', userId),
    ]);
    if (balRes.error) console.error('잔액 로드 오류:', balRes.error.message);
    setBalances(((balRes.data ?? []) as AssetBalance[]).map((b) => ({ ...b, balance: Number(b.balance) || 0 })));
    setCategories((catRes.data ?? []) as Category[]);
    setMappings((mapRes.data ?? []) as Mapping[]);
    setAssetTx({});
    setIsLoading(false);
  }, [supabase, userId]);

  useEffect(() => { load(); }, [load]);

  // 자산 / 부채 / 합계 — 부채 그룹(대출·카드 등)은 부채로, 나머지 음수 잔액은 자산 안에서 빼기
  const groups = useMemo(() => {
    const catById = new Map(categories.map((c) => [c.id, c]));
    const mapByName = new Map(mappings.map((m) => [m.asset_name, m.category_id]));
    const map = new Map<string, Group>();
    for (const a of balances) {
      if (hideZero && a.balance === 0) continue;
      const cat = catById.get(mapByName.get(a.asset_name) ?? '');
      let g: Omit<Group, 'items' | 'total'>;
      if (cat) {
        g = { key: cat.id, name: cat.name, icon: '', debt: cat.type === 'debt', order: cat.sort_order };
      } else {
        const idx = AUTO_GROUPS.findIndex((r) => r.test(a.asset_name, a));
        const r = idx >= 0 ? AUTO_GROUPS[idx] : AUTO_ETC;
        // 설정한 그룹 뒤에 자동 그룹 (부채는 맨 뒤)
        const order = 1000 + (r.debt ? 100 : 0) + (idx >= 0 ? idx : 50);
        g = { key: r.key, name: r.name, icon: r.icon, debt: r.debt, order };
      }
      const cur = map.get(g.key) ?? { ...g, items: [], total: 0 };
      cur.items.push(a);
      cur.total += a.balance;
      map.set(g.key, cur);
    }
    const list = [...map.values()];
    list.forEach((g) => g.items.sort((x, y) => Math.abs(y.balance) - Math.abs(x.balance)));
    list.sort((x, y) => (x.debt === y.debt ? x.order - y.order : x.debt ? 1 : -1));
    return list;
  }, [balances, categories, mappings, hideZero]);

  const totals = useMemo(() => {
    let assets = 0;
    let debts = 0;
    for (const g of groups) {
      if (g.debt) debts += -g.total; // 부채 잔액은 음수로 쌓임
      else assets += g.total;
    }
    return { assets, debts, net: assets - debts };
  }, [groups]);

  const toggleAsset = async (name: string) => {
    if (openAsset === name) { setOpenAsset(null); return; }
    setOpenAsset(name);
    if (assetTx[name] || !supabase || !userId) return;
    setAssetTx((p) => ({ ...p, [name]: 'loading' }));
    const safe = name.replace(/"/g, '\\"');
    const { data } = await supabase
      .from('transactions')
      .select('id, date, transaction_type, category, amount, memo, asset, transfer_asset')
      .eq('user_id', userId)
      .or(`asset.eq."${safe}",transfer_asset.eq."${safe}"`)
      .order('date', { ascending: false })
      .limit(30);
    setAssetTx((p) => ({ ...p, [name]: (data ?? []) as AssetTx[] }));
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-28">
        <GlobalNav />

        {/* 상단 고정: 제목 · 자산/부채/합계 */}
        <div className="sticky top-16 z-40 bg-[rgb(254,252,247)]/95 dark:bg-gray-900/95 backdrop-blur">
          <div className={APP_HORIZONTAL_CONTAINER}>
            <div className="flex items-center pt-2 pb-1">
              <h1 className="text-[17px] font-semibold text-gray-900 dark:text-white">자산</h1>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const v = !hideZero;
                    setHideZero(v);
                    try { localStorage.setItem('little-life:assets-hide-zero', v ? '1' : '0'); } catch {}
                  }}
                  className={`rounded-lg px-2 py-1.5 text-xs font-medium ${hideZero ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'text-gray-500 dark:text-gray-400'}`}
                  aria-pressed={hideZero}
                >
                  0원 숨기기
                </button>
                <button
                  type="button"
                  onClick={() => setShowGroups(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 dark:text-gray-300"
                  aria-label="자산 그룹 설정"
                  title="자산 그룹 설정"
                >
                  <IconAdjustmentsHorizontal size={20} stroke={1.8} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 border-y border-gray-200 dark:border-gray-700 py-2 text-center">
              <div>
                <div className="text-[12px] text-gray-500 dark:text-gray-400">자산</div>
                <div className="text-[15px] font-semibold tabular-nums text-blue-600 dark:text-blue-400">{isLoading ? '—' : won(totals.assets)}</div>
              </div>
              <div>
                <div className="text-[12px] text-gray-500 dark:text-gray-400">부채</div>
                <div className="text-[15px] font-semibold tabular-nums text-red-500 dark:text-red-400">{isLoading ? '—' : won(totals.debts)}</div>
              </div>
              <div>
                <div className="text-[12px] text-gray-500 dark:text-gray-400">합계</div>
                <div className="text-[15px] font-semibold tabular-nums text-gray-900 dark:text-white">{isLoading ? '—' : won(totals.net)}</div>
              </div>
            </div>
          </div>
        </div>

        <main className={APP_HORIZONTAL_CONTAINER}>
          {isLoading ? (
            <div className="space-y-2 py-4">
              {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-11 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />)}
            </div>
          ) : groups.length === 0 ? (
            <div className="py-20 text-center text-sm text-gray-400">자산이 없어요</div>
          ) : (
            groups.map((g) => {
              const share = !g.debt && totals.assets > 0 ? Math.round((g.total / totals.assets) * 100) : null;
              return (
                <section key={g.key} className="mt-3">
                  <div className="flex items-center justify-between bg-gray-100/80 dark:bg-gray-800/70 px-2 py-2.5 rounded-t-lg">
                    <span className="text-[15px] text-gray-700 dark:text-gray-200">
                      {g.icon && <span className="mr-1">{g.icon}</span>}
                      {g.name}
                      {share !== null && share >= 1 && <span className="ml-0.5 text-gray-500 dark:text-gray-400">({share}%)</span>}
                    </span>
                    <span className={`text-[15px] font-medium tabular-nums ${amountColor(g.total)}`}>{won(g.total)}원</span>
                  </div>
                  <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                    {g.items.map((a) => {
                      const open = openAsset === a.asset_name;
                      const txs = assetTx[a.asset_name];
                      return (
                        <li key={a.asset_name}>
                          <button
                            type="button"
                            onClick={() => toggleAsset(a.asset_name)}
                            className="flex w-full items-center gap-2 px-2 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
                            aria-expanded={open}
                          >
                            <span className="min-w-0 flex-1 truncate text-[15px] text-gray-900 dark:text-gray-100">{a.asset_name}</span>
                            <span className={`shrink-0 text-[15px] tabular-nums ${amountColor(a.balance)}`}>{won(a.balance)}원</span>
                            <IconChevronDown size={14} className={`shrink-0 text-gray-300 transition-transform ${open ? 'rotate-180' : ''}`} />
                          </button>
                          {open && (
                            <div className="mb-1 rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-1.5">
                              {txs === 'loading' || txs === undefined ? (
                                <div className="py-2 text-center text-xs text-gray-400">불러오는 중…</div>
                              ) : txs.length === 0 ? (
                                <div className="py-2 text-center text-xs text-gray-400">거래내역이 없어요</div>
                              ) : (
                                <>
                                  <ul>
                                    {txs.map((t) => {
                                      const isTransfer = t.transaction_type === '자산이체';
                                      const outgoing = isTransfer ? t.asset === a.asset_name : t.transaction_type === '지출';
                                      const sign = t.transaction_type === '수입' || (isTransfer && !outgoing) ? '+' : '−';
                                      const label = isTransfer
                                        ? `${outgoing ? '→ ' + (t.transfer_asset ?? '') : '← ' + t.asset}${t.memo ? ' · ' + t.memo : ''}`
                                        : t.memo || t.category || '';
                                      const time = kstTimeLabel(t.date);
                                      return (
                                        <li key={t.id} className="flex items-center gap-2 py-1.5 text-[12.5px]">
                                          <span className="w-[74px] shrink-0 tabular-nums text-gray-400">
                                            {kstYmd(t.date).slice(2).replace(/-/g, '.')}
                                          </span>
                                          <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-300" title={time ?? undefined}>{label}</span>
                                          <span className={`shrink-0 tabular-nums ${sign === '+' ? 'text-blue-600 dark:text-blue-400' : 'text-red-500 dark:text-red-400'}`}>
                                            {sign}{won(t.amount)}
                                          </span>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                  {txs.length >= 30 && <div className="pb-1 text-center text-[11px] text-gray-400">최근 30건</div>}
                                </>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })
          )}
          {!isLoading && groups.some((g) => g.key.startsWith('auto-')) && (
            <p className="mt-3 text-[11px] text-gray-400">
              그룹을 정하지 않은 계좌는 이름으로 자동 분류했어요. 오른쪽 위 설정 아이콘에서 그룹을 직접 만들 수 있어요.
            </p>
          )}
        </main>

        <FooterNav />
      </div>

      {userId && (
        <CategoryManager
          isOpen={showGroups}
          onClose={() => setShowGroups(false)}
          userId={userId}
          assetNames={balances.map((b) => b.asset_name)}
          onUpdate={load}
        />
      )}
    </AuthGuard>
  );
}
