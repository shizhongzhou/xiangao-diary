import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, statusOf } from './theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function IconButton(props: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  color?: string;
  bg?: string;
  size?: number;
  border?: boolean;
  disabled?: boolean;
}) {
  const size = props.size ?? 44;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      onPress={props.onPress}
      disabled={props.disabled}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: props.bg ?? 'transparent',
          borderWidth: props.border ? 1.5 : 0,
          borderColor: props.color ?? C.ink,
          opacity: props.disabled ? 0.3 : pressed ? 0.6 : 1,
        },
      ]}
    >
      <Ionicons name={props.icon} size={Math.round(size * 0.5)} color={props.color ?? C.ink} />
    </Pressable>
  );
}

export function Button(props: {
  title: string;
  onPress?: () => void;
  variant?: 'solid' | 'outline';
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const solid = (props.variant ?? 'solid') === 'solid';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      disabled={props.disabled}
      style={({ pressed }) => [
        styles.btn,
        solid ? { backgroundColor: C.ink } : { borderWidth: 2, borderColor: C.ink },
        { opacity: props.disabled ? 0.4 : pressed ? 0.75 : 1 },
        props.style,
      ]}
    >
      <Text style={[styles.btnText, { color: solid ? C.white : C.ink }]}>{props.title}</Text>
      {props.icon ? <Ionicons name={props.icon} size={18} color={solid ? C.white : C.ink} /> : null}
    </Pressable>
  );
}

export function Segmented<T extends string>(props: {
  options: readonly { readonly id: T; readonly label: string }[];
  value: T;
  onChange: (v: T) => void;
  dark?: boolean;
}) {
  return (
    <View style={[styles.seg, { backgroundColor: props.dark ? C.darkSoft : C.soft }]}>
      {props.options.map((o) => {
        const on = o.id === props.value;
        const fg = props.dark ? (on ? C.dark : '#BDBDBD') : on ? C.ink : C.muted;
        const bg = on ? C.white : 'transparent';
        return (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => props.onChange(o.id)}
            style={[styles.segItem, { backgroundColor: bg }]}
          >
            <Text style={{ color: fg, fontSize: 14, fontWeight: on ? '700' : '500' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StatusBadge({ progress }: { progress: number }) {
  const s = statusOf(progress);
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: s.outline ? 3 : 4,
        borderRadius: 999,
        backgroundColor: s.bg,
        borderWidth: s.outline ? 1.5 : 0,
        borderColor: C.ink,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '700', color: C.ink }}>{s.label}</Text>
    </View>
  );
}

export function ProgressBar({ value, width = 72 }: { value: number; width?: number }) {
  return (
    <View style={{ width, height: 6, borderRadius: 3, backgroundColor: C.line, overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(Math.min(1, value) * 100)}%`, height: '100%', backgroundColor: C.ink }} />
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
  },
  btnText: { fontSize: 16, fontWeight: '700' },
  seg: { flexDirection: 'row', borderRadius: 999, padding: 0, gap: 2 },
  segItem: { minHeight: 44, paddingHorizontal: 18, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
