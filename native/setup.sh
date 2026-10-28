#!/usr/bin/env bash
# 一键安装依赖：先装 Expo，再让 Expo 自动挑选与当前 SDK 匹配的各个库版本
set -e
cd "$(dirname "$0")"

echo "① 安装 Expo SDK 57 ..."
npm install expo@~57.0.0

echo "② 安装 App 用到的库（版本由 Expo 自动匹配）..."
npx expo install \
  react react-native \
  expo-router expo-linking expo-constants expo-status-bar \
  react-native-screens react-native-safe-area-context \
  react-native-gesture-handler \
  expo-camera expo-image-picker expo-file-system expo-sharing expo-haptics \
  @shopify/react-native-skia @expo/vector-icons

npx expo install --dev @types/react

echo "③ 修正不匹配的版本 ..."
npx expo install --fix || true

echo ""
echo "✅ 安装完成！运行：  npx expo start"
