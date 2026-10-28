/**
 * 本地数据：所有记录和设置都存在手机里（App 的文档目录），不上传到任何服务器。
 */
import { useSyncExternalStore } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import type { StyleId } from './lineart';

export interface Rec {
  id: string;
  createdAt: number;
  note: string;
  style: StyleId;
  w: number;
  h: number;
  colors: Record<string, string>; // 格子编号 → 颜色
  progress: number; // 已涂面积占比 0~1
  preview: string; // 预览图文件名
}

export interface Settings {
  nickname: string;
  defaultStyle: StyleId;
  quality: 'standard' | 'high';
}

const DEFAULT_SETTINGS: Settings = { nickname: '', defaultStyle: 'bold', quality: 'standard' };

let records: Rec[] = [];
let settings: Settings = DEFAULT_SETTINGS;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function root(): Directory {
  const dir = new Directory(Paths.document, 'diary');
  if (!dir.exists) dir.create();
  return dir;
}

function writeFile(name: string, content: string | Uint8Array) {
  const f = new File(root(), name);
  if (!f.exists) f.create();
  f.write(content);
}

function removeFile(name: string) {
  try {
    const f = new File(root(), name);
    if (f.exists) f.delete();
  } catch {
    // 文件不存在就算了
  }
}

export function fileUri(name: string): string {
  return new File(root(), name).uri;
}

export const lineName = (id: string) => `${id}_line.png`;
export const previewUri = (rec: Rec) => fileUri(rec.preview);

function persist() {
  writeFile('records.json', JSON.stringify(records));
}

export async function init() {
  try {
    const db = new File(root(), 'records.json');
    if (db.exists) records = JSON.parse(await db.text());
  } catch {
    records = [];
  }
  try {
    const sf = new File(root(), 'settings.json');
    if (sf.exists) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(await sf.text()) };
  } catch {
    settings = DEFAULT_SETTINGS;
  }
  emit();
}

export function useRecords(): Rec[] {
  return useSyncExternalStore(subscribe, () => records);
}

export function useRecord(id: string | undefined): Rec | undefined {
  const all = useRecords();
  return all.find((r) => r.id === id);
}

export function getRecord(id: string): Rec | undefined {
  return records.find((r) => r.id === id);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => settings);
}

export function updateSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch };
  writeFile('settings.json', JSON.stringify(settings));
  emit();
}

/** 新建一条记录：保存线稿和初始预览图 */
export function addRecord(opts: {
  linePng: Uint8Array;
  w: number;
  h: number;
  style: StyleId;
  note: string;
}): Rec {
  const id = Date.now().toString(36);
  writeFile(lineName(id), opts.linePng);
  const preview = `${id}_p${Date.now()}.png`;
  writeFile(preview, opts.linePng);
  const rec: Rec = {
    id,
    createdAt: Date.now(),
    note: opts.note.trim(),
    style: opts.style,
    w: opts.w,
    h: opts.h,
    colors: {},
    progress: 0,
    preview,
  };
  records = [rec, ...records];
  persist();
  emit();
  return rec;
}

function patchRecord(id: string, patch: Partial<Rec>) {
  records = records.map((r) => (r.id === id ? { ...r, ...patch } : r));
  persist();
  emit();
}

export function updateNote(id: string, note: string) {
  patchRecord(id, { note });
}

/** 保存涂色结果：颜色、进度、新的预览图（换文件名，避免图片缓存不刷新） */
export function saveColoring(id: string, colors: Record<string, string>, progress: number, previewPng: Uint8Array) {
  const rec = getRecord(id);
  if (!rec) return;
  const preview = `${id}_p${Date.now()}.png`;
  writeFile(preview, previewPng);
  if (rec.preview !== preview) removeFile(rec.preview);
  patchRecord(id, { colors, progress, preview });
}

export function deleteRecord(id: string) {
  const rec = getRecord(id);
  if (!rec) return;
  removeFile(rec.preview);
  removeFile(lineName(id));
  records = records.filter((r) => r.id !== id);
  persist();
  emit();
}

export function clearAll() {
  for (const r of records) {
    removeFile(r.preview);
    removeFile(lineName(r.id));
  }
  records = [];
  persist();
  emit();
}
