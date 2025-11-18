'use client';

import { useState } from 'react';
import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';
export default function AccountPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pb-20">
      <GlobalNav />
      
      <div className="max-w-[480px] mx-auto px-4 sm:px-6 py-4 sm:py-6">

        <div className="space-y-2">
          {/* 가계부 제목 */}
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 mb-2">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2">
              💰 가계부
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              수입과 지출을 기록하고 관리하세요.
            </p>
          </div>

          {/* 가계부 내용 영역 */}
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 mb-2">
            <p className="text-base text-gray-500 dark:text-gray-400 text-center py-8">
              가계부 기능을 추가할 예정입니다.
            </p>
          </div>
        </div>
      </div>

      <FooterNav />
    </div>
  );
}

