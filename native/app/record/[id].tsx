import React, { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import { deleteRecord, previewUri, updateNote, useRecord } from '../../src/store';
import { STYLE_LIST } from '../../src/lineart';
import { C, fmtDate, fmtTime } from '../../src/theme';
import { Button, IconButton, StatusBadge } from '../../src/ui';

export default function RecordScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const rec = useRecord(id);
  const [note, setNote] = useState(rec?.note ?? '');

  useEffect(() => {
    if (rec) setNote(rec.note);
    // 只在切换记录时同步
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec?.id]);

  if (!rec) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper }}>
        <Text style={{ color: C.ink }}>这条记录已经删除</Text>
        <Button title="返回" variant="outline" onPress={() => router.back()} style={{ marginTop: 12, paddingHorizontal: 28 }} />
      </View>
    );
  }

  const saveNote = () => {
    if (note.trim() !== rec.note) updateNote(rec.id, note.trim());
  };

  const share = async () => {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('这台设备不支持分享');
      return;
    }
    await Sharing.shareAsync(previewUri(rec), { mimeType: 'image/png', dialogTitle: '分享这张作品' });
  };

  const remove = () => {
    Alert.alert('删除这条记录？', '删除后无法恢复。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          router.back();
          deleteRecord(rec.id);
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.paper }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <IconButton
          icon="chevron-back"
          label="返回"
          onPress={() => {
            saveNote();
            router.back();
          }}
        />
        <Text style={styles.title}>{fmtDate(rec.createdAt)}</Text>
        <IconButton icon="share-outline" label="分享" onPress={share} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.imageBox, { aspectRatio: rec.w / rec.h }]}>
          <Image source={{ uri: previewUri(rec) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 13, color: C.muted }}>
            {fmtTime(rec.createdAt)} · {STYLE_LIST.find((s) => s.id === rec.style)?.label}线稿
          </Text>
          <StatusBadge progress={rec.progress} />
        </View>

        <Text style={styles.label} nativeID="noteLabel">
          当时的感受
        </Text>
        <TextInput
          accessibilityLabelledBy="noteLabel"
          value={note}
          onChangeText={setNote}
          onBlur={saveNote}
          placeholder="补写一点当时的心情……"
          placeholderTextColor={C.muted}
          multiline
          maxLength={200}
          style={styles.input}
        />

        <Button
          title={rec.progress > 0 ? '继续上色' : '开始上色'}
          icon="color-palette-outline"
          onPress={() => {
            saveNote();
            router.push(`/editor/${rec.id}`);
          }}
        />
        <Button title="删除这条记录" variant="outline" onPress={remove} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 4 },
  title: { fontSize: 17, fontWeight: '700', color: C.ink },
  imageBox: { width: '100%', maxHeight: 460, borderRadius: 20, borderWidth: 2, borderColor: C.ink, overflow: 'hidden', backgroundColor: C.white, alignSelf: 'center' },
  label: { fontSize: 14, fontWeight: '700', color: C.ink, marginTop: 4 },
  input: {
    minHeight: 100,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#D6D3CB',
    backgroundColor: C.white,
    color: C.ink,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
});
