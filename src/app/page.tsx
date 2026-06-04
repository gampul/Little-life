'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { getSupabase } from '../lib/supabase';
import { GlobalNav } from './components/GlobalNav';
import { PendingSmsPopup } from './components/PendingSmsPopup';
import type { PendingTransaction, TransactionType } from '../types/pending_transaction';
import { FooterNav } from './components/FooterNav';
import { AuthGuard } from './components/AuthGuard';
import { SwipeNav } from './components/SwipeNav';
import { APP_CONTENT_CONTAINER } from './components/container';
import {
  IconSparkles,
  IconCode,
  IconWallet,
  IconHeart,
  IconTarget,
  IconBottleOff,
  IconClock,
  IconBook,
  IconRun,
  IconDeviceLaptop,
  IconCheckbox,
} from '@tabler/icons-react';

// WeightChart를 동적 import로 로드 (SSR 방지)
const WeightChart = dynamic(
  () => import('./components/WeightChart'),
  { ssr: false }
);

interface DailyRecord {
  id?: string;
  date: string;
  weight: number | null;
  meal_breakfast: boolean;
  meal_lunch: boolean;
  meal_dinner: boolean;
  meal_memo: string;
  meal_images?: string[];
  daily_memo: string;
  created_at?: string;
  updated_at?: string;
}

interface RoutineTemplate {
  id: string;
  emoji: string;
  label: string;
  field_key: string;
  sort_order: number;
  type: 'checkbox' | 'number';
  unit?: string;
  image_upload_enabled?: boolean;
}

interface RoutineCheck {
  routine_id: string;
  checked: boolean;
  value?: number | null;
}

type PeriodFilter = '7days' | '1month' | '1year' | 'ytd' | 'all';

interface WeatherData {
  temperature: number;
  description: string;
  icon: string;
  city: string;
}

const getKstDateString = (): string =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());

const getRoutineIcon = (label: string) => {
  const map: Record<string, React.ReactNode> = {
    '주변정리': <IconSparkles size={18} stroke={1.5} />,
    '1Day class': <IconCode size={18} stroke={1.5} />,
    'DevOps': <IconCode size={18} stroke={1.5} />,
    '1Day': <IconDeviceLaptop size={18} stroke={1.5} />,
    '가계부': <IconWallet size={18} stroke={1.5} />,
    '기도': <IconHeart size={18} stroke={1.5} />,
    'OKR': <IconTarget size={18} stroke={1.5} />,
    '금주': <IconBottleOff size={18} stroke={1.5} />,
    '사랑이': <IconClock size={18} stroke={1.5} />,
    'brush': <IconSparkles size={18} stroke={1.5} />,
    '독서': <IconBook size={18} stroke={1.5} />,
    '500km': <IconRun size={18} stroke={1.5} />,
    'Dev ops': <IconCode size={18} stroke={1.5} />,
  };

  const key = Object.keys(map).find((k) => label.includes(k));
  return key ? map[key] : <IconCheckbox size={18} stroke={1.5} />;
};

