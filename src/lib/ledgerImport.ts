/**
 * 가계부 앱 엑셀(xlsx/csv) 한 줄 → transactions 행으로 변환.
 *
 * 가계부 앱이 내보내는 열: 날짜 · 자산 · 분류 · 소분류 · 내용 · 금액(원) · 수입/지출 · 태그 · 메모 · 금액 · 화폐
 *  - 자산·분류 이름 앞뒤의 이모지(🍜 식비, 🇺🇸 RISE …)와 공백은 떼고 저장 (앱 안의 이름과 맞춤)
 *  - 이체(이체지출/이체입금)는 "분류" 칸에 상대 자산이 들어 있음 → transfer_asset
 *  - "내용"(가맹점)이 메모로 들어가고, "메모" 칸이 따로 있으면 "내용 · 메모"
 */

// 거래 유형 매핑 (파일 → DB)
const TYPE_MAPPING: Record<string, { transaction_type: string; is_transfer: boolean }> = {
  수입: { transaction_type: '수입', is_transfer: false },
  지출: { transaction_type: '지출', is_transfer: false },
  이체: { transaction_type: '자산이체', is_transfer: true },
  이체지출: { transaction_type: '자산이체', is_transfer: true },
  이체입금: { transaction_type: '자산이체', is_transfer: true },
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 엑셀 날짜 → 실제 시각. 가계부 앱이 내보낸 시각은 한국 시간(KST) 기준이라
 * 서버(UTC)에서 그대로 읽으면 9시간 밀려 오후 3시 이후 거래가 다음 날로 넘어감.
 *  - 숫자(엑셀 시리얼): KST 벽시계 시각으로 보고 9시간 빼서 UTC 로
 *  - 문자열 "2026. 01. 30 20:10:58": +09:00 을 붙여 해석
 */
export function parseKstDate(v: unknown): Date | null {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return new Date(Math.round((v - 25569) * 86400 * 1000) - KST_OFFSET_MS);
  }
  if (typeof v === 'string' && v.trim()) {
    const m = v.trim().match(/^(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})\.?(?:\s+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?/);
    if (m) {
      const [, y, mo, d, h = '0', mi = '0', se = '0', ms = '0'] = m;
      return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +se, +ms.padEnd(3, '0')) - KST_OFFSET_MS);
    }
    const t = new Date(v);
    return Number.isNaN(t.getTime()) ? null : t;
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  return null;
}

// 이모지·국기·피부색·결합 문자 (숫자·#·* 는 건드리지 않음)
const EMOJI_RE = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}\u{20E3}]/gu;

/** 자산·분류 이름: 이모지를 떼고 공백 정리 ("🍜 식비" → "식비", "💵금융소득(⭕️비과세)" → "금융소득(비과세)") */
export function cleanName(v: unknown): string {
  if (v == null) return '';
  return String(v).replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim();
}

const text = (v: unknown): string => (v == null ? '' : String(v).trim());

export interface LedgerExcelRow {
  날짜?: string | number | Date;
  자산?: string;
  이체자산?: string;
  분류?: string;
  소분류?: string;
  내용?: string;
  메모?: string;
  '금액(원)'?: number | string;
  금액?: number | string;
  '수입/지출'?: string;
}

export interface LedgerImportRow {
  date: string;
  asset: string;
  category: string;
  sub_category: string | null;
  transaction_type: string;
  is_transfer: boolean;
  transfer_asset: string | null;
  amount: number;
  memo: string | null;
}

export function parseLedgerRows(jsonData: LedgerExcelRow[]): { rows: LedgerImportRow[]; errors: string[] } {
  const rows: LedgerImportRow[] = [];
  const errors: string[] = [];

  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i];
    const rowNum = i + 2; // Excel은 1-based, 헤더 제외

    try {
      // 날짜 파싱 (KST 기준)
      if (row.날짜 == null || row.날짜 === '') {
        errors.push(`Row ${rowNum}: 날짜가 없습니다`);
        continue;
      }
      const dateValue = parseKstDate(row.날짜);
      if (!dateValue) {
        errors.push(`Row ${rowNum}: 잘못된 날짜 형식`);
        continue;
      }

      // 금액 파싱 (금액(원) 또는 금액 컬럼)
      const rawAmount = row['금액(원)'] ?? row.금액;
      let signed: number;
      if (typeof rawAmount === 'number') {
        signed = Math.round(rawAmount);
      } else if (typeof rawAmount === 'string') {
        signed = parseInt(rawAmount.replace(/[^0-9-]/g, '')) || 0;
      } else {
        errors.push(`Row ${rowNum}: 금액이 없습니다`);
        continue;
      }

      const amount = Math.abs(signed);
      if (amount <= 0) {
        errors.push(`Row ${rowNum}: 금액은 0보다 커야 합니다`);
        continue;
      }

      // 거래 유형 매핑
      let typeText = text(row['수입/지출']);
      // 음수 금액(잔액수정 등)은 부호를 버리지 않고 수입↔지출을 뒤집어 저장
      if (signed < 0 && (typeText === '수입' || typeText === '지출')) typeText = typeText === '수입' ? '지출' : '수입';
      const typeInfo = TYPE_MAPPING[typeText];
      if (!typeInfo) {
        errors.push(`Row ${rowNum}: 알 수 없는 거래 유형 "${typeText}"`);
        continue;
      }

      const asset = cleanName(row.자산);
      if (!asset) {
        errors.push(`Row ${rowNum}: 자산이 없습니다`);
        continue;
      }

      // 이체: 분류는 '자산이체', 상대 자산은 "이체자산" 칸(앱 내보내기) 또는 "분류" 칸(가계부 앱)
      let category = cleanName(row.분류);
      let transferAsset: string | null = null;
      if (typeInfo.is_transfer) {
        transferAsset = cleanName(row.이체자산) || category || null;
        category = '자산이체';
      }
      if (!category) {
        errors.push(`Row ${rowNum}: 분류가 없습니다`);
        continue;
      }

      // 메모: "내용"(가맹점) + "메모"
      const memo = [text(row.내용), text(row.메모)].filter(Boolean).join(' · ') || null;

      rows.push({
        date: dateValue.toISOString(),
        asset,
        category,
        sub_category: text(row.소분류) || null,
        transaction_type: typeInfo.transaction_type,
        is_transfer: typeInfo.is_transfer,
        transfer_asset: transferAsset,
        amount,
        memo,
      });
    } catch {
      errors.push(`Row ${rowNum}: 처리 오류`);
    }
  }

  return { rows, errors };
}
