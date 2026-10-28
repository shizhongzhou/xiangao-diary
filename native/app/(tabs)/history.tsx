import React, { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { previewUri, useRecords, type Rec } from '../../src/store';
import { C, dayKey, fmtDate, fmtTime } from '../../src/theme';
import { Button, IconButton, StatusBadge } from '../../src/ui';

type Mode = 'timeline' | 'calendar';

function RecordCard({ rec }: { rec: Rec }) {
  const done = rec.progress >= 0.9;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/record/${rec.id}`)}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.thumbBox}>
        <Image source={{ uri: previewUri(rec) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <Text style={styles.date}>
          {fmtDate(rec.createdAt)} · {fmtTime(rec.createdAt)}
        </Text>
        <Text style={[styles.note, rec.note ? null : { color: C.muted }]} numberOfLines={3}>
          {rec.note || '没有写文字'}
        </Text>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <StatusBadge progress={rec.progress} />
          {!done ? (
            <Pressable accessibilityRole="button" onPress={() => router.push(`/editor/${rec.id}`)} hitSlop={8}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink }}>{rec.progress > 0 ? '继续 →' : '去上色 →'}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function HistoryTab() {
  const insets = useSafeAreaInsets();
  const records = useRecords();
  const [mode, setMode] = useState<Mode>('timeline');
  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selectedDay, setSelectedDay] = useState<string | null>(dayKey(Date.now()));

  const byDay = useMemo(() => {
    const map = new Map<string, Rec[]>();
    for (const r of records) {
      const k = dayKey(r.createdAt);
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return map;
  }, [records]);

  const monthCount = records.filter((r) => {
    const d = new Date(r.createdAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  // 日历格子：周一开头
  const cells = useMemo(() => {
    const first = new Date(month.y, month.m, 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(month.y, month.m + 1, 0).getDate();
    const out: (number | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= days; d++) out.push(d);
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);

  const shiftMonth = (k: number) => {
    const d = new Date(month.y, month.m + k, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  };

  const todayKey = dayKey(Date.now());
  const dayRecords = selectedDay ? byDay.get(selectedDay) ?? [] : [];

  return (
    <View style={{ flex: 1, backgroundColor: C.paper, paddingTop: insets.top + 12 }}>
      <View style={{ paddingHorizontal: 16, gap: 4 }}>
        <Text style={styles.h1}>我的记录</Text>
        <Text style={styles.sub}>
          {now.getFullYear()} 年 {now.getMonth() + 1} 月 · 本月 {monthCount} 条记录
        </Text>
      </View>

      <View style={styles.tabs}>
        {(['timeline', 'calendar'] as Mode[]).map((m) => {
          const on = m === mode;
          return (
            <Pressable
              key={m}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setMode(m)}
              style={[styles.tab, on && styles.tabOn]}
            >
              <Text style={{ fontSize: 14, fontWeight: on ? '700' : '500', color: on ? C.ink : C.muted }}>
                {m === 'timeline' ? '时间轴' : '日历'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {records.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="book-outline" size={40} color={C.muted} />
          <Text style={styles.emptyText}>还没有记录。拍一张照片，写下当时的感受，它就会出现在这里。</Text>
          <Button title="去拍照" icon="camera-outline" onPress={() => router.navigate('/')} style={{ paddingHorizontal: 28 }} />
        </View>
      ) : mode === 'timeline' ? (
        <FlatList
          data={records}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 14 }}
          renderItem={({ item }) => <RecordCard rec={item} />}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <IconButton icon="chevron-back" label="上个月" onPress={() => shiftMonth(-1)} />
            <Text style={{ fontSize: 17, fontWeight: '700', color: C.ink }}>
              {month.y} 年 {month.m + 1} 月
            </Text>
            <IconButton icon="chevron-forward" label="下个月" onPress={() => shiftMonth(1)} />
          </View>
          <View style={styles.weekRow}>
            {'一二三四五六日'.split('').map((w) => (
              <Text key={w} style={styles.weekText}>
                {w}
              </Text>
            ))}
          </View>
          {Array.from({ length: cells.length / 7 }).map((_, row) => (
            <View key={row} style={styles.weekRow}>
              {cells.slice(row * 7, row * 7 + 7).map((d, i) => {
                if (!d) return <View key={i} style={styles.dayCell} />;
                const k = `${month.y}-${month.m + 1}-${d}`;
                const recs = byDay.get(k);
                const sel = k === selectedDay;
                return (
                  <Pressable
                    key={i}
                    accessibilityRole="button"
                    accessibilityLabel={`${month.m + 1}月${d}日${recs ? `，${recs.length} 条记录` : ''}`}
                    onPress={() => setSelectedDay(k)}
                    style={[
                      styles.dayCell,
                      recs && styles.dayHas,
                      sel && { borderWidth: 2.5, borderColor: C.ink },
                      k === todayKey && !sel && { borderWidth: 1.5, borderColor: C.accent },
                    ]}
                  >
                    {recs ? (
                      <Image source={{ uri: previewUri(recs[0]) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    ) : null}
                    <Text style={[styles.dayText, recs && styles.dayTextOn]}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}

          <Text style={{ marginTop: 8, fontSize: 14, fontWeight: '700', color: C.ink }}>
            {selectedDay ? `${selectedDay.split('-')[1]}月${selectedDay.split('-')[2]}日` : ''}
            {dayRecords.length ? ` · ${dayRecords.length} 条` : ' · 这天没有记录'}
          </Text>
          {dayRecords.map((r) => (
            <RecordCard key={r.id} rec={r} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 30, fontWeight: '900', color: C.ink, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: C.muted },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, padding: 4, borderRadius: 14, backgroundColor: C.soft },
  tab: { flex: 1, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: C.white },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  emptyText: { fontSize: 15, color: C.muted, textAlign: 'center', lineHeight: 22 },
  card: { flexDirection: 'row', gap: 14, padding: 12, borderRadius: 20, borderWidth: 1.5, borderColor: C.ink, backgroundColor: C.white },
  thumbBox: { width: 104, height: 124, borderRadius: 12, borderWidth: 1.5, borderColor: C.ink, overflow: 'hidden', backgroundColor: C.white },
  date: { fontSize: 12, color: C.muted },
  note: { fontSize: 14, lineHeight: 21, color: C.inkSoft },
  weekRow: { flexDirection: 'row', gap: 6 },
  weekText: { flex: 1, textAlign: 'center', fontSize: 12, color: C.muted },
  dayCell: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  dayHas: { borderWidth: 1.5, borderColor: C.ink },
  dayText: { fontSize: 14, color: C.inkSoft },
  dayTextOn: {
    fontWeight: '800',
    color: C.ink,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
});
