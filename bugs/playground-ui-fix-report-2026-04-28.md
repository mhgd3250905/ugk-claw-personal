# Playground UI 修复核查报告

**日期**：2026-04-28  
**状态**：已修复  
**核查范围**：`src/ui/playground-styles.ts`、`src/ui/playground-theme-controller.ts`  
**结论**：已按报告问题落地修复。Landing 空态命令条居中、markdown 表格长文本换行、桌面历史栏蓝色竖线移除、桌面历史列表滚动条隐藏、“回到底部”按钮深浅主题可发现性增强；浅色运行日志文字 / 状态摘要沿用既有可读性覆盖。

---

## 1. 核查摘要

| 项目 | 原报告结论 | 当前源码状态 | 处理建议 |
| --- | --- | --- | --- |
| Landing 顶部按钮容器居中 | 已修改 | 已生效，landing 模式下 `.landing-side-right` 居中 | 已修复 |
| Markdown 表格单元格换行 | 已修改 | 已生效，`td/th` 允许换行并保留滚动兜底 | 已修复 |
| 桌面历史栏蓝色竖线移除 | 已修改 | 已生效，`.desktop-conversation-rail` 不再使用蓝色左边框 | 已修复 |
| 桌面历史列表滚动条隐藏 | 已修改 | 已生效，Firefox / WebKit 均隐藏滚动条 | 已修复 |
| “回到底部”按钮显眼化 | 已修改 | 已生效，深色青蓝、浅色绿色描边与轻量阴影 | 已修复 |
| 浅色运行日志文字颜色 | 已修改 | 已有浅色覆盖规则 | 已确认 |

---

## 2. 真实问题

### 2.1 Landing 顶部按钮仍偏右

修复前 `.landing-side-right` 使用：

```css
justify-content: flex-end;
justify-self: end;
padding: 6px 92px 6px 8px;
```

这会让 landing 状态下右侧按钮组明显偏右。若目标是居中，需要把 landing 模式下的容器对齐口径收回到中线附近。

已落地：

```css
.shell[data-stage-mode="landing"] .topbar {
    justify-items: center;
}

.shell[data-stage-mode="landing"] .landing-side-right {
    justify-content: center;
    justify-self: center;
    padding: 6px 12px;
}
```

注意：只限定在 `data-stage-mode="landing"` 下，避免影响 active 会话态的顶部工具布局。

### 2.2 Markdown 表格长文本换行

修复前表格使用：

```css
.message-content table {
    width: max-content;
}

.message-content th,
.message-content td {
    white-space: nowrap;
}
```

这对宽表格很容易撑开消息气泡。原报告提出的 `white-space: normal` 方向是对的，但不能只改单元格，还要保留滚动容器兜底。

已落地：

```css
.message-content table {
    width: max-content;
    max-width: 100%;
}

.message-content th,
.message-content td {
    min-width: 60px;
    white-space: normal;
    word-break: break-word;
}
```

风险：过度换行会让数字型表格变高。验收时要同时看普通中文表格、长 URL、长英文单词和代码片段。

### 2.3 桌面历史栏滚动条隐藏

修复前 `.desktop-conversation-list` 有：

```css
scrollbar-width: thin;
scrollbar-color: rgba(201, 210, 255, 0.18) transparent;
```

现在视觉上隐藏滚动条，同时保留滚动能力：

```css
.desktop-conversation-list {
    scrollbar-width: none;
}

.desktop-conversation-list::-webkit-scrollbar {
    display: none;
}
```

风险：隐藏滚动条会降低“这里可以滚”的可发现性，但当前历史栏卡片列表本身已经暗示可滚动，风险可接受。

### 2.4 “回到底部”按钮可发现性增强

修复前 `.scroll-to-bottom-button` 是：

```css
border: 1px solid rgba(201, 210, 255, 0.2);
box-shadow: none;
```

浅色主题下也被统一覆盖成透明边框和无阴影。若用户反馈找不到该按钮，应提高按钮在深浅主题下的识别度。

已落地深色主题：

```css
.scroll-to-bottom-button {
    border: 2px solid rgba(101, 209, 255, 0.5);
    box-shadow:
        0 4px 12px rgba(0, 0, 0, 0.4),
        0 0 8px rgba(101, 209, 255, 0.2);
}
```

已落地浅色主题单独覆盖：

```css
:root[data-theme="light"] .scroll-to-bottom-button {
    border-color: rgba(8, 120, 75, 0.4);
    background: rgba(255, 255, 255, 0.92);
    color: #08784b;
    box-shadow:
        0 4px 12px rgba(0, 0, 0, 0.15),
        0 0 8px rgba(8, 120, 75, 0.1);
}
```

注意：不要把按钮做得像主 CTA。它是辅助导航，不该抢发送按钮的注意力。

### 2.5 浅色运行日志文字颜色已基本覆盖

当前 `src/ui/playground-theme-controller.ts` 已存在：

```css
:root[data-theme="light"] .assistant-run-log-trigger.ok .assistant-run-log-hint,
:root[data-theme="light"] .assistant-loading-bubble.ok .assistant-run-log-hint {
    color: #08784b;
}

:root[data-theme="light"] .assistant-status-summary {
    background: transparent;
    color: rgba(75, 86, 110, 0.76);
}
```

这部分和用户之前的浅色可读性要求一致。后续只需要回归确认 `ok / system / running` 等不同状态，不要重复补一堆互相打架的浅色覆盖。

---

## 3. 实施结果

本次直接落到正式源码：

- `src/ui/playground-styles.ts`
- `src/ui/playground-theme-controller.ts`
- `test/server.test.ts`
- `docs/playground-current.md`
- `DESIGN.md`

已执行：

```bash
node --test --import tsx test/server.test.ts
```

结果：101 个测试全部通过。

---

## 4. 验收清单

- Landing 空态下顶部按钮组居中，不影响 active 会话态布局。
- Markdown 表格在助手气泡内不撑破消息宽度；长文本能换行，宽表格仍可横向滚动兜底。
- 桌面历史列表仍可滚动，但不显示滚动条。
- “回到底部”按钮在深色和浅色主题下都容易发现，但不抢发送按钮视觉主导权。
- 浅色主题下运行日志按钮、状态摘要和 loading 气泡文字均可读。
- 手机端 `max-width: 640px` 布局不受桌面 landing / 历史栏规则影响。

---

## 5. 影响范围

本报告只涉及 playground 视觉样式，不应改动：

- 会话切换 / 新建逻辑
- SSE 流式输出
- 文件上传与资产引用
- 后台任务和任务消息接口
- browser sidecar / web-access 运行链路

这类纯 UI 修复别把手伸到业务逻辑里，伸过去就是给自己加戏。
