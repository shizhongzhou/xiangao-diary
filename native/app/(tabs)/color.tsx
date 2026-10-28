import React from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { previewUri, useRecords } from '../../src/store';
import { C, fmtDate } from '../../src/theme';
import { Button, ProgressBar } from '../../src/ui';

export default function ColorTab() {
  const insets = useSafeAreaInsets();
  const records = useRecords();
  // 没涂完的排前面
  const list = [...records].sort((a, b) => {
    const da = a.progress >= 0.9 ? 1 : 0;
    const db = b.progress >= 0.9 ? 1 : 0;
    return da - db || b.createdAt - a.createdAt;
  });
  const todo = records.filter((r) => r.progress < 0.9).length;

  return (
    <View style={{ flex: 1, backgroundColor: C.paper, paddingTop: insets.top + 12 }}>
      <View style={styles.head}>
        <Text style={styles.h1}>上色</Text>
        <Text style={styles.sub}>{records.length ? `还有 ${todo} 张等你涂色` : '先去拍一张照片吧'}</Text>
      </View>

      {records.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>拍下的照片会变成线稿，出现在这里等你涂色。</Text>
          <Button title="去拍照" icon="camera-outline" onPress={() => router.navigate('/')} style={{ paddingHorizontal: 28 }} />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(r) => r.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`给 ${fmtDate(item.createdAt)} 的线稿上色`}
              onPress={() => router.push(`/editor/${item.id}`)}
              style={({ pressed }) => [styles.card, { opacity: pressed ? 0.8 : 1 }]}
            >
              <View style={[styles.thumbBox, { aspectRatio: 3 / 4 }]}>
                <Image source={{ uri: previewUri(item) }} style={styles.thumb} resizeMode="cover" />
              </View>
              <View style={{ padding: 10, gap: 6 }}>
                <Text style={styles.date}>{fmtDate(item.createdAt)}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ProgressBar value={item.progress} width={60} />
                  <Text style={styles.pct}>{item.progress >= 0.9 ? '已完成' : `${Math.round(item.progress * 100)}%`}</Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 16, gap: 4 },
  h1: { fontSize: 30, fontWeight: '900', color: C.ink, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: C.muted },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  emptyText: { fontSize: 15, color: C.muted, textAlign: 'center', lineHeight: 22 },
  card: { flex: 1, maxWidth: '48.4%', borderRadius: 18, borderWidth: 1.5, borderColor: C.ink, backgroundColor: C.white, overflow: 'hidden' },
  thumbBox: { width: '100%', borderBottomWidth: 1.5, borderColor: C.ink, backgroundColor: C.white },
  thumb: { width: '100%', height: '100%' },
  date: { fontSize: 13, fontWeight: '700', color: C.ink },
  pct: { fontSize: 12, color: C.muted },
});
