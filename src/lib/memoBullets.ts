/**
 * 일반 textarea 용 최소 불릿(목록) 기능 — 글자 그대로 "• " 를 줄 앞에 붙이는 방식이라
 * 저장·표시 쪽은 바꿀 필요 없음 (whitespace-pre-wrap 으로 그대로 보임).
 *  - toggleBullets: 커서 줄(또는 선택한 줄들)에 불릿 붙이기/떼기
 *  - continueBullet: 불릿 줄에서 Enter → 다음 줄에도 불릿, 빈 불릿 줄에서 Enter → 목록 끝
 */

export const BULLET = '• ';
const BULLET_RE = /^(\s*)([•\-*])\s/;

interface Edit {
  value: string;
  selStart: number;
  selEnd: number;
}

function lineStartAt(value: string, pos: number) {
  return value.lastIndexOf('\n', pos - 1) + 1;
}

function lineEndAt(value: string, pos: number) {
  const i = value.indexOf('\n', pos);
  return i === -1 ? value.length : i;
}

/** 선택 범위가 걸친 줄 전체에 불릿 토글 (모두 불릿이면 떼고, 아니면 붙임) */
export function toggleBullets(value: string, selStart: number, selEnd: number): Edit {
  const from = lineStartAt(value, selStart);
  const to = lineEndAt(value, Math.max(selStart, selEnd - (selEnd > selStart && value[selEnd - 1] === '\n' ? 1 : 0)));
  const lines = value.slice(from, to).split('\n');
  // 불릿 줄이 하나 이상 있고 나머지가 빈 줄뿐이면 '떼기', 아니면 '붙이기'
  const allBulleted = lines.some((l) => BULLET_RE.test(l)) && lines.every((l) => BULLET_RE.test(l) || l.trim() === '');
  let delta = 0;
  let firstDelta = 0;
  const next = lines.map((l, i) => {
    if (allBulleted) {
      const m = l.match(BULLET_RE);
      if (!m) return l;
      const removed = m[0].length - m[1].length;
      delta -= removed;
      if (i === 0) firstDelta = -removed;
      return m[1] + l.slice(m[0].length);
    }
    if (BULLET_RE.test(l)) return l;
    if (l.trim() === '' && lines.length > 1) return l;
    delta += BULLET.length;
    if (i === 0) firstDelta = BULLET.length;
    return BULLET + l;
  });
  const out = value.slice(0, from) + next.join('\n') + value.slice(to);
  // 줄 맨 앞에서 시작한 선택은 줄 맨 앞 그대로 유지
  const s = selEnd !== selStart && selStart === from ? from : Math.max(from, selStart + firstDelta);
  const e = selEnd === selStart ? s : Math.max(s, selEnd + delta);
  return { value: out, selStart: s, selEnd: e };
}

/** Enter 처리 — 불릿 줄이 아니면 null (기본 동작 그대로) */
export function continueBullet(value: string, selStart: number, selEnd: number): Edit | null {
  if (selStart !== selEnd) return null;
  const from = lineStartAt(value, selStart);
  const line = value.slice(from, lineEndAt(value, selStart));
  const m = line.match(BULLET_RE);
  if (!m) return null;
  const prefix = `${m[1]}${m[2]} `;
  // 내용 없는 불릿 줄에서 Enter → 불릿 지우고 목록 끝
  if (line.slice(m[0].length).trim() === '' && selStart - from >= m[0].length) {
    const out = value.slice(0, from) + m[1] + value.slice(from + m[0].length);
    const pos = from + m[1].length;
    return { value: out, selStart: pos, selEnd: pos };
  }
  const out = value.slice(0, selStart) + '\n' + prefix + value.slice(selEnd);
  const pos = selStart + 1 + prefix.length;
  return { value: out, selStart: pos, selEnd: pos };
}
