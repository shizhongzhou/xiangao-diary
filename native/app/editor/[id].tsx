import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Canvas, Group, Image as SkiaImage, type SkImage } from '@shopify/react-native-skia';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { buildRegions, coloredRatio, compose, regionAt, type Regions } from '../../src/lineart';
import { encodePng, loadMask, makeImage, nextFrame } from '../../src/imageio';
import { fileUri, getRecord, lineName, saveColoring } from '../../src/store';
import { C, PALETTE, fmtDate } from '../../src/theme';
import { IconButton, ProgressBar } from '../../src/ui';

interface Step {
  label: number;
  prev?: string;
  next?: string;
}

const MAX_ZOOM = 8;
const ERASER = 'eraser';

export default function EditorScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const rec = useMemo(() => getRecord(id), [id]);

  const [loading, setLoading] = useState(true);
  const [image, setImage] = useState<SkImage | null>(null);
  const [colors, setColors] = useState<Record<string, string>>(rec?.colors ?? {});
  const [current, setCurrent] = useState<string>(PALETTE[1][1]);
  const [undoStack, setUndo] = useState<Step[]>([]);
  const [redoStack, setRedo] = useState<Step[]>([]);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });

  const data = useRef<{ w: number; h: number; ink: Uint8Array; regions: Regions } | null>(null);
  const dirty = useRef(false);
  const colorsRef = useRef(colors);
  colorsRef.current = colors;

  // 读取线稿并切分格子
  useEffect(() => {
    if (!rec) return;
    (async () => {
      await nextFrame();
      try {
        const { w, h, ink } = await loadMask(fileUri(lineName(rec.id)));
        data.current = { w, h, ink, regions: buildRegions(ink, w, h) };
        setImage(makeImage(compose(ink, data.current.regions, rec.colors, w, h), w, h));
      } catch (e) {
        Alert.alert('打开失败', String((e as Error)?.message ?? e));
      } finally {
        setLoading(false);
      }
    })();
  }, [rec]);

  const redraw = (next: Record<string, string>) => {
    const d = data.current;
    if (!d) return;
    setImage(makeImage(compose(d.ink, d.regions, next, d.w, d.h), d.w, d.h));
  };

  const apply = (next: Record<string, string>) => {
    setColors(next);
    dirty.current = true;
    redraw(next);
  };

  const setRegion = (base: Record<string, string>, label: number, color?: string) => {
    const next = { ...base };
    if (color) next[label] = color;
    else delete next[label];
    return next;
  };

  const paintAt = (sx: number, sy: number) => {
    const d = data.current;
    if (!d) return;
    const fit = Math.min(box.w / d.w, box.h / d.h);
    const s = fit * view.scale;
    const ox = (box.w - d.w * fit) / 2;
    const oy = (box.h - d.h * fit) / 2;
    const x = (sx - ox - view.tx) / s;
    const y = (sy - oy - view.ty) / s;
    if (x < 0 || y < 0 || x >= d.w || y >= d.h) return;
    const label = regionAt(d.regions, d.w, d.h, x, y);
    if (label < 0) return;
    const prev = colorsRef.current[label];
    const nextColor = current === ERASER ? undefined : current;
    if (prev === nextColor) return;
    Haptics.selectionAsync().catch(() => {});
    setUndo((u) => [...u.slice(-50), { label, prev, next: nextColor }]);
    setRedo([]);
    apply(setRegion(colorsRef.current, label, nextColor));
  };

  const undo = () => {
    const step = undoStack[undoStack.length - 1];
    if (!step) return;
    setUndo(undoStack.slice(0, -1));
    setRedo([...redoStack, step]);
    apply(setRegion(colorsRef.current, step.label, step.prev));
  };

  const redo = () => {
    const step = redoStack[redoStack.length - 1];
    if (!step) return;
    setRedo(redoStack.slice(0, -1));
    setUndo([...undoStack, step]);
    apply(setRegion(colorsRef.current, step.label, step.next));
  };

  const progress = data.current ? coloredRatio(data.current.regions, colors) : rec?.progress ?? 0;

  const save = useCallback(() => {
    const d = data.current;
    if (!d || !rec || !dirty.current) return;
    const c = colorsRef.current;
    const png = encodePng(compose(d.ink, d.regions, c, d.w, d.h), d.w, d.h);
    saveColoring(rec.id, c, coloredRatio(d.regions, c), png);
    dirty.current = false;
  }, [rec]);

  // 离开页面（包括安卓返回键、侧滑）时自动保存
  useEffect(() => () => save(), [save]);

  const leave = (to?: string) => {
    save();
    if (to) router.dismissTo(to);
    else router.back();
  };

  // ---- 画面摆放：线稿等比放进画布区域 ----
  const d = data.current;
  const fit = d ? Math.min(box.w / d.w, box.h / d.h) : 1;
  const ox = d ? (box.w - d.w * fit) / 2 : 0;
  const oy = d ? (box.h - d.h * fit) / 2 : 0;
  const cw = d ? d.w * fit : box.w;
  const ch = d ? d.h * fit : box.h;

  // ---- 手势：单指拖动、双指缩放、轻点填色 ----
  const start = useRef({ scale: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;

  const clampView = (v: { scale: number; tx: number; ty: number }) => {
    const scale = Math.min(MAX_ZOOM, Math.max(1, v.scale));
    // 以画面中心为基准，放大后可以拖到边缘，但不能拖出太远
    const cx = (cw * (1 - scale)) / 2;
    const cy = (ch * (1 - scale)) / 2;
    const limX = (cw * (scale - 1)) / 2 + box.w * 0.25;
    const limY = (ch * (scale - 1)) / 2 + box.h * 0.25;
    return {
      scale,
      tx: Math.min(cx + limX, Math.max(cx - limX, v.tx)),
      ty: Math.min(cy + limY, Math.max(cy - limY, v.ty)),
    };
  };

  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      start.current = { ...viewRef.current };
    })
    .onUpdate((e) => {
      const s0 = start.current;
      const scale = Math.min(MAX_ZOOM, Math.max(1, s0.scale * e.scale));
      const k = scale / s0.scale;
      const fx = e.focalX - ox;
      const fy = e.focalY - oy;
      setView(clampView({ scale, tx: fx - (fx - s0.tx) * k, ty: fy - (fy - s0.ty) * k }));
    });

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(8)
    .averageTouches(true)
    .onStart(() => {
      start.current = { ...viewRef.current };
    })
    .onUpdate((e) => {
      const s0 = start.current;
      setView(clampView({ scale: viewRef.current.scale, tx: s0.tx + e.translationX, ty: s0.ty + e.translationY }));
    });

  const tap = Gesture.Tap()
    .runOnJS(true)
    .maxDuration(300)
    .onEnd((e, ok) => {
      if (ok) paintAt(e.x, e.y);
    });

  const gesture = Gesture.Race(Gesture.Simultaneous(pinch, pan), tap);

  if (!rec) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={{ color: C.ink }}>这条记录不存在了</Text>
        <Pressable onPress={() => router.back()} style={{ padding: 12 }}>
          <Text style={{ fontWeight: '700', color: C.ink }}>返回</Text>
        </Pressable>
      </View>
    );
  }

  const currentName = current === ERASER ? '橡皮擦' : PALETTE.find((p) => p[1] === current)?.[0] ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <IconButton icon="chevron-back" label="返回" onPress={() => leave()} />
        <Text style={styles.title} numberOfLines={1}>
          {rec.note ? rec.note : fmtDate(rec.createdAt)}
        </Text>
        <IconButton icon="arrow-undo-outline" label="撤销" onPress={undo} disabled={!undoStack.length} />
        <IconButton icon="arrow-redo-outline" label="重做" onPress={redo} disabled={!redoStack.length} />
        <Pressable accessibilityRole="button" onPress={() => leave('/history')} style={styles.done}>
          <Ionicons name="checkmark" size={16} color={C.white} />
          <Text style={{ color: C.white, fontWeight: '700', fontSize: 14 }}>完成</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
      <GestureDetector gesture={gesture}>
        <View
          style={styles.canvasArea}
          onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
          collapsable={false}
        >
          {image && d && box.w > 0 ? (
            <Canvas style={StyleSheet.absoluteFill}>
              <Group transform={[{ translateX: ox + view.tx }, { translateY: oy + view.ty }, { scale: fit * view.scale }]}>
                <SkiaImage image={image} x={0} y={0} width={d.w} height={d.h} fit="fill" />
              </Group>
            </Canvas>
          ) : null}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={C.ink} />
              <Text style={{ color: C.ink, marginTop: 8 }}>正在准备画布…</Text>
            </View>
          ) : null}
          <View style={styles.hint} pointerEvents="none">
            <Text style={styles.hintText}>点击格子填色 · 双指缩放 · 拖动查看</Text>
          </View>
        </View>
      </GestureDetector>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="缩放复原"
        onPress={() => setView({ scale: 1, tx: 0, ty: 0 })}
        style={styles.zoom}
      >
        <Ionicons name="scan-outline" size={14} color={C.ink} />
        <Text style={{ fontSize: 12, fontWeight: '700', color: C.ink }}>
          {view.scale > 1.01 ? `${Math.round(view.scale * 100)}% · 复原` : '100%'}
        </Text>
      </Pressable>
      </View>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.sheetHead}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={[
                styles.currentDot,
                current === ERASER ? { backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' } : { backgroundColor: current },
              ]}
            >
              {current === ERASER ? <Ionicons name="close" size={14} color={C.ink} /> : null}
            </View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>{currentName}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ProgressBar value={progress} />
            <Text style={{ fontSize: 13, color: C.muted }}>已涂 {Math.round(progress * 100)}%</Text>
          </View>
        </View>

        <View style={{ gap: 8 }}>
          {[0, 1, 2].map((row) => (
            <View key={row} style={styles.row}>
              {PALETTE.slice(row * 7, row * 7 + 7).map(([name, hex]) => {
                const on = hex === current;
                return (
                  <Pressable
                    key={hex}
                    accessibilityRole="button"
                    accessibilityLabel={name}
                    accessibilityState={{ selected: on }}
                    onPress={() => setCurrent(hex)}
                    style={[styles.swatch, { backgroundColor: hex }, on ? styles.swatchOn : null]}
                  />
                );
              })}
            </View>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: current === ERASER }}
          onPress={() => setCurrent(ERASER)}
          style={[styles.eraser, current === ERASER ? { backgroundColor: C.ink } : null]}
        >
          <Ionicons name="backspace-outline" size={18} color={current === ERASER ? C.white : C.ink} />
          <Text style={{ fontWeight: '700', color: current === ERASER ? C.white : C.ink }}>橡皮擦（点格子变回白色）</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper },
  header: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 4, paddingRight: 12, paddingBottom: 6 },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: C.ink },
  done: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: 14,
    marginLeft: 4,
    borderRadius: 999,
    backgroundColor: C.ink,
  },
  canvasArea: { flex: 1, backgroundColor: C.white, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line, overflow: 'hidden' },
  hint: { position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: C.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  hintText: { color: C.white, fontSize: 12, fontWeight: '500' },
  zoom: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: C.ink,
    backgroundColor: C.white,
  },
  sheet: { paddingHorizontal: 16, paddingTop: 14, gap: 12, backgroundColor: C.paper },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  currentDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: C.ink },
  row: { flexDirection: 'row', gap: 8 },
  swatch: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(20,20,20,0.12)' },
  swatchOn: { borderWidth: 3, borderColor: C.ink },
  eraser: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.ink,
  },
});
