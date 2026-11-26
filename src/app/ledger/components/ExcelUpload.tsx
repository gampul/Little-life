'use client';

import { useState, useRef } from 'react';

interface ExcelUploadProps {
  onUploadComplete: () => void;
  accessToken: string | null;
}

interface UploadResult {
  success: boolean;
  imported?: number;
  total?: number;
  skipped?: number;
  replaced?: boolean;
  deleted?: number;
  errors?: string[];
  error?: string;
  details?: string;
}

export function ExcelUpload({ onUploadComplete, accessToken }: ExcelUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** 켜면 기존 내역을 모두 지우고 파일 내용으로 교체 (끄면 없는 거래만 추가) */
  const [replaceAll, setReplaceAll] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!accessToken) {
      setResult({ success: false, error: '로그인이 필요합니다' });
      return;
    }

    setIsUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (replaceAll) formData.append('mode', 'replace');

      const response = await fetch('/api/ledger/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const data: UploadResult = await response.json();
      setResult(data);

      if (data.success) {
        setReplaceAll(false);
        // 교체 결과(삭제·추가 건수)는 닫지 않고 보여 준다
        if (!data.replaced) onUploadComplete();
      }
    } catch (err) {
      setResult({ 
        success: false, 
        error: '업로드 중 오류가 발생했습니다',
        details: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileChange}
        className="hidden"
        disabled={isUploading}
      />
      
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        style={{ fontSize: '14px' }}
        className={`w-full py-2 text-white font-medium rounded-lg transition-colors ${
          replaceAll
            ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
            : 'bg-green-600 hover:bg-green-700 disabled:bg-green-400'
        }`}
      >
        {isUploading ? '업로드 중...' : replaceAll ? '파일 선택 — 기존 내역을 지우고 교체' : 'Excel 파일 업로드'}
      </button>

      <label className="mt-2 flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={replaceAll}
          onChange={(e) => setReplaceAll(e.target.checked)}
          disabled={isUploading}
          className="mt-0.5"
        />
        <span style={{ fontSize: '12px' }} className={replaceAll ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'}>
          기존 내역을 모두 지우고 이 파일로 교체
          {replaceAll && ' — 앱에서 직접 입력한 내역도 지워져요. 파일을 고르면 바로 실행됩니다.'}
        </span>
      </label>

      <p style={{ fontSize: '12px' }} className="text-gray-500 dark:text-gray-400 mt-2 text-center">
        xlsx, xls, csv 파일 지원
      </p>

      {/* 결과 표시 */}
      {result && (
        <div className={`mt-3 p-2 rounded-lg ${result.success ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
          {result.success ? (
            <div>
              <p style={{ fontSize: '14px' }} className="text-green-700 dark:text-green-300 font-medium">
                업로드 완료
              </p>
              <p style={{ fontSize: '12px' }} className="text-green-600 dark:text-green-400">
                {result.replaced
                  ? `기존 ${result.deleted}건 삭제 → ${result.imported}건으로 교체`
                  : `${result.imported}건 추가 / ${result.skipped}건 중복 스킵`}
              </p>
              {result.replaced && (
                <button
                  type="button"
                  onClick={onUploadComplete}
                  style={{ fontSize: '12px' }}
                  className="mt-1 underline text-green-700 dark:text-green-300"
                >
                  닫고 내역 보기
                </button>
              )}
              {!!result.errors?.length && (
                <p style={{ fontSize: '11px' }} className="text-gray-500 dark:text-gray-400 mt-1">
                  건너뜀: {result.errors.slice(0, 3).join(', ')}
                </p>
              )}
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '14px' }} className="text-red-700 dark:text-red-300 font-medium">
                {result.error}
              </p>
              {result.details && (
                <p style={{ fontSize: '12px' }} className="text-red-600 dark:text-red-400">
                  {result.details}
                </p>
              )}
              {result.errors && result.errors.length > 0 && (
                <ul style={{ fontSize: '11px' }} className="text-red-500 dark:text-red-400 mt-1 list-disc list-inside">
                  {result.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
