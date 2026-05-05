# 桌面端文件库头部结构优化

日期：2026-05-05

## 目标

桌面端（min-width: 641px）文件库 workspace 面板的头部，从直接复用手机端 `mobile-work-topbar` 结构，改为桌面原生轻量工具栏。

## 改动范围

### 1. HTML 结构调整 (`src/ui/playground-assets.ts`)

- header 去掉 `mobile-work-topbar` class，新增 `asset-modal-head-desktop` 标识桌面端专用结构
- 删除 `mobile-work-title-row` 包裹层
- 删除 `mobile-work-back-button` 返回箭头（桌面端通过顶部"文件库"按钮 toggle 返回）
- 标题区改为：面包屑 `工作区 /` + 标题 `可复用资产` + 数量徽标
- 右侧操作区保留 `刷新` 按钮，新增 `×` 关闭按钮
- 移动端断点下的结构不变

### 2. 桌面 workspace header 样式 (`src/ui/playground-styles.ts`)

- 新增 `.chat-stage > .workspace-contained .asset-modal-head` 桌面专用规则
- header 背景透明、无边框、紧凑高度
- 面包屑使用低透明度次要色，标题使用主色
- 数量徽标使用微小承接面
- 操作按钮紧凑排列

### 3. 浅色主题 (`src/ui/playground-theme-controller.ts`)

- 新增面包屑、标题、徽标、关闭按钮的浅色映射

### 4. 关闭逻辑 (`src/ui/playground-workspace-controller.ts`)

- `×` 按钮调用 `closeAssetLibrary()`
- 顶部 "文件库" 按钮 toggle 行为不变（再次点击关闭）

## 不变

- 手机端（max-width: 640px）文件库全屏页保持现有结构
- 资产列表项样式不变
- `openAssetLibrary()` / `closeAssetLibrary()` 主逻辑不变
