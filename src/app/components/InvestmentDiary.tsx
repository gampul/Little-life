'use client';

import { useState, useEffect } from 'react';

interface DiaryEntry {
  id: string;
  entry_date: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export default function InvestmentDiary() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [newDate, setNewDate] = useState('');
  const [newContent, setNewContent] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 오늘 날짜를 YYYY-MM-DD 형식으로
  const getTodayDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    setNewDate(getTodayDate());
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/investment-diary');
      if (res.ok) {
        const json = await res.json();
        setEntries(json.entries || []);
      }
    } catch (err) {
      console.error('Failed to fetch entries:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!newDate || newContent.trim() === '') {
      alert('날짜와 내용을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/investment-diary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_date: newDate, content: newContent }),
      });

      if (res.ok) {
        setNewContent('');
        fetchEntries();
      } else {
        const json = await res.json();
        alert(`저장 실패: ${json.error || '알 수 없는 오류'}`);
      }
    } catch (err) {
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${year}년 ${month}월 ${day}일`;
  };

  return (
    <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-3">
        📝 투자일기
      </h2>

      {/* 새 일기 입력 */}
      <div className="mb-4 space-y-2">
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="오늘의 투자 기록을 남겨보세요..."
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
        />
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {isSaving ? '저장 중...' : '저장'}
        </button>
      </div>

      {/* 기존 일기 목록 (아코디언) */}
      <div className="space-y-2">
        {isLoading && (
          <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
            불러오는 중...
          </div>
        )}
        {!isLoading && entries.length === 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
            아직 작성된 일기가 없습니다.
          </div>
        )}
        {!isLoading &&
          entries.map((entry) => {
            const isExpanded = expandedId === entry.id;
            return (
              <div
                key={entry.id}
                className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : entry.id)
                  }
                  className="w-full px-3 py-2 flex items-center justify-between bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-left"
                >
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatDate(entry.entry_date)}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </button>
                {isExpanded && (
                  <div className="px-3 py-2 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {entry.content}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