export default function Home() {
  // Supabase 클라이언트 싱글톤 사용
  const supabase = getSupabase();
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  // Pending SMS queue & badge
  const [pendingQueue, setPendingQueue] = useState<PendingTransaction[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const currentPopup = pendingQueue[0] ?? null;

  useEffect(() => {
    if (!supabase) {
      console.error('❌ Supabase 클라이언트를 초기화할 수 없습니다.');
      setAuthLoading(false);
      return;
    }
    
    console.log('🔍 사용자 인증 정보 확인 중...');
    supabase.auth.getUser()
      .then(({ data, error }) => {
        if (error) {
          console.error('❌ 인증 오류:', error);
          setUserId(null);
        } else {
          console.log('✅ 사용자 인증 완료:', data.user?.id);
          setUserId(data.user?.id ?? null);
        }
      })
      .catch((err) => {
        console.error('❌ 예상치 못한 인증 오류:', err);
        setUserId(null);
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, [supabase]);

  // Load initial pending list and count
  useEffect(() => {
    if (!supabase || !userId) return;
    let isMounted = true;
    const load = async () => {
      const { data } = await supabase
        .from('pending_transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (!isMounted) return;
      setPendingQueue((data as PendingTransaction[]) ?? []);
      setPendingCount((data?.length as number) ?? 0);
    };
    load();
    return () => { isMounted = false; };
  }, [supabase, userId]);

  // Realtime subscription
  useEffect(() => {
    if (!supabase || !userId) return;
    const channel = supabase
      .channel('pending-sms')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'pending_transactions',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        const row = payload.new as PendingTransaction;
        if (row.status === 'pending') {
          setPendingQueue((q) => [row, ...q]);
          setPendingCount((c) => c + 1);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, userId]);

  // ── 등록하기: pending → confirmed + transactions 삽입 ──
  const handleConfirmPending = useCallback(async (id: string, updates: {
    transaction_type: TransactionType;
    category: string;
    asset: string;
    memo: string;
    amount: number;
  }) => {
    if (!supabase || !userId) {
      console.error('❌ [등록] supabase 또는 userId 없음');
      alert('로그인 정보가 없습니다. 새로고침 후 다시 시도해주세요.');
      return;
    }

    try {
      // Find item for date/account mapping
      const item = pendingQueue.find((p) => p.id === id);
      const dateIso = item?.transaction_date
        ? new Date(item.transaction_date + 'T00:00:00Z').toISOString()
        : new Date().toISOString();
      const asset = updates.asset || item?.sender || 'SMS';

      // 금액: transactions 테이블은 amount INTEGER > 0 필수
      const safeAmount = Math.max(1, Math.round(updates.amount || 0));

      // 1) pending_transactions → confirmed
      const { error: updateErr } = await supabase
        .from('pending_transactions')
        .update({
          status: 'confirmed',
          transaction_type: updates.transaction_type,
          category: updates.category,
          memo: updates.memo,
          amount: updates.amount,
        })
        .eq('id', id)
        .eq('user_id', userId);

      if (updateErr) {
        console.error('❌ [등록] pending 업데이트 실패:', updateErr);
        alert(`등록 실패: ${updateErr.message}`);
        return;
      }

      // 2) transactions 테이블에 삽입
      const typeKo =
        updates.transaction_type === 'income' ? '수입' :
        updates.transaction_type === 'expense' ? '지출' : '자산이체';

      const { error: insertErr } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          date: dateIso,
          asset,
          category: updates.category || typeKo,
          sub_category: null,
          transaction_type: typeKo,
          is_transfer: updates.transaction_type === 'transfer',
          transfer_asset: null,
          amount: safeAmount,
          memo: updates.memo || null,
          currency: 'KRW',
          source: 'app',
        });

      if (insertErr) {
        console.error('❌ [등록] transactions 삽입 실패:', insertErr);
        alert(`거래 등록 실패: ${insertErr.message}`);
        return;
      }

      console.log('✅ [등록] 성공:', id);
      // 3) dequeue
      setPendingQueue((q) => q.filter((p) => p.id !== id));
      setPendingCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('❌ [등록] 예외:', err);
      alert('등록 중 오류가 발생했습니다.');
    }
  }, [supabase, userId, pendingQueue]);

  // ── 나중에: 팝업 닫기 (큐 뒤로 이동 또는 임시 숨김) ──
  const handleSkipPending = useCallback((id: string) => {
    setPendingQueue((q) => {
      if (q.length <= 1) {
        // 1개뿐이면 빈 배열로 → 팝업 닫힘 (큐에서 완전 제거는 아님, 새로고침 시 다시 로드)
        return [];
      }
      const idx = q.findIndex((p) => p.id === id);
      if (idx < 0) return q;
      const item = q[idx];
      return [...q.slice(0, idx), ...q.slice(idx + 1), item];
    });
    console.log('⏭️ [나중에] 스킵:', id);
  }, []);

  // ── 임시저장: DB에 현재 편집 내용 저장 + 큐 뒤로 이동 ──
  const handleTempSavePending = useCallback(async (id: string, updates: {
    transaction_type: TransactionType | null;
    asset: string;
    memo: string;
    amount: number;
  }) => {
    if (!supabase || !userId) {
      console.error('❌ [임시저장] supabase 또는 userId 없음');
      alert('로그인 정보가 없습니다. 새로고침 후 다시 시도해주세요.');
      return;
    }

    try {
      const { error } = await supabase
        .from('pending_transactions')
        .update({
          transaction_type: updates.transaction_type,
          memo: updates.memo,
          amount: updates.amount,
        })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('❌ [임시저장] DB 업데이트 실패:', error);
        alert(`임시저장 실패: ${error.message}`);
        return;
      }

      console.log('💾 [임시저장] 성공:', id);

      // 큐에서 해당 아이템 업데이트 + 뒤로 이동 (또는 1개면 팝업 닫기)
      setPendingQueue((q) => {
        const idx = q.findIndex((p) => p.id === id);
        if (idx < 0) return q;
        const updatedItem: PendingTransaction = {
          ...q[idx],
          transaction_type: updates.transaction_type,
          memo: updates.memo,
          amount: updates.amount,
        };
        if (q.length <= 1) {
          // 1개뿐이면 팝업 닫기 (다음 로드 시 복원됨)
          return [];
        }
        return [...q.slice(0, idx), ...q.slice(idx + 1), updatedItem];
      });
    } catch (err) {
      console.error('❌ [임시저장] 예외:', err);
      alert('임시저장 중 오류가 발생했습니다.');
    }
  }, [supabase, userId]);

  // ── 삭제: DB에서 dismissed 처리 → 큐에서 제거 ──
  const handleDismissPending = useCallback(async (id: string) => {
    if (!supabase || !userId) {
      console.error('❌ [삭제] supabase 또는 userId 없음');
      alert('로그인 정보가 없습니다. 새로고침 후 다시 시도해주세요.');
      return;
    }

    try {
      const { error } = await supabase
        .from('pending_transactions')
        .update({ status: 'dismissed' })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('❌ [삭제] DB 업데이트 실패:', error);
        alert(`삭제 실패: ${error.message}`);
        return;
      }

      console.log('🗑️ [삭제] 성공:', id);
      setPendingQueue((q) => q.filter((p) => p.id !== id));
      setPendingCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('❌ [삭제] 예외:', err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  }, [supabase, userId]);

  const [selectedDate, setSelectedDate] = useState<string>(
    getKstDateString()
  );
  const [isEditMode, setIsEditMode] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isMealSectionExpanded, setIsMealSectionExpanded] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [allRecords, setAllRecords] = useState<DailyRecord[]>([]);
  const [weightPeriod, setWeightPeriod] = useState<PeriodFilter>('1month');
  const [isWeightListExpanded, setIsWeightListExpanded] = useState(false);
  const [weightInputModal, setWeightInputModal] = useState<{
    open: boolean;
    dateStr: string;
    weightText: string;
  }>({ open: false, dateStr: '', weightText: '' });
  const [isWeightModalSaving, setIsWeightModalSaving] = useState(false);
  
  // 루틴 관련 상태
  const [routineTemplates, setRoutineTemplates] = useState<RoutineTemplate[]>([]);
  const [routineChecks, setRoutineChecks] = useState<RoutineCheck[]>([]);
  const [routineValues, setRoutineValues] = useState<Record<string, number | null>>({});
  // 루틴 숫자/체크 즉시 연동을 위한 동기화 트리거
  const [routineSyncTick, setRoutineSyncTick] = useState(0);
  const bumpRoutineSync = useCallback(() => setRoutineSyncTick(t => t + 1), []);
  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);
  const [editModeRoutine, setEditModeRoutine] = useState<string | null>(null);
  
  // 식사 기록 목록
  const [mealRecords, setMealRecords] = useState<DailyRecord[]>([]);
  const [expandedMealMonth, setExpandedMealMonth] = useState<string | null>(null);
  const [mealRecordsPage, setMealRecordsPage] = useState(1);
  
  // 그래프에서 선택된 날짜의 식사 메모
  const [selectedChartDate, setSelectedChartDate] = useState<string | null>(null);
  const [selectedDateMealMemo, setSelectedDateMealMemo] = useState<string | null>(null);
  
  // 차트 팝업 편집 상태
  const [chartPopupWeight, setChartPopupWeight] = useState<string>('');
  const [chartPopupMemo, setChartPopupMemo] = useState<string>('');
  const [chartPopupImages, setChartPopupImages] = useState<string[]>([]);
  const [chartPopupSaving, setChartPopupSaving] = useState(false);
  const [chartPopupEditMode, setChartPopupEditMode] = useState(false);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const chartPopupFileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<DailyRecord>({
    date: selectedDate,
    weight: null,
    meal_breakfast: false,
    meal_lunch: false,
    meal_dinner: false,
    meal_memo: '',
    meal_images: [],
    daily_memo: '',
  });

  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // 날씨 관련 상태
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherSummary, setWeatherSummary] = useState<string | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [dailyRecordsError, setDailyRecordsError] = useState<string | null>(null);

  // 날씨 API 호출 함수
  const fetchWeather = useCallback(async () => {
    const apiKey = process.env.NEXT_PUBLIC_WEATHER_API_KEY;
    if (!apiKey) {
      setWeatherError('날씨 API 키가 설정되지 않았습니다. .env.local 파일에 NEXT_PUBLIC_WEATHER_API_KEY를 추가해주세요.');
      setIsLoadingWeather(false);
      return;
    }

    setIsLoadingWeather(true);
    setWeatherError(null);
    try {
      // 사용자의 위치를 가져오거나 기본값으로 서울 사용
      // 실제로는 geolocation API를 사용하거나 사용자가 설정한 위치를 사용할 수 있습니다
      const city = 'Seoul'; // 기본값: 서울
      const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric&lang=kr`;
      const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}&units=metric&lang=kr`;
      
      const [weatherRes, forecastRes] = await Promise.all([fetch(weatherUrl), fetch(forecastUrl)]);

      if (!weatherRes.ok) {
        const errorData = await weatherRes.json().catch(() => ({}));
        if (weatherRes.status === 401) {
          throw new Error('API 키가 유효하지 않습니다. OpenWeatherMap에서 발급한 키를 확인해주세요.');
        } else if (weatherRes.status === 404) {
          throw new Error('도시를 찾을 수 없습니다.');
        } else {
          throw new Error(errorData.message || '날씨 데이터를 가져오는데 실패했습니다.');
        }
      }

      const weather = await weatherRes.json();
      setWeatherData({
        temperature: Math.round(weather.main.temp),
        description: weather.weather[0].description,
        icon: weather.weather[0].icon,
        city: weather.name,
      });

      // 5일/3시간 예보 기반 "오늘 요약" 텍스트 생성
      if (forecastRes.ok) {
        const forecast = await forecastRes.json();
        const todayKst = getKstDateString();
        const todaySlots = (forecast.list || []).filter((item: any) =>
          String(item.dt_txt || '').startsWith(todayKst)
        );

        if (todaySlots.length > 0) {
          const afternoonSlots = todaySlots.filter((item: any) => {
            const hh = Number(String(item.dt_txt || '').slice(11, 13));
            return hh >= 12 && hh < 18;
          });
          const targetSlots = afternoonSlots.length > 0 ? afternoonSlots : todaySlots;

          const hasRain = targetSlots.some((item: any) => {
            const main = String(item.weather?.[0]?.main || '').toLowerCase();
            const id = Number(item.weather?.[0]?.id || 0);
            const pop = Number(item.pop || 0);
            return main.includes('rain') || (id >= 500 && id < 600) || pop >= 0.4;
          });

          const maxTemp = Math.round(Math.max(...todaySlots.map((i: any) => Number(i.main?.temp_max ?? i.main?.temp ?? 0))));
          const minTemp = Math.round(Math.min(...todaySlots.map((i: any) => Number(i.main?.temp_min ?? i.main?.temp ?? 0))));
          const maxPop = Math.max(...todaySlots.map((i: any) => Number(i.pop || 0)));

          let summary = `오늘 예상 기온은 최저 ${minTemp}°C, 최고 ${maxTemp}°C입니다.`;
          if (hasRain) {
            summary = `오늘은 오후부터 비가 예상됩니다. (강수확률 최대 ${Math.round(maxPop * 100)}%) ${summary}`;
          } else if (maxPop >= 0.2) {
            summary = `오늘은 대체로 흐리며 간헐적 약한 비 가능성이 있습니다. (강수확률 최대 ${Math.round(maxPop * 100)}%) ${summary}`;
          } else {
            summary = `오늘은 큰 비 예보 없이 ${weather.weather?.[0]?.description || '대체로 무난한'} 날씨입니다. ${summary}`;
          }
          setWeatherSummary(summary);
        } else {
          setWeatherSummary(null);
        }
      } else {
        setWeatherSummary(null);
      }
      setWeatherError(null);
    } catch (error: any) {
      // 네트워크/광고차단/회사망 등으로 fetch가 실패할 수 있음. (앱 기능과 무관하므로 조용히 실패 처리)
      console.warn('날씨 데이터 가져오기 실패:', error?.message || error);
      setWeatherError(error?.message || '날씨 정보를 불러올 수 없습니다.');
      setWeatherSummary(null);
    } finally {
      setIsLoadingWeather(false);
    }
  }, []);

  const handleInputChange = (
    field: keyof DailyRecord,
    value: string | number
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // 이미지 업로드 핸들러
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    console.log('📤 업로드 시작:', files?.length, '개 파일');
    
    if (!files || files.length === 0) {
      console.log('❌ 파일이 선택되지 않음');
      return;
    }
    
    if (!supabase) {
      console.error('❌ Supabase 연결 없음');
      alert('❌ Supabase 연결이 없습니다. 환경 변수를 확인해주세요.');
      return;
    }

    setIsUploadingImage(true);
    const uploadedUrls: string[] = [];
    let successCount = 0;
    let errorCount = 0;

    try {
      // Storage bucket 존재 확인
      console.log('📤 이미지 업로드 시작...');

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`📁 파일 ${i + 1}/${files.length}: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        
        // 파일 크기 체크 (5MB 제한)
        if (file.size > 5 * 1024 * 1024) {
          console.warn(`⚠️ 파일 크기 초과: ${file.name}`);
          alert(`❌ ${file.name}은(는) 너무 큽니다. 5MB 이하만 업로드 가능합니다.`);
          errorCount++;
          continue;
        }

        // 이미지 파일만 허용
        if (!file.type.startsWith('image/')) {
          console.warn(`⚠️ 이미지 파일 아님: ${file.name} (${file.type})`);
          alert(`❌ ${file.name}은(는) 이미지 파일이 아닙니다.`);
          errorCount++;
          continue;
        }

        // 파일명 생성 (타임스탬프 + 랜덤)
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${userId}/${formData.date}/${fileName}`;
        console.log(`📂 업로드 경로: ${filePath}`);

        // Storage에 업로드
        const { data, error } = await supabase.storage
          .from('meal-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) {
          console.error(`❌ 업로드 실패 (${file.name}):`, error);
          console.error('- 에러 메시지:', error.message);
          console.error('- 에러 상세:', error);
          
          let errorMsg = error.message;
          if (error.message.includes('row-level security')) {
            errorMsg = 'Storage 정책이 설정되지 않았습니다. DATABASE_SETUP.md를 참고하여 정책을 추가하세요.';
          } else if (error.message.includes('not found')) {
            errorMsg = 'Storage bucket을 찾을 수 없습니다.';
          }
          
          alert(`❌ ${file.name} 업로드 실패:\n${errorMsg}`);
          errorCount++;
          continue;
        }

        console.log(`✅ 업로드 성공 (${file.name}):`, data);

        // Public URL 가져오기
        const { data: urlData } = supabase.storage
          .from('meal-images')
          .getPublicUrl(filePath);

        console.log('🔗 Public URL:', urlData.publicUrl);
        uploadedUrls.push(urlData.publicUrl);
        successCount++;
      }

      if (uploadedUrls.length > 0) {
        // formData에 이미지 URL 추가
        setFormData(prev => ({
          ...prev,
          meal_images: [...(prev.meal_images || []), ...uploadedUrls]
        }));

        console.log('✅ 이미지 업로드 완료:', uploadedUrls);
        alert(`✅ ${successCount}개 이미지 업로드 완료!`);
      } else if (errorCount > 0) {
        alert(`❌ 모든 이미지 업로드 실패 (${errorCount}개)`);
      }
    } catch (err: any) {
      console.error('❌ 이미지 업로드 오류:', err);
      console.error('- 에러 타입:', typeof err);
      console.error('- 에러 메시지:', err?.message);
      console.error('- 전체 에러:', err);
      alert(`❌ 이미지 업로드 중 오류가 발생했습니다.\n\n${err?.message || '알 수 없는 오류'}`);
    } finally {
      setIsUploadingImage(false);
      // input 초기화
      e.target.value = '';
      console.log('🏁 업로드 프로세스 종료');
    }
  };

  // 이미지 삭제 핸들러
  const handleImageDelete = async (imageUrl: string) => {
    if (!supabase) return;
    
    try {
      // URL에서 파일 경로 추출
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split('/meal-images/');
      if (pathParts.length < 2) return;
      
      const filePath = pathParts[1];

      // Storage에서 삭제
      const { error } = await supabase.storage
        .from('meal-images')
        .remove([filePath]);

      if (error) {
        console.error('이미지 삭제 오류:', error);
        alert('❌ 이미지 삭제 실패');
        return;
      }

      // formData에서 제거
      setFormData(prev => ({
        ...prev,
        meal_images: (prev.meal_images || []).filter(url => url !== imageUrl)
      }));

      console.log('✅ 이미지 삭제 완료');
    } catch (err) {
      console.error('이미지 삭제 오류:', err);
      alert('❌ 이미지 삭제 중 오류가 발생했습니다.');
    }
  };


  // 루틴 템플릿 로드
  const loadRoutineTemplates = useCallback(async () => {
    if (!supabase || !userId) return;
    try {
      // type, unit, deleted_at 컬럼 포함하여 조회 시도 (deleted_at은 soft delete 용)
      let { data, error } = await supabase
        .from('routine_templates')
        .select('id, emoji, label, field_key, sort_order, user_id, type, unit, deleted_at, image_upload_enabled')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });

      // type 컬럼이 없는 경우 재시도
      if (error && (error.message.includes('column') || error.code === '42703')) {
        console.warn('⚠️ type 또는 unit 컬럼이 없습니다. 마이그레이션 없이 계속 진행합니다.');
        const result = await supabase
          .from('routine_templates')
          .select('id, emoji, label, field_key, sort_order, user_id')
          .eq('user_id', userId)
          .order('sort_order', { ascending: true });
        
        // type, unit 필드 추가
        data = (result.data || []).map(t => ({ ...t, type: 'checkbox' as const, unit: undefined, deleted_at: null, image_upload_enabled: false }));
        error = result.error;
      }

      if (error) {
        console.error('루틴 템플릿 조회 오류');
        if (error?.message) console.error('- 메시지:', error.message);
        if (error?.code) console.error('- 코드:', error.code);
        if (error?.details) console.error('- 상세:', error.details);
        if (error?.hint) console.error('- 힌트:', error.hint);
        return;
      }

      // type, unit 필드가 없는 경우 기본값 설정
      const templatesWithType = (data || [])
        .filter((t: any) => !t.deleted_at) // 안전장치 (쿼리에서 걸렀지만 방어)
        .map(t => ({
        ...t,
        type: t.type || 'checkbox' as 'checkbox' | 'number',
        unit: t.unit || undefined,
        image_upload_enabled: t.image_upload_enabled ?? false
      }));
      setRoutineTemplates(templatesWithType);
    } catch (err) {
      console.error('예상치 못한 오류:', err);
    }
  }, [supabase, userId]);

  // 특정 날짜의 루틴 체크 상태 로드
  const loadRoutineChecks = useCallback(async (date: string) => {
    if (!supabase || !userId) return;
    try {
      console.log('📋 루틴 체크 로드 시작:', date);
      const { data, error } = await supabase
        .from('daily_routine_checks')
        .select('routine_id, checked, value')
        .eq('date', date)
        .eq('user_id', userId);

      if (error) {
        // PGRST116은 "no rows returned" 에러로, 데이터가 없을 때 발생하는 정상적인 상황
        if (error.code === 'PGRST116') {
          console.log('📋 루틴 체크 데이터 없음 (정상):', date);
          setRoutineChecks([]);
          return;
        }
        
        // 실제 에러인 경우에만 상세 로깅
        console.error('루틴 체크 조회 오류');
        if (error?.message) console.error('- 메시지:', error.message);
        if (error?.code) console.error('- 코드:', error.code);
        if (error?.details) console.error('- 상세:', error.details);
        if (error?.hint) console.error('- 힌트:', error.hint);
        return;
      }

      console.log('✅ 루틴 체크 로드 완료:', date, '개수:', data?.length || 0, '데이터:', data);
      setRoutineChecks(data || []);
      
      // 루틴 값 추출하여 state에 저장
      const values: Record<string, number | null> = {};
      if (data) {
        data.forEach((check: any) => {
          values[check.routine_id] = check.value ?? null;
        });
      }
      setRoutineValues(values);
    } catch (err) {
      console.error('예상치 못한 오류:', err);
    }
  }, [supabase, userId]);

  const loadDailyRecord = useCallback(async (date: string) => {
    if (!supabase || !userId) return;
    try {
      setDailyRecordsError(null);
      // meal_images 포함하여 조회 시도
      let { data, error } = await supabase
        .from('daily_records')
        .select('id, date, weight, meal_breakfast, meal_lunch, meal_dinner, meal_memo, meal_images, daily_memo, created_at, updated_at')
        .eq('date', date)
        .eq('user_id', userId)
        .maybeSingle();

      // meal_images 컬럼이 없는 경우 재시도
      if (error && error.code !== 'PGRST116' && (error.message.includes('column') || error.code === '42703')) {
        console.warn('⚠️ meal_images 컬럼이 없습니다. 마이그레이션 없이 계속 진행합니다.');
        const result = await supabase
          .from('daily_records')
          .select('id, date, weight, meal_breakfast, meal_lunch, meal_dinner, meal_memo, daily_memo, created_at, updated_at')
          .eq('date', date)
          .eq('user_id', userId)
          .maybeSingle();
        
        data = result.data ? { ...result.data, meal_images: [] } : null;
        error = result.error;
      }

      if (error && error.code !== 'PGRST116') {
        console.error('데이터 조회 오류');
        setDailyRecordsError(error.message || 'daily_records 조회 오류');
        if (error?.message) console.error('- 메시지:', error.message);
        if (error?.code) console.error('- 코드:', error.code);
        if (error?.details) console.error('- 상세:', error.details);
        if (error?.hint) console.error('- 힌트:', error.hint);
        return;
      }

      if (data) {
        setFormData({
          ...data,
          meal_images: data.meal_images || []
        });
        setHasData(true);
        setIsEditMode(false);
      } else {
        setFormData({
          date: date,
          weight: null,
          meal_breakfast: false,
          meal_lunch: false,
          meal_dinner: false,
          meal_memo: '',
          meal_images: [],
          daily_memo: '',
        });
        setHasData(false);
        setIsEditMode(true);
      }
    } catch (err) {
      console.error('예상치 못한 오류:', err);
      setDailyRecordsError((err as any)?.message || 'daily_records 로드 중 오류');
    }
  }, [supabase, userId]);

  // 식사 기록 로드
  const loadMealRecords = useCallback(async () => {
    if (!supabase || !userId) return;
    try {
      setDailyRecordsError(null);
      // meal_images 포함하여 조회 시도
      let { data, error } = await supabase
        .from('daily_records')
        .select('id, date, weight, meal_breakfast, meal_lunch, meal_dinner, meal_memo, meal_images, daily_memo, created_at, updated_at')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(50);

      // meal_images 컬럼이 없는 경우 재시도
      if (error && (error.message.includes('column') || error.code === '42703')) {
        console.warn('⚠️ meal_images 컬럼이 없습니다. 마이그레이션 없이 계속 진행합니다.');
        const result = await supabase
          .from('daily_records')
          .select('id, date, weight, meal_breakfast, meal_lunch, meal_dinner, meal_memo, daily_memo, created_at, updated_at')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(50);
        
        data = result.data ? result.data.map(r => ({ ...r, meal_images: [] })) : null;
        error = result.error;
      }

      if (error) {
        console.error('식사 기록 조회 오류:', error);
        setDailyRecordsError(error.message || 'daily_records(식사 기록) 조회 오류');
        return;
      }

      // 식사 관련 데이터가 있는 기록만 필터링 (최근 20개)
      const filteredRecords = (data || [])
        .filter(record => 
          record.meal_breakfast || record.meal_lunch || record.meal_dinner || (record.meal_memo && record.meal_memo.trim() !== '')
        )
        .map(record => ({
          ...record,
          meal_images: record.meal_images || []
        }))
        .slice(0, 20);

      setMealRecords(filteredRecords);
    } catch (err) {
      console.error('식사 기록 로드 오류:', err);
      setDailyRecordsError((err as any)?.message || 'daily_records(식사 기록) 로드 중 오류');
    }
  }, [supabase, userId]);

  const loadAllRecords = useCallback(async () => {
    if (!supabase || !userId) {
      console.warn('Supabase 클라이언트가 없습니다.');
      return;
    }
    try {
      setDailyRecordsError(null);
      // meal_images 포함하여 조회 시도
      let { data, error } = await supabase
        .from('daily_records')
        .select('id, date, weight, meal_breakfast, meal_lunch, meal_dinner, meal_memo, meal_images, daily_memo, created_at, updated_at')
        .eq('user_id', userId)
        .order('date', { ascending: true });

      // meal_images 컬럼이 없는 경우 (마이그레이션 전) 재시도
      if (error && (error.message.includes('column') || error.code === '42703')) {
        console.warn('⚠️ meal_images 컬럼이 없습니다. 마이그레이션 없이 계속 진행합니다.');
        const result = await supabase
          .from('daily_records')
          .select('id, date, weight, meal_breakfast, meal_lunch, meal_dinner, meal_memo, daily_memo, created_at, updated_at')
          .eq('user_id', userId)
          .order('date', { ascending: true });
        
        data = result.data ? result.data.map(r => ({ ...r, meal_images: [] })) : null;
        error = result.error;
      }

      if (error) {
        console.error('전체 데이터 조회 오류');
        setDailyRecordsError(error.message || 'daily_records 전체 조회 오류');
        if (error?.message) console.error('- 메시지:', error.message);
        if (error?.code) console.error('- 코드:', error.code);
        if (error?.details) console.error('- 상세:', error.details);
        if (error?.hint) console.error('- 힌트:', error.hint);
        return;
      }

      // 날짜 형식 정규화 (YYYY-MM-DD로 통일)
      const normalizedData = (data || []).map(record => ({
        ...record,
        meal_images: record.meal_images || [], // meal_images가 없으면 빈 배열
        date: record.date.includes('T') 
          ? record.date.split('T')[0] 
          : (record.date.includes(' ') ? record.date.split(' ')[0] : record.date)
      }));
      
      setAllRecords(normalizedData);
    } catch (err) {
      console.error('예상치 못한 오류:', err);
      setDailyRecordsError((err as any)?.message || 'daily_records 전체 로드 중 오류');
    }
  }, [supabase, userId]);

  useEffect(() => {
    loadRoutineTemplates();
  }, [loadRoutineTemplates]);

  // 페이지 포커스 시 루틴 템플릿 다시 로드 (설정 페이지에서 변경 시 동기화)
  useEffect(() => {
    const handleFocus = () => {
      loadRoutineTemplates();
    };

    window.addEventListener('focus', handleFocus);
    
    // 주기적으로 루틴 템플릿 확인 (30초마다)
    const interval = setInterval(() => {
      loadRoutineTemplates();
    }, 30000);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [loadRoutineTemplates]);

  // userId가 준비된 이후에만 데이터 로드 (로그인 전환 후 "데이터 없음" 방지)
  useEffect(() => {
    if (!userId) return;
    loadAllRecords();
    loadMealRecords();
    fetchWeather().catch(() => {});
  }, [userId, loadAllRecords, loadMealRecords, fetchWeather]);

  // 날짜 변경 시 데이터 로드
  useEffect(() => {
    if (!userId) return;
    loadDailyRecord(selectedDate);
    loadRoutineChecks(selectedDate);
  }, [userId, selectedDate, loadDailyRecord, loadRoutineChecks]);

  // 루틴 체크박스 상태 확인
  const isRoutineChecked = (routineId: string): boolean => {
    return routineChecks.some(check => check.routine_id === routineId && check.checked);
  };

  // 루틴 체크박스 토글
  const handleRoutineCheckChange = (routineId: string) => {
    const isChecked = isRoutineChecked(routineId);
    console.log('🔄 루틴 체크 변경:', routineId, '현재 상태:', isChecked, '→', !isChecked);
    setRoutineChecks(prev => {
      const existing = prev.find(c => c.routine_id === routineId);
      let newChecks;
      if (existing) {
        newChecks = prev.map(c => 
          c.routine_id === routineId ? { ...c, checked: !c.checked } : c
        );
      } else {
        newChecks = [...prev, { routine_id: routineId, checked: true }];
      }
      console.log('✅ 업데이트된 routineChecks:', newChecks);
      return newChecks;
    });
  };

  const handleCheckboxChange = (field: keyof DailyRecord) => {
    setFormData((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const openWeightModal = () => {
    // 항상 현재 날짜(오늘)로 설정
    const today = getKstDateString();
    const current = typeof formData?.weight === 'number' ? formData.weight : null;
    setWeightInputModal({
      open: true,
      dateStr: today,
      weightText: current != null ? current.toFixed(1) : '',
    });
  };

  const saveWeightForDate = async (dateStr: string, weightText: string) => {
    if (!supabase) {
      alert('❌ Supabase 연결이 설정되지 않았습니다.');
      return;
    }
    if (!userId) {
      alert('❌ 로그인 정보가 없습니다. 다시 로그인 후 시도해주세요.');
      return;
    }

    const normalizedDate = dateStr.includes('T')
      ? dateStr.split('T')[0]
      : (dateStr.includes(' ') ? dateStr.split(' ')[0] : dateStr);

    const trimmed = String(weightText ?? '').trim();
    const hasValue = trimmed !== '';

    let weightValue: number | null = null;
    if (hasValue) {
      const parsed = parseFloat(trimmed);
      if (Number.isNaN(parsed)) {
        alert('올바른 숫자를 입력해주세요.');
        return;
      }
      weightValue = Math.round(parsed * 10) / 10; // 소수점 1자리
    }

    setIsWeightModalSaving(true);
    setMessage('');
    try {
      const { data: existingData, error: checkError } = await supabase
        .from('daily_records')
        .select('id')
        .eq('date', normalizedDate)
        .eq('user_id', userId)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('체중 저장 - 레코드 확인 오류:', checkError);
        throw checkError;
      }

      if (existingData) {
        const { error } = await supabase
          .from('daily_records')
          .update({
            weight: weightValue,
            updated_at: new Date().toISOString(),
          })
          .eq('date', normalizedDate)
          .eq('user_id', userId);

        if (error) {
          console.error('체중 저장 - 업데이트 오류:', error);
          throw error;
        }
      } else {
        const baseInsert: any = {
          date: normalizedDate,
          user_id: userId,
          weight: weightValue,
          meal_breakfast: false,
          meal_lunch: false,
          meal_dinner: false,
          meal_memo: '',
          daily_memo: '',
          updated_at: new Date().toISOString(),
        };

        const first = await supabase
          .from('daily_records')
          .insert([{ ...baseInsert, meal_images: [] }]);

        if (first.error) {
          if (first.error.code === '42703' || String(first.error.message || '').includes('column')) {
            const second = await supabase.from('daily_records').insert([baseInsert]);
            if (second.error) {
              console.error('체중 저장 - 삽입 오류(재시도):', second.error);
              throw second.error;
            }
          } else {
            console.error('체중 저장 - 삽입 오류:', first.error);
            throw first.error;
          }
        }
      }

      setAllRecords(prev => {
        const normalizedPrev = prev.map(r => ({
          ...r,
          date: r.date.includes('T') ? r.date.split('T')[0] : (r.date.includes(' ') ? r.date.split(' ')[0] : r.date),
        }));
        const idx = normalizedPrev.findIndex(r => r.date === normalizedDate);
        if (idx >= 0) {
          const updated = [...normalizedPrev];
          updated[idx] = {
            ...updated[idx],
            weight: weightValue,
            updated_at: new Date().toISOString(),
          } as DailyRecord;
          return updated;
        }
        return [
          ...normalizedPrev,
          {
            id: (globalThis as any).crypto?.randomUUID?.() ?? `local-${Date.now()}`,
            date: normalizedDate,
            weight: weightValue,
            meal_breakfast: false,
            meal_lunch: false,
            meal_dinner: false,
            meal_memo: '',
            daily_memo: '',
            updated_at: new Date().toISOString(),
          } as DailyRecord,
        ];
      });

      if (normalizedDate === selectedDate) {
        setFormData(prev => ({
          ...prev,
          date: normalizedDate,
          weight: weightValue,
        }));
      }

      setMessage('✅ 체중이 저장되었습니다!');
      loadAllRecords();
      setTimeout(() => setMessage(''), 2500);
    } catch (err: any) {
      const msg = err?.message || '알 수 없는 오류';
      setMessage(`❌ 저장 실패: ${msg}`);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setIsWeightModalSaving(false);
    }
  };


  const handleSave = async () => {
    if (!supabase) {
      setMessage('❌ Supabase 연결이 설정되지 않았습니다. 환경 변수를 확인해주세요.');
      return;
    }
    if (!userId) {
      setMessage('❌ 로그인 정보가 없습니다. 다시 로그인 후 시도해주세요.');
      return;
    }
    
    setIsSaving(true);
    setMessage('');

    try {
      // 1. daily_records 저장 (formData.date 사용)
      const { data: existingData, error: checkError } = await supabase
        .from('daily_records')
        .select('id')
        .eq('date', formData.date)
        .eq('user_id', userId)
        .maybeSingle();

      // ✅ 에러 상세 로깅 추가
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('=== 체크 에러 상세 ===');
        console.error('메시지:', checkError.message);
        console.error('코드:', checkError.code);
        console.error('상세:', checkError.details);
        console.error('힌트:', checkError.hint);
        console.error('전체:', JSON.stringify(checkError, null, 2));
        throw checkError;
      }

      if (existingData) {
        const { error } = await supabase
          .from('daily_records')
          .update({
            ...formData,
            user_id: userId,
            updated_at: new Date().toISOString(),
          })
          .eq('date', formData.date)
          .eq('user_id', userId);

        if (error) {
          console.error('=== 업데이트 에러 상세 ===');
          console.error('메시지:', error.message);
          console.error('코드:', error.code);
          console.error('상세:', error.details);
          console.error('힌트:', error.hint);
          console.error('전체:', JSON.stringify(error, null, 2));
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('daily_records')
          .insert([{ ...formData, user_id: userId }]);

        if (error) {
          console.error('=== 삽입 에러 상세 ===');
          console.error('메시지:', error.message);
          console.error('코드:', error.code);
          console.error('상세:', error.details);
          console.error('힌트:', error.hint);
          console.error('전체:', JSON.stringify(error, null, 2));
          throw error;
        }
      }

      // 2. 루틴 체크 저장 (formData.date 사용)
      console.log('📋 루틴 체크 저장 시작:', formData.date, 'routineChecks:', routineChecks);
      const { error: deleteError } = await supabase
        .from('daily_routine_checks')
        .delete()
        .eq('date', formData.date)
        // ✅ 로그인 도입 이후: 다른 사용자 데이터까지 삭제되지 않도록 user_id로 스코프 제한
        .eq('user_id', userId);

      if (deleteError) {
        console.error('=== 루틴 체크 삭제 에러 상세 ===');
        console.error('메시지:', deleteError.message);
        console.error('코드:', deleteError.code);
        console.error('상세:', deleteError.details);
        console.error('힌트:', deleteError.hint);
        console.error('전체:', JSON.stringify(deleteError, null, 2));
        throw deleteError;
      }

      const checksToInsert = routineChecks
        .filter(check => check.checked)
        .map(check => ({
          // ✅ RLS/멀티유저 대응: 반드시 user_id 포함
          user_id: userId,
          date: formData.date,
          routine_id: check.routine_id,
          checked: true,
          value: routineValues[check.routine_id] ?? null,
        }));

      console.log('📋 삽입할 루틴 체크:', checksToInsert);

      if (checksToInsert.length > 0) {
        const { error: checkError } = await supabase
          .from('daily_routine_checks')
          .insert(checksToInsert);

        if (checkError) {
          console.error('=== 루틴 체크 삽입 에러 상세 ===');
          console.error('메시지:', checkError.message);
          console.error('코드:', checkError.code);
          console.error('상세:', checkError.details);
          console.error('힌트:', checkError.hint);
          console.error('전체:', JSON.stringify(checkError, null, 2));
          throw checkError;
        }
        console.log('✅ 루틴 체크 저장 완료:', checksToInsert.length, '개');
      } else {
        console.log('⚠️ 저장할 루틴 체크 없음 (모두 체크 해제됨)');
      }

      setMessage('✅ 저장되었습니다!');
      setIsEditMode(false);
      setHasData(true);
      // 저장된 날짜로 selectedDate 업데이트 (상단 날짜 필드와 동기화)
      setSelectedDate(formData.date);
      
      // 날짜 형식 정규화
      const normalizedFormData = {
        ...formData,
        date: formData.date.includes('T') 
          ? formData.date.split('T')[0] 
          : (formData.date.includes(' ') ? formData.date.split(' ')[0] : formData.date)
      };
      
      // allRecords 즉시 업데이트 (저장된 데이터 반영)
      setAllRecords(prev => {
        // 이전 데이터도 날짜 형식 정규화
        const normalizedPrev = prev.map(r => ({
          ...r,
          date: r.date.includes('T') ? r.date.split('T')[0] : (r.date.includes(' ') ? r.date.split(' ')[0] : r.date)
        }));
        
        const existingIndex = normalizedPrev.findIndex(r => r.date === normalizedFormData.date);
        if (existingIndex >= 0) {
          // 기존 레코드 업데이트
          const updated = [...normalizedPrev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            ...normalizedFormData,
            updated_at: new Date().toISOString(),
          } as DailyRecord;
          return updated;
        } else {
          // 새 레코드 추가
          return [...normalizedPrev, {
            ...normalizedFormData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as DailyRecord];
        }
      });
      
      // 데이터 새로고침 (백그라운드에서 실행)
      loadAllRecords();
      loadMealRecords();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      console.error('=== 최종 에러 캐치 ===');
      console.error('타입:', typeof err);
      console.error('전체 에러:', err);
      
      let errorMessage = '알 수 없는 오류가 발생했습니다.';
      
      if (err?.message) {
        errorMessage = err.message;
        
        // 구체적인 에러 메시지 처리
        if (err.message.includes('new row violates row-level security policy')) {
          errorMessage = '데이터 저장 권한이 없습니다. Supabase RLS 정책을 확인해주세요.';
        } else if (err.message.includes('duplicate key value')) {
          errorMessage = '이미 존재하는 데이터입니다.';
        } else if (err.message.includes('violates foreign key constraint')) {
          errorMessage = '참조 데이터가 존재하지 않습니다.';
        }
      }
      
      setMessage(`❌ 저장 실패: ${errorMessage}`);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = () => {
    setIsEditMode(true);
  };

  // 체중 그래프 데이터 필터링
  const getWeightChartData = () => {
    const now = new Date();
    let startDate = new Date();

    switch (weightPeriod) {
      case '7days':
        startDate.setDate(now.getDate() - 7);
        break;
      case '1month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case '1year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'all':
        const allData = allRecords
          .filter((r) => r.weight !== null)
          .map((r) => ({
            date: r.date,
            weight: r.weight,
          }));
        console.log('전체 데이터 필터링 결과:', allData.length, '개');
        return allData;
    }

    const filtered = allRecords
      .filter((r) => {
        const recordDate = new Date(r.date);
        return r.weight !== null && recordDate >= startDate;
      })
      .map((r) => ({
        date: r.date,
        weight: r.weight,
      }));
    console.log(`${weightPeriod} 필터링 결과:`, filtered.length, '개');
    return filtered;
  };




  // 환경 변수 오류 표시
  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    return (
      <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-[412px] w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 sm:p-6">
          <h2 className="text-xl font-bold text-red-800 dark:text-red-400 mb-4">
            ⚠️ 환경 변수 오류
          </h2>
          <p className="text-red-700 dark:text-red-300 mb-4">
            Supabase 환경 변수가 설정되지 않았습니다.
          </p>
          <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded p-4 mb-4">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              다음 환경 변수가 필요합니다:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-3">
              <li>
                NEXT_PUBLIC_SUPABASE_URL: {supabaseUrl ? (
                  <span className="text-green-600">✅ 설정됨 ({supabaseUrl.substring(0, 30)}...)</span>
                ) : (
                  <span className="text-red-600">❌ 없음</span>
                )}
              </li>
              <li>
                NEXT_PUBLIC_SUPABASE_ANON_KEY: {supabaseAnonKey ? (
                  <span className="text-green-600">✅ 설정됨 (길이: {supabaseAnonKey.length})</span>
                ) : (
                  <span className="text-red-600">❌ 없음</span>
                )}
              </li>
            </ul>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded p-3 mb-4">
            <p className="text-xs text-yellow-800 dark:text-yellow-300">
              💡 <strong>해결 방법:</strong>
            </p>
            <ol className="text-xs text-yellow-700 dark:text-yellow-400 mt-2 space-y-1 list-decimal list-inside">
              <li>Vercel 대시보드 → Settings → Environment Variables 확인</li>
              <li>환경 변수 추가 후 <strong>반드시 재배포</strong> (Redeploy) 필요</li>
              <li>브라우저 콘솔(F12)에서 환경 변수 상태 확인</li>
            </ol>
          </div>
          <p className="text-sm text-red-600 dark:text-red-400">
            Vercel에 배포된 경우, 프로젝트 설정 → Environment Variables에서 확인하세요.
          </p>
        </div>
      </div>
    );
  }

  // 전역 로그인 필수 전환: userId가 아직 로드되지 않았으면 잠시 대기
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-[412px] w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-6 text-center">
          <div className="text-sm text-gray-700 dark:text-gray-300">로그인 정보 확인 중...</div>
        </div>
      </div>
    );
  }

  // 인증 완료 후 userId가 없으면 에러 표시
  if (!userId) {
    return (
      <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-[412px] w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-6 text-center">
          <div className="text-sm text-red-600 dark:text-red-400 mb-4">
            ❌ 로그인 정보를 확인할 수 없습니다.
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            브라우저 콘솔(F12)에서 에러를 확인하세요.
          </div>
          <a
            href="/login"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            로그인 페이지로 이동
          </a>
        </div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <SwipeNav>
      <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-20">
        {/* 가계부 미처리 건수 배지 (상단 고정 간단 표시) */}
        {pendingCount > 0 && (
          <div className="sticky top-0 z-40">
            <div className="max-w-[412px] mx-auto px-4 pt-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600 text-white text-xs font-semibold shadow">
                <span>가계부</span>
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white text-red-600 font-bold text-[11px]">
                  {pendingCount}
                </span>
              </div>
            </div>
          </div>
        )}
        {/* SMS Pending Popup (modal) — key로 아이템 전환 시 컴포넌트 리셋 */}
        {currentPopup && (
          <PendingSmsPopup
            key={currentPopup.id}
            item={currentPopup}
            onConfirm={handleConfirmPending}
            onTempSave={handleTempSavePending}
            onSkip={handleSkipPending}
            onDismiss={handleDismissPending}
          />
        )}
        {/* 체중 입력 모달 */}
        {weightInputModal.open && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            role="dialog"
            aria-modal="true"
            aria-label="체중 입력"
          >
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setWeightInputModal({ open: false, dateStr: '', weightText: '' })}
            />
            <div className="relative w-full max-w-[412px] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">체중 기록</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  날짜를 선택하고 체중을 입력해주세요.
                </div>
              </div>

              <div className="px-4 py-4 space-y-3">
                {/* 날짜 선택 */}
                <div className="relative">
                  <input
                    type="date"
                    value={weightInputModal.dateStr}
                    onChange={(e) =>
                      setWeightInputModal(prev => ({ ...prev, dateStr: e.target.value }))
                    }
                    className="w-full px-4 py-3 text-base bg-transparent text-transparent border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[44px] cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
                    style={{ color: 'transparent', WebkitAppearance: 'none' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if ((e.currentTarget as any).showPicker) {
                        try {
                          (e.currentTarget as any).showPicker();
                        } catch {}
                      }
                    }}
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-sm text-gray-900 dark:text-white font-medium whitespace-nowrap">
                    {(() => {
                      const d = new Date(weightInputModal.dateStr);
                      const year = d.getFullYear();
                      const month = d.getMonth() + 1;
                      const day = d.getDate();
                      return `${year}년 ${month}월 ${day}일`;
                    })()}
                  </div>
                </div>

                {/* 체중 입력 */}
                <div>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={weightInputModal.weightText}
                    onChange={(e) =>
                      setWeightInputModal(prev => ({ ...prev, weightText: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setWeightInputModal({ open: false, dateStr: '', weightText: '' });
                        return;
                      }
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveWeightForDate(weightInputModal.dateStr, weightInputModal.weightText).then(
                          () => setWeightInputModal({ open: false, dateStr: '', weightText: '' })
                        );
                      }
                    }}
                    placeholder="예: 85.5"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-[rgb(254,252,247)] dark:bg-gray-800 text-gray-900 dark:text-white text-base focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                    소수점 1자리까지 저장됩니다. (예: 85.54 → 85.5)
                  </div>
                </div>
              </div>

              <div className="px-4 pb-4 flex gap-2 justify-end">
                <button
                  className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => setWeightInputModal({ open: false, dateStr: '', weightText: '' })}
                  disabled={isWeightModalSaving}
                >
                  취소
                </button>
                <button
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={isWeightModalSaving}
                  onClick={async () => {
                    await saveWeightForDate(weightInputModal.dateStr, weightInputModal.weightText);
                    setWeightInputModal({ open: false, dateStr: '', weightText: '' });
                  }}
                >
                  {isWeightModalSaving ? '저장중' : '저장'}
                </button>
              </div>
            </div>
          </div>
        )}

        <GlobalNav />
        <div className={APP_CONTENT_CONTAINER}>

        <div className="space-y-2">
          {/* 입력 섹션 */}
          <div>
            {/* 날짜, 체중 입력, 수정 버튼 한 줄 배치 */}
            <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 mb-2">
              <div className="flex gap-1 sm:gap-1.5">
                {/* 날짜 입력 */}
                <div 
                  className="relative cursor-pointer flex-1 min-w-0"
                  onClick={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.querySelector('input[type="date"]') as HTMLInputElement;
                    if (input) {
                      input.focus();
                      // showPicker는 readOnly가 아닌 input에서만 작동
                      if (input.showPicker) {
                        try {
                          input.showPicker();
                        } catch (err) {
                          // showPicker 실패 시 click으로 대체
                          input.click();
                        }
                      } else {
                        input.click();
                      }
                    }
                  }}
                >
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={async (e) => {
                      const newDate = e.target.value;
                      console.log('📅 상단 날짜 변경:', newDate);
                      setSelectedDate(newDate);
                      // formData.date도 함께 업데이트
                      setFormData(prev => ({ ...prev, date: newDate }));
                    }}
                    className="w-[150px] px-1.5 sm:px-3 py-3 text-base bg-transparent text-transparent border-0 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[44px] cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
                    style={{ color: 'transparent', WebkitAppearance: 'none' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (e.currentTarget.showPicker) {
                        try {
                          e.currentTarget.showPicker();
                        } catch (err) {
                          // 에러 무시 (브라우저가 자동으로 처리)
                        }
                      }
                    }}
                  />
                  {/* 날짜 포맷 표시 (오버레이) - 한 줄로 정렬, 전체 텍스트 표시 */}
                  <div className="absolute left-1.5 sm:left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[14px] text-gray-900 dark:text-white font-medium whitespace-nowrap" style={{ lineHeight: '22px' }}>
                    {(() => {
                      const [year, month = '01', day = '01'] = selectedDate.split('-');
                      return `${year}-${month}-${day}`;
                    })()}
                  </div>
                </div>
            {/* 체중 입력 */}
            <input
              type="number"
              step="0.1"
              value={formData.weight || ''}
              onChange={(e) =>
                handleInputChange('weight', e.target.value ? parseFloat(e.target.value) : '')
              }
              placeholder="체중"
              readOnly={!isEditMode}
              onClick={() => {
                if (!isEditMode) openWeightModal();
              }}
              className={`w-10 sm:w-14 px-1 sm:px-1.5 py-3 text-[14px] bg-transparent text-gray-900 dark:text-white border-0 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[44px] ${
                !isEditMode ? 'cursor-pointer' : ''
              }`}
            />
            {/* 수정/저장 버튼 */}
                {!isEditMode ? (
                  <button
                    onClick={handleEdit}
                className="w-10 sm:w-12 px-1.5 sm:px-2 py-3 text-base bg-transparent text-gray-900 dark:text-white border-0 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 focus:ring-2 focus:ring-blue-500 outline-none min-h-[44px] transition-colors flex items-center justify-center"
                aria-label="수정하기"
                  >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                  </button>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                className="w-10 sm:w-12 px-1.5 sm:px-2 py-3 text-base bg-transparent text-gray-900 dark:text-white border-0 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 min-h-[44px] disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                aria-label={isSaving ? '저장 중' : '저장'}
                  >
                {isSaving ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                )}
                  </button>
                )}
                
                {/* 체중 기록 버튼: 상단(오늘) 입력 줄 오른쪽 */}
                <button
                  onClick={() => setIsWeightListExpanded(!isWeightListExpanded)}
                  className={`w-auto flex items-center justify-center py-3 px-0.5 sm:px-1 rounded-lg transition-colors min-h-[44px] flex-shrink-0 ${
                    isWeightListExpanded
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-900 dark:text-white'
                  }`}
                  title="체중 기록"
                  aria-label="체중 기록"
                >
                  <div className="text-[10px] sm:text-[11px] font-semibold whitespace-nowrap">기록</div>
                </button>
              </div>
              {/* 날씨 정보 표시 */}
              {weatherData && (
                <>
                  <div className="mt-3 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="text-lg">
                      {weatherData.icon && (
                        <img 
                          src={`https://openweathermap.org/img/wn/${weatherData.icon}@2x.png`} 
                          alt={weatherData.description}
                          className="w-8 h-8"
                        />
                      )}
                    </span>
                    <span className="font-medium">{weatherData.temperature}°C</span>
                    <span className="text-gray-500 dark:text-gray-400">•</span>
                    <span>{weatherData.description}</span>
                    <span className="text-gray-500 dark:text-gray-400">•</span>
                    <span className="text-gray-600 dark:text-gray-400">{weatherData.city}</span>
                  </div>
                  {weatherSummary && (
                    <div className="mt-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 px-1 py-1">
                      {weatherSummary}
                    </div>
                  )}
                </>
              )}
              {isLoadingWeather && (
                <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  날씨 정보를 불러오는 중...
                </div>
              )}
              {weatherError && !isLoadingWeather && (
                <div className="mt-3 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2">
                    <span>⚠️</span>
                    <div className="flex-1">
                      <div className="font-medium mb-1">날씨 정보를 불러올 수 없습니다</div>
                      <div className="text-amber-700 dark:text-amber-300">{weatherError}</div>
                      <div className="mt-2 text-amber-600 dark:text-amber-400">
                        <a 
                          href="https://openweathermap.org/api" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="underline hover:text-amber-800 dark:hover:text-amber-200"
                        >
                          OpenWeatherMap에서 무료 API 키 발급하기 →
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {message && (
                <div className="mt-3 text-center text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">{message}</div>
              )}
              
              {/* 체중 기록 드롭다운 */}
              <div className="mt-3">
                {isWeightListExpanded && (
                  allRecords.filter(r => r.weight != null).length === 0 ? (
                    <div className="text-xs text-gray-500 dark:text-gray-400 py-2">표시할 체중 기록이 없습니다.</div>
                  ) : (
                    <div className="max-h-80 overflow-auto space-y-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2">
                      <div className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1 border-b border-gray-200 dark:border-gray-700 mb-1">
                        총 {allRecords.filter(r => r.weight != null).length}개 기록
                      </div>
                      {[...allRecords]
                        .filter(r => r.weight != null)
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((r) => {
                          const dateObj = new Date(r.date);
                          const formattedDate = `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일`;
                          const hasImages = r.meal_images && r.meal_images.length > 0;
                          const hasMemo = r.meal_memo && r.meal_memo.trim() !== '';
                          
                          return (
                            <div
                              key={r.date}
                              onClick={() => {
                                // 클릭 시 편집 팝업 열기
                                setSelectedChartDate(r.date);
                                setChartPopupWeight(r.weight?.toString() || '');
                                setChartPopupMemo(r.meal_memo || '');
                                setChartPopupImages(r.meal_images || []);
                                setTimeout(() => {
                                  const popup = document.getElementById('chart-edit-popup');
                                  if (popup) {
                                    popup.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }
                                }, 100);
                              }}
                              className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all"
                            >
                              {/* 날짜 & 체중 */}
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{formattedDate}</span>
                                <span className="text-sm font-bold text-red-500 dark:text-red-400">{r.weight}kg</span>
                              </div>
                              
                              {/* 사진 썸네일 */}
                              {hasImages && (
                                <div className="flex gap-1 mb-2">
                                  {r.meal_images!.slice(0, 4).map((url, idx) => (
                                    <div key={idx} className="relative w-10 h-10 rounded overflow-hidden">
                                      <img 
                                        src={url} 
                                        alt={`사진 ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                      {idx === 3 && r.meal_images!.length > 4 && (
                                        <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
                                          <span className="text-white text-xs font-bold">+{r.meal_images!.length - 4}</span>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* 메모 */}
                              {hasMemo && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{r.meal_memo}</p>
                              )}
                              
                              {/* 편집 힌트 */}
                              {!hasImages && !hasMemo && (
                                <p className="text-xs text-gray-400 dark:text-gray-500 italic">클릭하여 메모/사진 추가</p>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )
                )}
              </div>
            </div>

            {/* 체중 변화 그래프 */}
            <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 mb-2">
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">📊 체중 변화</h3>
                  {(() => {
                    const rawData = getWeightChartData();
                    const chartData = [...rawData].sort((a, b) => 
                      new Date(a.date).getTime() - new Date(b.date).getTime()
                    );
                    
                    // 전체 데이터를 날짜순으로 정렬 (비교 기준 날짜 찾기용)
                    const allDataSorted = [...allRecords]
                      .filter(r => r.weight != null)
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    
                    // 기간별 기준 상승/하락 계산
                    const getWeightChangeText = () => {
                      if (chartData.length === 0 || allDataSorted.length === 0) return null;
                      
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      
                      let compareDate: Date;
                      let compareText: string;
                      
                      // 기간별 비교 기준 설정
                      switch (weightPeriod) {
                        case '7days':
                          compareDate = new Date(today);
                          compareDate.setDate(today.getDate() - 7);
                          compareText = '일주일 전보다';
                          break;
                        case '1month':
                          compareDate = new Date(today);
                          compareDate.setMonth(today.getMonth() - 1);
                          compareText = '한달 전보다';
                          break;
                        case 'ytd':
                          compareDate = new Date(today.getFullYear(), 0, 1);
                          compareText = '1월 1일보다';
                          break;
                        case '1year':
                          compareDate = new Date(today);
                          compareDate.setFullYear(today.getFullYear() - 1);
                          compareText = '작년보다';
                          break;
                        case 'all':
                          // 전체는 첫 번째 데이터와 마지막 데이터 비교
                          if (allDataSorted.length < 2) return null;
                          const firstData = allDataSorted[0];
                          const latestData = allDataSorted[allDataSorted.length - 1];
                          const firstWeight = firstData.weight;
                          const currentWeight = latestData.weight;
                          
                          if (!firstWeight || !currentWeight) return null;
                          
                          const difference = currentWeight - firstWeight;
                          const absDifference = Math.abs(difference);
                          
                          if (absDifference < 0.1) return null;
                          
                          const direction = difference > 0 ? '상승' : '하락';
                          const weightText = absDifference.toFixed(1);
                          
                          return { 
                            text: `처음 기록보다 ${direction}했습니다.`, 
                            weight: weightText,
                            prefix: '처음 기록보다'
                          };
                        default:
                          return null;
                      }
                      
                      // 비교 날짜 데이터 찾기 (전체 데이터에서 찾기)
                      let compareWeight: number | null = null;
                      
                      if (weightPeriod === 'ytd') {
                        // YTD: 1월 1일 이후의 첫 번째 데이터 찾기
                        for (let i = 0; i < allDataSorted.length; i++) {
                          const recordDate = new Date(allDataSorted[i].date);
                          recordDate.setHours(0, 0, 0, 0);
                          if (recordDate >= compareDate) {
                            compareWeight = allDataSorted[i].weight;
                            break;
                          }
                        }
                      } else {
                        // 7days, 1month, 1year: 비교 날짜 이전의 가장 가까운 데이터 찾기
                        for (let i = allDataSorted.length - 1; i >= 0; i--) {
                          const recordDate = new Date(allDataSorted[i].date);
                          recordDate.setHours(0, 0, 0, 0);
                          if (recordDate <= compareDate) {
                            compareWeight = allDataSorted[i].weight;
                            break;
                          }
                        }
                      }
                      
                      // 현재(최신) 데이터 찾기 (필터링된 데이터의 마지막 항목 또는 전체 데이터의 마지막 항목)
                      const latestData = chartData.length > 0 
                        ? chartData[chartData.length - 1] 
                        : allDataSorted[allDataSorted.length - 1];
                      const currentWeight = latestData.weight;
                      
                      if (!compareWeight || !currentWeight) return null;
                      
                      const difference = currentWeight - compareWeight;
                      const absDifference = Math.abs(difference);
                      
                      if (absDifference < 0.1) {
                        return null;
                      }
                      
                      const direction = difference > 0 ? '상승' : '하락';
                      const weightText = absDifference.toFixed(1);
                      
                      return { 
                        text: `${compareText} ${direction}했습니다.`, 
                        weight: weightText,
                        prefix: compareText
                      };
                    };
                    
                    const weightChangeText = getWeightChangeText();
                    
                    return weightChangeText ? (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {weightChangeText.prefix}{' '}
                        <span className="font-bold text-red-500">{weightChangeText.weight}kg</span>
                        {' '}{weightChangeText.text.replace(weightChangeText.prefix + ' ', '')}
                      </p>
                    ) : null;
                  })()}
                </div>
                <div className="flex gap-1.5 sm:gap-2">
                  <button
                    onClick={() => setWeightPeriod('7days')}
                    className={`flex-1 px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${
                      weightPeriod === '7days'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[rgb(254,252,247)] dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    7D
                  </button>
                  <button
                    onClick={() => setWeightPeriod('1month')}
                    className={`flex-1 px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${
                      weightPeriod === '1month'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[rgb(254,252,247)] dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    1M
                  </button>
                  <button
                    onClick={() => setWeightPeriod('1year')}
                    className={`flex-1 px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${
                      weightPeriod === '1year'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[rgb(254,252,247)] dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    1Y
                  </button>
                  <button
                    onClick={() => setWeightPeriod('ytd')}
                    className={`flex-1 px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${
                      weightPeriod === 'ytd'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[rgb(254,252,247)] dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    YTD
                  </button>
                  <button
                    onClick={() => setWeightPeriod('all')}
                    className={`flex-1 px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${
                      weightPeriod === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[rgb(254,252,247)] dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    전체
                  </button>
                </div>
              </div>

              {dailyRecordsError && (
                <div className="mb-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                  daily_records 조회 오류: {dailyRecordsError}
                </div>
              )}

              <div className="h-64">
                {getWeightChartData().length > 0 ? (() => {
                  const rawData = getWeightChartData();
                  // 날짜순으로 정렬
                  const chartData = [...rawData].sort((a, b) => 
                    new Date(a.date).getTime() - new Date(b.date).getTime()
                  );
                  
                  // 데이터 포인트 수에 따라 interval 자동 계산
                  // 10개 이하: 모두 표시, 10-20개: 1개씩 건너뛰기, 20-30개: 2개씩, 30개 이상: 3개씩
                  const dataCount = chartData.length;
                  let interval: number | "preserveStartEnd" = 0;
                  if (dataCount > 30) {
                    interval = Math.floor(dataCount / 10); // 최대 10개 정도만 표시
                  } else if (dataCount > 20) {
                    interval = 2;
                  } else if (dataCount > 10) {
                    interval = 1;
                  }
                  
                  return (
                    <WeightChart
                      chartData={chartData}
                      interval={interval}
                      allRecords={allRecords}
                      onDateClick={(date, mealMemo) => {
                        console.log('🎯 차트 날짜 클릭:', date, '→ 메모:', mealMemo || '없음');
                        setSelectedChartDate(date);
                        setSelectedDateMealMemo(mealMemo);
                        
                        // 해당 날짜의 데이터 로드
                        const record = allRecords.find(r => r.date === date);
                        setChartPopupWeight(record?.weight != null ? record.weight.toString() : '');
                        setChartPopupMemo(mealMemo || '');
                        setChartPopupImages(record?.meal_images || []);
                        
                        // 팝업으로 자동 스크롤
                        setTimeout(() => {
                          const popup = document.getElementById('chart-edit-popup');
                          if (popup) {
                            popup.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }, 100);
                      }}
                    />
                  );
                })() : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📊</div>
                      <p className="text-gray-400 dark:text-gray-500 text-sm">체중 데이터가 없습니다</p>
                    </div>
                  </div>
                )}
              </div>

              {/* (체중 기록 버튼은 상단 입력 카드 아래 영역으로 이동됨) */}
              
              {/* 원본 이미지 모달 */}
              {fullImageUrl && (
                <div 
                  className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                  onClick={() => setFullImageUrl(null)}
                >
                  <button
                    onClick={() => setFullImageUrl(null)}
                    className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white text-xl transition-colors"
                  >
                    ✕
                  </button>
                  <img
                    src={fullImageUrl}
                    alt="원본 이미지"
                    className="max-w-full max-h-full object-contain rounded-lg"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}

              {/* 선택된 날짜 상세보기/편집 팝업 */}
              {selectedChartDate && (
                <div 
                  id="chart-edit-popup"
                  className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg"
                >
                  {/* 헤더 */}
                  <div className="flex items-center justify-between mb-2">
                    <p style={{ fontSize: '16px' }} className="font-bold text-gray-900 dark:text-white">
                      {(() => {
                        const date = new Date(selectedChartDate);
                        const days = ['일', '월', '화', '수', '목', '금', '토'];
                        return `${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
                      })()}
                    </p>
                    <button
                      onClick={() => {
                        setSelectedChartDate(null);
                        setSelectedDateMealMemo(null);
                        setChartPopupWeight('');
                        setChartPopupMemo('');
                        setChartPopupImages([]);
                        setChartPopupEditMode(false);
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                      aria-label="닫기"
                    >
                      ✕
                    </button>
                  </div>

                  {/* 보기 모드 */}
                  {!chartPopupEditMode ? (
                    <div>
                      {/* 몸무게 */}
                      <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                        <span style={{ fontSize: '16px' }} className="text-gray-500 dark:text-gray-400">몸무게</span>
                        <span style={{ fontSize: '16px' }} className="font-bold text-gray-900 dark:text-white">
                          {chartPopupWeight ? `${chartPopupWeight} kg` : '-'}
                        </span>
                      </div>

                      {/* 사진 */}
                      {chartPopupImages.length > 0 && (
                        <div className="py-2 border-b border-gray-100 dark:border-gray-700">
                          <p style={{ fontSize: '16px' }} className="text-gray-500 dark:text-gray-400 mb-1">사진</p>
                          <div className="grid grid-cols-3 gap-2">
                            {chartPopupImages.map((url, idx) => (
                              <div 
                                key={idx} 
                                className="aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => setFullImageUrl(url)}
                              >
                                <img
                                  src={url}
                                  alt={`사진 ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 메모 */}
                      {chartPopupMemo && chartPopupMemo.trim() !== '' && (
                        <div className="py-2 border-b border-gray-100 dark:border-gray-700">
                          <p style={{ fontSize: '16px' }} className="text-gray-500 dark:text-gray-400 mb-1">메모</p>
                          <p style={{ fontSize: '16px' }} className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {chartPopupMemo}
                          </p>
                        </div>
                      )}

                      {/* 데이터 없음 표시 */}
                      {!chartPopupWeight && chartPopupImages.length === 0 && (!chartPopupMemo || chartPopupMemo.trim() === '') && (
                        <div className="text-center py-4 text-gray-400 dark:text-gray-500">
                          <p style={{ fontSize: '16px' }}>기록된 데이터가 없습니다</p>
                        </div>
                      )}

                      {/* 수정 버튼 */}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => setChartPopupEditMode(true)}
                          style={{ fontSize: '16px' }}
                          className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => {
                            setSelectedChartDate(null);
                            setSelectedDateMealMemo(null);
                            setChartPopupWeight('');
                            setChartPopupMemo('');
                            setChartPopupImages([]);
                            setChartPopupEditMode(false);
                          }}
                          style={{ fontSize: '16px' }}
                          className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
                        >
                          닫기
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* 수정 모드 */
                    <div>
                      {/* 몸무게 수정 */}
                      <div className="mb-2">
                        <label style={{ fontSize: '16px' }} className="font-medium text-gray-700 dark:text-gray-300 mb-1 block">몸무게</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            value={chartPopupWeight}
                            onChange={(e) => setChartPopupWeight(e.target.value)}
                            placeholder="예: 75.5"
                            style={{ fontSize: '16px' }}
                            className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                          />
                          <span style={{ fontSize: '16px' }} className="text-gray-500 dark:text-gray-400">kg</span>
                        </div>
                      </div>
                      
                      {/* 메모 수정 */}
                      <div className="mb-2">
                        <label style={{ fontSize: '16px' }} className="font-medium text-gray-700 dark:text-gray-300 mb-1 block">메모</label>
                        <textarea
                          value={chartPopupMemo}
                          onChange={(e) => setChartPopupMemo(e.target.value)}
                          placeholder="메모를 입력하세요..."
                          rows={2}
                          style={{ fontSize: '16px' }}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all"
                        />
                      </div>
                      
                      {/* 사진 업로드 */}
                      <div className="mb-3">
                        <label style={{ fontSize: '16px' }} className="font-medium text-gray-700 dark:text-gray-300 mb-1 block">사진</label>
                        <input
                          ref={chartPopupFileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={async (e) => {
                            const files = e.target.files;
                            if (!files || files.length === 0) {
                              console.log('파일이 선택되지 않음');
                              return;
                            }
                            if (!supabase) {
                              alert('Supabase 연결이 안 되어 있습니다.');
                              return;
                            }
                            if (!userId) {
                              alert('로그인이 필요합니다.');
                              return;
                            }
                            
                            console.log('사진 업로드 시작:', files.length, '개');
                            const uploadedUrls: string[] = [];
                            const errors: string[] = [];
                            
                            for (const file of Array.from(files)) {
                              try {
                                const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
                                const fileName = `${userId}/${selectedChartDate}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                                
                                console.log('업로드 중:', fileName);
                                
                                const { data: uploadData, error: uploadError } = await supabase.storage
                                  .from('meal-images')
                                  .upload(fileName, file, {
                                    cacheControl: '3600',
                                    upsert: false
                                  });
                                
                                if (uploadError) {
                                  console.error('업로드 오류:', uploadError);
                                  errors.push(`${file.name}: ${uploadError.message}`);
                                  continue;
                                }
                                
                                console.log('업로드 성공:', uploadData);
                                
                                const { data: urlData } = supabase.storage
                                  .from('meal-images')
                                  .getPublicUrl(fileName);
                                
                                if (urlData?.publicUrl) {
                                  console.log('공개 URL:', urlData.publicUrl);
                                  uploadedUrls.push(urlData.publicUrl);
                                }
                              } catch (err) {
                                console.error('파일 처리 오류:', err);
                                errors.push(`${file.name}: 처리 오류`);
                              }
                            }
                            
                            if (uploadedUrls.length > 0) {
                              setChartPopupImages(prev => [...prev, ...uploadedUrls]);
                              console.log('총', uploadedUrls.length, '개 업로드 완료');
                            }
                            
                            if (errors.length > 0) {
                              alert(`일부 파일 업로드 실패:\n${errors.join('\n')}\n\nSupabase Storage에 'meal-images' 버킷이 있는지 확인하세요.`);
                            }
                            
                            e.target.value = '';
                          }}
                        />
                        <button
                          onClick={() => chartPopupFileInputRef.current?.click()}
                          style={{ fontSize: '16px' }}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 hover:border-blue-400 transition-all text-gray-600 dark:text-gray-400"
                        >
                          + 사진 추가
                        </button>
                        
                        {/* 업로드된 이미지 미리보기 */}
                        {chartPopupImages.length > 0 && (
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            {chartPopupImages.map((url, idx) => (
                              <div key={idx} className="relative aspect-square">
                                <img
                                  src={url}
                                  alt={`사진 ${idx + 1}`}
                                  className="w-full h-full object-cover rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:opacity-80"
                                  onClick={() => setFullImageUrl(url)}
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setChartPopupImages(prev => prev.filter((_, i) => i !== idx));
                                  }}
                                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 shadow"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* 저장/취소 버튼 */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            // 원래 데이터로 복원
                            const record = allRecords.find(r => r.date === selectedChartDate);
                            setChartPopupWeight(record?.weight != null ? record.weight.toString() : '');
                            setChartPopupMemo(record?.meal_memo || '');
                            setChartPopupImages(record?.meal_images || []);
                            setChartPopupEditMode(false);
                          }}
                          style={{ fontSize: '16px' }}
                          className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
                        >
                          취소
                        </button>
                        <button
                          onClick={async () => {
                            if (!supabase || !userId || !selectedChartDate) {
                              console.log('저장 조건 미충족:', { supabase: !!supabase, userId, selectedChartDate });
                              return;
                            }
                            
                            setChartPopupSaving(true);
                            try {
                              const weightValue = chartPopupWeight ? parseFloat(chartPopupWeight) : null;
                              console.log('저장 시작:', { date: selectedChartDate, weight: weightValue, memo: chartPopupMemo });
                              
                              // 기존 레코드 확인 (maybeSingle 사용으로 에러 방지)
                              const { data: existing, error: selectError } = await supabase
                                .from('daily_records')
                                .select('id')
                                .eq('user_id', userId)
                                .eq('date', selectedChartDate)
                                .maybeSingle();
                              
                              if (selectError) {
                                console.error('레코드 조회 오류:', selectError);
                              }
                              
                              if (existing) {
                                console.log('기존 레코드 업데이트:', existing.id);
                                // 업데이트
                                const { error: updateError } = await supabase
                                  .from('daily_records')
                                  .update({
                                    weight: weightValue,
                                    meal_memo: chartPopupMemo || null,
                                    meal_images: chartPopupImages.length > 0 ? chartPopupImages : [],
                                    updated_at: new Date().toISOString(),
                                  })
                                  .eq('id', existing.id);
                                
                                if (updateError) {
                                  console.error('업데이트 오류:', updateError);
                                  throw updateError;
                                }
                              } else {
                                console.log('새 레코드 생성');
                                // 새로 생성
                                const { error: insertError } = await supabase
                                  .from('daily_records')
                                  .insert({
                                    user_id: userId,
                                    date: selectedChartDate,
                                    weight: weightValue,
                                    meal_memo: chartPopupMemo || null,
                                    meal_images: chartPopupImages.length > 0 ? chartPopupImages : [],
                                  });
                                
                                if (insertError) {
                                  console.error('삽입 오류:', insertError);
                                  throw insertError;
                                }
                              }
                              
                              console.log('저장 완료');
                              
                              // 데이터 새로고침
                              loadAllRecords();
                              loadMealRecords();
                              
                              // 수정 모드 종료 (팝업은 유지)
                              setChartPopupEditMode(false);
                              
                              setMessage('저장되었습니다!');
                              setTimeout(() => setMessage(''), 2500);
                            } catch (err) {
                              console.error('저장 오류:', err);
                              alert('저장 중 오류가 발생했습니다: ' + (err as any)?.message);
                            } finally {
                              setChartPopupSaving(false);
                            }
                          }}
                          disabled={chartPopupSaving}
                          style={{ fontSize: '16px' }}
                          className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
                        >
                          {chartPopupSaving ? '저장 중...' : '저장'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 데일리 루틴 - 동적으로 렌더링 */}
            <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 mb-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">데일리 루틴</h3>
                {/* 최근 5일 날짜 표시 */}
                <div className="flex items-center gap-1" style={{ marginTop: '8px' }}>
                  {(() => {
                    const today = new Date();
                    const dates = [];
                    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
                    
                    for (let i = 4; i >= 0; i--) {
                      const date = new Date(today);
                      date.setDate(date.getDate() - i);
                      
                      // 한국 시간으로 변환
                      const koreaTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
                      const isToday = i === 0;
                      const dayOfWeek = weekDays[koreaTime.getUTCDay()];
                      
                      dates.push(
                        <div 
                          key={i}
                          className="flex flex-col items-center"
                          style={{ width: '20px' }}
                        >
                          <span 
                            className={`${isToday ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} 
                            style={{ fontSize: '12px' }}
                          >
                            {koreaTime.getUTCDate()}
                          </span>
                          <span 
                            className={`${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`} 
                            style={{ fontSize: '8px' }}
                          >
                            {dayOfWeek}
                          </span>
                        </div>
                      );
                    }
                    
                    return dates;
                  })()}
                </div>
              </div>
              {routineTemplates.map((routine, index) => (
                <div key={routine.id}>
                  <RoutineItem
                    emoji={routine.emoji}
                    label={routine.label}
                    checked={isRoutineChecked(routine.id)}
                    onChange={() => handleRoutineCheckChange(routine.id)}
                    disabled={false}
                    isLast={index === routineTemplates.length - 1}
                    isExpanded={expandedRoutineId === routine.id}
                    onExpandToggle={() => {
                      const newExpandedId = expandedRoutineId === routine.id ? null : routine.id;
                      setExpandedRoutineId(newExpandedId);
                      // 아코디언을 펼칠 때 자동으로 수정 모드 활성화
                      if (newExpandedId) {
                        setEditModeRoutine(newExpandedId);
                      }
                    }}
                    userId={userId}
                    routineId={routine.id}
                    routineTemplates={routineTemplates}
                    editModeRoutine={editModeRoutine}
                    setEditModeRoutine={setEditModeRoutine}
                    routineType={routine.type || 'checkbox'}
                    value={routineValues[routine.id] ?? null}
                    onValueChange={(value) => {
                      setRoutineValues(prev => ({
                        ...prev,
                        [routine.id]: value
                      }));
                    }}
                    unit={routine.unit}
                    syncTick={routineSyncTick}
                    onSync={bumpRoutineSync}
                    imageUploadEnabled={!!routine.image_upload_enabled}
                    routineTemplateData={routine}
                  />
                  {/* 확장된 루틴의 캘린더 표시 (이미지 업로드가 아닌 루틴만) */}
                  {expandedRoutineId === routine.id && !routine.image_upload_enabled && (
                    <div className="mt-2 pb-2 -mx-4 sm:-mx-5">
                      <RoutineCalendar
                        userId={userId}
                        routineId={routine.id}
                        routineLabel={routine.label}
                        routineEmoji={routine.emoji}
                        routineTemplates={routineTemplates}
                        isExpanded={true}
                        editModeRoutine={editModeRoutine}
                        setEditModeRoutine={setEditModeRoutine}
                        syncTick={routineSyncTick}
                        onSync={bumpRoutineSync}
                        imageUploadEnabled={false}
                      />
                    </div>
                  )}
                </div>
              ))}
              {routineTemplates.length === 0 && (
                <div className="text-center text-gray-400 dark:text-gray-500 py-4">
                  루틴을 추가해주세요
                </div>
              )}
            </div>

            {/* 식사 기록 섹션 삭제됨 - 체중 기록에서 메모/사진 관리 */}
            <div className="hidden">
              <div className="flex items-center gap-3 mb-4">
                <h3 
                  className="text-lg font-semibold text-gray-900 dark:text-white shrink-0 flex items-center gap-2 cursor-pointer"
                  onClick={() => {
                    const newExpanded = !isMealSectionExpanded;
                    setIsMealSectionExpanded(newExpanded);
                    if (newExpanded && !isEditMode) {
                      handleEdit();
                    }
                  }}
                >
                  🍽️ 식사 기록
                  <svg 
                    className={`w-5 h-5 transition-transform duration-200 ${isMealSectionExpanded ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </h3>
                
                {isMealSectionExpanded && (
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="ml-auto text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={isSaving ? '저장 중' : '저장'}
                  >
                    {isSaving ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
                
              {isMealSectionExpanded && (
              <>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                {/* 작은 날짜 선택 필드 */}
                <div 
                  className="relative cursor-pointer overflow-hidden w-[120px]"
                  onClick={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.querySelector('input[type="date"]') as HTMLInputElement;
                    if (input) {
                      input.focus();
                      if (input.showPicker) {
                        try {
                          input.showPicker();
                        } catch (err) {
                          input.click();
                        }
                      } else {
                        input.click();
                      }
                    }
                  }}
                >
                  <input
                    type="date"
                    value={formData.date}
                    onChange={async (e) => {
                      const newDate = e.target.value;
                      console.log('📅 식사 날짜 변경:', newDate);
                      await loadDailyRecord(newDate);
                      await loadRoutineChecks(newDate);
                      setSelectedDate(newDate);
                    }}
                    className="w-full px-3 py-2 text-sm bg-[rgb(254,252,247)] dark:bg-gray-700 text-transparent border border-blue-400 dark:border-blue-500 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
                    style={{ color: 'transparent', WebkitAppearance: 'none' }}
                  />
                  {/* 날짜 포맷 표시 (오버레이) */}
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-sm text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[calc(100%-1.5rem)]">
                    📅 {(() => {
                      const date = new Date(formData.date);
                      const month = date.getMonth() + 1;
                      const day = date.getDate();
                      return `${month}/${day}`;
                    })()}
                  </div>
                </div>
                
                {/* 식사 체크박스 */}
                <MealCheckbox
                  label="아침"
                  checked={formData.meal_breakfast}
                  onChange={() => handleCheckboxChange('meal_breakfast')}
                  disabled={!isEditMode}
                />
                <MealCheckbox
                  label="점심"
                  checked={formData.meal_lunch}
                  onChange={() => handleCheckboxChange('meal_lunch')}
                  disabled={!isEditMode}
                />
                <MealCheckbox
                  label="저녁"
                  checked={formData.meal_dinner}
                  onChange={() => handleCheckboxChange('meal_dinner')}
                  disabled={!isEditMode}
                />
              </div>
              <textarea
                value={formData.meal_memo}
                onChange={(e) => handleInputChange('meal_memo', e.target.value)}
                placeholder="식사 메모 (선택사항)"
                disabled={!isEditMode}
                className="w-full px-4 py-3 text-base bg-[rgb(254,252,247)] dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 resize-none"
                rows={3}
              />

              {/* 이미지 업로드 */}
              <div className="mt-4">
                {isEditMode && (
                  <div className="mb-3">
                    <label className="flex items-center justify-center w-full px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        disabled={isUploadingImage}
                        className="hidden"
                      />
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {isUploadingImage ? '📤 업로드 중...' : '📷 사진 추가 (최대 5MB)'}
                      </span>
                    </label>
                  </div>
                )}

                {/* 이미지 미리보기 */}
                {formData.meal_images && formData.meal_images.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {formData.meal_images.map((imageUrl, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={imageUrl}
                          alt={`식사 사진 ${index + 1}`}
                          className="w-full aspect-square object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                        />
                        {isEditMode && (
                          <button
                            onClick={() => handleImageDelete(imageUrl)}
                            className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="이미지 삭제"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* 날짜별 식사 기록 목록 - 일별 리스트 + 페이지네이션 */}
              {mealRecords.length > 0 && (() => {
                // 최신순으로 정렬
                const sortedRecords = [...mealRecords].sort((a, b) => 
                  new Date(b.date).getTime() - new Date(a.date).getTime()
                );
                
                // 페이지네이션
                const itemsPerPage = 10;
                const totalPages = Math.ceil(sortedRecords.length / itemsPerPage);
                const startIndex = (mealRecordsPage - 1) * itemsPerPage;
                const paginatedRecords = sortedRecords.slice(startIndex, startIndex + itemsPerPage);

                return (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                        📅 식사 기록
                      </h4>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        총 {sortedRecords.length}개
                      </span>
                    </div>
                    
                    {/* 일별 기록 리스트 */}
                    <div className="space-y-2">
                      {paginatedRecords.map((record) => {
                        const recordDate = new Date(record.date);
                        const formattedDate = `${recordDate.getFullYear()}년 ${recordDate.getMonth() + 1}월 ${recordDate.getDate()}일`;
                        const meals = [];
                        if (record.meal_breakfast) meals.push('아침');
                        if (record.meal_lunch) meals.push('점심');
                        if (record.meal_dinner) meals.push('저녁');
                        
                        return (
                          <div
                            key={record.id}
                            className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all"
                            onClick={async () => {
                              console.log('📋 기록 클릭:', record.date);
                              await loadDailyRecord(record.date);
                              await loadRoutineChecks(record.date);
                              setSelectedDate(record.date);
                              setIsEditMode(true);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {formattedDate}
                              </span>
                              <div className="flex items-center gap-2">
                                {meals.length > 0 && (
                                  <div className="flex gap-1.5">
                                    {meals.map((meal, idx) => (
                                      <span
                                        key={idx}
                                        className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded"
                                      >
                                        {meal}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            {record.meal_memo && (
                              <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 line-clamp-2">
                                {record.meal_memo}
                              </p>
                            )}
                            {/* 아래 오른쪽: 수정 아이콘 */}
                            <div className="flex justify-end mt-2">
                              <button
                                className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-1"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  console.log('✏️ 수정 아이콘 클릭:', record.date);
                                  await loadDailyRecord(record.date);
                                  await loadRoutineChecks(record.date);
                                  setSelectedDate(record.date);
                                  setIsEditMode(true);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                title="수정하기"
                                aria-label="수정하기"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            </div>
                            {/* 이미지 미리보기 (최대 3개) */}
                            {record.meal_images && record.meal_images.length > 0 && (
                              <div className="flex gap-2 mt-2">
                                {record.meal_images.slice(0, 3).map((imageUrl, idx) => (
                                  <div key={idx} className="relative w-16 h-16 flex-shrink-0">
                                    <img
                                      src={imageUrl}
                                      alt={`식사 사진 ${idx + 1}`}
                                      className="w-full h-full object-cover rounded border border-gray-300 dark:border-gray-600"
                                    />
                                    {idx === 2 && record.meal_images.length > 3 && (
                                      <div className="absolute inset-0 bg-black bg-opacity-50 rounded flex items-center justify-center">
                                        <span className="text-white text-xs font-medium">
                                          +{record.meal_images.length - 3}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* 페이지네이션 */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-4">
                        <button
                          onClick={() => setMealRecordsPage(prev => Math.max(1, prev - 1))}
                          disabled={mealRecordsPage === 1}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                          ◀ 이전
                        </button>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {mealRecordsPage} / {totalPages}
                        </span>
                        <button
                          onClick={() => setMealRecordsPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={mealRecordsPage === totalPages}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                          다음 ▶
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
              </>
              )}
            </div>
            </div>
          </div>
        </div>
        
        <FooterNav />
      </div>
      </SwipeNav>
    </AuthGuard>
  );
}

// 원형 그래프 컴포넌트
function CircularProgressChart({ 
  progress, 
  size = 36
}: { 
  progress: number; 
  size?: number;
}) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;
  
  // 파란색 단일 계열로 통일
  const gaugeColor = '#178CF2';
  const gaugeTrackColor = '#E5E7EB';

  return (
    <div 
      className="relative flex items-center justify-center" 
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* 배경 원 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          className="text-gray-200 dark:text-gray-700"
        />
        {/* 진행률 원 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={gaugeColor}
          strokeWidth="4"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {/* 달성률 텍스트 (중앙) */}
      <div 
        className="absolute inset-0 flex items-center justify-center text-xs font-medium text-blue-500 dark:text-blue-400 pointer-events-none"
      >
        {Math.round(progress)}%
      </div>
    </div>
  );
}

// 루틴 아이템 컴포넌트
function RoutineItem({
  emoji,
  label,
  checked,
  onChange,
  disabled,
  isLast = false,
  isExpanded = false,
  onExpandToggle,
  userId,
  routineId,
  routineTemplates,
  editModeRoutine,
  setEditModeRoutine,
  routineType,
  value,
  onValueChange,
  unit,
  syncTick,
  onSync,
  imageUploadEnabled = false,
  onPhotoManagementClick,
  routineTemplateData,
}: {
  emoji: string;
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
  isLast?: boolean;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
  userId: string;
  routineId: string;
  routineTemplates: RoutineTemplate[];
  editModeRoutine: string | null;
  setEditModeRoutine: (routineId: string | null) => void;
  routineType: 'checkbox' | 'number';
  value?: number | null;
  onValueChange?: (value: number | null) => void;
  unit?: string;
  syncTick: number;
  onSync: () => void;
  imageUploadEnabled?: boolean;
  onPhotoManagementClick?: () => void;
  routineTemplateData?: RoutineTemplate;
}) {
  const router = useRouter();
  const [checkedDates, setCheckedDates] = useState<Record<string, Set<string>>>({});
  const [yearlyTotal, setYearlyTotal] = useState<number>(0);
  const [numberDateValues, setNumberDateValues] = useState<Record<string, number>>({});
  const [numberInputModal, setNumberInputModal] = useState<{
    open: boolean;
    dateStr: string;
    valueText: string;
  }>({ open: false, dateStr: '', valueText: '' });
  
  // 독서 루틴 통합 바텀시트
  // 독서 루틴 통합 바텀시트 state
  const [readingSheet, setReadingSheet] = useState<{
    open: boolean;
    routineId: string;
    label: string;
    emoji: string;
    unit: string;
  } | null>(null);
  const [readingMinutes, setReadingMinutes] = useState('');
  const [readingImageUrl, setReadingImageUrl] = useState<string | null>(null);
  const [readingUploading, setReadingUploading] = useState(false);
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const supabase = getSupabase();

  // Supabase에서 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      if (!supabase) return;
      
      try {
        // 연말/연초(예: 2025-12-31 → 2026-01-01) 연속 체크/최근 5일 표시까지 자연스럽게 하기 위해
        // "올해 + 전년" 범위를 함께 로드
        const rangeStart = `${currentYear - 1}-01-01`;
        const rangeEnd = `${currentYear}-12-31`;

        const { data: checks, error } = await supabase
          .from('daily_routine_checks')
          .select('date, routine_id, checked, value')
          .gte('date', rangeStart)
          .lte('date', rangeEnd)
          .eq('user_id', userId)
          .eq('routine_id', routineId)
          .eq('checked', true);

        if (error) {
          console.error('루틴 체크 데이터 로드 오류:', error);
          return;
        }

        // 데이터를 Record<string, Set<string>> 형태로 변환
        const data: Record<string, Set<string>> = {};
        let totalValue = 0;
        const valuesByDate: Record<string, number> = {};
        
        if (checks && checks.length > 0) {
          checks.forEach((check: any) => {
            if (!data[check.date]) {
              data[check.date] = new Set();
            }
            data[check.date].add(check.routine_id);
            
            // 숫자 타입인 경우: 날짜별 값 저장 + "올해" 누적만 합산
            if (routineType === 'number' && check.value != null) {
              if (String(check.date).startsWith(`${currentYear}-`)) {
                totalValue += check.value;
              }
              valuesByDate[check.date] = check.value;
            }
          });
        }
        
        setCheckedDates(data);
        setYearlyTotal(totalValue);
        setNumberDateValues(valuesByDate);
      } catch (err) {
        console.error('데이터 로드 오류:', err);
      }
    };

    loadData();
    
    // 주기적으로 업데이트 (30초마다)
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [supabase, routineId, currentYear, routineType, syncTick]);

  // 날짜 체크 상태 확인
  const isDateChecked = (date: string, routineId: string) => {
    return checkedDates[date]?.has(routineId) || false;
  };

  // 연속 체크한 날짜 수 계산
  const getConsecutiveDays = (routineId: string) => {
    const getKoreaDateString = (date: Date): string => {
      // 한국 시간으로 변환 (UTC+9)
      const koreaTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
      const year = koreaTime.getUTCFullYear();
      const month = String(koreaTime.getUTCMonth() + 1).padStart(2, '0');
      const day = String(koreaTime.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    let consecutiveCount = 0;
    const today = new Date();
    const todayStr = getKoreaDateString(today);
    
    // 오늘이 체크되어 있는지 확인
    const isTodayChecked = isDateChecked(todayStr, routineId);
    
    // 오늘부터 시작 (오늘이 체크되어 있을 때만)
    // 오늘이 체크되지 않았으면 어제부터 시작
    let checkDate = new Date(today);
    if (!isTodayChecked) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    while (true) {
      const dateStr = getKoreaDateString(checkDate);
      if (isDateChecked(dateStr, routineId)) {
        consecutiveCount++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
      if (consecutiveCount > 365) break;
    }
    return consecutiveCount;
  };

  // 월별 체크 비율 계산
  const getMonthProgress = (year: number, month: number, routineId: string) => {
    const daysInMonth = new Date(year, month, 0).getDate();
    let checkedCount = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (isDateChecked(dateStr, routineId)) {
        checkedCount++;
      }
    }
    return daysInMonth > 0 ? (checkedCount / daysInMonth) * 100 : 0;
  };

  // 루틴 색상은 항상 기본값(blue) 사용
  const routineColor = '#3B82F6';
  
  // hex 색상을 RGB로 변환
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 59, g: 130, b: 246 };
  };
  
  // 색상 밝기 계산 (0-255)
  const getBrightness = (hex: string) => {
    const rgb = hexToRgb(hex);
    return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  };
  
  // hex를 rgba로 변환
  const hexToRgba = (hex: string, alpha: number) => {
    const rgb = hexToRgb(hex);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  };
  
  // 색상별 클래스 매핑 (hex 색상 지원)
  const getColorClasses = (color: string) => {
    // hex 색상인 경우
    if (color.startsWith('#')) {
      const brightness = getBrightness(color);
      const isLight = brightness > 128;
      const lightColor = hexToRgba(color, 0.2); // 20% 투명도
      const darkColor = hexToRgba(color, 0.3); // 30% 투명도
      const textColor = isLight ? '#1E3A8A' : '#60A5FA';
      const textDarkColor = isLight ? '#3B82F6' : '#93C5FD';
      
      return {
        bg: color,
        bgLight: lightColor,
        bgDark: darkColor,
        text: textColor,
        textDark: textDarkColor,
        ring: color,
        button: color,
        buttonHover: color,
      };
    }
    
    // 기존 색상 이름 매핑
    const colorMap: Record<string, { bg: string; bgLight: string; bgDark: string; text: string; textDark: string; ring: string; button: string; buttonHover: string }> = {
      blue: { bg: 'bg-blue-500', bgLight: 'bg-blue-100', bgDark: 'bg-blue-900/30', text: 'text-blue-700', textDark: 'text-blue-400', ring: 'ring-blue-500', button: 'bg-blue-600', buttonHover: 'hover:bg-blue-700' },
      purple: { bg: 'bg-purple-500', bgLight: 'bg-purple-100', bgDark: 'bg-purple-900/30', text: 'text-purple-700', textDark: 'text-purple-400', ring: 'ring-purple-500', button: 'bg-purple-600', buttonHover: 'hover:bg-purple-700' },
      green: { bg: 'bg-green-500', bgLight: 'bg-green-100', bgDark: 'bg-green-900/30', text: 'text-green-700', textDark: 'text-green-400', ring: 'ring-green-500', button: 'bg-green-600', buttonHover: 'hover:bg-green-700' },
      red: { bg: 'bg-red-500', bgLight: 'bg-red-100', bgDark: 'bg-red-900/30', text: 'text-red-700', textDark: 'text-red-400', ring: 'ring-red-500', button: 'bg-red-600', buttonHover: 'hover:bg-red-700' },
      yellow: { bg: 'bg-yellow-500', bgLight: 'bg-yellow-100', bgDark: 'bg-yellow-900/30', text: 'text-yellow-700', textDark: 'text-yellow-400', ring: 'ring-yellow-500', button: 'bg-yellow-600', buttonHover: 'hover:bg-yellow-700' },
      orange: { bg: 'bg-orange-500', bgLight: 'bg-orange-100', bgDark: 'bg-orange-900/30', text: 'text-orange-700', textDark: 'text-orange-400', ring: 'ring-orange-500', button: 'bg-orange-600', buttonHover: 'hover:bg-orange-700' },
      pink: { bg: 'bg-pink-500', bgLight: 'bg-pink-100', bgDark: 'bg-pink-900/30', text: 'text-pink-700', textDark: 'text-pink-400', ring: 'ring-pink-500', button: 'bg-pink-600', buttonHover: 'hover:bg-pink-700' },
      indigo: { bg: 'bg-indigo-500', bgLight: 'bg-indigo-100', bgDark: 'bg-indigo-900/30', text: 'text-indigo-700', textDark: 'text-indigo-400', ring: 'ring-indigo-500', button: 'bg-indigo-600', buttonHover: 'hover:bg-indigo-700' },
    };
    return colorMap[color] || colorMap.blue;
  };
  
  const colorClasses = getColorClasses(routineColor);
  const isHexColor = routineColor.startsWith('#');
  const consecutiveDays = getConsecutiveDays(routineId);
  
  // 오늘 날짜 확인 (한국 시간대 기준)
  const getKoreaDateString = (date: Date): string => {
    // 한국 시간으로 변환 (UTC+9)
    const koreaTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    const year = koreaTime.getUTCFullYear();
    const month = String(koreaTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(koreaTime.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const today = new Date();
  const todayDateStr = getKoreaDateString(today);
  const isTodayChecked = isDateChecked(todayDateStr, routineId);
  
  // 오늘 날짜 체크/언체크 핸들러
  const handleTodayToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    
    const newChecked = !isTodayChecked;
    
    // 이미지 업로드 루틴이고 체크하려는 경우, 통합 바텀시트 열기
    if (imageUploadEnabled && newChecked) {
      const currentValue = numberDateValues[todayDateStr] ?? null;
      setReadingSheet({
        open: true,
        routineId: routineId,
        label: label,
        emoji: emoji,
        unit: unit || '분',
      });
      setReadingMinutes(currentValue !== null ? currentValue.toString() : '');
      setReadingImageUrl(null);
      return;
    }
    
    // 숫자 타입 루틴이고 체크하려는 경우, 숫자 입력 모달 열기
    if (routineType === 'number' && newChecked && !imageUploadEnabled) {
      const currentValue = numberDateValues[todayDateStr] ?? null;
      setNumberInputModal({
        open: true,
        dateStr: todayDateStr,
        valueText: currentValue !== null ? currentValue.toFixed(1) : '0.0',
      });
      return;
    }
    
    // Supabase에 저장
    if (supabase) {
      try {
        if (newChecked) {
          // 체크: insert 또는 update
          const { error } = await supabase
            .from('daily_routine_checks')
            .upsert({
              user_id: userId,
              date: todayDateStr,
              routine_id: routineId,
              checked: true
            }, {
              onConflict: 'user_id,date,routine_id'
            });
          
          if (error) {
            console.error('Supabase 저장 오류:', error);
            return;
          }
        } else {
          // 언체크: delete
          const { error } = await supabase
            .from('daily_routine_checks')
            .delete()
            .eq('date', todayDateStr)
            .eq('routine_id', routineId)
            .eq('user_id', userId);
          
          if (error) {
            console.error('Supabase 삭제 오류:', error);
            return;
          }
        }
        
        // 상태 업데이트
        setCheckedDates(prev => {
          const newData = { ...prev };
          if (!newData[todayDateStr]) {
            newData[todayDateStr] = new Set();
          }
          
          const dateSet = new Set(newData[todayDateStr]);
          if (newChecked) {
            dateSet.add(routineId);
          } else {
            dateSet.delete(routineId);
          }
          
          if (dateSet.size === 0) {
            delete newData[todayDateStr];
          } else {
            newData[todayDateStr] = dateSet;
          }
          
          return newData;
        });
      } catch (err) {
        console.error('Supabase 작업 오류:', err);
        return;
      }
    }
    
    // 부모 컴포넌트의 onChange 호출 (체크박스 상태 업데이트)
    onChange();
  };

  // 숫자 입력 저장/삭제 (prompt 대신 모달에서 호출)
  const saveNumberValueForDate = async (dateStr: string, valueText: string) => {
    if (!supabase) return;

    const trimmed = String(valueText ?? '').trim();
    const isEmpty = trimmed === '';

    let numValue: number | null = null;
    if (!isEmpty) {
      const parsed = parseFloat(trimmed);
      if (Number.isNaN(parsed)) {
        alert('올바른 숫자를 입력해주세요.');
        return;
      }
      // 소수점 1자리로 반올림
      numValue = Math.round(parsed * 10) / 10;
    }

    try {
      console.log('💾 숫자 입력 저장 시작:', { dateStr, numValue, routineId, userId });

      if (numValue === null) {
        const { error } = await supabase
          .from('daily_routine_checks')
          .delete()
          .eq('date', dateStr)
          .eq('routine_id', routineId)
          .eq('user_id', userId);

        if (error) {
          console.error('❌ 삭제 오류(raw):', error);
          alert(`삭제 실패: ${error.message || '알 수 없는 오류'}`);
          return;
        }
        console.log('✅ 삭제 완료');
      } else {
        const { data, error } = await supabase
          .from('daily_routine_checks')
          .upsert(
            {
              user_id: userId,
              date: dateStr,
              routine_id: routineId,
              checked: true,
              value: numValue,
            },
            {
              onConflict: 'user_id,date,routine_id',
            }
          );

        if (error) {
          // Next/Turbopack 콘솔 오버레이에서 Error 객체가 `{}`로 보이는 경우가 있어,
          // 실제 정보(키/프로퍼티/문자열 표현)를 강제로 펼쳐서 로깅합니다.
          const errAny: any = error as any;
          const errInfo = {
            typeof: typeof errAny,
            isError: errAny instanceof Error,
            name: errAny?.name,
            message: errAny?.message,
            code: errAny?.code,
            details: errAny?.details,
            hint: errAny?.hint,
            status: errAny?.status,
            statusCode: errAny?.statusCode,
            toString: (() => {
              try {
                return String(errAny);
              } catch {
                return '[toString failed]';
              }
            })(),
            keys: (() => {
              try {
                return Object.keys(errAny ?? {});
              } catch {
                return ['[Object.keys failed]'];
              }
            })(),
            props: (() => {
              try {
                return Object.getOwnPropertyNames(errAny ?? {});
              } catch {
                return ['[getOwnPropertyNames failed]'];
              }
            })(),
          };

          console.error('❌ 저장 오류(raw):', error);
          console.error('❌ 저장 오류(info):', errInfo);
          try {
            console.error('❌ 저장 오류(JSON):', JSON.stringify(error, null, 2));
          } catch (e) {
            console.error('❌ 저장 오류(JSON stringify 실패):', e);
          }

          const alertMsg =
            errAny?.message ||
            errAny?.details ||
            errAny?.hint ||
            (errInfo.toString && errInfo.toString !== '[object Object]' ? errInfo.toString : '') ||
            `저장에 실패했습니다. (에러 객체가 비어있습니다)`;
          alert(`저장 실패: ${alertMsg}`);
          return;
        }
        console.log('✅ 저장 완료:', data);
      }

      // 즉시 UI 반영 (최근 5일) + 캘린더와 연동 트리거
      setNumberDateValues(prev => {
        const next = { ...prev };
        if (numValue == null) {
          delete next[dateStr];
        } else {
          next[dateStr] = numValue;
        }
        console.log('🔄 UI 업데이트:', next);
        return next;
      });
      onSync();
      console.log('✅ 동기화 트리거 완료');
    } catch (err) {
      console.error('❌ 숫자 입력 오류:', err);
      alert(`오류 발생: ${err}`);
    }
  };

  // 통합 입력 모달 저장 (숫자 + 이미지)
  // 독서 바텀시트 저장
  // 독서 시트 저장
  const saveReadingSheet = async () => {
    if (!supabase || !readingSheet) return;

    const todayStr = getKoreaDateString(new Date());
    const trimmed = readingMinutes.trim();

    let numValue: number | null = null;
    if (trimmed !== '') {
      const parsed = parseFloat(trimmed);
      if (Number.isNaN(parsed)) {
        alert('올바른 숫자를 입력해주세요.');
        return;
      }
      numValue = parsed;
    }

    setReadingUploading(true);

    try {
      // DB에 저장
      const { error: dbError } = await supabase
        .from('daily_routine_checks')
        .upsert(
          {
            user_id: userId,
            date: todayStr,
            routine_id: readingSheet.routineId,
            checked: true,
            value: numValue,
            image_url: readingImageUrl,
          },
          {
            onConflict: 'user_id,date,routine_id',
          }
        );

      if (dbError) {
        console.error('DB 저장 오류:', dbError);
        alert(`저장 실패: ${dbError.message || '알 수 없는 오류'}`);
        setReadingUploading(false);
        return;
      }

      // UI 업데이트
      if (numValue !== null) {
        setNumberDateValues(prev => ({ ...prev, [todayStr]: numValue! }));
      }
      
      setCheckedDates(prev => {
        const newData = { ...prev };
        if (!newData[todayStr]) {
          newData[todayStr] = new Set();
        }
        newData[todayStr].add(readingSheet.routineId);
        return newData;
      });

      onSync();
      onChange();

      // 시트 닫기
      setReadingSheet(null);
      setReadingMinutes('');
      setReadingImageUrl(null);
      setReadingUploading(false);
    } catch (err) {
      console.error('저장 오류:', err);
      alert(`오류 발생: ${err}`);
      setReadingUploading(false);
    }
  };

  // 독서 시트 이미지 업로드
  const handleReadingImageUpload = async (file: File) => {
    if (!supabase || !readingSheet) return;

    setReadingUploading(true);

    try {
      const todayStr = getKoreaDateString(new Date());
      const fileExt = file.name.split('.').pop() || 'jpg';
      const filePath = `${userId}/${readingSheet.routineId}/${todayStr}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('reading-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        // reading-images 버킷이 없으면 routine-images 시도
        const { error: fallbackError } = await supabase.storage
          .from('routine-images')
          .upload(filePath, file, { upsert: true });

        if (fallbackError) {
          console.error('이미지 업로드 오류:', fallbackError);
          alert('이미지 업로드에 실패했습니다.');
          setReadingUploading(false);
          return;
        }

        const { data: urlData } = supabase.storage
          .from('routine-images')
          .getPublicUrl(filePath);

        setReadingImageUrl(urlData.publicUrl);
      } else {
        const { data: urlData } = supabase.storage
          .from('reading-images')
          .getPublicUrl(filePath);

        setReadingImageUrl(urlData.publicUrl);
      }

      setReadingUploading(false);
    } catch (err) {
      console.error('업로드 오류:', err);
      alert(`업로드 실패: ${err}`);
      setReadingUploading(false);
    }
  };

  // 독서 일기 쓰기 버튼 클릭 핸들러
  const handleWriteDiary = () => {
    if (!readingSheet) return;
    
    const todayStr = getKoreaDateString(new Date());
    
    // 시트 닫기
    setReadingSheet(null);
    setReadingMinutes('');
    setReadingImageUrl(null);

    // /memo 페이지로 이동
    const params = new URLSearchParams({
      date: todayStr,
      from: 'routine',
      label: readingSheet.label
    });
    router.push(`/memo?${params.toString()}`);
  };
  
  return (
    <div>
      {/* 숫자 입력 모달 (prompt 대신 사용) */}
      {numberInputModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-label="숫자 입력"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setNumberInputModal({ open: false, dateStr: '', valueText: '' })}
          />
          <div className="relative w-full max-w-[412px] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {numberInputModal.dateStr} 값 입력
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                {label} {unit ? `(${unit})` : ''}
              </div>
            </div>

            <div className="px-4 py-4">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                autoFocus
                value={numberInputModal.valueText}
                onChange={(e) =>
                  setNumberInputModal((prev) => ({ ...prev, valueText: e.target.value }))
                }
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setNumberInputModal({ open: false, dateStr: '', valueText: '' });
                    return;
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveNumberValueForDate(numberInputModal.dateStr, numberInputModal.valueText).then(
                      () => setNumberInputModal({ open: false, dateStr: '', valueText: '' })
                    );
                  }
                }}
                placeholder="예: 7.6"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-[rgb(254,252,247)] dark:bg-gray-800 text-gray-900 dark:text-white text-base focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                소수점 1자리까지 저장됩니다. (예: 7.64 → 7.6)
              </div>
            </div>

            <div className="px-4 pb-4 flex gap-2 justify-end">
              <button
                className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                onClick={() => setNumberInputModal({ open: false, dateStr: '', valueText: '' })}
              >
                취소
              </button>
              <button
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                onClick={async () => {
                  await saveNumberValueForDate(numberInputModal.dateStr, numberInputModal.valueText);
                  setNumberInputModal({ open: false, dateStr: '', valueText: '' });
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 독서 루틴 통합 바텀시트 */}
      {readingSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="독서 기록"
        >
          <div
            className="absolute inset-0 bg-black/50 transition-opacity"
            onClick={() => {
              if (!readingUploading) {
                setReadingSheet(null);
                setReadingMinutes('');
                setReadingImageUrl(null);
              }
            }}
          />
          <div className="relative w-full max-w-[412px] mx-auto rounded-t-2xl bg-white dark:bg-gray-900 shadow-2xl animate-slide-up overflow-hidden flex flex-col max-h-[90vh]">
            {/* 헤더 */}
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-semibold text-gray-900 dark:text-white">
                    {readingSheet.emoji} {readingSheet.label}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {(() => {
                      const date = new Date();
                      return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
                    })()}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!readingUploading) {
                      setReadingSheet(null);
                      setReadingMinutes('');
                      setReadingImageUrl(null);
                    }
                  }}
                  disabled={readingUploading}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 컨텐츠 영역 */}
            <div className="px-5 py-4 flex-1 overflow-y-auto">
              {/* 숫자 입력 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  오늘 독서 시간
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    autoFocus
                    value={readingMinutes}
                    onChange={(e) => setReadingMinutes(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    disabled={readingUploading}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-[rgb(254,252,247)] dark:bg-gray-800 text-gray-900 dark:text-white text-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
                    {readingSheet.unit}
                  </span>
                </div>
              </div>

              {/* 사진 업로드 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  오늘 책 사진 (선택)
                </label>
                
                {readingUploading ? (
                  <div className="flex items-center justify-center h-24 bg-gray-100 dark:bg-gray-800 rounded-xl">
                    <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                ) : readingImageUrl ? (
                  <div className="relative mb-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={readingImageUrl}
                      alt="업로드된 사진"
                      className="w-full h-48 object-cover rounded-xl"
                    />
                    <button
                      onClick={() => setReadingImageUrl(null)}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleReadingImageUpload(file);
                        }
                      }}
                      className="hidden"
                    />
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">📷 사진 추가</span>
                  </label>
                )}
              </div>
            </div>

            {/* 독서 일기 쓰기 버튼 */}
            <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleWriteDiary}
                disabled={readingUploading}
                className="w-full flex items-center justify-center gap-2 py-3 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors font-medium disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                ✏️ 독서 일기 쓰기
              </button>
            </div>

            {/* 액션 버튼 */}
            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 flex-shrink-0">
              <button
                onClick={() => {
                  setReadingSheet(null);
                  setReadingMinutes('');
                  setReadingImageUrl(null);
                }}
                disabled={readingUploading}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={saveReadingSheet}
                disabled={readingUploading}
                className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors font-medium disabled:opacity-50"
              >
                {readingUploading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div 
        className="flex items-center gap-3 py-2 min-h-[44px] cursor-pointer"
          onClick={onExpandToggle}
      >
        {/* 원형 그래프 + 아이콘 + 텍스트 영역 */}
        <div className="flex items-center gap-3 flex-1">
          <div className="flex-shrink-0">
            <CircularProgressChart 
              progress={getMonthProgress(currentYear, currentMonth, routineId)} 
              size={36}
            />
          </div>
          <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">
            {getRoutineIcon(label)}
          </span>
          <span className={`text-sm ${checked ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400'}`} style={{ lineHeight: '22px' }}>
            {label}
          </span>
        </div>
        
        {/* 연속 일수 + 슬라이더 + 오늘 날짜 체크박스 */}
        <div className="flex items-center gap-2 shrink-0">
          {/* 스트릭 (체크박스 타입일 때만) */}
          {routineType === 'checkbox' && consecutiveDays > 0 && (
            <span className="text-xs text-blue-400 dark:text-blue-500 font-medium">
              {consecutiveDays}일 연속
            </span>
          )}
          
          {/* 연간 누적 (숫자 타입일 때) */}
          {routineType === 'number' && yearlyTotal > 0 && (
            <div
              className="px-2 py-1 text-[9px] font-medium rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
            >
              {(Number.isInteger(yearlyTotal) ? String(yearlyTotal) : yearlyTotal.toFixed(1))}
              {(unit || '').toLowerCase()}
            </div>
          )}
          
          {/* 숫자 입력 필드 (숫자 타입일 때) - 최근 5일 */}
          {routineType === 'number' && unit && (
            <div className="flex items-center gap-1 shrink-0">
              {/* 오늘 날짜 체크박스 (숫자 타입) */}
              <div
                onClick={handleTodayToggle}
                className={`w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer mr-1 ${
                  isTodayChecked
                    ? 'bg-blue-500 border-blue-500'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600'
                }`}
                title="오늘 기록 추가"
              >
                {isTodayChecked && (
                  <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                    <path
                      d="M1 4L4.5 7.5L11 1"
                      stroke="white"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              
              {(() => {
                const today = new Date();
                const buttons = [];
                
                for (let i = 4; i >= 0; i--) {
                  const date = new Date(today);
                  date.setDate(date.getDate() - i);
                  
                  // 한국 시간으로 변환
                  const koreaTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
                  const dateStr = `${koreaTime.getUTCFullYear()}-${String(koreaTime.getUTCMonth() + 1).padStart(2, '0')}-${String(koreaTime.getUTCDate()).padStart(2, '0')}`;
                  const isToday = i === 0;
                  
                  // 해당 날짜의 값 가져오기 (연간 값 맵에서)
                  const dayValue = numberDateValues[dateStr] ?? null;
                  
                  buttons.push(
                    <button
                      key={dateStr}
                      onClick={(e) => {
                        e.stopPropagation();
                        setNumberInputModal({
                          open: true,
                          dateStr,
                          valueText: dayValue !== null ? dayValue.toFixed(1) : '0.0',
                        });
                      }}
                      className="flex flex-col items-center justify-center font-medium text-gray-700 dark:text-gray-300 bg-[rgb(254,252,247)] dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors cursor-pointer active:scale-95 overflow-hidden"
                      title={`${dateStr} 값 입력`}
                      style={{ width: '20px', height: '20px', minWidth: '20px', maxWidth: '20px', fontSize: '8px', padding: '1px', lineHeight: '1' }}
                    >
                      <span 
                        className={`font-bold ${dayValue !== null && dayValue !== 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`} 
                        style={{ fontSize: '14px' }}
                      >
                        {dayValue !== null ? Math.round(dayValue) : '0'}
                      </span>
                      <span className="text-gray-600 dark:text-gray-300" style={{ fontSize: '7px' }}>{unit}</span>
                    </button>
                  );
                }
                
                return buttons;
              })()}
            </div>
          )}
          
          {/* 최근 5일 체크박스 (체크박스 타입일 때) */}
          {routineType === 'checkbox' && (
            <div className="flex items-center gap-1 shrink-0">
              {(() => {
                const today = new Date();
                const checkboxes = [];
                
                const handleCheckboxToggle = async (dateStr: string) => {
                  if (!supabase) return;
                  
                  const isCurrentlyChecked = checkedDates[dateStr]?.has(routineId) || false;
                  const newChecked = !isCurrentlyChecked;
                  
                  try {
                    if (newChecked) {
                      await supabase
                        .from('daily_routine_checks')
                        .upsert({
                          user_id: userId,
                          date: dateStr,
                          routine_id: routineId,
                          checked: true
                        }, {
                          onConflict: 'user_id,date,routine_id'
                        });
                    } else {
                      await supabase
                        .from('daily_routine_checks')
                        .delete()
                        .eq('date', dateStr)
                        .eq('routine_id', routineId)
                        .eq('user_id', userId);
                    }
                    
                    // 상태 업데이트
                    setCheckedDates(prev => {
                      const newData = { ...prev };
                      if (!newData[dateStr]) {
                        newData[dateStr] = new Set();
                      }
                      
                      const dateSet = new Set(newData[dateStr]);
                      if (newChecked) {
                        dateSet.add(routineId);
                      } else {
                        dateSet.delete(routineId);
                      }
                      
                      if (dateSet.size === 0) {
                        delete newData[dateStr];
                      } else {
                        newData[dateStr] = dateSet;
                      }
                      
                      return newData;
                    });
                  } catch (err) {
                    console.error('체크박스 토글 오류:', err);
                  }
                };
                
                for (let i = 4; i >= 0; i--) {
                  const date = new Date(today);
                  date.setDate(date.getDate() - i);
                  
                  // 한국 시간으로 변환
                  const koreaTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
                  const dateStr = `${koreaTime.getUTCFullYear()}-${String(koreaTime.getUTCMonth() + 1).padStart(2, '0')}-${String(koreaTime.getUTCDate()).padStart(2, '0')}`;
                  const isChecked = checkedDates[dateStr]?.has(routineId) || false;
                  const isToday = i === 0;
                  
                  checkboxes.push(
                    <div
                      key={dateStr}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCheckboxToggle(dateStr);
                      }}
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-blue-500 border-blue-500'
                          : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      {isChecked && (
                        <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                          <path
                            d="M1 4L4.5 7.5L11 1"
                            stroke="white"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  );
                }
                
                return checkboxes;
              })()}
            </div>
          )}
        </div>
      </div>
      {!isLast && <div style={{ height: '0.5px' }} className="bg-gray-200 dark:bg-gray-600"></div>}
      
      {/* 확장된 루틴의 캘린더 표시 */}
      {isExpanded && imageUploadEnabled && routineTemplateData && (
        <div className="mt-2 pb-2 -mx-4 sm:-mx-5">
          <RoutineCalendar
            userId={userId}
            routineId={routineId}
            routineLabel={label}
            routineEmoji={emoji}
            routineTemplates={routineTemplates}
            isExpanded={true}
            editModeRoutine={editModeRoutine}
            setEditModeRoutine={setEditModeRoutine}
            syncTick={syncTick}
            onSync={onSync}
            imageUploadEnabled={imageUploadEnabled}
          />
        </div>
      )}
    </div>
  );
}

// 식사 체크박스 컴포넌트
function MealCheckbox({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer min-h-[44px] py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="w-6 h-6 text-blue-500 bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
      />
      <span className={`text-sm ${checked ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400'}`} style={{ lineHeight: '22px' }}>
        {label}
      </span>
    </label>
  );
}

// 루틴별 캘린더 컴포넌트
function RoutineCalendar({
  userId,
  routineId,
  routineLabel,
  routineEmoji,
  routineTemplates,
  isExpanded = false,
  editModeRoutine,
  setEditModeRoutine,
  syncTick,
  onSync,
  imageUploadEnabled = false,
}: {
  userId: string;
  routineId: string;
  routineLabel: string;
  routineEmoji: string;
  routineTemplates: RoutineTemplate[];
  isExpanded?: boolean;
  editModeRoutine: string | null;
  setEditModeRoutine: (routineId: string | null) => void;
  syncTick: number;
  onSync: () => void;
  imageUploadEnabled?: boolean;
}) {
  const [checkedDates, setCheckedDates] = useState<Record<string, Set<string>>>({});
  const [dateValues, setDateValues] = useState<Record<string, number>>({});
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [bookTitles, setBookTitles] = useState<Record<string, string>>({});
  const [memos, setMemos] = useState<Record<string, string>>({});
  const [uploadingDate, setUploadingDate] = useState<string | null>(null);
  const calendarScrollRef = useRef<HTMLDivElement>(null);
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  
  // 선택된 연도와 월 상태 관리
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<string>(String(currentMonth));

  // 아코디언이 펼쳐질 때 이미지 업로드 루틴은 현재 월, 그 외는 전체 뷰로 자동 전환
  useEffect(() => {
    if (isExpanded) {
      if (imageUploadEnabled) {
        setSelectedMonth(String(currentMonth));
      } else {
        setSelectedMonth('all');
      }
    }
  }, [isExpanded, imageUploadEnabled, currentMonth]);

  // Supabase 클라이언트 싱글톤 사용
  const supabase = getSupabase();

  // 3개월 목록 생성 (이전, 현재, 다음)
  const getThreeMonths = useCallback(() => {
    const months = [];
    for (let i = -1; i <= 1; i++) {
      let year = currentYear;
      let month = currentMonth + i;
      
      if (month < 1) {
        month += 12;
        year -= 1;
      } else if (month > 12) {
        month -= 12;
        year += 1;
      }
      
      months.push({ year, month });
    }
    return months;
  }, [currentYear, currentMonth]);

  // Supabase에서 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      if (!supabase) return;
      
      try {
        // 선택된 년도의 모든 날짜에 대한 체크 데이터 로드
        const allDates: string[] = [];
        for (let month = 1; month <= 12; month++) {
          const daysInMonth = new Date(selectedYear, month, 0).getDate();
          for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${selectedYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            allDates.push(dateStr);
          }
        }

        const { data: checks, error } = await supabase
          .from('daily_routine_checks')
          .select('date, routine_id, checked, value, image_url, book_title, memo')
          .in('date', allDates)
          .eq('user_id', userId)
          .eq('routine_id', routineId)
          .eq('checked', true);

        if (error) {
          console.error('루틴 체크 데이터 로드 오류:', error);
          return;
        }

        // 데이터를 Record<string, Set<string>> 형태로 변환
        const data: Record<string, Set<string>> = {};
        const values: Record<string, number> = {};
        const imgs: Record<string, string> = {};
        const titles: Record<string, string> = {};
        const notes: Record<string, string> = {};
        if (checks && checks.length > 0) {
          checks.forEach((check: any) => {
            if (!data[check.date]) {
              data[check.date] = new Set();
            }
            data[check.date].add(check.routine_id);

            // value가 있으면 저장
            if (check.value != null) {
              values[check.date] = check.value;
            }
            // image_url이 있으면 저장
            if (check.image_url) {
              imgs[check.date] = check.image_url;
            }
            // book_title이 있으면 저장
            if (check.book_title) {
              titles[check.date] = check.book_title;
            }
            // memo가 있으면 저장
            if (check.memo) {
              notes[check.date] = check.memo;
            }
          });
        }

        setCheckedDates(data);
        setDateValues(values);
        setImageUrls(imgs);
        setBookTitles(titles);
        setMemos(notes);
      } catch (err) {
        console.error('데이터 로드 오류:', err);
      }
    };
    
    loadData();
    
    // 주기적으로 업데이트 (30초마다)
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [supabase, routineId, selectedYear, syncTick]);

  // 토글이 열릴 때 또는 선택이 변경될 때 스크롤 위치 설정
  useEffect(() => {
    if (isExpanded && calendarScrollRef.current) {
      // 오늘 날짜를 기준으로 계산
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // 선택된 년도와 월에 따라 시작 위치 계산
      const startYear = selectedYear;
      const startMonth = selectedMonth === 'all' ? 1 : parseInt(selectedMonth);
      
      const firstDayOfMonth = new Date(startYear, startMonth - 1, 1);
      const firstDayWeekday = firstDayOfMonth.getDay();
      const firstDayMondayIndex = (firstDayWeekday + 6) % 7;
      const firstMonday = new Date(firstDayOfMonth);
      if (firstDayMondayIndex !== 0) {
        firstMonday.setDate(firstMonday.getDate() - firstDayMondayIndex);
      }
      firstMonday.setHours(0, 0, 0, 0);
      
      // 오늘 날짜가 몇 번째 주인지 계산 (0부터 시작)
      const daysDiff = Math.floor((today.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24));
      const weekIndex = Math.floor(daysDiff / 7);
      
      // 약간의 지연을 두고 스크롤 (DOM 렌더링 완료 후)
      const timeoutId = setTimeout(() => {
        if (calendarScrollRef.current) {
          const container = calendarScrollRef.current;
          const containerWidth = container.clientWidth;
          
          // 요일 헤더 너비: 28px (2/3 크기)
          const headerWidth = 28;
          // 주 너비: 26px (셀) + 3px (gap) = 29px (2/3 크기)
          const weekWidth = 26 + 3;
          
          // 오늘 날짜가 포함된 주 시작 위치 (요일 헤더 포함)
          const todayWeekStartPosition = headerWidth + (weekIndex * weekWidth);
          
          // 오늘 날짜가 포함된 주를 화면 정 중앙에 배치하기 위한 스크롤 위치 계산
          // 스크롤 위치 = 오늘 주 시작 위치 - (컨테이너 너비 / 2) + (주 너비 / 2)
          const scrollPosition = Math.max(0, todayWeekStartPosition - (containerWidth / 2) + (weekWidth / 2));
          
          container.scrollLeft = scrollPosition;
        }
      }, 600);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isExpanded, selectedYear, selectedMonth]);


  // 특정 월의 날짜 목록 생성
  const getMonthDays = (year: number, month: number) => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = [];
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        day,
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      });
    }
    return days;
  };

  // 주 단위로 날짜 배열 생성 (세로: 요일, 가로: 주)
  // 첫 번째 열에 1,2,3,4,5,6,7이 오도록 주 단위로 구성
  const getWeekBasedDateGrid = (startYear: number, startMonth: number | string, numWeeks: number = 8) => {
    // 시작 날짜: 해당 월의 첫 날
    const monthNum = typeof startMonth === 'string' ? parseInt(startMonth) : startMonth;
    const firstDayOfMonth = new Date(startYear, monthNum - 1, 1);
    
    // 첫 날의 요일 (0=일요일, 1=월요일, ..., 6=토요일)
    const firstDayWeekday = firstDayOfMonth.getDay();
    
    // 월요일 인덱스로 변환 (월요일=0, 화요일=1, ..., 일요일=6)
    const firstDayMondayIndex = (firstDayWeekday + 6) % 7; // 일요일(0)을 6으로 변환
    
    // 해당 월의 첫 월요일 계산
    // 첫 날이 월요일이 아니면 이전 주 월요일로 이동
    const firstMonday = new Date(firstDayOfMonth);
    if (firstDayMondayIndex !== 0) {
      firstMonday.setDate(firstMonday.getDate() - firstDayMondayIndex);
    }
    
    // 주 단위로 날짜 그룹화
    // weeks[0] = 첫 번째 주 [월, 화, 수, 목, 금, 토, 일]
    // weeks[1] = 두 번째 주 [월, 화, 수, 목, 금, 토, 일]
    const weeks: Array<Array<{ 
      day: number; 
      date: string; 
      month: number; 
      year: number;
      isNewMonth: boolean;
    }>> = [];
    
    let currentDate = new Date(firstMonday);
    let prevMonth = currentDate.getMonth() + 1;
    let prevYear = currentDate.getFullYear();
    
    // numWeeks 주만큼 날짜 생성
    for (let weekIdx = 0; weekIdx < numWeeks; weekIdx++) {
      const week: Array<{ 
        day: number; 
        date: string; 
        month: number; 
        year: number;
        isNewMonth: boolean;
      }> = [];
      
      // 한 주의 7일 (월요일~일요일)
      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const day = currentDate.getDate();
        
        // 월 변경 감지: 이전 날짜와 비교
        const isNewMonth = (month !== prevMonth || year !== prevYear);
        
        week.push({
          day,
          date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          month,
          year,
          isNewMonth
        });
        
        // 이전 값 업데이트
        prevMonth = month;
        prevYear = year;
        
        // 다음 날로 이동
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      weeks.push(week);
    }
    
    return weeks;
  };

  // 날짜 체크 상태 확인
  const isDateChecked = (date: string, routineId: string) => {
    return checkedDates[date]?.has(routineId) || false;
  };

  // 날짜 클릭 핸들러 (체크/언체크 또는 숫자 입력)
  const handleDateToggle = async (date: string, routineId: string) => {
    if (editModeRoutine !== routineId) return;
    if (!supabase) return;
    
    // 루틴 타입 확인
    const routine = routineTemplates.find(r => r.id === routineId);
    const routineType = routine?.type || 'checkbox';
    
    if (routineType === 'number') {
      // 숫자 타입: 입력 모달 표시
      const currentValue = dateValues[date] || '';
      const inputValue = prompt(`${date} 날짜의 값을 입력하세요:`, String(currentValue));
      
      if (inputValue === null) return; // 취소
      
      const numValue = inputValue === '' ? null : parseFloat(inputValue);
      
      if (inputValue !== '' && (isNaN(numValue as number) || numValue === null)) {
        alert('올바른 숫자를 입력해주세요.');
        return;
      }
      
      try {
        if (numValue === null || inputValue === '') {
          // 값 삭제
          const { error } = await supabase
            .from('daily_routine_checks')
            .delete()
            .eq('date', date)
            .eq('routine_id', routineId)
            .eq('user_id', userId);
          
          if (error) {
            console.error('Supabase 삭제 오류:', error);
            return;
          }
          
          // 로컬 상태 업데이트
          setDateValues(prev => {
            const newValues = { ...prev };
            delete newValues[date];
            return newValues;
          });
          onSync();
        } else {
          // 값 저장
          const { error } = await supabase
            .from('daily_routine_checks')
            .upsert({
              user_id: userId,
              date: date,
              routine_id: routineId,
              checked: true,
              value: numValue
            }, {
              onConflict: 'user_id,date,routine_id'
            });
          
          if (error) {
            console.error('Supabase 저장 오류:', error);
            return;
          }
          
          // 로컬 상태 업데이트
          setDateValues(prev => ({
            ...prev,
            [date]: numValue
          }));
          
          setCheckedDates(prev => {
            const newDates = { ...prev };
            if (!newDates[date]) {
              newDates[date] = new Set();
            }
            newDates[date].add(routineId);
            return newDates;
          });
          onSync();
        }
      } catch (err) {
        console.error('데이터 저장 오류:', err);
      }
    } else {
      // 체크박스 타입: 기존 토글 로직
      const isCurrentlyChecked = isDateChecked(date, routineId);
      const newChecked = !isCurrentlyChecked;
      
      try {
        if (newChecked) {
          // 체크: insert 또는 update
          const { error } = await supabase
            .from('daily_routine_checks')
            .upsert({
              user_id: userId,
              date: date,
              routine_id: routineId,
              checked: true
            }, {
              onConflict: 'user_id,date,routine_id'
            });
          
          if (error) {
            console.error('Supabase 저장 오류:', error);
            return;
          }
        } else {
          // 언체크: delete
          const { error } = await supabase
            .from('daily_routine_checks')
            .delete()
            .eq('date', date)
            .eq('routine_id', routineId)
            .eq('user_id', userId);
        
          if (error) {
            console.error('Supabase 삭제 오류:', error);
            return;
          }
        }
        
        // 상태 업데이트
        setCheckedDates(prev => {
          const newData = { ...prev };
          if (!newData[date]) {
            newData[date] = new Set();
          }
          
          const dateSet = new Set(newData[date]);
          if (newChecked) {
            dateSet.add(routineId);
          } else {
            dateSet.delete(routineId);
          }
          
          if (dateSet.size === 0) {
            delete newData[date];
          } else {
            newData[date] = dateSet;
          }
          
          return newData;
        });
        onSync();
      } catch (err) {
        console.error('예상치 못한 오류:', err);
      }
    }
  };

  // 독서 모달 저장 핸들러
  // 분(minutes) 입력 핸들러 (독서 루틴용)
  const handleMinutesChange = async (date: string, routineId: string, value: number | null) => {
    if (!supabase || !userId) return;

    try {
      if (value === null || value === 0) {
        // 값이 없으면 삭제
        const { error } = await supabase
          .from('daily_routine_checks')
          .delete()
          .eq('date', date)
          .eq('routine_id', routineId)
          .eq('user_id', userId);
        
        if (error) {
          console.error('분 기록 삭제 오류:', error);
          return;
        }
        
        setDateValues(prev => {
          const newValues = { ...prev };
          delete newValues[date];
          return newValues;
        });
        
        setCheckedDates(prev => {
          const newDates = { ...prev };
          if (newDates[date]) {
            newDates[date].delete(routineId);
            if (newDates[date].size === 0) {
              delete newDates[date];
            }
          }
          return newDates;
        });
      } else {
        // 값 저장
        const { error } = await supabase
          .from('daily_routine_checks')
          .upsert({
            user_id: userId,
            date: date,
            routine_id: routineId,
            checked: true,
            value: value
          }, {
            onConflict: 'user_id,date,routine_id'
          });
        
        if (error) {
          console.error('분 기록 저장 오류:', error);
          return;
        }
        
        setDateValues(prev => ({
          ...prev,
          [date]: value
        }));
        
        setCheckedDates(prev => {
          const newDates = { ...prev };
          if (!newDates[date]) {
            newDates[date] = new Set();
          }
          newDates[date].add(routineId);
          return newDates;
        });
      }
      onSync();
    } catch (err) {
      console.error('분 기록 처리 오류:', err);
    }
  };

  // 루틴 이미지 업로드 핸들러
  const handleImageUpload = async (date: string, file: File) => {
    if (!supabase) return;
    setUploadingDate(date);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const filePath = `${userId}/${routineId}/${date}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('routine-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('이미지 업로드 오류:', uploadError);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('routine-images')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      const { error: dbError } = await supabase
        .from('daily_routine_checks')
        .upsert({
          user_id: userId,
          date: date,
          routine_id: routineId,
          checked: true,
          image_url: publicUrl
        }, { onConflict: 'user_id,date,routine_id' });

      if (dbError) {
        console.error('이미지 URL DB 저장 오류:', dbError);
        return;
      }

      setImageUrls(prev => ({ ...prev, [date]: publicUrl }));
      setCheckedDates(prev => {
        const newDates = { ...prev };
        if (!newDates[date]) newDates[date] = new Set();
        newDates[date].add(routineId);
        return newDates;
      });
      onSync();
    } catch (err) {
      console.error('이미지 업로드 실패:', err);
    } finally {
      setUploadingDate(null);
    }
  };

  // 월별 체크 비율 계산 (0~100%)
  const getMonthProgress = (year: number, month: number, routineId: string) => {
    const days = getMonthDays(year, month);
    let checkedCount = 0;
    
    days.forEach(({ date }) => {
      if (isDateChecked(date, routineId)) {
        checkedCount++;
      }
    });
    
    return days.length > 0 ? (checkedCount / days.length) * 100 : 0;
  };

  // 연속 체크한 날짜 수 계산 (현재 날짜 기준)
  const getConsecutiveDays = (routineId: string) => {
    const getKoreaDateString = (date: Date): string => {
      // 한국 시간으로 변환 (UTC+9)
      const koreaTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
      const year = koreaTime.getUTCFullYear();
      const month = String(koreaTime.getUTCMonth() + 1).padStart(2, '0');
      const day = String(koreaTime.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    let consecutiveCount = 0;
    const today = new Date();
    
    // 오늘부터 과거로 거슬러 올라가며 연속 체크된 날짜 계산
    let checkDate = new Date(today);
    
    while (true) {
      const dateStr = getKoreaDateString(checkDate);
      if (isDateChecked(dateStr, routineId)) {
        consecutiveCount++;
        // 하루 전으로 이동
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
      
      // 무한 루프 방지 (최대 365일까지 확인)
      if (consecutiveCount > 365) break;
    }
    
    return consecutiveCount;
  };

  // 루틴 색상은 항상 기본값(blue) 사용
  const routineColor = '#3B82F6';
  
  // hex 색상을 RGB로 변환
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 59, g: 130, b: 246 };
  };
  
  // 색상 밝기 계산 (0-255)
  const getBrightness = (hex: string) => {
    const rgb = hexToRgb(hex);
    return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  };
  
  // hex를 rgba로 변환
  const hexToRgba = (hex: string, alpha: number) => {
    const rgb = hexToRgb(hex);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  };
  
  // 색상별 클래스 매핑 (hex 색상 지원)
  const getColorClasses = (color: string) => {
    // hex 색상인 경우
    if (color.startsWith('#')) {
      const brightness = getBrightness(color);
      const isLight = brightness > 128;
      const lightColor = hexToRgba(color, 0.2); // 20% 투명도
      const darkColor = hexToRgba(color, 0.3); // 30% 투명도
      const textColor = isLight ? '#1E3A8A' : '#60A5FA';
      const textDarkColor = isLight ? '#3B82F6' : '#93C5FD';
      
      return {
        bg: color,
        bgLight: lightColor,
        bgDark: darkColor,
        text: textColor,
        textDark: textDarkColor,
        ring: color,
        button: color,
        buttonHover: color,
      };
    }
    
    // 기존 색상 이름 매핑
    const colorMap: Record<string, { bg: string; bgLight: string; bgDark: string; text: string; textDark: string; button: string; buttonHover: string }> = {
      blue: { bg: 'bg-blue-500', bgLight: 'bg-blue-100', bgDark: 'bg-blue-900/30', text: 'text-blue-700', textDark: 'text-blue-400', button: 'bg-blue-600', buttonHover: 'hover:bg-blue-700' },
      purple: { bg: 'bg-purple-500', bgLight: 'bg-purple-100', bgDark: 'bg-purple-900/30', text: 'text-purple-700', textDark: 'text-purple-400', button: 'bg-purple-600', buttonHover: 'hover:bg-purple-700' },
      green: { bg: 'bg-green-500', bgLight: 'bg-green-100', bgDark: 'bg-green-900/30', text: 'text-green-700', textDark: 'text-green-400', button: 'bg-green-600', buttonHover: 'hover:bg-green-700' },
      red: { bg: 'bg-red-500', bgLight: 'bg-red-100', bgDark: 'bg-red-900/30', text: 'text-red-700', textDark: 'text-red-400', button: 'bg-red-600', buttonHover: 'hover:bg-red-700' },
      yellow: { bg: 'bg-yellow-500', bgLight: 'bg-yellow-100', bgDark: 'bg-yellow-900/30', text: 'text-yellow-700', textDark: 'text-yellow-400', button: 'bg-yellow-600', buttonHover: 'hover:bg-yellow-700' },
      orange: { bg: 'bg-orange-500', bgLight: 'bg-orange-100', bgDark: 'bg-orange-900/30', text: 'text-orange-700', textDark: 'text-orange-400', button: 'bg-orange-600', buttonHover: 'hover:bg-orange-700' },
      pink: { bg: 'bg-pink-500', bgLight: 'bg-pink-100', bgDark: 'bg-pink-900/30', text: 'text-pink-700', textDark: 'text-pink-400', button: 'bg-pink-600', buttonHover: 'hover:bg-pink-700' },
      indigo: { bg: 'bg-indigo-500', bgLight: 'bg-indigo-100', bgDark: 'bg-indigo-900/30', text: 'text-indigo-700', textDark: 'text-indigo-400', button: 'bg-indigo-600', buttonHover: 'hover:bg-indigo-700' },
    };
    return colorMap[color] || colorMap.blue;
  };
  
  const colorClasses = getColorClasses(routineColor);
  const isHexColor = routineColor.startsWith('#');
  const consecutiveDays = getConsecutiveDays(routineId);

  return (
    <div className="bg-gray-50 dark:bg-gray-800 p-2 sm:p-3 w-full">
      {/* 날짜 선택 + 수정 버튼 */}
      <div className="flex items-center justify-between mb-3 gap-2">
        {/* 왼쪽: 연도/월 선택 드롭다운 */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* 연도 선택 */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-2 py-1 text-sm font-medium bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
          >
            {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map(year => (
              <option key={year} value={year}>{year}년</option>
            ))}
          </select>
          
          {/* 월 선택 */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-2 py-1 text-sm font-medium bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
          >
            <option value="all">전체</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
              <option key={month} value={String(month)}>{month}월</option>
            ))}
          </select>
        </div>
        
        {/* 오른쪽: 편집 모드 토글 버튼 */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditModeRoutine(editModeRoutine === routineId ? null : routineId);
            }}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              editModeRoutine === routineId
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-500 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600'
            }`}
          >
            {editModeRoutine === routineId ? '✓ 편집중' : '✏️ 편집'}
          </button>
        </div>
      </div>
      

      {/* 캘린더 컨테이너 */}
      {imageUploadEnabled && selectedMonth !== 'all' ? (
        // 이미지 업로드 루틴: 월 캘린더 그리드 (이미지 + 분 표시)
        (() => {
          const monthNum = parseInt(selectedMonth);
          const firstDay = new Date(selectedYear, monthNum - 1, 1);
          const lastDay = new Date(selectedYear, monthNum, 0);
          const firstDayWeekday = (firstDay.getDay() + 6) % 7;
          const totalDays = lastDay.getDate() + firstDayWeekday;
          const numWeeks = Math.ceil(totalDays / 7);
          const weeks = getWeekBasedDateGrid(selectedYear, selectedMonth, numWeeks);
          const getKoreaToday = (): string => {
            const now = new Date();
            const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
            return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
          };
          const todayStr = getKoreaToday();

          return (
            <div className="w-full">
              {/* 요일 헤더 */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['월', '화', '수', '목', '금', '토', '일'].map((d, i) => (
                  <div
                    key={d}
                    className="text-center text-xs font-bold py-1"
                    style={{
                      color: i === 5 ? '#3B82F6' : i === 6 ? '#EF4444' : '#6B7280'
                    }}
                  >
                    {d}
                  </div>
                ))}
              </div>
              {/* 주별 행 */}
              {weeks.map((week, weekIdx) => (
                <div key={weekIdx} className="grid grid-cols-7 gap-1 mb-1">
                  {week.map((cell, dayIdx) => {
                    const { day, date, month: cellMonth, year: cellYear } = cell;
                    const isCurrentMonth = cellMonth === monthNum && cellYear === selectedYear;
                    const isToday = date === todayStr;
                    const isChecked = isDateChecked(date, routineId);
                    const imgUrl = imageUrls[date];
                    const minutes = dateValues[date];
                    const isUploading = uploadingDate === date;
                    const inEditMode = editModeRoutine === routineId;
                    const isSat = dayIdx === 5;
                    const isSun = dayIdx === 6;

                    return (
                      <div
                        key={`${weekIdx}-${dayIdx}`}
                        className="relative flex flex-col rounded-lg overflow-hidden cursor-pointer"
                        style={{
                          height: '72px',
                          border: isToday ? '2px solid #60A5FA' : '1px solid',
                          borderColor: isToday ? '#60A5FA' : isChecked ? 'rgba(59,130,246,0.3)' : 'rgba(107,114,128,0.2)',
                          backgroundColor: isChecked
                            ? 'rgba(59,130,246,0.06)'
                            : 'rgba(249,250,251,0.8)',
                          opacity: isCurrentMonth ? 1 : 0.25
                        }}
                      >
                        {/* 날짜 숫자 */}
                        <div
                          className="absolute top-1 left-1.5 text-xs font-semibold leading-none z-10"
                          style={{
                            color: isSat ? '#3B82F6' : isSun ? '#EF4444' : isChecked ? '#1D4ED8' : '#9CA3AF',
                            fontSize: '10px'
                          }}
                        >
                          {day}
                        </div>

                        {/* 이미지 영역 — 고정 높이 박스 */}
                        <div
                          className="absolute"
                          style={{ top: '18px', left: 0, right: 0, height: '36px', overflow: 'hidden' }}
                        >
                          {isUploading ? (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : imgUrl ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={imgUrl}
                                alt={`${date} ${routineLabel}`}
                                className="w-full h-full object-cover"
                              />
                              {inEditMode && isCurrentMonth && (
                                <>
                                  <label
                                    htmlFor={`img-upload-${date}`}
                                    className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all flex items-center justify-center opacity-0 hover:opacity-100 cursor-pointer"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                  </label>
                                  <input
                                    id={`img-upload-${date}`}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (file) await handleImageUpload(date, file);
                                      e.target.value = '';
                                    }}
                                  />
                                </>
                              )}
                            </>
                          ) : (
                            inEditMode && isCurrentMonth && (
                              <>
                                <label
                                  htmlFor={`img-upload-${date}`}
                                  className="w-full h-full flex items-center justify-center cursor-pointer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                </label>
                                <input
                                  id={`img-upload-${date}`}
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) await handleImageUpload(date, file);
                                    e.target.value = '';
                                  }}
                                />
                              </>
                            )
                          )}
                        </div>

                        {/* 책 제목 + 분 기록 — 하단 고정 */}
                        {isCurrentMonth && (
                          <div
                            className="absolute bottom-0 left-0 right-0 px-0.5 pb-0.5 flex flex-col items-center"
                            style={{ minHeight: '18px' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* 책 제목 미리보기 */}
                            {!inEditMode && bookTitles[date] && (
                              <div
                                className="text-gray-600 dark:text-gray-400 truncate w-full text-center"
                                style={{ fontSize: '8px', lineHeight: '10px', maxHeight: '10px' }}
                                title={bookTitles[date]}
                              >
                                {bookTitles[date]}
                              </div>
                            )}
                            {/* 분 기록 */}
                            <div className="w-full text-center">
                              {inEditMode ? (
                                <input
                                  type="number"
                                  min="0"
                                  max="999"
                                  value={minutes ?? ''}
                                  placeholder="-"
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? null : Number(e.target.value);
                                    handleMinutesChange(date, routineId, val);
                                  }}
                                  style={{
                                    width: '100%',
                                    fontSize: '10px',
                                    textAlign: 'center',
                                    background: 'transparent',
                                    border: 'none',
                                    borderBottom: '1px solid rgba(59,130,246,0.4)',
                                    outline: 'none',
                                    color: '#2563EB',
                                    fontWeight: 'bold',
                                    padding: '0',
                                  }}
                                />
                              ) : (
                                minutes != null ? (
                                  <span
                                    className="text-blue-600 dark:text-blue-400 font-bold"
                                    style={{ fontSize: '10px' }}
                                  >
                                    {minutes}분
                                  </span>
                                ) : null
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })()
      ) : selectedMonth === 'all' ? (
        // 연간 뷰: 쿼터별로 12개월 표시
        <div className="space-y-2">
          {/* Q1, Q2, Q3, Q4 */}
          {[0, 1, 2, 3].map((quarterIdx) => {
            // 쿼터의 3개월 데이터를 모두 수집
            const quarterMonths = Array.from({ length: 3 }, (_, monthInQuarter) => {
              const month = quarterIdx * 3 + monthInQuarter + 1;
              const firstDay = new Date(selectedYear, month - 1, 1);
              const lastDay = new Date(selectedYear, month, 0);
              const firstDayWeekday = (firstDay.getDay() + 6) % 7;
              const totalDays = lastDay.getDate() + firstDayWeekday;
              const numWeeks = Math.ceil(totalDays / 7);
              const weeks = getWeekBasedDateGrid(selectedYear, month, numWeeks);
              return { month, weeks };
            });
            
            return (
              <div key={quarterIdx} className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-gray-300 dark:border-gray-700 shadow-sm p-2">
                {/* 쿼터 전체 캘린더 그리드 */}
                <div className="flex gap-1 w-full">
                  {quarterMonths.map(({ month, weeks }) => (
                    <div
                      key={month}
                      className="flex-1 relative"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${weeks.length}, 1fr)`,
                        gridTemplateRows: 'repeat(7, 22px)',
                        gap: '1px'
                      }}
                    >
                      {/* 워터마크 */}
                      <div 
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        style={{
                          fontSize: '64px',
                          fontWeight: '900',
                          color: 'rgba(59, 130, 246, 0.15)',
                          zIndex: 0
                        }}
                      >
                        {month}
                      </div>
                  {/* 주별 날짜 열들 */}
                  {weeks.map((week, weekIdx) => {
                    return week.map((cell, weekdayIdx) => {
                      const { day, date, month: cellMonth, year } = cell;
                      const isCurrentMonth = cellMonth === month && year === selectedYear;
                      const isChecked = isDateChecked(date, routineId);
                      
                      // 한국 시간대 기준 오늘 날짜 확인
                      const getKoreaDateString = (): string => {
                        const now = new Date();
                        const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
                        const year = koreaTime.getUTCFullYear();
                        const month = String(koreaTime.getUTCMonth() + 1).padStart(2, '0');
                        const day = String(koreaTime.getUTCDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                      };
                      const isToday = date === getKoreaDateString();
                      const isSaturday = weekdayIdx === 5;
                      const isSunday = weekdayIdx === 6;
                      
                      // 배경색 결정
                      let backgroundColor = 'rgba(75, 85, 99, 0.15)';
                      if (isChecked) {
                        backgroundColor = '#9CA3AF'; // 체크된 날짜는 모두 회색
                      } else if (isSaturday || isSunday) {
                        backgroundColor = 'rgba(75, 85, 99, 0.15)'; // 토/일요일도 회색 배경
                      }
                      
                      return (
                        <div
                          key={`${weekIdx}-${weekdayIdx}`}
                          className={`
                            flex items-center justify-center relative
                            ${editModeRoutine === routineId && isCurrentMonth ? 'cursor-pointer' : 'cursor-default'}
                            transition-all duration-200
                            ${editModeRoutine === routineId && isCurrentMonth ? 'hover:scale-110 hover:brightness-125' : ''}
                          `}
                          style={{
                            gridRow: weekdayIdx + 1,
                            gridColumn: weekIdx + 1,
                            width: '100%',
                            height: '22px',
                            backgroundColor: backgroundColor,
                            borderRadius: '3px',
                            color: isChecked ? '#FFFFFF' : (isSaturday ? '#3B82F6' : isSunday ? '#EF4444' : '#9CA3AF'),
                            fontSize: '8px',
                            fontWeight: isChecked ? '700' : '500',
                            border: isToday ? '1px solid #60A5FA' : 'none',
                            opacity: isCurrentMonth ? 1 : 0.2,
                            zIndex: 1
                          }}
                          onClick={() => {
                            if (editModeRoutine === routineId && isCurrentMonth) {
                              handleDateToggle(date, routineId);
                            }
                          }}
                          title={`${year}년 ${cellMonth}월 ${day}일${isToday ? ' (오늘)' : ''}${dateValues[date] ? ` - ${dateValues[date]}` : ''}`}
                          onMouseEnter={(e) => {
                            if (dateValues[date]) {
                              const dateSpan = e.currentTarget.querySelector('.hover-date');
                              if (dateSpan) (dateSpan as HTMLElement).style.display = 'block';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (dateValues[date]) {
                              const dateSpan = e.currentTarget.querySelector('.hover-date');
                              if (dateSpan) (dateSpan as HTMLElement).style.display = 'none';
                            }
                          }}
                        >
                          {dateValues[date] ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                              <span className="hover-date" style={{ fontSize: '6px', fontWeight: '400', color: 'rgba(156, 163, 175, 0.6)', display: 'none' }}>{day}</span>
                              <span style={{ fontSize: '9px', fontWeight: '900', color: '#1F2937' }}>{dateValues[date]}</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '8px' }}>{day}</span>
                          )}
                        </div>
                      );
                    });
                  })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // 월별 뷰: 기존 가로 스크롤 캘린더
        <div 
          ref={calendarScrollRef}
          className="overflow-x-auto overflow-y-hidden"
          style={{
            width: '100%',
            scrollbarWidth: 'thin',
            scrollbarColor: '#6B7280 #374151'
          }}
        >
          <div style={{ minWidth: 'max-content' }}>
            {(() => {
              // 선택된 연도와 월에 따라 캘린더 표시
              const startYear = selectedYear;
              const startMonth = selectedMonth === 'all' ? '1' : selectedMonth;
            
            // 주 수 계산: 전체 연도면 365일 전체, 특정 월이면 해당 월의 주 수
            let numWeeks: number;
            if (selectedMonth === 'all') {
              // 연간 전체: 1월 1일부터 12월 31일까지
              const yearStart = new Date(selectedYear, 0, 1); // 1월 1일
              const yearEnd = new Date(selectedYear, 11, 31); // 12월 31일
              const yearStartWeekday = (yearStart.getDay() + 6) % 7; // 월요일 기준
              const daysInYear = Math.ceil((yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              const totalDays = daysInYear + yearStartWeekday;
              numWeeks = Math.ceil(totalDays / 7);
            } else {
              // 특정 월의 주 수 계산
              const monthNum = parseInt(selectedMonth);
              const firstDay = new Date(selectedYear, monthNum - 1, 1);
              const lastDay = new Date(selectedYear, monthNum, 0);
              const firstDayWeekday = (firstDay.getDay() + 6) % 7; // 월요일 기준
              const totalDays = lastDay.getDate() + firstDayWeekday;
              numWeeks = Math.ceil(totalDays / 7);
            }
            
            const weeks = getWeekBasedDateGrid(startYear, startMonth, numWeeks);
            
            // 각 주의 월 정보 계산 (월별 헤더 표시용)
            const monthHeaders: Array<{ weekIndex: number; month: number; year: number }> = [];
            weeks.forEach((week, weekIdx) => {
              // 각 주의 첫 번째 날짜(월요일)의 월을 사용
              const firstDay = week[0];
              
              // 월이 변경되는 시점에 헤더 추가
              if (weekIdx === 0 || weeks[weekIdx - 1][0].month !== firstDay.month || weeks[weekIdx - 1][0].year !== firstDay.year) {
                // 전체 연도 선택 시: 모든 월 표시
                // 특정 월 선택 시: 해당 월만 표시
                if (selectedMonth === 'all' || firstDay.month === parseInt(selectedMonth)) {
                  monthHeaders.push({
                    weekIndex: weekIdx,
                    month: firstDay.month,
                    year: firstDay.year
                  });
                }
              }
            });
            
            return (
              <div
                className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-300 dark:border-gray-700 shadow-sm"
                style={{
                  padding: '6px',
                  display: 'grid',
                  gridTemplateColumns: `28px repeat(${weeks.length}, 26px)`,
                  gridTemplateRows: '18px repeat(7, 22px)',
                  gap: '3px',
                  minHeight: '170px',
                  width: 'max-content'
                }}
              >
                {/* 왼쪽 상단 빈 공간 */}
                <div
                  style={{
                    gridRow: 1,
                    gridColumn: 1,
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: '6px'
                  }}
                />
                
                {/* 월별 헤더 */}
                {monthHeaders.map((header, idx) => {
                  const nextHeader = monthHeaders[idx + 1];
                  const colSpan = nextHeader 
                    ? nextHeader.weekIndex - header.weekIndex 
                    : weeks.length - header.weekIndex;
                  
                  return (
                    <div
                      key={`month-${header.weekIndex}`}
                      className="flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold"
                      style={{
                        gridRow: 1,
                        gridColumn: header.weekIndex + 2,
                        gridColumnEnd: `span ${colSpan}`,
                        fontSize: '9px',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderRadius: '6px'
                      }}
                    >
                      {header.year !== currentYear ? `${header.year}년 ` : ''}{header.month}월
                    </div>
                  );
                })}
                
                {/* 요일 헤더 (왼쪽 열) */}
                {['월', '화', '수', '목', '금', '토', '일'].map((weekdayName, weekdayIdx) => {
                  const isSaturday = weekdayIdx === 5;
                  const isSunday = weekdayIdx === 6;
                  return (
                    <div
                      key={`header-${weekdayIdx}`}
                      className="flex items-center justify-center font-bold"
                      style={{
                        gridRow: weekdayIdx + 2,
                        gridColumn: 1,
                        fontSize: '10px',
                        backgroundColor: isSaturday 
                          ? 'rgba(59, 130, 246, 0.15)' 
                          : isSunday 
                          ? 'rgba(239, 68, 68, 0.15)' 
                          : 'rgba(75, 85, 99, 0.1)',
                        color: isSaturday 
                          ? '#3B82F6' 
                          : isSunday 
                          ? '#EF4444' 
                          : '#6B7280',
                        borderRadius: '6px'
                      }}
                    >
                      {weekdayName}
                    </div>
                  );
                })}
                
                {/* 주별 날짜 열들 */}
                {weeks.map((week, weekIdx) => {
                  return week.map((cell, weekdayIdx) => {
                    const { day, date, month, year } = cell;
                    
                    // 전체 연도 선택 시: 선택된 연도의 모든 날짜 표시
                    // 특정 월 선택 시: 해당 월만 표시, 다른 월은 흐리게
                    const isCurrentMonth = selectedMonth === 'all' 
                      ? year === selectedYear 
                      : (month === parseInt(selectedMonth) && year === selectedYear);
                    
                    const isChecked = isDateChecked(date, routineId);
                    // 한국 시간대 기준 오늘 날짜 확인 (UTC+9)
                    const getKoreaDateString = (): string => {
                      const now = new Date();
                      // 한국 시간으로 변환 (UTC+9)
                      const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
                      const year = koreaTime.getUTCFullYear();
                      const month = String(koreaTime.getUTCMonth() + 1).padStart(2, '0');
                      const day = String(koreaTime.getUTCDate()).padStart(2, '0');
                      return `${year}-${month}-${day}`;
                    };
                    const isToday = date === getKoreaDateString();
                    const isSaturday = weekdayIdx === 5; // 토요일
                    const isSunday = weekdayIdx === 6; // 일요일
                    
                    // 배경색 결정: 체크됨 > 요일별 색상 > 기본
                    let backgroundColor = 'rgba(75, 85, 99, 0.15)'; // 기본 회색 (투명도 15%)
                    if (isChecked) {
                      // 체크된 날짜는 요일별로 다른 색상
                      if (isSaturday) {
                        backgroundColor = '#3B82F6'; // 토요일: 파란색
                      } else if (isSunday) {
                        backgroundColor = '#EF4444'; // 일요일: 빨간색
                      } else {
                        backgroundColor = '#9CA3AF'; // 월~금: 밝은 회색
                      }
                    } else if (isSaturday) {
                      backgroundColor = 'rgba(59, 130, 246, 0.15)'; // 토요일: 파란색 (투명도 15%)
                    } else if (isSunday) {
                      backgroundColor = 'rgba(239, 68, 68, 0.15)'; // 일요일: 붉은색 (투명도 15%)
                    }
                    
                    return (
                      <div
                        key={`${weekIdx}-${weekdayIdx}`}
                        style={{
                          gridRow: weekdayIdx + 2,
                          gridColumn: weekIdx + 2,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative'
                        }}
                      >
                        {/* 날짜 셀 */}
                        <div
                          className={`
                            flex flex-col items-center justify-center relative shrink-0
                            ${editModeRoutine === routineId && isCurrentMonth ? 'cursor-pointer' : 'cursor-default'}
                            transition-all duration-200 ease-in-out
                            ${editModeRoutine === routineId && isCurrentMonth ? 'hover:scale-110 hover:brightness-125 hover:z-10 hover:ring-1 hover:ring-blue-400' : ''}
                          `}
                          style={{
                            width: '26px',
                            height: '22px',
                            backgroundColor: backgroundColor,
                            borderRadius: '6px',
                            color: isChecked ? '#FFFFFF' : (isSaturday ? '#3B82F6' : isSunday ? '#EF4444' : '#9CA3AF'),
                            fontSize: '10px',
                            fontWeight: isChecked ? '700' : '500',
                            border: isToday 
                              ? '2px solid #60A5FA'
                              : 'none',
                            boxShadow: isChecked ? '0 2px 4px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.05)',
                            userSelect: 'none',
                            position: 'relative',
                            zIndex: isToday ? 3 : 2,
                            opacity: isCurrentMonth ? 1 : 0.3
                          }}
                          onClick={() => {
                            if (editModeRoutine === routineId && isCurrentMonth) {
                              handleDateToggle(date, routineId);
                            }
                          }}
                          onMouseEnter={(e) => {
                            if (dateValues[date] != null) {
                              const dateSpan = e.currentTarget.querySelector('.hover-date-monthly');
                              if (dateSpan) (dateSpan as HTMLElement).style.display = 'block';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (dateValues[date] != null) {
                              const dateSpan = e.currentTarget.querySelector('.hover-date-monthly');
                              if (dateSpan) (dateSpan as HTMLElement).style.display = 'none';
                            }
                          }}
                          title={
                            `${year}년 ${month}월 ${day}일${isToday ? ' (오늘)' : ''}${isChecked ? ' (체크됨)' : ''}${editModeRoutine === routineId ? ' - 클릭하여 체크/언체크' : ''}`
                          }
                        >
                          {dateValues[date] != null ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                              <span className="hover-date-monthly" style={{ fontSize: '7px', fontWeight: '400', color: 'rgba(156, 163, 175, 0.6)', display: 'none' }}>{day}</span>
                              <span style={{ fontSize: '9px', fontWeight: '900', color: '#1F2937' }}>{dateValues[date]}</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '10px' }}>{day}</span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })}
              </div>
            );
          })()}
          </div>
        </div>
      )}

      {/* 독서 캘린더 셀 모달 */}

      {/* 풀스크린 이미지 뷰어 */}
    </div>
  );
}