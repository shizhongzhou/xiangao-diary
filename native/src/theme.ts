export const C = {
  paper: '#FBFAF7',
  ink: '#141414',
  inkSoft: '#3A3A3A',
  muted: '#6B6B6B',
  line: '#E4E2DC',
  soft: '#EFEDE7',
  white: '#FFFFFF',
  accent: '#FF5B3A',
  dark: '#0E0E0E',
  darkSoft: '#1F1F1F',
  orangeTint: '#FFE4D9',
  greenTint: '#DDF0D3',
  blueTint: '#DCEFF7',
  danger: '#C2361B',
};

export const PALETTE: [string, string][] = [
  ['珊瑚红', '#FF5B3A'], ['杏橙', '#FF8A5B'], ['琥珀', '#FFB547'], ['柠檬', '#FFD966'], ['奶油', '#FFF1B8'], ['嫩芽', '#C8E6A0'], ['草绿', '#7CC47F'],
  ['松绿', '#2F9E6E'], ['薄荷蓝', '#9ED9E0'], ['湖蓝', '#4FB3D9'], ['钴蓝', '#2D6FD6'], ['深海', '#1F3A7A'], ['薰衣草', '#B9A6F0'], ['葡萄紫', '#7B5CD6'],
  ['樱粉', '#F7B6C8'], ['玫红', '#E2547A'], ['砖红', '#A8432F'], ['可可', '#7A5236'], ['沙色', '#D9C7A7'], ['雾灰', '#9A9A9A'], ['墨色', '#3A3A3A'],
];

const WEEK = '日一二三四五六';

export function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日 周${WEEK[d.getDay()]}`;
}

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function statusOf(progress: number): { label: string; bg: string; outline: boolean } {
  if (progress <= 0) return { label: '未上色', bg: 'transparent', outline: true };
  if (progress < 0.9) return { label: `涂色中 ${Math.round(progress * 100)}%`, bg: C.orangeTint, outline: false };
  return { label: '已完成', bg: C.greenTint, outline: false };
}
