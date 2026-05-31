'use client';

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { OWNERS, DIVISIONS, BUCKETS, BUCKET_LABELS } from '../lib';

interface Props {
  supabase: SupabaseClient;
  defaultMonth: string; // 'YYYY-MM-DD'
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  month: string; // 'YYYY-MM'
  owner: string;
  division: string;
  bucket: string;
  asset_class: string;
  account: string;
  ticker: string;
  balance: string;
  dividend: string;
  tax_fee: string;
  cash_flow: string;
  note: string;
}

function initialForm(defaultMonth: string): FormState {
  return {
    month: defaultMonth ? defaultMonth.slice(0, 7) : new Date().toISOString().slice(0, 7),
    owner: OWNERS[0],
    division: DIVISIONS[0],
    bucket: BUCKETS[0],
    asset_class: '',
    account: '',
    ticker: '',
    balance: '',
    dividend: '',
    tax_fee: '',
    cash_flow: '',
    note: '',
  };
}

export function AddInvestmentModal({ supabase, defaultMonth, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(() => initialForm(defaultMonth));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  const update = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (keepOpen: boolean) => {
    setError(null);

    if (!form.balance.trim() || isNaN(Number(form.balance))) {
      setError('balance(평가금액)는 필수 숫자 입력입니다.');
      return;
    }
    if (!form.asset_class.trim()) {
      setError('asset_class를 입력하세요.');
      return;
    }
    if (!form.ticker.trim()) {
      setError('ticker를 입력하세요.');
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      const dividend = Number(form.dividend) || 0;
      const taxFee = Number(form.tax_fee) || 0;

      const payload = {
        user_id: userId,
        monthly_date: `${form.month}-01`,
        owner: form.owner,
        division: form.division,
        bucket: form.bucket,
        asset_class: form.asset_class.trim(),
        account: form.account.trim() || null,
        ticker: form.ticker.trim(),
        dividend,
        tax_fee: taxFee,
        net_dividend: dividend - taxFee,
        cash_flow: Number(form.cash_flow) || 0,
        balance: Number(form.balance) || 0,
        note: form.note.trim() || null,
      };

      const { error: insertError } = await supabase.from('finance_investments').insert([payload]);
      if (insertError) {
        setError(insertError.message);
        return;
      }

      setSavedCount((c) => c + 1);
      onSaved();

      if (keepOpen) {
        // 같은 월/owner/division/bucket 유지, 종목 관련 필드만 초기화
        setForm((prev) => ({
          ...prev,
          asset_class: '',
          ticker: '',
          balance: '',
          dividend: '',
          tax_fee: '',
          cash_flow: '',
          note: '',
        }));
      } else {
        onClose();
      }
    } catch (e: any) {
      setError(e?.message ?? '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1';

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-[412px] max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[rgb(254,252,247)] dark:bg-gray-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">투자 데이터 추가</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none" aria-label="닫기">
            ×
          </button>
        </div>

        {savedCount > 0 && (
          <p className="mb-3 text-xs text-green-600 dark:text-green-400">이번 세션에 {savedCount}건 저장됨</p>
        )}

        <div className="space-y-3">
          <div>
            <label className={labelCls}>기록 월</label>
            <input type="month" value={form.month} onChange={(e) => update('month', e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>owner</label>
              <select value={form.owner} onChange={(e) => update('owner', e.target.value)} className={inputCls}>
                {OWNERS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>division</label>
              <select value={form.division} onChange={(e) => update('division', e.target.value)} className={inputCls}>
                {DIVISIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>bucket</label>
            <select value={form.bucket} onChange={(e) => update('bucket', e.target.value)} className={inputCls}>
              {BUCKETS.map((b) => (
                <option key={b} value={b}>{BUCKET_LABELS[b]} ({b})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>asset_class</label>
              <input value={form.asset_class} onChange={(e) => update('asset_class', e.target.value)} className={inputCls} placeholder="S&P500, NASDAQ ..." />
            </div>
            <div>
              <label className={labelCls}>ticker</label>
              <input value={form.ticker} onChange={(e) => update('ticker', e.target.value)} className={inputCls} placeholder="ACE 미국S&P500" />
            </div>
          </div>

          <div>
            <label className={labelCls}>account (계좌)</label>
            <input value={form.account} onChange={(e) => update('account', e.target.value)} className={inputCls} placeholder="선택 입력" />
          </div>

          <div>
            <label className={labelCls}>balance (평가금액, 필수)</label>
            <input type="number" inputMode="numeric" value={form.balance} onChange={(e) => update('balance', e.target.value)} className={inputCls} placeholder="0" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>dividend (배당)</label>
              <input type="number" inputMode="numeric" value={form.dividend} onChange={(e) => update('dividend', e.target.value)} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>tax_fee (세금/수수료)</label>
              <input type="number" inputMode="numeric" value={form.tax_fee} onChange={(e) => update('tax_fee', e.target.value)} className={inputCls} placeholder="0" />
            </div>
          </div>

          <div>
            <label className={labelCls}>cash_flow (양수=추가투자 / 음수=인출)</label>
            <input type="number" inputMode="numeric" value={form.cash_flow} onChange={(e) => update('cash_flow', e.target.value)} className={inputCls} placeholder="0" />
          </div>

          <div>
            <label className={labelCls}>note</label>
            <input value={form.note} onChange={(e) => update('note', e.target.value)} className={inputCls} placeholder="선택 입력" />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <p className="text-xs text-gray-400">net_dividend는 dividend − tax_fee로 자동 계산됩니다.</p>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex-1 rounded-lg border border-blue-500 text-blue-600 dark:text-blue-400 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            저장 후 계속 추가
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex-1 rounded-lg bg-blue-600 text-white py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
