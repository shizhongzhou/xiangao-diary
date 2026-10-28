import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STYLE_LIST, type StyleId } from '../../src/lineart';
import { useSettings } from '../../src/store';
import { C } from '../../src/theme';
import { Button, IconButton, Segmented } from '../../src/ui';

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const [permission, requestPermission] = useCameraPermissions();
  const [active, setActive] = useState(false);
  const [style, setStyle] = useState<StyleId>(settings.defaultStyle);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [shooting, setShooting] = useState(false);
  const cam = useRef<CameraView>(null);

  // 只在这个页面可见时打开相机，离开时关掉，省电
  useFocusEffect(
    useCallback(() => {
      setActive(true);
      setStyle(settings.defaultStyle);
      return () => setActive(false);
    }, [settings.defaultStyle]),
  );

  const openResult = (uri: string) => {
    router.push({ pathname: '/result', params: { uri, style } });
  };

  const shoot = async () => {
    if (!cam.current || shooting) return;
    setShooting(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const pic = await cam.current.takePictureAsync({ quality: 0.85 });
      if (pic?.uri) openResult(pic.uri);
    } finally {
      setShooting(false);
    }
  };

  const pickFromAlbum = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!res.canceled && res.assets[0]?.uri) openResult(res.assets[0].uri);
  };

  const granted = permission?.granted;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <IconButton
          icon={flash === 'on' ? 'flash' : 'flash-off-outline'}
          label="闪光灯"
          color={C.white}
          bg={C.darkSoft}
          onPress={() => setFlash(flash === 'on' ? 'off' : 'on')}
        />
        <Segmented dark options={STYLE_LIST} value={style} onChange={setStyle} />
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.viewfinder}>
        {granted ? (
          active ? (
            <CameraView ref={cam} style={StyleSheet.absoluteFill} facing={facing} flash={flash} />
          ) : null
        ) : (
          <View style={styles.permission}>
            <Text style={styles.permTitle}>需要相机权限</Text>
            <Text style={styles.permText}>允许使用相机后，拍下的照片会自动变成可以涂色的线稿。</Text>
            <Button title="允许使用相机" onPress={requestPermission} style={{ marginTop: 8, paddingHorizontal: 24 }} />
            <Pressable onPress={pickFromAlbum} style={{ padding: 12 }}>
              <Text style={{ color: C.ink, fontWeight: '600' }}>或者从相册选一张</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.badge}>
          <View style={styles.dot} />
          <Text style={styles.badgeText}>拍完自动生成「{STYLE_LIST.find((s) => s.id === style)?.label}」线稿</Text>
        </View>
      </View>

      <Text style={styles.hint}>对准想记录的瞬间，按下快门</Text>

      <View style={styles.controls}>
        <IconButton icon="images-outline" label="从相册导入" color={C.white} bg={C.darkSoft} size={52} onPress={pickFromAlbum} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="拍照"
          onPress={shoot}
          disabled={!granted || shooting}
          style={({ pressed }) => [styles.shutter, { opacity: !granted ? 0.4 : pressed ? 0.7 : 1 }]}
        >
          {shooting ? <ActivityIndicator color={C.dark} /> : <View style={styles.shutterInner} />}
        </Pressable>
        <IconButton
          icon="camera-reverse-outline"
          label="切换前后摄像头"
          color={C.white}
          bg={C.darkSoft}
          size={52}
          onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.dark },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  viewfinder: { flex: 1, marginHorizontal: 12, borderRadius: 28, backgroundColor: C.white, overflow: 'hidden' },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  permTitle: { fontSize: 20, fontWeight: '800', color: C.ink },
  permText: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 21 },
  badge: {
    position: 'absolute',
    left: 12,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: C.dark,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent },
  badgeText: { color: C.white, fontSize: 12, fontWeight: '500' },
  hint: { textAlign: 'center', color: '#A3A3A3', fontSize: 13, marginTop: 14 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 36, paddingTop: 16, paddingBottom: 20 },
  shutter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: C.white, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: C.white },
});
