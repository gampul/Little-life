'use client';

import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';
import { AuthGuard } from '../components/AuthGuard';

export default function LedgerPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-20">
        <GlobalNav />
        
        <main className="max-w-[412px] mx-auto px-4 pt-20">
          <div className="text-center py-20">
            <p style={{ fontSize: '16px' }} className="text-gray-500 dark:text-gray-400">
              새로운 기능을 준비 중입니다
            </p>
          </div>
        </main>
        
        <FooterNav />
      </div>
    </AuthGuard>
  );
}
