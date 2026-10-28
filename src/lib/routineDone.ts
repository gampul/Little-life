/**
 * 루틴 "완료" 판정 — 루틴기록 피드·달력·알림(routine-reminder)이 같은 기준을 쓴다.
 *  - checked 가 아니면 미완료
 *  - 숫자형인데 값이 0/없음이고 메모·사진도 없으면 "하지 않음"
 */

export interface DoneCheckRow {
  checked: boolean;
  value: number | null;
  memo?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
}

/** 행의 사진 목록 (image_urls 우선, 없으면 기존 단일 image_url) */
export const getRowImages = (row: Pick<DoneCheckRow, 'image_url' | 'image_urls'>): string[] => {
  const list = Array.isArray(row.image_urls) ? row.image_urls.filter(Boolean) : [];
  // 예전 단일 업로드로 image_url 만 갱신된 경우 맨 앞에 합친다
  if (row.image_url && !list.includes(row.image_url)) return [row.image_url, ...list].slice(0, 5);
  return list;
};

export const isRoutineRowDone = (routineType: string | null | undefined, row: DoneCheckRow | null | undefined): boolean => {
  if (!row || !row.checked) return false;
  if (routineType === 'number') {
    const empty = (row.value == null || Number(row.value) === 0) && !row.memo?.trim() && getRowImages(row).length === 0;
    if (empty) return false;
  }
  return true;
};

/** 오늘 (KST, YYYY-MM-DD) */
export const kstTodayString = (): string => {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
};
