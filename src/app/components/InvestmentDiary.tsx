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
  const [activeTab, setActiveTab] = useState<'write' | 'view' | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
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
    setSelectedDate(getTodayDate());
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
    if (!selectedDate || content.trim() === '') {
      alert('날짜와 내용을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/investment-diary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_date: selectedDate, content }),
      });

      if (res.ok) {
        setContent('');
        setEditingId(null);
        fetchEntries();
        alert('저장되었습니다.');
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

  const handleEdit = (entry: DiaryEntry) => {
    setSelectedDate(entry.entry_date);
    setContent(entry.content);
    setEditingId(entry.id);
    setActiveTab('write');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/investment-diary?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchEntries();
        if (editingId === id) {
          setContent('');
          setEditingId(null);
        }
      } else {
        const json = await res.json();
        alert(`삭제 실패: ${json.error || '알 수 없는 오류'}`);
      }
    } catch (err) {
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${year}년 ${month}월 ${day}일`;
  };

  // 오늘 날짜인지 확인
  const isToday = (dateStr: string) => {
    return dateStr === getTodayDate();
  };

  return (
    <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      {/* 헤더: 제목 + 탭 */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
          📝 투자다짐
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab(activeTab === 'write' ? null : 'write')}
            className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'write'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            쓰기 {activeTab === 'write' ? '▲' : '▼'}
          </button>
          <button
            onClick={() => setActiveTab('view')}
            className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'view'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            보기
          </button>
        </div>
      </div>

      {/* 쓰기 탭 */}
      {activeTab === 'write' && (
        <div className="space-y-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="오늘의 투자 다짐을 남겨보세요..."
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {isSaving ? '저장 중...' : editingId ? '수정' : '저장'}
            </button>
            {editingId && (
              <button
                onClick={() => {
                  setContent('');
                  setEditingId(null);
                  setSelectedDate(getTodayDate());
                }}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                취소
              </button>
            )}
          </div>
        </div>
      )}

      {/* 보기 탭 */}
      {activeTab === 'view' && (
        <div className="space-y-2">
          {isLoading && (
            <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
              불러오는 중...
            </div>
          )}
          {!isLoading && entries.length === 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
              아직 작성된 다짐이 없습니다.
            </div>
          )}
          {!isLoading &&
            entries.map((entry) => (
              <div
                key={entry.id}
                className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={
                      isToday(entry.entry_date)
                        ? 'text-[12px] font-bold text-blue-600 dark:text-blue-400'
                        : 'text-sm font-medium text-gray-900 dark:text-white'
                    }
                  >
                    {formatDate(entry.entry_date)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(entry)}
                      className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded transition-colors"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-xs px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {entry.content}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

