'use client';

import { useState } from 'react';
import Link from 'next/link';
import { GlobalNav } from '../../components/GlobalNav';
import { FooterNav } from '../../components/FooterNav';
import { AuthGuard } from '../../components/AuthGuard';
import { SwipeNav } from '../../components/SwipeNav';

type ImportResult =
  | { status: 'ok'; fileHash: string; batchId: string; rowsParsed: number; rowsAttempted: number; rowsInserted: number | null }
  | { status: 'duplicate_file'; fileHash: string; batchId: string | null; message: string }
  | { error: string; code?: string };

export default function LedgerImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/ledger/import', { method: 'POST', body: form });
      const json = (await res.json()) as ImportResult;
      setResult(json);
    } catch (e: any) {
      setResult({ error: e?.message || '업로드 실패' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <AuthGuard>
      <SwipeNav>
        <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-24">
          <GlobalNav />
          <div className="max-w-[412px] mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">CSV 업로드</h1>
              <Link
                href="/ledger"
                className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
              >
                ← Ledger
              </Link>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-sm text-gray-700 dark:text-gray-200 font-medium mb-2">
                expense.csv 업로드
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                같은 파일을 다시 올려도 중복 없이 처리됩니다.
              </div>

              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-700 dark:text-gray-200 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-gray-900 file:text-white hover:file:bg-gray-800 dark:file:bg-gray-700 dark:hover:file:bg-gray-600"
              />

              <button
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="mt-3 w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isUploading ? '업로드 중...' : '업로드 & 적재'}
              </button>
            </div>

            {result && (
              <div className="mt-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                {'error' in result ? (
                  <div className="text-sm text-red-600 dark:text-red-400">
                    ❌ {result.error}{result.code ? ` (${result.code})` : ''}
                  </div>
                ) : result.status === 'duplicate_file' ? (
                  <div className="text-sm text-gray-700 dark:text-gray-200">
                    ✅ {result.message}
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      fileHash: {result.fileHash.slice(0, 12)}…
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-700 dark:text-gray-200">
                    ✅ 업로드 완료
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                      <div>rowsParsed: {result.rowsParsed.toLocaleString()}</div>
                      <div>rowsAttempted: {result.rowsAttempted.toLocaleString()}</div>
                      <div>rowsInserted: {(result.rowsInserted ?? 0).toLocaleString()}</div>
                      <div>fileHash: {result.fileHash.slice(0, 12)}…</div>
                    </div>
                    <div className="mt-3">
                      <Link
                        href="/ledger"
                        className="inline-block px-4 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm"
                      >
                        Ledger로 이동
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <FooterNav />
        </div>
      </SwipeNav>
    </AuthGuard>
  );
}


