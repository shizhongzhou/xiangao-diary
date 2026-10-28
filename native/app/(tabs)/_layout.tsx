import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../src/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const icon =
  (name: IconName) =>
  ({ color }: { color: string }) => <Ionicons name={name} size={24} color={color} />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.ink,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: { backgroundColor: C.paper, borderTopColor: C.line },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: C.paper },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '拍照',
          tabBarIcon: icon('camera-outline'),
          tabBarActiveTintColor: C.white,
          tabBarInactiveTintColor: '#8A8A8A',
          tabBarStyle: { backgroundColor: C.dark, borderTopColor: '#262626' },
        }}
      />
      <Tabs.Screen name="color" options={{ title: '上色', tabBarIcon: icon('color-palette-outline') }} />
      <Tabs.Screen name="history" options={{ title: '历史', tabBarIcon: icon('book-outline') }} />
      <Tabs.Screen name="account" options={{ title: '账户', tabBarIcon: icon('person-outline') }} />
    </Tabs>
  );
}
