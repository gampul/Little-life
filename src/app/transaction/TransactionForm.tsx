'use client';

import { useActionState, useMemo, useState } from 'react';
import type { TxActionState } from '../actions/transactions';
import { createTransactionAction, updateTransactionAction, softDeleteTransactionDirectAction } from '../actions/transactions';
import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';

type Asset = { id: string; name: string; currency: string };
type Category = { id: string; type: 'income' | 'expense' | 'transfer'; name: string; parent_id: string | null };
type TxType = 'income' | 'expense' | 'transfer_out' | 'transfer_in';

type InitialTx = {
  id?: string;
  occurred_at: string; // ISO
  type: TxType;
  asset_id: string;
  category_id: string | null;
  amount: number;
  description: string;
  memo: string;
  transfer_pair_id?: string | null;
  to_asset_id?: string | null; // UI helper for transfers
};

function toDatetimeLocal(iso: string) {
  // Convert ISO to datetime-local in Asia/Seoul for consistent UX
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  // sv-SE gives "YYYY-MM-DD HH:mm"; convert to "YYYY-MM-DDTHH:mm"
  return fmt.format(d).replace(' ', 'T');
}

export function TransactionForm({
  mode,
  assets,
  categories,
  initial,
}: {
  mode: 'create' | 'edit';
  assets: Asset[];
  categories: Category[];
  initial: InitialTx;
}) {
  const [state, action, pending] = useActionState(
    mode === 'create' ? createTransactionAction : updateTransactionAction,
    {} as TxActionState
  );

  const [type, setType] = useState<TxType>(initial.type);
  const [assetId, setAssetId] = useState(initial.asset_id);
  const [toAssetId, setToAssetId] = useState(initial.to_asset_id || '');

  const showCategory = type === 'income' || type === 'expense';
  const showTransferTo = type === 'transfer_out';

  const filteredCategories = useMemo(() => {
    if (type === 'income') return categories.filter(c => c.type === 'income');
    if (type === 'expense') return categories.filter(c => c.type === 'expense');
    return [];
  }, [categories, type]);

  const isEditingTransfer = mode === 'edit' && (initial.type === 'transfer_out' || initial.type === 'transfer_in');

  return (
    <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-24">
      <GlobalNav />
      <div className="max-w-[412px] mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          {mode === 'create' ? '거래 추가' : '거래 수정'}
        </h1>

        <form action={action} className="space-y-4">
          {mode === 'edit' && <input type="hidden" name="id" value={initial.id} />}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">일시</label>
              <input
                name="occurred_at"
                type="datetime-local"
                defaultValue={toDatetimeLocal(initial.occurred_at)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">타입</label>
              <select
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value as TxType)}
                disabled={isEditingTransfer} // MVP: transfer 타입 변경은 복잡하므로 잠금
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-60"
              >
                <option value="income">수입</option>
                <option value="expense">지출</option>
                <option value="transfer_out">이체(출금)</option>
              </select>
              {isEditingTransfer && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">이체 거래는 타입 변경을 제한합니다(MVP).</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {showTransferTo ? '출금 자산' : '자산'}
              </label>
              <select
                name="asset_id"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">선택</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {showTransferTo && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">대상 자산</label>
                <select
                  name="to_asset_id"
                  value={toAssetId}
                  onChange={(e) => setToAssetId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">선택</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {showCategory && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">카테고리</label>
              <select
                name="category_id"
                defaultValue={initial.category_id || ''}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">선택</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">금액</label>
              <input
                name="amount"
                type="number"
                min={0}
                step="0.01"
                defaultValue={initial.amount}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">내용</label>
            <input
              name="description"
              type="text"
              defaultValue={initial.description}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">메모</label>
            <textarea
              name="memo"
              defaultValue={initial.memo}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
            >
              {pending ? '저장 중...' : '저장'}
            </button>
            <a
              href="/ledger"
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              취소
            </a>
          </div>
        </form>

        {mode === 'edit' && (
          <form action={softDeleteTransactionDirectAction} className="mt-6">
            <input type="hidden" name="id" value={initial.id} />
            <button
              className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium"
              onClick={(e) => {
                if (!confirm('이 거래를 삭제(soft delete)할까요? 이체인 경우 쌍도 함께 삭제됩니다.')) {
                  e.preventDefault();
                }
              }}
            >
              삭제
            </button>
          </form>
        )}
      </div>
      <FooterNav />
    </div>
  );
}


