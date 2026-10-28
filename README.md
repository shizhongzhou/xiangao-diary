# 线稿日记

拍下照片 → 自动变成黑白线稿 → 写下感受 → 点格子涂色 → 在历史里回看。

- **网页版**（本仓库根目录 `index.html`）：用 GitHub Pages 直接打开，iPhone Safari「分享 → 添加到主屏幕」即可像 App 一样使用。所有计算都在手机上完成，记录保存在这台设备的浏览器里。
- **原生 App 源码**（`native/`）：Expo / React Native，iOS 和安卓共用一套代码，运行方法见 `native/README.md`。

## 安卓安装包

`android/` 是安卓外壳工程（WebView 加载内置的网页版，补上相机权限、相册选图、保存到相册、返回键）。
每次推送改动，GitHub Actions 会自动打包并发布，安卓手机打开下面的链接即可下载最新版：

https://github.com/shizhongzhou/xiangao-diary/releases/latest/download/xiangao-diary.apk

> 安装包用的是仓库里的测试签名（`android/app/xiangao-test.jks`），方便新版本直接覆盖安装；正式上架应用商店前要换成私密证书。
