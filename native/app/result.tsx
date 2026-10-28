import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Image as SkiaImage, type SkImage } from '@shopify/react-native-skia';
import { Ionicons } from '@expo/vector-icons';
import { STYLE_LIST, WORK_SIZE, makeLineArt, type StyleId } from '../src/lineart';
import { encodePng, loadPixels, makeImage, maskToRgba, nextFrame, type Pixels } from '../src/imageio';
import { addRecord, useSettings } from '../src/store';
import { C, fmtDate, fmtTime } from '../src/theme';
import { Button, IconButton, Segmented } from '../src/ui';

export default function ResultScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ uri: string; style?: string }>();
  const settings = useSettings();
  const [style, setStyle] = useState<StyleId>((params.style as StyleId) || settings.defaultStyle);
  const [busy, setBusy] = useState(true);
  const [image, setImage] = useState<SkImage | null>(null);
  const [note, setNote] = useState('');
  const [box, setBox] = useState({ w: 0, h: 0 });
  const src = useRef<Pixels | null>(null);
  const ink = useRef<Uint8Array | null>(null);
  const createdAt = useRef(Date.now()).current;

  const generate = async (s: StyleId) => {
    setBusy(true);
    await nextFrame();
    try {
      if (!src.current) {
        const maxSide = settings.quality === 'high' ? 1200 : WORK_SIZE;
        src.current = await loadPixels(params.uri, maxSide);
      }
      const { rgba, w, h } = src.current;
      ink.current = makeLineArt(rgba, w, h, s);
      setImage(makeImage(maskToRgba(ink.current), w, h));
    } catch (e) {
      Alert.alert('生成失败', String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (params.uri) generate(style);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.uri]);

  const changeStyle = (s: StyleId) => {
    if (s === style || busy) return;
    setStyle(s);
    generate(s);
  };

  const save = (thenColor: boolean) => {
    if (!src.current || !ink.current) return;
    const { w, h } = src.current;
    const rec = addRecord({ linePng: encodePng(maskToRgba(ink.current), w, h), w, h, style, note });
    if (thenColor) router.replace(`/editor/${rec.id}`);
    else router.dismissTo('/history');
  };

  // 线稿在框内等比显示
  const iw = src.current?.w ?? 1;
  const ih = src.current?.h ?? 1;
  const scale = Math.min(box.w / iw, box.h / ih) || 0;
  const dw = iw * scale;
  const dh = ih * scale;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.paper }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <IconButton icon="chevron-back" label="重拍" onPress={() => router.back()} />
        <Text style={styles.title}>新的记录</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
        <View
          style={styles.card}
          onLayout={(e) => setBox({ w: e.nativeEvent.layout.width - 4, h: e.nativeEvent.layout.height - 4 })}
        >
          {image && scale > 0 ? (
            <Canvas style={{ width: dw, height: dh }}>
              <SkiaImage image={image} x={0} y={0} width={dw} height={dh} fit="fill" />
            </Canvas>
          ) : null}
          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator color={C.ink} />
              <Text style={{ color: C.ink, fontWeight: '600' }}>正在生成线稿…</Text>
            </View>
          ) : null}
        </View>

        <View style={{ alignItems: 'center', marginTop: 14 }}>
          <Segmented options={STYLE_LIST} value={style} onChange={changeStyle} />
        </View>

        <View style={styles.metaRow}>
          <View style={styles.chip}>
            <Ionicons name="calendar-outline" size={15} color={C.ink} />
            <Text style={styles.chipText}>
              {fmtDate(createdAt)} {fmtTime(createdAt)}
            </Text>
          </View>
        </View>

        <Text style={styles.label} nativeID="feelingLabel">
          此刻的感受
        </Text>
        <TextInput
          accessibilityLabelledBy="feelingLabel"
          value={note}
          onChangeText={setNote}
          placeholder="写点什么吧：今天看到了什么、想到了什么……"
          placeholderTextColor={C.muted}
          multiline
          maxLength={200}
          style={styles.input}
        />
        <Text style={styles.counter}>{note.length} / 200</Text>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 12 }]}>
        <Button title="存入历史" variant="outline" style={{ flex: 1 }} disabled={busy} onPress={() => save(false)} />
        <Button title="开始上色" icon="arrow-forward" style={{ flex: 1 }} disabled={busy} onPress={() => save(true)} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 4 },
  title: { fontSize: 17, fontWeight: '700', color: C.ink },
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    height: 360,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: C.ink,
    backgroundColor: C.white,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  busy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: C.soft,
  },
  chipText: { fontSize: 13, fontWeight: '500', color: C.ink },
  label: { marginHorizontal: 16, marginTop: 20, marginBottom: 8, fontSize: 14, fontWeight: '700', color: C.ink },
  input: {
    marginHorizontal: 16,
    minHeight: 112,
    padding: 14,
    paddingTop: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#D6D3CB',
    backgroundColor: C.white,
    color: C.ink,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  counter: { marginHorizontal: 16, marginTop: 6, textAlign: 'right', fontSize: 12, color: C.muted },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.paper },
});
