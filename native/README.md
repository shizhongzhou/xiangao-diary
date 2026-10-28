# 线稿日记

拍下照片 → 自动变成黑白线稿 → 写下感受 → 点格子涂色 → 在历史里回看。
iOS 和安卓共用一套代码（Expo / React Native）。所有数据只保存在手机本地。

## 第一次运行（在 Mac 的「终端」里）

```bash
cd ~/Documents/xiangao-diary
bash setup.sh        # 安装依赖，只需要做一次，几分钟
npx expo start       # 启动开发服务器，会显示一个二维码
```

然后在手机上：

- **安卓**：在应用商店装 **Expo Go**，打开后扫终端里的二维码。
- **iPhone**：装 App Store 里的 **Expo Go**，用系统相机扫二维码。
  如果提示 *“项目 SDK 版本与 Expo Go 不兼容”*，说明 App Store 上的 Expo Go 还没更新到最新版，有两种办法：
  1. 装了 Xcode 的话，直接运行 `npx expo run:ios --device`，把 App 装到连着数据线的 iPhone 上（不需要 Expo Go）。
  2. 或者把项目降到 Expo Go 支持的版本：`npx expo install expo@^54 --fix`（54 换成 Expo Go 里显示的 SDK 版本）。

手机和电脑要连同一个 Wi-Fi。改代码后保存，手机上会自动刷新。

## 功能

| 页面 | 能做什么 |
| --- | --- |
| 拍照 | 相机拍照 / 从相册导入，选择 细线 · 粗线 · 漫画 风格 |
| 写感受 | 看生成的线稿、切换风格重新生成、写一段文字，存入历史或直接去上色 |
| 上色 | 21 色调色板，点格子填色，双指缩放、拖动，撤销 / 重做，橡皮擦，自动保存 |
| 历史 | 时间轴 / 日历两种视图；点开可补写文字、继续上色、分享、删除 |
| 账户 | 昵称、统计（记录数 / 已上色 / 连续天数）、默认风格、清晰度、清空数据 |

## 代码在哪

```
app/(tabs)/index.tsx     拍照
app/(tabs)/color.tsx     上色列表
app/(tabs)/history.tsx   历史（时间轴 + 日历）
app/(tabs)/account.tsx   账户
app/result.tsx           拍完后：线稿 + 写感受
app/editor/[id].tsx      涂色编辑器
app/record/[id].tsx      单条记录详情
src/lineart.ts           照片 → 线稿算法、格子切分、填色合成（纯 TS，可单独测试）
src/imageio.ts           图片读写（Skia）
src/store.ts             本地存储
src/theme.ts             颜色、调色板、日期格式
```

## 线稿算法说明

完全在手机本地计算，不需要网络：
1. 把照片缩小到最长边 800 像素（高清模式 1200）；
2. 模糊后把颜色归并成 5~8 种色块，色块边界就是**封闭的线条**，保证每个格子都能填色；
3. 再叠加 Canny 边缘检测得到的细节线；
4. 加粗线条、去掉碎线和过小的格子；漫画风格会把最暗的部分涂成实心黑。

想要更"动漫"的效果，以后可以把 `makeLineArt` 换成调用 AI 线稿接口，其他代码不用改。

## 打包上架

用 Expo 的 EAS 服务：`npx eas build -p ios` / `npx eas build -p android`（需要 Apple / Google 开发者账号）。
