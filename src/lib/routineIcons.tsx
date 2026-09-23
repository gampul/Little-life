/**
 * 루틴 아이콘 레지스트리 — 매트릭스·루틴기록·설정이 같은 아이콘을 쓴다.
 *
 * routine_templates.icon 에 키(예: 'heart')를 저장한다 (add_routine_icon.sql).
 * icon 이 없으면 예전처럼 루틴 이름의 키워드로 추정한다 → 이름을 바꿔도 icon 이 저장돼 있으면 그대로 유지.
 */
import type { ReactNode } from 'react';
import {
  IconHeart,
  IconClock,
  IconSparkles,
  IconCode,
  IconDeviceLaptop,
  IconWallet,
  IconTarget,
  IconBottleOff,
  IconBook,
  IconRun,
  IconPencil,
  IconCheckbox,
  IconBulb,
  IconBrain,
  IconPray,
  IconYoga,
  IconStretching,
  IconBarbell,
  IconWalk,
  IconBike,
  IconSwimming,
  IconMoon,
  IconSun,
  IconBed,
  IconDroplet,
  IconCoffee,
  IconSalad,
  IconPill,
  IconDental,
  IconHome,
  IconPaw,
  IconUsers,
  IconMessage,
  IconLanguage,
  IconSchool,
  IconNotebook,
  IconMusic,
  IconHeadphones,
  IconCamera,
  IconPlant,
  IconLeaf,
  IconPigMoney,
  IconChartLine,
  IconCalendar,
  IconFlame,
} from '@tabler/icons-react';

type IconProps = { size?: number; stroke?: number };

/** 칫솔 라인 아이콘 (Tabler 에 없어서 같은 스타일로 직접 그림) */
export const IconToothbrush = ({ size = 18, stroke = 1.5 }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="tabler-icon tabler-icon-toothbrush"
    aria-hidden="true"
  >
    <g transform="rotate(45 12 12)">
      <rect x="9" y="1" width="6" height="7.5" rx="1.75" />
      <rect x="10.6" y="2.6" width="2.8" height="4.3" rx="0.8" />
      <path d="M11 8.5v1.75l-0.6 1.6v10.15a1.6 1.6 0 0 0 3.2 0v-10.15l-0.6-1.6v-1.75" />
    </g>
  </svg>
);

type IconComp = (p: IconProps) => ReactNode;

/** 선택 가능한 아이콘 — 그룹 순서대로 피커에 노출. 앞쪽 13개는 기존에 쓰던 아이콘 */
export const ROUTINE_ICON_GROUPS: { title: string; items: { key: string; name: string; C: IconComp }[] }[] = [
  {
    title: '지금 쓰는 아이콘',
    items: [
      { key: 'heart', name: '하트', C: IconHeart },
      { key: 'clock', name: '시계', C: IconClock },
      { key: 'run', name: '러닝', C: IconRun },
      { key: 'toothbrush', name: '칫솔', C: IconToothbrush },
      { key: 'wallet', name: '지갑', C: IconWallet },
      { key: 'sparkles', name: '반짝', C: IconSparkles },
      { key: 'bottle-off', name: '금주', C: IconBottleOff },
      { key: 'book', name: '책', C: IconBook },
      { key: 'pencil', name: '연필', C: IconPencil },
      { key: 'code', name: '코드', C: IconCode },
      { key: 'laptop', name: '노트북', C: IconDeviceLaptop },
      { key: 'target', name: '목표', C: IconTarget },
      { key: 'checkbox', name: '체크', C: IconCheckbox },
    ],
  },
  {
    title: '마음·생각',
    items: [
      { key: 'bulb', name: '전구', C: IconBulb },
      { key: 'brain', name: '생각', C: IconBrain },
      { key: 'pray', name: '기도', C: IconPray },
      { key: 'yoga', name: '명상', C: IconYoga },
      { key: 'notebook', name: '노트', C: IconNotebook },
      { key: 'flame', name: '열정', C: IconFlame },
    ],
  },
  {
    title: '운동·건강',
    items: [
      { key: 'stretching', name: '스트레칭', C: IconStretching },
      { key: 'barbell', name: '근력', C: IconBarbell },
      { key: 'walk', name: '걷기', C: IconWalk },
      { key: 'bike', name: '자전거', C: IconBike },
      { key: 'swimming', name: '수영', C: IconSwimming },
      { key: 'droplet', name: '물', C: IconDroplet },
      { key: 'salad', name: '식단', C: IconSalad },
      { key: 'pill', name: '약', C: IconPill },
      { key: 'dental', name: '치아', C: IconDental },
    ],
  },
  {
    title: '생활',
    items: [
      { key: 'sun', name: '아침', C: IconSun },
      { key: 'moon', name: '밤', C: IconMoon },
      { key: 'bed', name: '수면', C: IconBed },
      { key: 'coffee', name: '커피', C: IconCoffee },
      { key: 'home', name: '집', C: IconHome },
      { key: 'paw', name: '반려', C: IconPaw },
      { key: 'users', name: '가족', C: IconUsers },
      { key: 'message', name: '연락', C: IconMessage },
      { key: 'plant', name: '식물', C: IconPlant },
      { key: 'leaf', name: '자연', C: IconLeaf },
    ],
  },
  {
    title: '공부·일·돈',
    items: [
      { key: 'school', name: '공부', C: IconSchool },
      { key: 'language', name: '외국어', C: IconLanguage },
      { key: 'music', name: '음악', C: IconMusic },
      { key: 'headphones', name: '듣기', C: IconHeadphones },
      { key: 'camera', name: '사진', C: IconCamera },
      { key: 'pig-money', name: '저축', C: IconPigMoney },
      { key: 'chart-line', name: '투자', C: IconChartLine },
      { key: 'calendar', name: '일정', C: IconCalendar },
    ],
  },
];

const ICON_BY_KEY: Record<string, IconComp> = Object.fromEntries(
  ROUTINE_ICON_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.C]))
);

export const isRoutineIconKey = (v: unknown): v is string => typeof v === 'string' && v in ICON_BY_KEY;

/** 예전 규칙: 이름 키워드 → 아이콘 (앞에서부터 처음 맞는 것). add_routine_icon.sql 의 백필과 같은 순서 */
const LABEL_RULES: [string, string][] = [
  ['800km', 'run'],
  ['글쓰기', 'pencil'],
  ['주변정리', 'sparkles'],
  ['1Day class', 'code'],
  ['DevOps', 'code'],
  ['1Day', 'laptop'],
  ['가계부', 'wallet'],
  ['기도', 'clock'],
  ['OKR', 'target'],
  ['금주', 'bottle-off'],
  ['사랑이', 'heart'],
  ['brush', 'toothbrush'],
  ['독서', 'book'],
  ['500km', 'run'],
  ['Dev ops', 'code'],
  ['사색', 'bulb'],
];

export const guessRoutineIconKey = (label: string): string => {
  const hit = LABEL_RULES.find(([k]) => label.includes(k));
  return hit ? hit[1] : 'checkbox';
};

/** 저장된 icon 키 우선, 없으면 이름으로 추정 */
export const resolveRoutineIconKey = (label: string, icon?: string | null): string =>
  isRoutineIconKey(icon) ? icon : guessRoutineIconKey(label);

export function RoutineIcon({ label, icon, size = 18, stroke = 1.5 }: { label: string; icon?: string | null } & IconProps) {
  const C = ICON_BY_KEY[resolveRoutineIconKey(label, icon)] ?? IconCheckbox;
  return <C size={size} stroke={stroke} />;
}
