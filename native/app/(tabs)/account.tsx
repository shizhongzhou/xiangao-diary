import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { STYLE_LIST } from '../../src/lineart';
import { clearAll, updateSettings, useRecords, useSettings } from '../../src/store';
import { C, dayKey } from '../../src/theme';
import { Segmented } from '../../src/ui';

const QUALITY = [
  { id: 'standard', label: '标准' },
  { id: 'high', label: '高清' },
] as const;

export default function AccountTab() {
  const insets = useSafeAreaInsets();
  const records = useRecords();
  const settings = useSettings();
  const [name, setName] = useState(settings.nickname);

  const stats = useMemo(() => {
    const days = new Set(records.map((r) => dayKey(r.createdAt)));
    // 连续记录天数：从今天（或昨天）往前数
    let streak = 0;
    const d = new Date();
    if (!days.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1);
    while (days.has(dayKey(d.getTime()))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return {
      total: records.length,
      colored: records.filter((r) => r.progress >= 0.9).length,
      streak,
    };
  }, [records]);

  const confirmClear = () => {
    Alert.alert('清空所有记录？', '所有线稿、涂色和文字都会从这台手机上删除，无法恢复。', [
      { text: '取消', style: 'cancel' },
      { text: '全部清空', style: 'destructive', onPress: clearAll },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.paper }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 32, gap: 18 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.h1}>账户</Text>

      <View style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={{ fontSize: 26, fontWeight: '900', color: C.ink }}>{(settings.nickname || '我').slice(0, 1)}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <TextInput
            value={name}
            onChangeText={setName}
            onEndEditing={() => updateSettings({ nickname: name.trim() })}
            placeholder="点这里填写昵称"
            placeholderTextColor={C.muted}
            accessibilityLabel="昵称"
            style={{ fontSize: 18, fontWeight: '700', color: C.ink, paddingVertical: 4 }}
            maxLength={16}
          />
          <Text style={{ fontSize: 13, color: C.muted }}>用线条记录每一天</Text>
        </View>
        <Ionicons name="create-outline" size={20} color={C.ink} />
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Stat n={stats.total} label="条记录" bg={C.orangeTint} />
        <Stat n={stats.colored} label="张已上色" bg={C.greenTint} />
        <Stat n={stats.streak} label="天连续记录" bg={C.blueTint} />
      </View>

      <Section title="创作">
        <View style={styles.rowCol}>
          <Text style={styles.rowText}>默认线稿风格</Text>
          <Segmented options={STYLE_LIST} value={settings.defaultStyle} onChange={(v) => updateSettings({ defaultStyle: v })} />
        </View>
        <View style={[styles.rowCol, { borderBottomWidth: 0 }]}>
          <Text style={styles.rowText}>线稿清晰度</Text>
          <Text style={styles.rowHint}>高清线条更细腻，但生成会慢一些</Text>
          <Segmented
            options={QUALITY}
            value={settings.quality}
            onChange={(v) => updateSettings({ quality: v })}
          />
        </View>
      </Section>

      <Section title="数据">
        <View style={styles.row}>
          <Text style={[styles.rowText, { flex: 1 }]}>存储位置</Text>
          <Text style={styles.rowValue}>仅保存在这台手机</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={confirmClear} style={[styles.row, { borderBottomWidth: 0 }]}>
          <Text style={[styles.rowText, { color: C.danger }]}>清空所有记录</Text>
        </Pressable>
      </Section>

      <Section title="关于">
        <View style={[styles.row, { borderBottomWidth: 0 }]}>
          <Text style={[styles.rowText, { flex: 1 }]}>线稿日记</Text>
          <Text style={styles.rowValue}>版本 1.0.0</Text>
        </View>
      </Section>
    </ScrollView>
  );
}

function Stat({ n, label, bg }: { n: number; label: string; bg: string }) {
  return (
    <View style={{ flex: 1, padding: 14, borderRadius: 16, backgroundColor: bg, gap: 2 }}>
      <Text style={{ fontSize: 26, fontWeight: '900', color: C.ink }}>{n}</Text>
      <Text style={{ fontSize: 12, color: C.inkSoft }}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 30, fontWeight: '900', color: C.ink, letterSpacing: -0.5 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.ink,
    backgroundColor: C.white,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: C.ink,
    backgroundColor: '#FFD966',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { marginHorizontal: 4, fontSize: 13, fontWeight: '700', color: C.muted },
  group: { borderRadius: 18, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.soft },
  rowCol: { paddingHorizontal: 16, paddingVertical: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: C.soft, alignItems: 'flex-start' },
  rowText: { fontSize: 15, color: C.ink },
  rowHint: { fontSize: 12, color: C.muted, marginTop: -6 },
  rowValue: { fontSize: 14, color: C.muted },
});
