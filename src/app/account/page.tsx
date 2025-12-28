'use client';

import { useState, useEffect, useCallback } from 'react';
import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';
import { getSupabase } from '../../lib/supabase';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface FinanceRecord {
  id?: string;
  period: string;
  owner: string;
  division: string;
  category: string;
  stock: string;
  qty: number;
  in_out: number;
  dividend: number;
  value: number;
  growth_rate: number;
  memo?: string;
}

interface PeriodSummary {
  period: string;
  totalDividend: number;
  totalValue: number;
}

interface OwnerSummary {
  period: string;
  [key: string]: string | number;
}

interface DivisionSummary {
  period: string;
  [key: string]: string | number;
}

interface CategorySummary {
  period: string;
  [key: string]: string | number;
}

interface StockSummary {
  period: string;
  [key: string]: string | number;
}

// 숫자 포맷 함수
const formatNumber = (num: number): string => {
  if (num >= 100000000) {
    return `${(num / 100000000).toFixed(1)}억`;
  } else if (num >= 10000) {
    return `${(num / 10000).toFixed(0)}만`;
  }
  return num.toLocaleString();
};

// 천 단위 콤마 포맷
const formatCurrency = (num: number): string => {
  return num.toLocaleString() + '원';
};

export default function AccountPage() {
  const supabase = getSupabase();
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'owner' | 'division' | 'category' | 'add'>('overview');
  const [message, setMessage] = useState('');

  // 신규 등록 폼 상태
  const [newRecord, setNewRecord] = useState<Omit<FinanceRecord, 'id'>>({
    period: '',
    owner: '',
    division: 'P',
    category: '',
    stock: '',
    qty: 0,
    in_out: 0,
    dividend: 0,
    value: 0,
    growth_rate: 0,
    memo: '',
  });

  // 기간 선택 아코디언 상태
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const [isCustomPeriod, setIsCustomPeriod] = useState(false);
  const [customPeriodInput, setCustomPeriodInput] = useState('');

  // 소유자 선택 아코디언 상태
  const [isOwnerOpen, setIsOwnerOpen] = useState(false);
  const [isCustomOwner, setIsCustomOwner] = useState(false);
  const [customOwnerInput, setCustomOwnerInput] = useState('');

  // 기본 소유자 목록
  const defaultOwners = ['김희창', '민수진', '김사랑'];

  // 카테고리 선택 아코디언 상태
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');

  // 기본 카테고리 목록 (순서 유지)
  const defaultCategories = ['S&P', 'DOW', 'REITs', 'CC', 'NASDAQ', 'ROBOT'];

  // 종목명 선택 아코디언 상태
  const [isStockOpen, setIsStockOpen] = useState(false);
  const [isCustomStock, setIsCustomStock] = useState(false);
  const [customStockInput, setCustomStockInput] = useState('');

  // 기본 종목명 목록
  const defaultStocks = [
    'Tigier 리츠부동산 인프라&ACE 미국 S&P500채권혼합액티브',
    'ACE 미국 S&P 500',
    'SOL 미국배당다우존스',
    'RISE 미국나스닥 100',
    'KODEX 미국배당커브드콜액티브',
    '미국 SPEC',
    'KODEX 미국휴머노이드로봇',
  ];

  // 계좌유형 선택 아코디언 상태
  const [isDivisionOpen, setIsDivisionOpen] = useState(false);

  // 계좌유형별 상세보기 토글 상태
  const [expandedDivisions, setExpandedDivisions] = useState<{ [key: string]: boolean }>({});

  // 기본 계좌유형 목록
  const defaultDivisions = [
    { value: 'P', label: '개인연금' },
    { value: 'G', label: '일반' },
    { value: 'ISA', label: 'ISA' },
  ];

  // 계좌유형 선택 핸들러
  const handleDivisionSelect = (division: string) => {
    setNewRecord({ ...newRecord, division });
    setIsDivisionOpen(false);
  };

  // 선택된 계좌유형 라벨 가져오기
  const getSelectedDivisionLabel = () => {
    const found = defaultDivisions.find((d) => d.value === newRecord.division);
    return found ? `${found.value} (${found.label})` : '계좌유형을 선택하세요';
  };

  // 데이터 로드
  const loadRecords = useCallback(async () => {
    if (!supabase) {
      console.log('Supabase 클라이언트가 없습니다.');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      console.log('finance_records 테이블 조회 시작...');
      const { data, error } = await supabase
        .from('finance_records')
        .select('*')
        .order('period', { ascending: true });

      if (error) {
        console.error('Supabase 에러:', error.message);
        console.error('에러 코드:', error.code);
        console.error('에러 상세:', error.details);
        console.error('에러 힌트:', error.hint);
        throw error;
      }
      
      console.log('조회된 데이터 수:', data?.length || 0);
      setRecords(data || []);
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string };
      console.error('데이터 로드 실패:', err.message || error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // 기간별 합계 데이터 계산
  const getPeriodSummary = (): PeriodSummary[] => {
    const summary: { [key: string]: { dividend: number; value: number } } = {};
    
    records.forEach((record) => {
      if (!summary[record.period]) {
        summary[record.period] = { dividend: 0, value: 0 };
      }
      summary[record.period].dividend += record.dividend || 0;
      summary[record.period].value += record.value || 0;
    });

    return Object.entries(summary)
      .map(([period, data]) => ({
        period: period.replace('2025. ', ''),
        totalDividend: data.dividend,
        totalValue: data.value,
      }))
      .sort((a, b) => {
        const monthA = parseInt(a.period);
        const monthB = parseInt(b.period);
        return monthA - monthB;
      });
  };

  // Owner별 기간별 합계 데이터
  const getOwnerSummary = (): OwnerSummary[] => {
    const owners = [...new Set(records.map((r) => r.owner))];
    const periods = [...new Set(records.map((r) => r.period))].sort((a, b) => {
      const monthA = parseInt(a.replace('2025. ', ''));
      const monthB = parseInt(b.replace('2025. ', ''));
      return monthA - monthB;
    });

    return periods.map((period) => {
      const result: OwnerSummary = { period: period.replace('2025. ', '') };
      owners.forEach((owner) => {
        const ownerRecords = records.filter(
          (r) => r.period === period && r.owner === owner
        );
        result[owner] = ownerRecords.reduce((sum, r) => sum + (r.value || 0), 0);
      });
      return result;
    });
  };

  // Division별 기간별 합계 데이터
  const getDivisionSummary = (): DivisionSummary[] => {
    const divisions = [...new Set(records.map((r) => r.division))];
    const periods = [...new Set(records.map((r) => r.period))].sort((a, b) => {
      const monthA = parseInt(a.replace('2025. ', ''));
      const monthB = parseInt(b.replace('2025. ', ''));
      return monthA - monthB;
    });

    return periods.map((period) => {
      const result: DivisionSummary = { period: period.replace('2025. ', '') };
      divisions.forEach((division) => {
        const divRecords = records.filter(
          (r) => r.period === period && r.division === division
        );
        result[division] = divRecords.reduce((sum, r) => sum + (r.value || 0), 0);
      });
      return result;
    });
  };

  // Category별 기간별 합계 데이터
  const getCategorySummary = (): CategorySummary[] => {
    const categories = [...new Set(records.map((r) => r.category).filter(Boolean))];
    const periods = [...new Set(records.map((r) => r.period))].sort((a, b) => {
      const monthA = parseInt(a.replace('2025. ', ''));
      const monthB = parseInt(b.replace('2025. ', ''));
      return monthA - monthB;
    });

    return periods.map((period) => {
      const result: CategorySummary = { period: period.replace('2025. ', '') };
      categories.forEach((category) => {
        const catRecords = records.filter(
          (r) => r.period === period && r.category === category
        );
        result[category] = catRecords.reduce((sum, r) => sum + (r.value || 0), 0);
      });
      return result;
    });
  };

  // Stock별 기간별 합계 데이터
  const getStockSummary = (): StockSummary[] => {
    const stocks = [...new Set(records.map((r) => r.stock).filter(Boolean))];
    const periods = [...new Set(records.map((r) => r.period))].sort((a, b) => {
      const monthA = parseInt(a.replace('2025. ', ''));
      const monthB = parseInt(b.replace('2025. ', ''));
      return monthA - monthB;
    });

    return periods.map((period) => {
      const result: StockSummary = { period: period.replace('2025. ', '') };
      stocks.forEach((stock) => {
        const stockRecords = records.filter(
          (r) => r.period === period && r.stock === stock
        );
        result[stock] = stockRecords.reduce((sum, r) => sum + (r.value || 0), 0);
      });
      return result;
    });
  };

  // CSV 파일 업로드 핸들러
  const handleCSVFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const csvContent = e.target?.result as string;
      await handleUpdateFromCSV(csvContent);
    };
    reader.readAsText(file, 'UTF-8');
  };

  // CSV 데이터로 업데이트
  const handleUpdateFromCSV = async (csvContent?: string) => {
    if (!supabase) {
      setMessage('❌ Supabase 연결이 설정되지 않았습니다.');
      return;
    }

    try {
      // CSV 내용이 제공되지 않으면 기본 데이터 사용
      if (!csvContent) {
        const defaultCSV = [
          '기간,owner,division,category,stock,QTY,in&out,dividend,value,note,1열,2열,3열',
          '2025. 8,김희창,P,REITs,Tigier 리츠부동산 인프라&ACE 미국 S&P500 채권혼합액티브,,,"163,086","31,949,405",,,,',
          '2025. 8,김희창,P,S&P,ACE 미국 S&P 500,,,"80,678","32,563,960",,,,',
          '2025. 8,김희창,P,DOW,SOL 미국배당다우존스,,,"65,912","26,738,630",,,,',
          '2025. 8,김희창,P,CC,KODEX 미국배당커버드콜액티브,,,"44,528","4,851,120",,,,',
          '2025. 8,민수진,P,NASDAQ,RISE 미국나스닥 100,,,0,"4,183,900",,,,',
          '2025. 8,김희창,G,ROBOT,KODEX 미국휴머노이드로봇,,,"8,999","19,606,850",,,,',
          '2025. 8,김희창,ISA,CC,KODEX 미국배당커브드콜액티브,,,"11,592","1,545,700",,,,',
          '2025. 8,김희창,G,SPEC,미국 SPEC,,,0,"800,000",,,,',
          '2025. 9,김희창,P,REITs,Tigier 리츠부동산 인프라&ACE 미국 S&P500채권혼합액티브,,,"163,086","32,540,000",,,,',
          '2025. 9,김희창,P,S&P,ACE 미국 S&P 500,,,,"33,720,000",,,,',
          '2025. 9,김희창,P,DOW,SOL 미국배당다우존스,,,"75,968","26,435,000",,,,',
          '2025. 9,김희창,P,CC,KODEX 미국배당커버드콜액티브,,,"44,804","5,020,000",,,,',
          '2025. 9,민수진,P,NASDAQ,RISE 미국나스닥 100,,"500,000",,"4,800,000",,,,',
          '2025. 9,김희창,G,ROBOT,KODEX 미국휴머노이드로봇,,"-527,851",,"21,104,495",,,,',
          '2025. 9,김희창,ISA,CC,KODEX 미국배당커브드콜액티브,,,"11,960","1,585,000",,,,',
          '2025. 9,김희창,G,SPEC,미국 SPEC,,,,"1,140,000",,,,',
          '2025. 10,김희창,P,REITs,Tigier 리츠부동산 인프라&ACE 미국 S&P500채권혼합액티브,,,"164,703","33,634,620",,,,',
          '2025. 10,김희창,P,S&P,ACE 미국 S&P 500,,,"83,700","33,845,670",,,,',
          '2025. 10,김희창,P,DOW,SOL 미국배당다우존스,,,"80,954","26,637,550",,,,',
          '2025. 10,김희창,P,CC,KODEX 미국배당커버드콜액티브,,,"39,168","5,114,280",,,,',
          '2025. 10,민수진,P,NASDAQ,RISE 미국나스닥 100,,,,"4,500,000",,,,',
          '2025. 10,김희창,G,ROBOT,KODEX 미국휴머노이드로봇,,,,"22,000,000",,,,',
          '2025. 10,김희창,ISA,CC,KODEX 미국배당커브드콜액티브,,,"7,584","1,629,550",,,,',
          '2025. 10,김희창,G,SPEC,미국 SPEC,,,,"1,140,000",,,,',
          '2025. 11,김희창,P,REITs,Tigier 리츠부동산 인프라&ACE 미국 S&P500채권혼합액티브,,,"164,703","34,153,185",,,,',
          '2025. 11,김희창,P,S&P,ACE 미국 S&P 500,,,,"36,240,810",,,,',
          '2025. 11,김희창,P,DOW,SOL 미국배당다우존스,,,"83,700","27,951,300",,,,',
          '2025. 11,김희창,P,CC,KODEX 미국배당커버드콜액티브,,,"39,703","5,255,040",,,,',
          '2025. 11,민수진,P,NASDAQ,RISE 미국나스닥 100,,,,"6,500,000",,,,',
          '2025. 11,김희창,G,ROBOT,KODEX 미국휴머노이드로봇,,"-22,000,000",,0,,,,,',
          '2025. 11,김희창,ISA,CC,KODEX 미국배당커브드콜액티브,,,"7,584","1,674,400",,,,',
          '2025. 11,김희창,G,SPEC,미국 SPEC,,,,"1,140,000",,,,',
          '2025. 12,김희창,P,REITs,Tigier 리츠부동산 인프라&ACE 미국 S&P500채권혼합액티브,,"3,000,000","164,703","37,148,323",,,,',
          '2025. 12,김희창,P,S&P,ACE 미국 S&P 500,,,,"36,101,955",,,,',
          '2025. 12,김희창,P,DOW,SOL 미국배당다우존스,,,"83,615","28,393,720",,,,',
          '2025. 12,김희창,P,CC,KODEX 미국배당커버드콜액티브,,,"39,984","5,370,335",,,,',
          '2025. 12,민수진,P,NASDAQ,RISE 미국나스닥 100,,"1,500,000",,"6,700,000",,,,',
          '2025. 12,김희창,G,S&P,ACE 미국 S&P 500,,"19,000,000",,"18,964,260",,,,',
          '2025. 12,김사랑,G,S&P,ACE 미국 S&P 500,,"20,000,000",,"19,974,375",,,,',
          '2025. 12,김희창,ISA,CC,KODEX 미국배당커브드콜액티브,,,"7,742","1,658,800",,,,',
          '2025. 12,김희창,G,SPEC,미국 SPEC,,,,"1,160,000",,,,',
        ];
        csvContent = defaultCSV.join('\n');
      }

      // CSV 파싱 (따옴표 처리 포함)
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const lines = csvContent.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        setMessage('❌ CSV 파일 형식이 올바르지 않습니다.');
        return;
      }

      const headers = parseCSVLine(lines[0]);
      const records: FinanceRecord[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length < 9) continue; // 최소 필수 필드 확인

        const parseNumber = (str: string): number => {
          if (!str || str.trim() === '' || str === '-') return 0;
          const cleaned = str.replace(/,/g, '').replace(/"/g, '').trim();
          return parseFloat(cleaned) || 0;
        };

        const record: FinanceRecord = {
          period: values[0]?.replace(/"/g, '').trim() || '',
          owner: values[1]?.replace(/"/g, '').trim() || '',
          division: values[2]?.replace(/"/g, '').trim() || '',
          category: values[3]?.replace(/"/g, '').trim() || '',
          stock: values[4]?.replace(/"/g, '').trim() || '',
          qty: parseNumber(values[5] || '0'),
          in_out: parseNumber(values[6] || '0'),
          dividend: parseNumber(values[7] || '0'),
          value: parseNumber(values[8] || '0'),
          growth_rate: 0,
          memo: values[9]?.replace(/"/g, '').trim() || '',
        };

        if (record.period && record.owner && record.stock) {
          records.push(record);
        }
      }

      if (records.length === 0) {
        setMessage('❌ 파싱된 데이터가 없습니다.');
        return;
      }

      // 기존 데이터 삭제
      const { error: deleteError } = await supabase
        .from('finance_records')
        .delete()
        .neq('id', ''); // 모든 레코드 삭제

      if (deleteError) {
        console.error('삭제 오류:', deleteError);
        // 삭제 실패해도 계속 진행
      }

      // 새 데이터 삽입
      const { error: insertError } = await supabase
        .from('finance_records')
        .insert(records);

      if (insertError) throw insertError;

      setMessage(`✅ ${records.length}개의 레코드가 업데이트되었습니다!`);
      loadRecords();
      
      setTimeout(() => setMessage(''), 5000);
    } catch (error) {
      console.error('CSV 업데이트 실패:', error);
      setMessage('❌ CSV 업데이트에 실패했습니다.');
    }
  };

  // 신규 레코드 저장
  const handleSaveRecord = async () => {
    if (!supabase) {
      setMessage('❌ Supabase 연결이 설정되지 않았습니다.');
      return;
    }

    if (!newRecord.period || !newRecord.owner || !newRecord.stock) {
      setMessage('❌ 기간, 소유자, 종목명은 필수입니다.');
      return;
    }

    try {
      const { error } = await supabase.from('finance_records').insert([newRecord]);

      if (error) throw error;

      setMessage('✅ 저장되었습니다!');
      setNewRecord({
        period: '',
        owner: '',
        division: 'P',
        category: '',
        stock: '',
        qty: 0,
        in_out: 0,
        dividend: 0,
        value: 0,
        growth_rate: 0,
        memo: '',
      });
      loadRecords();
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('저장 실패:', error);
      setMessage('❌ 저장에 실패했습니다.');
    }
  };

  // 고유 Owner 목록
  const uniqueOwners = [...new Set(records.map((r) => r.owner))];
  const uniqueDivisions = [...new Set(records.map((r) => r.division))];
  const uniqueCategories = [...new Set(records.map((r) => r.category).filter(Boolean))];

  // 기간 목록 생성 (기존 + 미래 기간)
  const getAvailablePeriods = (): string[] => {
    // 기존 기간 추출
    const existingPeriods = [...new Set(records.map((r) => r.period))];
    
    // 현재 날짜 기준 다음 달까지 생성
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 0-indexed
    
    // 다음 2개월까지 미래 기간 생성
    const futurePeriods: string[] = [];
    for (let i = 0; i <= 2; i++) {
      let year = currentYear;
      let month = currentMonth + i;
      if (month > 12) {
        month = month - 12;
        year = year + 1;
      }
      const periodStr = `${year}. ${month}`;
      if (!existingPeriods.includes(periodStr)) {
        futurePeriods.push(periodStr);
      }
    }
    
    // 모든 기간을 합치고 정렬
    const allPeriods = [...existingPeriods, ...futurePeriods];
    
    return allPeriods.sort((a, b) => {
      const [yearA, monthA] = a.split('. ').map(Number);
      const [yearB, monthB] = b.split('. ').map(Number);
      if (yearA !== yearB) return yearA - yearB;
      return monthA - monthB;
    });
  };

  const availablePeriods = getAvailablePeriods();

  // 기간 선택 핸들러
  const handlePeriodSelect = (period: string) => {
    setNewRecord({ ...newRecord, period });
    setIsPeriodOpen(false);
    setIsCustomPeriod(false);
  };

  // 커스텀 기간 추가 핸들러
  const handleCustomPeriodAdd = () => {
    if (customPeriodInput.trim()) {
      setNewRecord({ ...newRecord, period: customPeriodInput.trim() });
      setCustomPeriodInput('');
      setIsCustomPeriod(false);
      setIsPeriodOpen(false);
    }
  };

  // 소유자 목록 생성 (기본값 + 데이터에서 추출된 소유자)
  const getAvailableOwners = (): string[] => {
    const recordOwners = [...new Set(records.map((r) => r.owner))];
    const allOwners = [...new Set([...defaultOwners, ...recordOwners])];
    return allOwners.sort();
  };

  const availableOwners = getAvailableOwners();

  // 소유자 선택 핸들러
  const handleOwnerSelect = (owner: string) => {
    setNewRecord({ ...newRecord, owner });
    setIsOwnerOpen(false);
    setIsCustomOwner(false);
  };

  // 커스텀 소유자 추가 핸들러
  const handleCustomOwnerAdd = () => {
    if (customOwnerInput.trim()) {
      setNewRecord({ ...newRecord, owner: customOwnerInput.trim() });
      setCustomOwnerInput('');
      setIsCustomOwner(false);
      setIsOwnerOpen(false);
    }
  };

  // 카테고리 목록 생성 (기본값 순서 유지 + 추가 카테고리)
  const getAvailableCategories = (): string[] => {
    const recordCategories = [...new Set(records.map((r) => r.category).filter(Boolean))];
    // 기본 카테고리 순서 유지, 추가 카테고리는 뒤에 정렬하여 추가
    const additionalCategories = recordCategories
      .filter((c) => !defaultCategories.includes(c))
      .sort();
    return [...defaultCategories, ...additionalCategories];
  };

  const availableCategories = getAvailableCategories();

  // 카테고리 선택 핸들러
  const handleCategorySelect = (category: string) => {
    setNewRecord({ ...newRecord, category });
    setIsCategoryOpen(false);
    setIsCustomCategory(false);
  };

  // 커스텀 카테고리 추가 핸들러
  const handleCustomCategoryAdd = () => {
    if (customCategoryInput.trim()) {
      setNewRecord({ ...newRecord, category: customCategoryInput.trim() });
      setCustomCategoryInput('');
      setIsCustomCategory(false);
      setIsCategoryOpen(false);
    }
  };

  // 종목명 목록 생성 (기본값 + 데이터에서 추출된 종목)
  const getAvailableStocks = (): string[] => {
    const recordStocks = [...new Set(records.map((r) => r.stock).filter(Boolean))];
    const allStocks = [...new Set([...defaultStocks, ...recordStocks])];
    return allStocks;
  };

  const availableStocks = getAvailableStocks();

  // 종목명 선택 핸들러
  const handleStockSelect = (stock: string) => {
    setNewRecord({ ...newRecord, stock });
    setIsStockOpen(false);
    setIsCustomStock(false);
  };

  // 커스텀 종목명 추가 핸들러
  const handleCustomStockAdd = () => {
    if (customStockInput.trim()) {
      setNewRecord({ ...newRecord, stock: customStockInput.trim() });
      setCustomStockInput('');
      setIsCustomStock(false);
      setIsStockOpen(false);
    }
  };

  // 색상 배열
  const ownerColors: { [key: string]: string } = {
    '김희창': '#3B82F6',
    '민수진': '#10B981',
    '김사랑': '#F59E0B',
  };

  const divisionColors: { [key: string]: string } = {
    'P': '#8B5CF6',
    'G': '#EC4899',
    'ISA': '#14B8A6',
  };

  const divisionLabels: { [key: string]: string } = {
    'P': '개인연금',
    'G': '일반',
    'ISA': 'ISA',
  };

  // 카테고리별 색상
  const categoryColors: { [key: string]: string } = {
    'S&P': '#3B82F6',
    'DOW': '#10B981',
    'REITs': '#F59E0B',
    'CC': '#EC4899',
    'NASDAQ': '#8B5CF6',
    'ROBOT': '#14B8A6',
  };

  // Legend 컴포넌트용 더미 (사용되지 않지만 import 유지)
  void Legend;
  void getCategorySummary;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-20 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-20">
      <GlobalNav />

      <div className="max-w-[480px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="space-y-2">
          {/* 제목 */}
          <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 mb-2">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2">
              💰 금융투자 포트폴리오
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              투자 현황을 기록하고 분석하세요.
            </p>
          </div>

          {/* 탭 메뉴 */}
          <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-2">
            <div className="flex gap-1">
              {[
                { key: 'overview', label: '전체', emoji: '📊' },
                { key: 'category', label: '비중', emoji: '📈' },
                { key: 'owner', label: '소유자', emoji: '👤' },
                { key: 'division', label: '계좌', emoji: '📁' },
                { key: 'add', label: '등록', emoji: '➕' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`flex-1 px-0.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'bg-red-600 text-white'
                      : 'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="hidden sm:inline">{tab.emoji} </span>{tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 전체 현황 탭 */}
          {activeTab === 'overview' && (
            <>
              {/* 총 자산 요약 - 통합 */}
              <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
                {(() => {
                  const periodSummary = getPeriodSummary();
                  const latestPeriod = periodSummary.slice(-1)[0];
                  const prevPeriod = periodSummary.slice(-2, -1)[0];
                  
                  // 변동 금액 및 퍼센트 계산
                  const valueDiff = latestPeriod && prevPeriod 
                    ? latestPeriod.totalValue - prevPeriod.totalValue
                    : 0;
                  const valueChangePercent = latestPeriod && prevPeriod && prevPeriod.totalValue > 0
                    ? ((valueDiff / prevPeriod.totalValue) * 100)
                    : 0;
                  const isPositive = valueDiff >= 0;
                  
                  // 최신 월 구하기
                  const latestMonth = latestPeriod?.period || '12';
                  
                  // 배당금 관련 계산
                  const dividendDiff = latestPeriod && prevPeriod 
                    ? latestPeriod.totalDividend - prevPeriod.totalDividend
                    : 0;
                  const isDividendPositive = dividendDiff >= 0;
                  
                  // 2025년 누적 배당금 계산
                  const yearlyDividend = periodSummary.reduce((sum, p) => sum + p.totalDividend, 0);
                  
                  // 2025년 누적 입출금 계산
                  const yearlyInOut = records.reduce((sum, r) => sum + (r.in_out || 0), 0);
                  
                  // 2025년 8월 기준 평가금액 (수익률 기준점)
                  const augustPeriod = periodSummary.find(p => p.period === '8');
                  const augustValue = augustPeriod?.totalValue || 0;
                  
                  // 8월 이후 입출금 합계 계산 (9월, 10월, 11월, 12월)
                  const inOutAfterAugust = records
                    .filter(r => {
                      const month = parseInt(r.period.split('. ')[1] || '0');
                      return month > 8;
                    })
                    .reduce((sum, r) => sum + (r.in_out || 0), 0);
                  
                  // 2025년 수익률 계산: (현재 평가금액 - 8월 평가금액 - 8월 이후 입출금) / 8월 평가금액 * 100
                  const currentValue = latestPeriod?.totalValue || 0;
                  const profitLoss = currentValue - augustValue - inOutAfterAugust;
                  const profitRate = augustValue > 0 ? ((profitLoss / augustValue) * 100) : 0;
                  const isProfitPositive = profitLoss >= 0;
                  
                  // 전월 수익률 계산 (전월이 있는 경우)
                  let prevProfitLoss = 0;
                  let prevProfitRate = 0;
                  let profitDiff = 0;
                  let profitRateDiff = 0;
                  
                  if (prevPeriod && augustValue > 0) {
                    const prevValue = prevPeriod.totalValue;
                    // 전월까지의 입출금 (9월 ~ 전월)
                    const prevMonth = parseInt(prevPeriod.period || '0');
                    const inOutUntilPrevMonth = records
                      .filter(r => {
                        const month = parseInt(r.period.split('. ')[1] || '0');
                        return month > 8 && month <= prevMonth;
                      })
                      .reduce((sum, r) => sum + (r.in_out || 0), 0);
                    
                    prevProfitLoss = prevValue - augustValue - inOutUntilPrevMonth;
                    prevProfitRate = ((prevProfitLoss / augustValue) * 100);
                    
                    // 전월 대비 차이
                    profitDiff = profitLoss - prevProfitLoss;
                    profitRateDiff = profitRate - prevProfitRate;
                  }
                  
                  return latestPeriod ? (
                    <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                      {/* 총 평가금액 */}
                      <div className="text-sm text-gray-900 dark:text-white mb-1">
                        {latestMonth}월(최근) 총평가금액
                      </div>
                      <div className="flex items-baseline gap-2 flex-wrap mb-4">
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                          {latestPeriod.totalValue.toLocaleString()}원
                        </span>
                        {prevPeriod && (
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            ({isPositive ? '+' : ''}{valueDiff.toLocaleString()}원, {isPositive ? '+' : ''}{valueChangePercent.toFixed(1)}%)
                          </span>
                        )}
                      </div>
                      
                      {/* 상세 정보 */}
                      <div className="space-y-2.5 pt-3 border-t border-gray-200 dark:border-gray-700">
                        {/* 12월 배당금 */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-900 dark:text-white">{latestMonth}월 배당금</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {latestPeriod.totalDividend.toLocaleString()}원
                            </span>
                            {prevPeriod && dividendDiff !== 0 && (
                              <span className="text-xs font-normal text-gray-700 dark:text-gray-300">
                                ({isDividendPositive ? '+' : ''}{dividendDiff.toLocaleString()})
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* 2025년 누적 배당금 */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-900 dark:text-white">2025년 누적 배당금</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {yearlyDividend.toLocaleString()}원
                          </span>
                        </div>
                        
                        {/* 2025년 누적 입출금 */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-900 dark:text-white">2025년 누적 입출금</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {yearlyInOut.toLocaleString()}원
                          </span>
                        </div>
                        
                        {/* 2025년 수익률 */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-900 dark:text-white">2025년 수익률</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {isProfitPositive ? '+' : ''}{profitRate.toFixed(1)}%
                            </span>
                            <span className="text-xs font-normal text-gray-700 dark:text-gray-300">
                              ({isProfitPositive ? '+' : ''}{profitLoss.toLocaleString()}원)
                            </span>
                          </div>
                        </div>
                        
                        {/* 전월 대비 수익률 */}
                        {prevPeriod && profitRateDiff !== 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-900 dark:text-white">전월 대비</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {profitRateDiff >= 0 ? '+' : ''}{profitRateDiff.toFixed(1)}%
                              </span>
                              <span className="text-xs font-normal text-gray-700 dark:text-gray-300">
                                ({profitDiff >= 0 ? '+' : ''}{profitDiff.toLocaleString()}원)
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">데이터가 없습니다.</p>
                  );
                })()}
              </div>

              {/* 기간별 배당금 & 평가금액 그래프 */}
              <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-1 sm:p-2">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                  📈 총자산 추이
                </h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={getPeriodSummary()} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                      <XAxis 
                        dataKey="period" 
                        tick={{ fill: '#9CA3AF', fontSize: 12 }}
                        tickFormatter={(v) => `${v}월`}
                      />
                      <YAxis 
                        yAxisId="left"
                        tick={{ fill: '#9CA3AF', fontSize: 10 }}
                        tickFormatter={(v) => formatNumber(v)}
                        width={40}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        tick={{ fill: '#6B7280', fontSize: 10 }}
                        tickFormatter={(v) => formatNumber(v)}
                        width={40}
                        axisLine={false}
                        tickLine={false}
                        domain={[0, 1000000]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#fff',
                        }}
                        formatter={(value: number, name: string) => {
                          if (name === '평가금액') {
                            return [formatCurrency(value), '평가금액'];
                          } else if (name === '배당금') {
                            return [formatCurrency(value), '배당금'];
                          }
                          return [formatCurrency(value), name];
                        }}
                        labelFormatter={(label) => `${label}월`}
                      />
                      <Bar
                        yAxisId="right"
                        dataKey="totalDividend"
                        name="배당금"
                        fill="#6B7280"
                        radius={[4, 4, 0, 0]}
                        background={false}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="totalValue"
                        name="평가금액"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={{ fill: '#3B82F6', r: 4 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </>
          )}

          {/* 소유자별 탭 */}
          {activeTab === 'owner' && (
            <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                👤 소유자별 평가금액 추이
              </h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getOwnerSummary()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis 
                      dataKey="period" 
                      tick={{ fill: '#9CA3AF', fontSize: 12 }}
                      tickFormatter={(v) => `${v}월`}
                    />
                    <YAxis 
                      tick={{ fill: '#9CA3AF', fontSize: 10 }}
                      tickFormatter={(v) => formatNumber(v)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                      formatter={(value: number) => [formatCurrency(value), '']}
                      labelFormatter={(label) => `${label}월`}
                    />
                    {uniqueOwners.map((owner) => (
                      <Bar
                        key={owner}
                        dataKey={owner}
                        name={owner}
                        fill={ownerColors[owner] || '#6B7280'}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 소유자별 최신 현황 */}
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">최신 현황</h3>
                {uniqueOwners.map((owner) => {
                  const ownerRecords = records.filter(
                    (r) => r.owner === owner && r.period === '2025. 12'
                  );
                  const total = ownerRecords.reduce((sum, r) => sum + (r.value || 0), 0);
                  return (
                    <div
                      key={owner}
                      className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: ownerColors[owner] || '#6B7280' }}
                        />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {owner}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 계좌유형별 탭 */}
          {activeTab === 'division' && (
            <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                📁 계좌유형별 평가금액 추이
              </h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getDivisionSummary()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis 
                      dataKey="period" 
                      tick={{ fill: '#9CA3AF', fontSize: 12 }}
                      tickFormatter={(v) => `${v}월`}
                    />
                    <YAxis 
                      tick={{ fill: '#9CA3AF', fontSize: 10 }}
                      tickFormatter={(v) => formatNumber(v)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                      formatter={(value: number, name: string) => [
                        formatCurrency(value),
                        divisionLabels[name] || name,
                      ]}
                      labelFormatter={(label) => `${label}월`}
                    />
                    {uniqueDivisions.map((division) => (
                      <Bar
                        key={division}
                        dataKey={division}
                        name={division}
                        fill={divisionColors[division] || '#6B7280'}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 계좌유형별 최신 현황 */}
              <div className="mt-6 space-y-3">
                {(() => {
                  // 최신 기간과 전월 기간 구하기
                  const allPeriods = [...new Set(records.map((r) => r.period))].sort((a, b) => {
                    const [yearA, monthA] = a.split('. ').map(Number);
                    const [yearB, monthB] = b.split('. ').map(Number);
                    if (yearA !== yearB) return yearB - yearA;
                    return monthB - monthA;
                  });
                  const latestPeriod = allPeriods[0] || '2025. 12';
                  const prevPeriod = allPeriods[1] || '';
                  const latestMonth = latestPeriod.split('. ')[1] || '12';

                  return (
                    <>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {latestMonth}월 현황 (최신)
                      </h3>
                      {uniqueDivisions.map((division) => {
                        // 최신 기간 데이터
                        const divRecords = records.filter(
                          (r) => r.division === division && r.period === latestPeriod
                        );
                        const total = divRecords.reduce((sum, r) => sum + (r.value || 0), 0);
                        const totalDividend = divRecords.reduce((sum, r) => sum + (r.dividend || 0), 0);
                        
                        // 전월 데이터
                        const prevRecords = records.filter(
                          (r) => r.division === division && r.period === prevPeriod
                        );
                        const prevTotal = prevRecords.reduce((sum, r) => sum + (r.value || 0), 0);
                        
                        // 변동 계산
                        const diff = total - prevTotal;
                        const diffPercent = prevTotal > 0 ? ((diff / prevTotal) * 100) : 0;
                        const isPositive = diff >= 0;
                        
                        const isExpanded = expandedDivisions[division] || false;
                        
                        return (
                          <div key={division} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden">
                            {/* 헤더 - 클릭하면 토글 */}
                            <button
                              onClick={() => setExpandedDivisions(prev => ({
                                ...prev,
                                [division]: !prev[division]
                              }))}
                              className="w-full p-3 hover:bg-gray-100 dark:hover:bg-gray-600/50 transition-colors text-left"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: divisionColors[division] || '#6B7280' }}
                                  />
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {divisionLabels[division] || division}
                                  </span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    ({divRecords.length}종목)
                                  </span>
                                </div>
                                <svg
                                  className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                              
                              {/* 평가금액 */}
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-gray-600 dark:text-gray-400">{latestMonth}월 총평가금액</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-900 dark:text-white">
                                    {total.toLocaleString()}원
                                  </span>
                                  {prevTotal > 0 && (
                                    <span className={`text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                      ({isPositive ? '+' : ''}{diff.toLocaleString()}원, {isPositive ? '+' : ''}{diffPercent.toFixed(1)}%)
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              {/* 배당금 */}
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">{latestMonth}월 배당금</span>
                                <span className="font-medium text-green-600 dark:text-green-400">
                                  {totalDividend.toLocaleString()}원
                                </span>
                              </div>
                            </button>
                            
                            {/* 상세 종목 리스트 */}
                            {isExpanded && divRecords.length > 0 && (
                              <div className="border-t border-gray-200 dark:border-gray-600">
                                {divRecords.map((record, idx) => (
                                  <div
                                    key={`${record.stock}-${idx}`}
                                    className="flex items-center justify-between px-4 py-2 text-xs border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <span className="text-gray-400">•</span>
                                      <span className="text-gray-700 dark:text-gray-300 truncate">
                                        {record.stock}
                                      </span>
                                      {record.category && (
                                        <span className="text-[10px] bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded flex-shrink-0">
                                          {record.category}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-gray-900 dark:text-white font-medium ml-2 flex-shrink-0">
                                      {(record.value || 0).toLocaleString()}원
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* 카테고리별 탭 */}
          {activeTab === 'category' && (
            <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                📈 투자비중
              </h2>

              {/* 카테고리별 원형 차트 */}
              <div>
                {(() => {
                  // 최신 기간 찾기
                  const periods = [...new Set(records.map((r) => r.period))].sort((a, b) => {
                    const [yearA, monthA] = a.split('. ').map(Number);
                    const [yearB, monthB] = b.split('. ').map(Number);
                    if (yearA !== yearB) return yearB - yearA;
                    return monthB - monthA;
                  });
                  const latestPeriod = periods[0];
                  
                  // 최신 기간의 카테고리별 합계 데이터
                  const pieData = uniqueCategories.map((category) => {
                    const catRecords = records.filter(
                      (r) => r.category === category && r.period === latestPeriod
                    );
                    const total = catRecords.reduce((sum, r) => sum + (r.value || 0), 0);
                    return {
                      name: category,
                      value: total,
                      color: categoryColors[category] || '#6B7280',
                    };
                  }).filter((item) => item.value > 0);

                  const totalValue = pieData.reduce((sum, item) => sum + item.value, 0);

                  return pieData.length > 0 ? (
                    <>
                      <div className="text-center text-xs text-gray-500 dark:text-gray-400 mb-2">
                        기준: {latestPeriod}
                      </div>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={95}
                              paddingAngle={4}
                              dataKey="value"
                              label={({ name, percent, cx, cy, midAngle, outerRadius }) => {
                                const RADIAN = Math.PI / 180;
                                const radius = outerRadius + 25;
                                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                const pct = (percent * 100).toFixed(0);
                                if (percent < 0.005) return null; // 0.5% 미만만 라벨 숨김
                                return (
                                  <text
                                    x={x}
                                    y={y}
                                    fill="#374151"
                                    textAnchor={x > cx ? 'start' : 'end'}
                                    dominantBaseline="central"
                                    fontSize={16}
                                    fontWeight={500}
                                  >
                                    {`${name} ${pct}%`}
                                  </text>
                                );
                              }}
                              labelLine={{
                                stroke: '#9CA3AF',
                                strokeWidth: 1,
                              }}
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#FFFFFF',
                                border: '1px solid #E5E7EB',
                                borderRadius: '8px',
                                color: '#1F2937',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                              }}
                              formatter={(value: number) => [formatCurrency(value), '']}
                              labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      {/* 총합 표시 */}
                      <div className="text-center mt-2">
                        <span className="text-sm text-gray-600 dark:text-gray-300">총 평가금액: </span>
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                          {formatCurrency(totalValue)}
                        </span>
                      </div>
                      {/* 범례 리스트 */}
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {pieData.map((item) => (
                          <div
                            key={item.name}
                            className="flex items-center justify-between bg-white dark:bg-gray-600 rounded-lg p-2.5 shadow-sm border border-gray-100 dark:border-gray-500"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                {item.name}
                              </span>
                            </div>
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {formatNumber(item.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-500 text-center py-4">데이터가 없습니다.</p>
                  );
                })()}
              </div>

              {/* 카테고리별 최근 3개월 데이터 표 */}
              <div className="mt-6">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">📊 최근 3개월 추이</h2>
                {(() => {
                  // 최근 3개월 기간 가져오기
                  const allPeriods = [...new Set(records.map((r) => r.period))].sort((a, b) => {
                    const [yearA, monthA] = a.split('. ').map(Number);
                    const [yearB, monthB] = b.split('. ').map(Number);
                    if (yearA !== yearB) return yearB - yearA;
                    return monthB - monthA;
                  });
                  const recentPeriods = allPeriods.slice(0, 3).reverse(); // 오래된 순으로 정렬

                  // 카테고리별 데이터 집계
                  const latestPeriod = recentPeriods[recentPeriods.length - 1];
                  const tableData = uniqueCategories.map((category) => {
                    const periodValues: { [key: string]: number } = {};
                    recentPeriods.forEach((period) => {
                      const catRecords = records.filter(
                        (r) => r.category === category && r.period === period
                      );
                      periodValues[period] = catRecords.reduce((sum, r) => sum + (r.value || 0), 0);
                    });
                    return {
                      category,
                      color: categoryColors[category] || '#6B7280',
                      periodValues,
                      latestValue: periodValues[latestPeriod] || 0,
                    };
                  }).filter((item) => {
                    // 최근 3개월 중 하나라도 값이 있는 카테고리만 표시
                    return recentPeriods.some((p) => item.periodValues[p] > 0);
                  }).sort((a, b) => b.latestValue - a.latestValue); // 최신 금액 기준 내림차순 정렬

                  return tableData.length > 0 && recentPeriods.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-600">
                            <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">카테고리</th>
                            {recentPeriods.map((period) => (
                              <th key={period} className="text-right py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">
                                {period.replace('2025. ', '')}월
                              </th>
                            ))}
                            <th className="text-right py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">변동</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableData.map((row) => {
                            const firstValue = row.periodValues[recentPeriods[0]] || 0;
                            const lastValue = row.periodValues[recentPeriods[recentPeriods.length - 1]] || 0;
                            const change = firstValue > 0 ? ((lastValue - firstValue) / firstValue * 100) : 0;
                            
                            return (
                              <tr key={row.category} className="border-b border-gray-100 dark:border-gray-700">
                                <td className="py-2 px-2">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-2.5 h-2.5 rounded-full"
                                      style={{ backgroundColor: row.color }}
                                    />
                                    <span className="font-medium text-gray-900 dark:text-white">{row.category}</span>
                                  </div>
                                </td>
                                {recentPeriods.map((period) => (
                                  <td key={period} className="text-right py-2 px-2 text-gray-700 dark:text-gray-300">
                                    {row.periodValues[period] > 0 ? formatNumber(row.periodValues[period]) : '-'}
                                  </td>
                                ))}
                                <td className="text-right py-2 px-2">
                                  {change !== 0 ? (
                                    <span className={`font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">최근 3개월 데이터가 없습니다.</p>
                  );
                })()}
              </div>
            </div>
          )}

          {/* 신규 등록 탭 */}
          {activeTab === 'add' && (
            <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  ➕ 신규 투자 기록 등록
                </h2>
                <div className="flex gap-2">
                  <label className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
                    📊 CSV 파일 업로드
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCSVFileUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={() => handleUpdateFromCSV()}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                  >
                    📋 기본 CSV 데이터 적용
                  </button>
                </div>
              </div>

              {message && (
                <div
                  className={`mb-4 p-3 rounded-lg text-sm ${
                    message.includes('✅')
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}
                >
                  {message}
                </div>
              )}

              <div className="space-y-4">
                {/* 기간 - 아코디언 선택 */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    📅 기간 *
                  </label>
                  
                  {/* 선택된 기간 표시 / 토글 버튼 */}
                  <button
                    type="button"
                    onClick={() => setIsPeriodOpen(!isPeriodOpen)}
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 outline-none transition-colors hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <span className={newRecord.period ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}>
                      {newRecord.period || '기간을 선택하세요'}
                    </span>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${isPeriodOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* 아코디언 드롭다운 */}
                  {isPeriodOpen && (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {/* 기존 기간 목록 */}
                      {availablePeriods.map((period) => {
                        const isFuture = !records.some((r) => r.period === period);
                        return (
                          <button
                            key={period}
                            type="button"
                            onClick={() => handlePeriodSelect(period)}
                            className={`w-full px-4 py-2.5 text-sm text-left flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${
                              newRecord.period === period
                                ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium'
                                : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {newRecord.period === period && (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                              {period}
                            </span>
                            {isFuture && (
                              <span className="text-xs bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full">
                                신규
                              </span>
                            )}
                          </button>
                        );
                      })}

                      {/* 구분선 */}
                      <div className="border-t border-gray-200 dark:border-gray-600 my-1" />

                      {/* 직접 입력 옵션 */}
                      {!isCustomPeriod ? (
                        <button
                          type="button"
                          onClick={() => setIsCustomPeriod(true)}
                          className="w-full px-4 py-2.5 text-sm text-left text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          새 기간 직접 입력...
                        </button>
                      ) : (
                        <div className="p-3 space-y-2">
                          <input
                            type="text"
                            placeholder="예: 2026. 3"
                            value={customPeriodInput}
                            onChange={(e) => setCustomPeriodInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleCustomPeriodAdd();
                              }
                            }}
                            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleCustomPeriodAdd}
                              className="flex-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            >
                              추가
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsCustomPeriod(false);
                                setCustomPeriodInput('');
                              }}
                              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 외부 클릭 시 닫기 */}
                  {isPeriodOpen && (
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => {
                        setIsPeriodOpen(false);
                        setIsCustomPeriod(false);
                      }}
                    />
                  )}
                </div>

                {/* 소유자 - 아코디언 선택 */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    👤 소유자 *
                  </label>
                  
                  {/* 선택된 소유자 표시 / 토글 버튼 */}
                  <button
                    type="button"
                    onClick={() => setIsOwnerOpen(!isOwnerOpen)}
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 outline-none transition-colors hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <span className={newRecord.owner ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}>
                      {newRecord.owner || '소유자를 선택하세요'}
                    </span>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${isOwnerOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* 아코디언 드롭다운 */}
                  {isOwnerOpen && (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {/* 소유자 목록 */}
                      {availableOwners.map((owner) => {
                        const isDefault = defaultOwners.includes(owner);
                        return (
                          <button
                            key={owner}
                            type="button"
                            onClick={() => handleOwnerSelect(owner)}
                            className={`w-full px-4 py-2.5 text-sm text-left flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${
                              newRecord.owner === owner
                                ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium'
                                : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {newRecord.owner === owner && (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                              {owner}
                            </span>
                            {isDefault && (
                              <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                                기본
                              </span>
                            )}
                          </button>
                        );
                      })}

                      {/* 구분선 */}
                      <div className="border-t border-gray-200 dark:border-gray-600 my-1" />

                      {/* 직접 입력 옵션 */}
                      {!isCustomOwner ? (
                        <button
                          type="button"
                          onClick={() => setIsCustomOwner(true)}
                          className="w-full px-4 py-2.5 text-sm text-left text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          새 소유자 추가...
                        </button>
                      ) : (
                        <div className="p-3 space-y-2">
                          <input
                            type="text"
                            placeholder="예: 홍길동"
                            value={customOwnerInput}
                            onChange={(e) => setCustomOwnerInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleCustomOwnerAdd();
                              }
                            }}
                            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleCustomOwnerAdd}
                              className="flex-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            >
                              추가
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsCustomOwner(false);
                                setCustomOwnerInput('');
                              }}
                              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 외부 클릭 시 닫기 */}
                  {isOwnerOpen && (
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => {
                        setIsOwnerOpen(false);
                        setIsCustomOwner(false);
                      }}
                    />
                  )}
                </div>

                {/* 계좌유형 - 아코디언 선택 */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    💼 계좌유형
                  </label>
                  
                  {/* 선택된 계좌유형 표시 / 토글 버튼 */}
                  <button
                    type="button"
                    onClick={() => setIsDivisionOpen(!isDivisionOpen)}
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 outline-none transition-colors hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <span className="text-gray-900 dark:text-white">
                      {getSelectedDivisionLabel()}
                    </span>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${isDivisionOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* 아코디언 드롭다운 */}
                  {isDivisionOpen && (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {/* 계좌유형 목록 */}
                      {defaultDivisions.map((division) => (
                        <button
                          key={division.value}
                          type="button"
                          onClick={() => handleDivisionSelect(division.value)}
                          className={`w-full px-4 py-2.5 text-sm text-left flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${
                            newRecord.division === division.value
                              ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {newRecord.division === division.value && (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                            {division.value} ({division.label})
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 외부 클릭 시 닫기 */}
                  {isDivisionOpen && (
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsDivisionOpen(false)}
                    />
                  )}
                </div>

                {/* 카테고리 - 아코디언 선택 */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    📂 카테고리
                  </label>
                  
                  {/* 선택된 카테고리 표시 / 토글 버튼 */}
                  <button
                    type="button"
                    onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 outline-none transition-colors hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <span className={newRecord.category ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}>
                      {newRecord.category || '카테고리를 선택하세요'}
                    </span>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${isCategoryOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* 아코디언 드롭다운 */}
                  {isCategoryOpen && (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {/* 카테고리 목록 */}
                      {availableCategories.map((category) => {
                        const isDefault = defaultCategories.includes(category);
                        return (
                          <button
                            key={category}
                            type="button"
                            onClick={() => handleCategorySelect(category)}
                            className={`w-full px-4 py-2.5 text-sm text-left flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${
                              newRecord.category === category
                                ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium'
                                : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {newRecord.category === category && (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                              {category}
                            </span>
                            {isDefault && (
                              <span className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full">
                                기본
                              </span>
                            )}
                          </button>
                        );
                      })}

                      {/* 구분선 */}
                      <div className="border-t border-gray-200 dark:border-gray-600 my-1" />

                      {/* 직접 입력 옵션 */}
                      {!isCustomCategory ? (
                        <button
                          type="button"
                          onClick={() => setIsCustomCategory(true)}
                          className="w-full px-4 py-2.5 text-sm text-left text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          새 카테고리 추가...
                        </button>
                      ) : (
                        <div className="p-3 space-y-2">
                          <input
                            type="text"
                            placeholder="예: DOW, ROBOT"
                            value={customCategoryInput}
                            onChange={(e) => setCustomCategoryInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleCustomCategoryAdd();
                              }
                            }}
                            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleCustomCategoryAdd}
                              className="flex-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            >
                              추가
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsCustomCategory(false);
                                setCustomCategoryInput('');
                              }}
                              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 외부 클릭 시 닫기 */}
                  {isCategoryOpen && (
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => {
                        setIsCategoryOpen(false);
                        setIsCustomCategory(false);
                      }}
                    />
                  )}
                </div>

                {/* 종목명 - 아코디언 선택 */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    📊 종목명 *
                  </label>
                  
                  {/* 선택된 종목명 표시 / 토글 버튼 */}
                  <button
                    type="button"
                    onClick={() => setIsStockOpen(!isStockOpen)}
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 outline-none transition-colors hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <span className={`truncate ${newRecord.stock ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                      {newRecord.stock || '종목을 선택하세요'}
                    </span>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform flex-shrink-0 ${isStockOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* 아코디언 드롭다운 */}
                  {isStockOpen && (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {/* 종목명 목록 */}
                      {availableStocks.map((stock) => {
                        const isDefault = defaultStocks.includes(stock);
                        return (
                          <button
                            key={stock}
                            type="button"
                            onClick={() => handleStockSelect(stock)}
                            className={`w-full px-4 py-2.5 text-sm text-left flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${
                              newRecord.stock === stock
                                ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium'
                                : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              {newRecord.stock === stock && (
                                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                              <span className="truncate">{stock}</span>
                            </span>
                            {isDefault && (
                              <span className="text-xs bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">
                                기본
                              </span>
                            )}
                          </button>
                        );
                      })}

                      {/* 구분선 */}
                      <div className="border-t border-gray-200 dark:border-gray-600 my-1" />

                      {/* 직접 입력 옵션 */}
                      {!isCustomStock ? (
                        <button
                          type="button"
                          onClick={() => setIsCustomStock(true)}
                          className="w-full px-4 py-2.5 text-sm text-left text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          새 종목 추가...
                        </button>
                      ) : (
                        <div className="p-3 space-y-2">
                          <input
                            type="text"
                            placeholder="예: KODEX 200"
                            value={customStockInput}
                            onChange={(e) => setCustomStockInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleCustomStockAdd();
                              }
                            }}
                            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleCustomStockAdd}
                              className="flex-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            >
                              추가
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsCustomStock(false);
                                setCustomStockInput('');
                              }}
                              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 외부 클릭 시 닫기 */}
                  {isStockOpen && (
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => {
                        setIsStockOpen(false);
                        setIsCustomStock(false);
                      }}
                    />
                  )}
                </div>

                {/* 수량 & 입출금 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      수량
                    </label>
                    <input
                      type="number"
                      value={newRecord.qty || ''}
                      onChange={(e) =>
                        setNewRecord({ ...newRecord, qty: parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      입출금액
                    </label>
                    <input
                      type="number"
                      value={newRecord.in_out || ''}
                      onChange={(e) =>
                        setNewRecord({ ...newRecord, in_out: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                {/* 배당금 & 평가금액 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      배당금
                    </label>
                    <input
                      type="number"
                      value={newRecord.dividend || ''}
                      onChange={(e) =>
                        setNewRecord({ ...newRecord, dividend: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      평가금액
                    </label>
                    <input
                      type="number"
                      value={newRecord.value || ''}
                      onChange={(e) =>
                        setNewRecord({ ...newRecord, value: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                {/* 메모 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    📝 메모
                  </label>
                  <textarea
                    placeholder="투자 관련 메모를 입력하세요..."
                    value={newRecord.memo || ''}
                    onChange={(e) => setNewRecord({ ...newRecord, memo: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                </div>

                {/* 저장 버튼 */}
                <button
                  onClick={handleSaveRecord}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                >
                  💾 저장하기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <FooterNav />
    </div>
  );
}
