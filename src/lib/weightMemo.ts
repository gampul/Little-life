/**
 * 체중 기록 메모 양식 (아침 / 점심 / 저녁)
 *
 * - 입력창을 열 때: 빈 메모면 양식을 채워 보여 주고, 양식 라벨이 있는 메모는 빠진 라벨만 제자리에 보충
 * - 저장할 때: 내용이 없는 라벨 줄은 지우고, 전부 비었으면 null
 *   → DB·피드·AI 컨텍스트에는 실제로 쓴 내용만 남는다
 */

export const WEIGHT_MEMO_LABELS = ['아침', '점심', '저녁'] as const;

export const WEIGHT_MEMO_TEMPLATE = WEIGHT_MEMO_LABELS.map((l) => `${l} : `).join('\n');

const LABEL_LINE = new RegExp(`^\\s*(${WEIGHT_MEMO_LABELS.join('|')})\\s*[:：]\\s?(.*)$`);

type Block = { label: string; first: string; rest: string[] };

/** 메모를 [라벨 앞 머리말] + 라벨별 블록(라벨 줄 + 이어지는 줄)으로 나눈다 */
function parse(memo: string): { head: string[]; blocks: Block[] } {
  const head: string[] = [];
  const blocks: Block[] = [];
  for (const line of memo.replace(/\r\n?/g, '\n').split('\n')) {
    const m = line.match(LABEL_LINE);
    if (m) blocks.push({ label: m[1], first: m[2], rest: [] });
    else if (blocks.length > 0) blocks[blocks.length - 1].rest.push(line);
    else head.push(line);
  }
  return { head, blocks };
}

const blockText = (b: Block) => [`${b.label} : ${b.first}`, ...b.rest].join('\n');

/** 입력창에 넣을 값 — 빈 메모는 양식, 양식을 쓴 메모는 빠진 라벨을 순서대로 보충. 예전 자유 메모는 그대로 */
export function withWeightMemoTemplate(memo: string | null | undefined): string {
  const text = (memo ?? '').replace(/\r\n?/g, '\n');
  if (!text.trim()) return WEIGHT_MEMO_TEMPLATE;
  const { head, blocks } = parse(text);
  if (blocks.length === 0) return text;

  const byLabel = new Map<string, Block>();
  const extra: Block[] = []; // 같은 라벨이 두 번 나오면 뒤쪽 것은 순서 그대로 뒤에
  for (const b of blocks) {
    if (byLabel.has(b.label)) extra.push(b);
    else byLabel.set(b.label, b);
  }
  const ordered = WEIGHT_MEMO_LABELS.map((l) => byLabel.get(l) ?? { label: l, first: '', rest: [] });
  const headText = head.join('\n').replace(/\n+$/, '');
  const body = [...ordered, ...extra].map(blockText).join('\n');
  return headText.trim() ? `${headText}\n${body}` : body;
}

/** 저장용 — 비어 있는 라벨 줄 제거, 앞뒤 공백 정리, 내용이 없으면 null */
export function normalizeWeightMemo(memo: string | null | undefined): string | null {
  const text = (memo ?? '').replace(/\r\n?/g, '\n');
  if (!text.trim()) return null;
  const { head, blocks } = parse(text);
  if (blocks.length === 0) return text.trim() || null;
  const kept = blocks.filter((b) => b.first.trim() || b.rest.some((r) => r.trim()));
  const out = [head.join('\n').trim(), ...kept.map((b) => [`${b.label} : ${b.first.trim()}`, ...b.rest].join('\n').trimEnd())]
    .filter(Boolean)
    .join('\n')
    .trim();
  return out || null;
}

/** 양식 그대로(아무것도 안 씀)인지 */
export const isWeightMemoEmpty = (memo: string | null | undefined) => normalizeWeightMemo(memo) === null;
