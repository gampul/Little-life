'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { getSupabase } from '../lib/supabase';
import { GlobalNav } from './components/GlobalNav';
import { FooterNav } from './components/FooterNav';

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

export default function Home() {
  const userId = 'default_user'; // 실제 앱에서는 로그인한 사용자 ID 사용

  // Supabase 클라이언트 싱글톤 사용
  const supabase = getSupabase();

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isEditMode, setIsEditMode] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isMealSectionExpanded, setIsMealSectionExpanded] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [allRecords, setAllRecords] = useState<DailyRecord[]>([]);
  const [weightPeriod, setWeightPeriod] = useState<PeriodFilter>('1month');
  
  // 루틴 관련 상태
  const [routineTemplates, setRoutineTemplates] = useState<RoutineTemplate[]>([]);
  const [routineChecks, setRoutineChecks] = useState<RoutineCheck[]>([]);
  const [isRoutineSettingOpen, setIsRoutineSettingOpen] = useState(false);
  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);
  const [editModeRoutine, setEditModeRoutine] = useState<string | null>(null);
  
  // 식사 기록 목록
  const [mealRecords, setMealRecords] = useState<DailyRecord[]>([]);
  const [expandedMealMonth, setExpandedMealMonth] = useState<string | null>(null);
  
  // 그래프에서 선택된 날짜의 식사 메모
  const [selectedChartDate, setSelectedChartDate] = useState<string | null>(null);
  const [selectedDateMealMemo, setSelectedDateMealMemo] = useState<string | null>(null);

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
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

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
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric&lang=kr`;
      
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('API 키가 유효하지 않습니다. OpenWeatherMap에서 발급한 키를 확인해주세요.');
        } else if (response.status === 404) {
          throw new Error('도시를 찾을 수 없습니다.');
        } else {
          throw new Error(errorData.message || '날씨 데이터를 가져오는데 실패했습니다.');
        }
      }

      const data = await response.json();
      setWeatherData({
        temperature: Math.round(data.main.temp),
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        city: data.name,
      });
      setWeatherError(null);
    } catch (error: any) {
      console.error('날씨 데이터 가져오기 실패:', error);
      setWeatherError(error.message || '날씨 정보를 불러올 수 없습니다.');
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
      console.log('🔍 Storage bucket 확인 중...');
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
      
      if (bucketError) {
        console.error('❌ Bucket 목록 조회 실패:', bucketError);
        throw new Error(`Storage 접근 오류: ${bucketError.message}`);
      }
      
      const mealImagesBucket = buckets?.find(b => b.id === 'meal-images');
      if (!mealImagesBucket) {
        console.error('❌ meal-images bucket이 없습니다');
        console.log('📋 사용 가능한 buckets:', buckets?.map(b => b.id));
        alert('❌ Storage bucket이 생성되지 않았습니다.\n\nDATABASE_SETUP.md 파일을 참고하여 다음을 실행하세요:\n1. Supabase SQL Editor에서 마이그레이션 실행\n2. Storage에서 meal-images bucket 생성');
        return;
      }
      
      console.log('✅ meal-images bucket 확인됨');

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
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('routine_templates')
        .select('id, emoji, label, field_key, sort_order, user_id')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('루틴 템플릿 조회 오류');
        if (error?.message) console.error('- 메시지:', error.message);
        if (error?.code) console.error('- 코드:', error.code);
        if (error?.details) console.error('- 상세:', error.details);
        if (error?.hint) console.error('- 힌트:', error.hint);
        return;
      }

      setRoutineTemplates(data || []);
    } catch (err) {
      console.error('예상치 못한 오류:', err);
    }
  }, [supabase, userId]);

  // 특정 날짜의 루틴 체크 상태 로드
  const loadRoutineChecks = useCallback(async (date: string) => {
    if (!supabase) return;
    try {
      console.log('📋 루틴 체크 로드 시작:', date);
      const { data, error } = await supabase
        .from('daily_routine_checks')
        .select('routine_id, checked, value')
        .eq('date', date);

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
    } catch (err) {
      console.error('예상치 못한 오류:', err);
    }
  }, [supabase]);

  const loadDailyRecord = useCallback(async (date: string) => {
    if (!supabase) return;
    try {
      // meal_images 포함하여 조회 시도
      let { data, error } = await supabase
        .from('daily_records')
        .select('id, date, weight, meal_breakfast, meal_lunch, meal_dinner, meal_memo, meal_images, daily_memo, created_at, updated_at')
        .eq('date', date)
        .maybeSingle();

      // meal_images 컬럼이 없는 경우 재시도
      if (error && error.code !== 'PGRST116' && (error.message.includes('column') || error.code === '42703')) {
        console.warn('⚠️ meal_images 컬럼이 없습니다. 마이그레이션 없이 계속 진행합니다.');
        const result = await supabase
          .from('daily_records')
          .select('id, date, weight, meal_breakfast, meal_lunch, meal_dinner, meal_memo, daily_memo, created_at, updated_at')
          .eq('date', date)
          .maybeSingle();
        
        data = result.data ? { ...result.data, meal_images: [] } : null;
        error = result.error;
      }

      if (error && error.code !== 'PGRST116') {
        console.error('데이터 조회 오류');
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
    }
  }, [supabase]);

  // 식사 기록 로드
  const loadMealRecords = useCallback(async () => {
    if (!supabase) return;
    try {
      // meal_images 포함하여 조회 시도
      let { data, error } = await supabase
        .from('daily_records')
        .select('id, date, weight, meal_breakfast, meal_lunch, meal_dinner, meal_memo, meal_images, daily_memo, created_at, updated_at')
        .order('date', { ascending: false })
        .limit(50);

      // meal_images 컬럼이 없는 경우 재시도
      if (error && (error.message.includes('column') || error.code === '42703')) {
        console.warn('⚠️ meal_images 컬럼이 없습니다. 마이그레이션 없이 계속 진행합니다.');
        const result = await supabase
          .from('daily_records')
          .select('id, date, weight, meal_breakfast, meal_lunch, meal_dinner, meal_memo, daily_memo, created_at, updated_at')
          .order('date', { ascending: false })
          .limit(50);
        
        data = result.data ? result.data.map(r => ({ ...r, meal_images: [] })) : null;
        error = result.error;
      }

      if (error) {
        console.error('식사 기록 조회 오류:', error);
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
    }
  }, [supabase]);

  const loadAllRecords = useCallback(async () => {
    if (!supabase) {
      console.warn('Supabase 클라이언트가 없습니다.');
      return;
    }
    try {
      // meal_images 포함하여 조회 시도
      let { data, error } = await supabase
        .from('daily_records')
        .select('id, date, weight, meal_breakfast, meal_lunch, meal_dinner, meal_memo, meal_images, daily_memo, created_at, updated_at')
        .order('date', { ascending: true });

      // meal_images 컬럼이 없는 경우 (마이그레이션 전) 재시도
      if (error && (error.message.includes('column') || error.code === '42703')) {
        console.warn('⚠️ meal_images 컬럼이 없습니다. 마이그레이션 없이 계속 진행합니다.');
        const result = await supabase
          .from('daily_records')
          .select('id, date, weight, meal_breakfast, meal_lunch, meal_dinner, meal_memo, daily_memo, created_at, updated_at')
          .order('date', { ascending: true });
        
        data = result.data ? result.data.map(r => ({ ...r, meal_images: [] })) : null;
        error = result.error;
      }

      if (error) {
        console.error('전체 데이터 조회 오류');
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
    }
  }, [supabase]);

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

  // 초기 데이터 로드 (마운트 시 한 번만)
  useEffect(() => {
    loadDailyRecord(selectedDate);
    loadRoutineChecks(selectedDate);
    loadAllRecords();
    loadMealRecords();
    fetchWeather(); // 날씨 데이터 가져오기
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 빈 배열로 초기 마운트 시에만 실행

  // 날짜 변경 시 데이터 로드
  useEffect(() => {
    loadDailyRecord(selectedDate);
    loadRoutineChecks(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

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


  const handleSave = async () => {
    if (!supabase) {
      setMessage('❌ Supabase 연결이 설정되지 않았습니다. 환경 변수를 확인해주세요.');
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
            updated_at: new Date().toISOString(),
          })
          .eq('date', formData.date);

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
          .insert([formData]);

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
        .eq('date', formData.date);

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
          date: formData.date,
          routine_id: check.routine_id,
          checked: true,
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
        <div className="max-w-[480px] w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 sm:p-6">
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

  return (
    <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-20">
      <GlobalNav />
      <div className="max-w-[480px] mx-auto px-4 sm:px-6 py-4 sm:py-6">

        {/* 루틴 설정 모달 */}
        {isRoutineSettingOpen && (
          <RoutineSettingModal
            userId={userId}
            routineTemplates={routineTemplates}
            onClose={() => {
              setIsRoutineSettingOpen(false);
              loadRoutineTemplates();
            }}
          />
        )}


        <div className="space-y-2">
          {/* 입력 섹션 */}
          <div>
            {/* 날짜, 체중 입력, 수정 버튼 한 줄 배치 */}
            <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 mb-2">
              <div className="flex gap-2 sm:gap-3">
                {/* 날짜 입력 */}
                <div 
                  className="relative cursor-pointer overflow-hidden flex-1"
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
                    className="w-full px-4 py-3 text-base bg-transparent text-transparent border-0 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[44px] cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
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
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-sm text-gray-900 dark:text-white font-medium whitespace-nowrap" style={{ lineHeight: '22px' }}>
                    {(() => {
                      const date = new Date(selectedDate);
                      const year = date.getFullYear();
                      const month = date.getMonth() + 1;
                      const day = date.getDate();
                      return `${year}년 ${month}월 ${day}일`;
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
              disabled={!isEditMode}
              className="w-20 px-3 py-3 text-base bg-transparent text-gray-900 dark:text-white border-0 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 min-h-[44px]"
            />
            {/* 수정/저장 버튼 */}
                {!isEditMode ? (
                  <button
                    onClick={handleEdit}
                className="w-12 px-2 py-3 text-base bg-transparent text-gray-900 dark:text-white border-0 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 focus:ring-2 focus:ring-blue-500 outline-none min-h-[44px] transition-colors flex items-center justify-center"
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
                className="w-12 px-2 py-3 text-base bg-transparent text-gray-900 dark:text-white border-0 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 min-h-[44px] disabled:cursor-not-allowed transition-colors flex items-center justify-center"
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
              {/* 날씨 정보 표시 */}
              {weatherData && (
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
                    className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      weightPeriod === '7days'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[rgb(254,252,247)] dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    7D
                  </button>
                  <button
                    onClick={() => setWeightPeriod('1month')}
                    className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      weightPeriod === '1month'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[rgb(254,252,247)] dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    1M
                  </button>
                  <button
                    onClick={() => setWeightPeriod('1year')}
                    className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      weightPeriod === '1year'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[rgb(254,252,247)] dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    1Y
                  </button>
                  <button
                    onClick={() => setWeightPeriod('ytd')}
                    className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      weightPeriod === 'ytd'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[rgb(254,252,247)] dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    YTD
                  </button>
                  <button
                    onClick={() => setWeightPeriod('all')}
                    className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      weightPeriod === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[rgb(254,252,247)] dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    전체
                  </button>
                </div>
              </div>
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
              
              {/* 선택된 날짜의 식사 메모 표시 */}
              {selectedChartDate && (
                <div className="mt-4 pt-4 border-t-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-base font-bold text-gray-900 dark:text-white">
                      📅 {(() => {
                        const date = new Date(selectedChartDate);
                        return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
                      })()}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedChartDate(null);
                        setSelectedDateMealMemo(null);
                      }}
                      className="text-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-bold"
                      aria-label="닫기"
                    >
                      ✕
                    </button>
                  </div>
                  {selectedDateMealMemo ? (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-blue-300 dark:border-blue-700">
                      <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2">🍽️ 식사 메모</p>
                      <p className="text-sm text-gray-900 dark:text-white font-medium" style={{ lineHeight: '22px' }}>
                        {selectedDateMealMemo}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 border-2 border-gray-300 dark:border-gray-600">
                      <p className="text-base text-gray-600 dark:text-gray-300 italic text-center">
                        이 날짜에는 식사 메모가 없습니다.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 데일리 루틴 - 동적으로 렌더링 */}
            <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 mb-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📋 데일리 루틴</h3>
              {routineTemplates.map((routine, index) => (
                <div key={routine.id}>
                  <RoutineItem
                    emoji={routine.emoji}
                    label={routine.label}
                    checked={isRoutineChecked(routine.id)}
                    onChange={() => handleRoutineCheckChange(routine.id)}
                    disabled={!isEditMode}
                    isLast={index === routineTemplates.length - 1}
                    isExpanded={expandedRoutineId === routine.id}
                    onExpandToggle={() => {
                      setExpandedRoutineId(expandedRoutineId === routine.id ? null : routine.id);
                    }}
                    routineId={routine.id}
                    routineTemplates={routineTemplates}
                    editModeRoutine={editModeRoutine}
                    setEditModeRoutine={setEditModeRoutine}
                  />
                  {/* 확장된 루틴의 캘린더 표시 */}
                  {expandedRoutineId === routine.id && (
                    <div className="mt-2 pb-2 -mx-4 sm:-mx-5">
                      <RoutineCalendar
                        routineId={routine.id}
                        routineLabel={routine.label}
                        routineEmoji={routine.emoji}
                        routineTemplates={routineTemplates}
                        isExpanded={true}
                        editModeRoutine={editModeRoutine}
                        setEditModeRoutine={setEditModeRoutine}
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

            {/* 식사 기록 */}
            <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 mb-2">
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
              <div className="flex flex-wrap gap-4 mb-4">
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
              
              {/* 날짜별 식사 기록 목록 - 월별 아코디언 */}
              {mealRecords.length > 0 && (() => {
                // 월별로 그룹화
                const recordsByMonth = mealRecords.reduce((acc, record) => {
                  const recordDate = new Date(record.date);
                  const monthKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}`;
                  if (!acc[monthKey]) {
                    acc[monthKey] = [];
                  }
                  acc[monthKey].push(record);
                  return acc;
                }, {} as Record<string, DailyRecord[]>);

                // 월별 키를 최신순으로 정렬
                const sortedMonths = Object.keys(recordsByMonth).sort((a, b) => b.localeCompare(a));

                return (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
                      📅 식사 기록
                    </h4>
                    <div className="space-y-2">
                      {sortedMonths.map((monthKey) => {
                        const [year, month] = monthKey.split('-');
                        const monthRecords = recordsByMonth[monthKey];
                        const isExpanded = expandedMealMonth === monthKey;
                        
                        return (
                          <div key={monthKey} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                            {/* 월별 헤더 */}
                            <button
                              onClick={() => setExpandedMealMonth(isExpanded ? null : monthKey)}
                              className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {year}년 {parseInt(month)}월
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  ({monthRecords.length}개)
                                </span>
                              </div>
                              <svg
                                className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {/* 월별 기록 목록 */}
                            {isExpanded && (
                              <div className="p-3 space-y-2 bg-white dark:bg-gray-900">
                                {monthRecords.map((record) => {
                                  const recordDate = new Date(record.date);
                                  const formattedDate = `${recordDate.getMonth() + 1}월 ${recordDate.getDate()}일`;
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
                                      </div>
                                      {record.meal_memo && (
                                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 line-clamp-2">
                                          {record.meal_memo}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
  
  // 달성률에 따른 색상 결정
  const getColor = (progress: number) => {
    if (progress >= 80) return '#10B981'; // green
    if (progress >= 60) return '#3B82F6'; // blue
    if (progress >= 40) return '#F59E0B'; // amber
    if (progress >= 20) return '#EF4444'; // red
    return '#9CA3AF'; // gray
  };

  const color = getColor(progress);

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
          stroke={color}
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
        className="absolute inset-0 flex items-center justify-center text-xs font-medium pointer-events-none"
        style={{ color }}
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
  routineId,
  routineTemplates,
  editModeRoutine,
  setEditModeRoutine,
}: {
  emoji: string;
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
  isLast?: boolean;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
  routineId: string;
  routineTemplates: RoutineTemplate[];
  editModeRoutine: string | null;
  setEditModeRoutine: (routineId: string | null) => void;
}) {
  const [checkedDates, setCheckedDates] = useState<Record<string, Set<string>>>({});
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const supabase = getSupabase();

  // Supabase에서 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      if (!supabase) return;
      
      try {
        // 현재 년도의 모든 날짜에 대한 체크 데이터 로드
        const allDates: string[] = [];
        for (let month = 1; month <= 12; month++) {
          const daysInMonth = new Date(currentYear, month, 0).getDate();
          for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            allDates.push(dateStr);
          }
        }

        const { data: checks, error } = await supabase
          .from('daily_routine_checks')
          .select('date, routine_id, checked, value')
          .in('date', allDates)
          .eq('routine_id', routineId)
          .eq('checked', true);

        if (error) {
          console.error('루틴 체크 데이터 로드 오류:', error);
          return;
        }

        // 데이터를 Record<string, Set<string>> 형태로 변환
        const data: Record<string, Set<string>> = {};
        if (checks && checks.length > 0) {
          checks.forEach((check: any) => {
            if (!data[check.date]) {
              data[check.date] = new Set();
            }
            data[check.date].add(check.routine_id);
          });
        }
        
        setCheckedDates(data);
      } catch (err) {
        console.error('데이터 로드 오류:', err);
      }
    };

    loadData();
    
    // 주기적으로 업데이트 (30초마다)
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [supabase, routineId, currentYear]);

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
    let checkDate = new Date(today);
    
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
    e.stopPropagation(); // 아코디언 토글 방지
    
    if (disabled) return; // 비활성화 상태면 동작하지 않음
    
    const newChecked = !isTodayChecked;
    
    // Supabase에 저장
    if (supabase) {
      try {
        if (newChecked) {
          // 체크: insert 또는 update
          const { error } = await supabase
            .from('daily_routine_checks')
            .upsert({
              date: todayDateStr,
              routine_id: routineId,
              checked: true
            }, {
              onConflict: 'date,routine_id'
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
            .eq('routine_id', routineId);
          
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
  
  return (
    <div>
      <div 
        className="flex items-center gap-3 py-2 min-h-[44px] cursor-pointer"
          onClick={onExpandToggle}
      >
        {/* 원형 그래프 + 텍스트 영역 */}
        <div className="flex items-center gap-3 flex-1">
          <div className="flex-shrink-0">
            <CircularProgressChart 
              progress={getMonthProgress(currentYear, currentMonth, routineId)} 
              size={36}
            />
          </div>
          <span className={`text-sm ${checked ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400'}`} style={{ lineHeight: '22px' }}>
            {label}
          </span>
        </div>
        
        {/* 연속 일수 + 슬라이더 + 오늘 날짜 체크박스 */}
        <div className="flex items-center gap-2 shrink-0">
          {consecutiveDays > 0 && (
            <div
              className={`px-2 py-1 text-xs font-medium rounded-full ${
                isHexColor 
                  ? '' 
                  : `${colorClasses.bgLight} dark:${colorClasses.bgDark} ${colorClasses.text} dark:${colorClasses.textDark}`
              }`}
              style={isHexColor ? {
                backgroundColor: colorClasses.bgLight,
                color: getBrightness(routineColor) > 128 ? '#1E3A8A' : '#60A5FA',
              } : {}}
            >
              {consecutiveDays}일 연속
            </div>
          )}
          {/* 오늘 날짜 체크박스 */}
          <div 
            className="flex items-center shrink-0"
            onClick={disabled ? undefined : handleTodayToggle}
          >
            <input
              type="checkbox"
              checked={isTodayChecked}
              onChange={(e) => {
                e.stopPropagation();
                if (!disabled) {
                  handleTodayToggle(e as any);
                }
              }}
              disabled={disabled}
              className="w-5 h-5 text-blue-500 bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={(e) => {
                e.stopPropagation();
                if (disabled) {
                  e.preventDefault();
                }
              }}
            />
          </div>
        </div>
      </div>
      {!isLast && <div style={{ height: '0.5px' }} className="bg-gray-200 dark:bg-gray-600"></div>}
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

// 루틴 설정 모달 컴포넌트
function RoutineSettingModal({
  userId,
  routineTemplates,
  onClose,
}: {
  userId: string;
  routineTemplates: RoutineTemplate[];
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<RoutineTemplate[]>([...routineTemplates]);
  const [isSaving, setIsSaving] = useState(false);

  // Supabase 클라이언트 싱글톤 사용
  const supabase = getSupabase();

  const handleAdd = () => {
    const newTemplate: RoutineTemplate = {
      id: `temp_${Date.now()}`,
      emoji: '✨',
      label: '새로운 루틴',
      field_key: `custom_${Date.now()}`,
      sort_order: templates.length + 1,
    };
    setTemplates([...templates, newTemplate]);
  };

  const handleDelete = (id: string) => {
    setTemplates(templates.filter(t => t.id !== id));
  };

  const handleUpdate = (id: string, field: 'emoji' | 'label', value: string) => {
    setTemplates(templates.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const handleSave = async () => {
    if (!supabase) {
      alert('❌ Supabase 연결이 설정되지 않았습니다.');
      return;
    }
    setIsSaving(true);
    try {
      // 기존 템플릿 ID 조회
      const { data: existingTemplates } = await supabase
        .from('routine_templates')
        .select('id, field_key')
        .eq('user_id', userId);

      const existingMap = new Map(
        (existingTemplates || []).map(t => [t.field_key, t.id])
      );

      // 템플릿 데이터 준비 (기존 ID 유지)
      const templatesToUpsert = templates.map((t, index) => {
        const existingId = existingMap.get(t.field_key);
        return {
          ...(existingId && !t.id.startsWith('temp_') ? { id: existingId } : {}),
          user_id: userId,
          emoji: t.emoji,
          label: t.label,
          field_key: t.field_key,
          sort_order: index + 1,
        };
      });

      // UPSERT로 저장 (기존 데이터 보존)
      const { error: upsertError } = await supabase
        .from('routine_templates')
        .upsert(templatesToUpsert, {
          onConflict: 'id',
          ignoreDuplicates: false
        });

      if (upsertError) {
        console.error('=== 템플릿 저장 에러 상세 ===');
        console.error('메시지:', upsertError.message);
        console.error('코드:', upsertError.code);
        console.error('상세:', upsertError.details);
        console.error('힌트:', upsertError.hint);
        console.error('전체:', JSON.stringify(upsertError, null, 2));
        throw upsertError;
      }

      // 삭제된 템플릿 처리 (현재 templates에 없는 것들)
      const currentFieldKeys = new Set(templates.map(t => t.field_key));
      const deletedTemplates = (existingTemplates || []).filter(
        t => !currentFieldKeys.has(t.field_key)
      );

      if (deletedTemplates.length > 0) {
        const { error: deleteError } = await supabase
          .from('routine_templates')
          .delete()
          .in('id', deletedTemplates.map(t => t.id));

        if (deleteError) {
          console.error('삭제된 템플릿 제거 오류:', deleteError);
          // 삭제 실패는 치명적이지 않으므로 계속 진행
        }
      }

      alert('✅ 저장되었습니다!');
      onClose();
    } catch (err: any) {
      console.error('=== 루틴 설정 저장 오류 ===');
      console.error('타입:', typeof err);
      console.error('전체 에러:', err);
      if (err?.message) console.error('메시지:', err.message);
      if (err?.code) console.error('코드:', err.code);
      if (err?.details) console.error('상세:', err.details);
      if (err?.hint) console.error('힌트:', err.hint);
      console.error('전체 JSON:', JSON.stringify(err, null, 2));
      
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
      
      alert(`❌ 저장 실패: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 max-w-[480px] w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">⚙️ 루틴 설정</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl w-10 h-10 flex items-center justify-center"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="space-y-6 mb-6">
          {templates.map((template, index) => {
            
            return (
            <div key={template.id} className="flex flex-col items-stretch gap-3 bg-[rgb(254,252,247)] dark:bg-gray-700 rounded-lg p-4 sm:p-5">
              <span className="text-gray-500 dark:text-gray-400 text-base">{index + 1}</span>
              <input
                type="text"
                value={template.emoji}
                onChange={(e) => handleUpdate(template.id, 'emoji', e.target.value)}
                className="w-full px-3 py-2.5 text-center bg-[rgb(254,252,247)] dark:bg-gray-600 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-500 rounded focus:ring-2 focus:ring-blue-500 outline-none min-h-[44px]"
                maxLength={2}
              />
              <input
                type="text"
                value={template.label}
                onChange={(e) => handleUpdate(template.id, 'label', e.target.value)}
                className="flex-1 px-4 py-2.5 bg-[rgb(254,252,247)] dark:bg-gray-600 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-500 rounded focus:ring-2 focus:ring-blue-500 outline-none min-h-[44px]"
              />
              <button
                onClick={() => handleDelete(template.id)}
                className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded transition-colors min-h-[44px]"
              >
                삭제
              </button>
            </div>
            );
          })}
        </div>

        <button
          onClick={handleAdd}
          className="w-full py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-white rounded-lg transition-colors mb-4 min-h-[44px] text-base"
        >
          + 루틴 추가
        </button>

        <div className="flex flex-col gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-white rounded-lg transition-colors min-h-[44px] text-base"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 min-h-[44px] text-base"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// 루틴별 캘린더 컴포넌트
function RoutineCalendar({
  routineId,
  routineLabel,
  routineEmoji,
  routineTemplates,
  isExpanded = false,
  editModeRoutine,
  setEditModeRoutine,
}: {
  routineId: string;
  routineLabel: string;
  routineEmoji: string;
  routineTemplates: RoutineTemplate[];
  isExpanded?: boolean;
  editModeRoutine: string | null;
  setEditModeRoutine: (routineId: string | null) => void;
}) {
  const [checkedDates, setCheckedDates] = useState<Record<string, Set<string>>>({});
  const [dateValues, setDateValues] = useState<Record<string, number>>({});
  const calendarScrollRef = useRef<HTMLDivElement>(null);
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  
  // 선택된 연도와 월 상태 관리
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(currentMonth);

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
          .select('date, routine_id, checked, value')
          .in('date', allDates)
          .eq('routine_id', routineId)
          .eq('checked', true);

        if (error) {
          console.error('루틴 체크 데이터 로드 오류:', error);
          return;
        }

        // 데이터를 Record<string, Set<string>> 형태로 변환
        const data: Record<string, Set<string>> = {};
        const values: Record<string, number> = {};
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
          });
        }
        
        setCheckedDates(data);
        setDateValues(values);
      } catch (err) {
        console.error('데이터 로드 오류:', err);
      }
    };
    
    loadData();
    
    // 주기적으로 업데이트 (30초마다)
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [supabase, routineId, selectedYear]);

  // 토글이 열릴 때 또는 선택이 변경될 때 스크롤 위치 설정
  useEffect(() => {
    if (isExpanded && calendarScrollRef.current) {
      // 오늘 날짜를 기준으로 계산
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // 선택된 년도와 월에 따라 시작 위치 계산
      const startYear = selectedYear;
      const startMonth = selectedMonth === 'all' ? 1 : selectedMonth;
      
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
  const getWeekBasedDateGrid = (startYear: number, startMonth: number, numWeeks: number = 8) => {
    // 시작 날짜: 해당 월의 첫 날
    const firstDayOfMonth = new Date(startYear, startMonth - 1, 1);
    
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

  // 날짜 클릭 핸들러 (체크/언체크)
  const handleDateToggle = async (date: string, routineId: string) => {
    if (editModeRoutine !== routineId) return;
    if (!supabase) return;
    
    const isCurrentlyChecked = isDateChecked(date, routineId);
    const newChecked = !isCurrentlyChecked;
    
    try {
      if (newChecked) {
        // 체크: insert 또는 update
        const { error } = await supabase
          .from('daily_routine_checks')
          .upsert({
            date: date,
            routine_id: routineId,
            checked: true
          }, {
            onConflict: 'date,routine_id'
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
          .eq('routine_id', routineId);
        
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
    } catch (err) {
      console.error('예상치 못한 오류:', err);
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
            onChange={(e) => setSelectedMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-2 py-1 text-sm font-medium bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
          >
            <option value="all">전체</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
              <option key={month} value={month}>{month}월</option>
            ))}
          </select>
        </div>
        
        {/* 오른쪽: 수정 버튼 */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setEditModeRoutine(editModeRoutine === routineId ? null : routineId)}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors shrink-0"
          >
            {editModeRoutine === routineId ? '저장' : '수정'}
          </button>
        </div>
      </div>
      
      {/* 가로 스크롤 가능한 캘린더 컨테이너 (요일별 세로 배치) */}
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
            const startMonth = selectedMonth === 'all' ? 1 : selectedMonth;
            
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
              const firstDay = new Date(selectedYear, selectedMonth - 1, 1);
              const lastDay = new Date(selectedYear, selectedMonth, 0);
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
                if (selectedMonth === 'all' || firstDay.month === selectedMonth) {
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
                      : (month === selectedMonth && year === selectedYear);
                    
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
                          title={
                            `${year}년 ${month}월 ${day}일${isToday ? ' (오늘)' : ''}${isChecked ? ' (체크됨)' : ''}${editModeRoutine === routineId ? ' - 클릭하여 체크/언체크' : ''}`
                          }
                        >
                          {/* 날짜 숫자 */}
                          <span style={{ fontSize: dateValues[date] ? '8px' : '10px' }}>{day}</span>
                          {/* 값 표시 (있는 경우) */}
                          {dateValues[date] != null && (
                            <span style={{ fontSize: '7px', fontWeight: 'bold', marginTop: '-1px' }}>
                              {dateValues[date]}
                            </span>
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
    </div>
  );
}