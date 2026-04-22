# Playground Runtime Split Handoff Implementation Plan

> **For the next agent:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. If you change UI behavior, also use the repo's frontend/testing guidance and verify with the real `http://127.0.0.1:3000/playground` entry.

**Goal:** Continue reducing `src/ui/playground.ts` into clear, bounded runtime modules without breaking the already working conn, activity, assets, conversation, and streaming experience.

**Architecture:** Keep `playground.ts` as the page assembler and shared state owner while extracting low-risk UI/runtime islands into colocated `src/ui/playground-*.ts` fragments. Each extraction must preserve the current classic inline script execution model: controllers are injected into the same browser global scope, not imported as browser ES modules.

**Tech Stack:** TypeScript, Node built-in test runner with `tsx`, Docker Compose, SQLite-backed conn stores, server-rendered HTML/JS strings under `src/ui/`, browser smoke testing via Chrome DevTools MCP.

---

## 1. 背景脉络

这轮工作的起点不是“单纯整理代码”，而是 conn 功能已经进入真实可用阶段后暴露出的产品结构问题。

用户一开始关注的是：如果创建一个 conn 后，它绑定某个对话 ID，但运行过程中用户切换了会话，那么 conn 运行产生的消息气泡就可能不在当前会话里可见。由此提出了一个更合理的方向：前端不要只把运行信息理解成“当前会话里的消息”，而是基于 agent / conn 的运行状态维护一条全局活动时间线，再按需回投或展示。

这个方向已经证明可行，并且近期已经做到了：

- conn 创建 / 编辑 UI 已落地。
- conn 可绑定 profile / agentSpec / skillSet / modelPolicy / upgradePolicy 这条后端解析链。
- worker 会通过运行时 snapshot 限定 skills。
- conn 可立即执行、定时执行、间隔执行、每日执行。
- 创建表单里触发方式已被用户收敛为三个清晰选项：
  - `定时执行`：设置执行时间。
  - `间隔执行`：设置首次执行时间和间隔。
  - `每日执行`：设置每日执行时间。
- conn 删除、批量清理、全局活动、toast 通知、run 详情、结果摘要、输出文件索引已经陆续修过。
- 已修复同一个 conn 两次执行结果摘要不一致的问题，避免后一次把 manifest 字段当成最终正文。

随后用户提出更大的要求：界面越堆越多，需要“大减负”，操作要更顺、更流畅、更快速，不能靠补丁堆叠。基于这个要求，当前重点已经从单点功能转向 `playground` 前端运行时的结构治理。

现在最大的技术债很明确：`src/ui/playground.ts` 曾经承担了页面 HTML、CSS、桌面/手机布局、stream 生命周期、会话管理、conn/activity、文件资产、context usage、复制按钮、markdown hydration 等所有职责。继续往里面塞功能，下一轮一定又会变成一锅粥。

所以当前策略是：先保功能，再拆边界；小步提交，每一刀都做真实入口验证。

---

## 2. 当前最新状态

### 2.1 Git 状态

当前主分支近期已推送到 GitHub。上一轮完成后工作区应为 clean。

最近提交顺序：

- `56e7ba3 refactor: split playground conn activity fragments`
- `35b7690 refactor: split playground conn activity controller`
- `c741482 fix: stabilize conn run result summaries`
- `fd27c24 refactor: split playground asset fragments`
- `1582d66 refactor: split playground asset controller`
- `f0f2d76 refactor: split playground context usage controller`

接手第一步必须运行：

```powershell
git status --short
git log --oneline -8
```

Expected:

- `git status --short` 没有输出，或者只有用户明确新增的无关文件。
- `git log` 能看到上面的拆分提交。

### 2.2 固定运行入口

- Playground: `http://127.0.0.1:3000/playground`
- Health: `http://127.0.0.1:3000/healthz`
- 默认开发启动 / 恢复：`docker compose up -d`
- 前端改动后通常只需要：`docker compose restart ugk-pi`

不要跑到 `3101`、`3102` 这类临时端口上做最终验收。排障可以短用，结论必须回到 `3000`。

### 2.3 已拆出的文件

当前 `src/ui/playground.ts` 仍然很大，约 6200 行，但已经不再承担全部 conn / assets / context usage 细节。

已拆出：

- `src/ui/playground-conn-activity.ts`
  - conn/activity 的静态样式、弹窗 HTML、全局活动区域 HTML。
- `src/ui/playground-conn-activity-controller.ts`
  - conn 管理器、创建/编辑、触发方式、删除、立即执行、全局活动、run 详情、activity polling、toast 协调等前端运行时。
- `src/ui/playground-assets.ts`
  - 文件/资产相关静态样式、资产库弹窗 HTML。
- `src/ui/playground-assets-controller.ts`
  - 文件选择、拖拽投放、上传、附件 chip、资产库刷新/复用、已选资产、文件下载卡片交互。
- `src/ui/playground-context-usage-controller.ts`
  - context usage 常量、DOM 引用、token 估算、进度环渲染、详情弹层、输入实时重算。

注意：`state.contextUsage`、`state.contextUsageExpanded`、`state.contextUsageSyncToken` 仍保留在 `playground.ts` 的主 state 中。它们被会话恢复、流式事件、发送流程共同读写，暂时不要为了“看起来干净”硬搬出去。硬搬就是制造新 bug，属于很努力但方向不对。

---

## 3. 当前功能事实

### 3.1 Conn / Activity

用户已经真实测试过：

- 立即执行 OK。
- 设置后能收到任务通知。
- 从新会话也能看到 toast 和全局活动。
- 当前设计允许 conn 输出不一定回到当前可见会话；全局活动是跨会话观察层。

重要理解：

- conn 不是“当前屏幕上的一条聊天消息”。
- conn 是后台任务定义 + worker run + activity event。
- 会话气泡是可选回投/展示结果，不应该成为唯一可见路径。
- 新建/切换会话时，不要把 conn 运行状态丢掉。

### 3.2 创建/编辑体验

用户明确否定过复杂表单化指令生成。当前正确方向：

- 任务说明仍用“按指令填写”的自由文本方式。
- 触发时间只保留简单三类：
  - 定时执行。
  - 间隔执行。
  - 每日执行。
- 不要恢复“每天固定时间 / 工作日固定时间 / 每周固定周几”那套复杂选项。那套已经被用户吐槽过，别又翻出来显得自己很有想法。

### 3.3 文件 / 资产

资产相关逻辑已从主文件拆出 controller。保持现状：

- 已选文件 / 已选资产统一 chip 风格。
- 上传、拖拽、复用资产、清除附件都要继续可用。
- agent 输出的文件卡片要继续能复制 / 打开 / 下载。

### 3.4 Context Usage

上下文用量圆环和详情弹层已拆 controller。已验证：

- 桌面点击圆环可展开详情。
- 手机点击圆环可打开详情弹层。

后续如果改 conversation / stream / input 相关逻辑，必须确认 context usage 仍会随输入、附件、会话恢复、流式事件同步。

---

## 4. 关键入口和文件地图

先看这些，不要全仓乱翻：

- `AGENTS.md`
- `README.md`
- `docs/traceability-map.md`
- `docs/playground-current.md`
- `docs/runtime-assets-conn-feishu.md`
- `docs/change-log.md`
- `src/server.ts`
- `src/routes/chat.ts`
- `src/routes/conns.ts`
- `src/routes/activity.ts`
- `src/ui/playground.ts`
- `src/ui/playground-conn-activity.ts`
- `src/ui/playground-conn-activity-controller.ts`
- `src/ui/playground-assets.ts`
- `src/ui/playground-assets-controller.ts`
- `src/ui/playground-context-usage-controller.ts`
- `src/agent/conn-store.ts`
- `src/agent/conn-db.ts`
- `src/agent/conn-sqlite-store.ts`
- `src/agent/conn-run-store.ts`
- `src/workers/conn-worker.ts`
- `test/server.test.ts`

---

## 5. 高风险边界

下面这些还在 `playground.ts` 内，不能一把梭：

- conversation catalog / current conversation sync / history drawer。
- 新建会话、切换会话、运行中禁切逻辑。
- transcript rendering、assistant/user/system 消息合并。
- markdown hydration、copy buttons、代码块增强。
- stream lifecycle、SSE、`/v1/chat/events` 续订、active run recovery。
- interrupt / queued submit / active assistant state。
- scroll follow、bottom buffer、用户上滑阅读历史时不强制滚底。
- mobile topbar / overflow menu / conversation drawer。
- localStorage persistence / resume sync。

其中最高风险的是 transcript renderer 和 stream lifecycle。下一位 agent 不要为了“显得推进很大”先拆这两个。先拆低风险外壳，别一上来就拆发动机还不拍照。

---

## 6. 推荐下一阶段总计划

### Phase 1: 拆 mobile shell controller

这是推荐下一刀。

**原因：**

- 与 stream / transcript 核心耦合相对低。
- 用户可见收益明确：手机端顶部、更多菜单、历史抽屉逻辑从主文件移出。
- 改坏时容易定位，验证路径短。

**目标：**

创建 `src/ui/playground-mobile-shell-controller.ts`，把移动端外壳状态和事件集中出去。

**候选范围：**

- mobile topbar button DOM refs。
- more menu open/close。
- conversation drawer open/close。
- drawer backdrop click。
- Escape / outside click 关闭行为。
- mobile-specific resize / class toggles。

**谨慎点：**

- 会话列表渲染如果深度依赖 conversation catalog，可以先不拆 render，只拆 shell event/state。
- 不要改视觉设计，不要顺手改文案。
- 保持手机端“左侧历史抽屉 + 透明右侧点击遮罩”的既有口径。

**验证：**

- 桌面 `1280x900` 打开 `/playground`，顶部桌面布局不变。
- 手机 `390x844` 打开 `/playground`：
  - 点击左侧 logo / `UGK Claw` 能打开历史抽屉。
  - 点击遮罩能关闭抽屉。
  - 点击右上更多能打开菜单。
  - 菜单里的技能 / 文件 / 文件库入口可触发原行为。
  - 新会话按钮仍可用。

**建议提交：**

```powershell
git add src/ui/playground.ts src/ui/playground-mobile-shell-controller.ts docs/playground-current.md docs/change-log.md
git commit -m "refactor: split playground mobile shell controller"
```

### Phase 2: 拆 conversation catalog controller

**目标：**

将会话目录加载、当前会话同步、新建会话、切换会话、历史抽屉列表渲染从 `playground.ts` 中收口。

**建议文件：**

- `src/ui/playground-conversations-controller.ts`

**范围：**

- `loadConversationCatalog` 类逻辑。
- `createConversation` 类逻辑。
- `switchConversation` 类逻辑。
- conversation drawer list rendering。
- current conversation title / active marker / disabled state。

**必须保持的行为：**

- 多浏览器 / 多设备打开后，先跟随服务端 `currentConversationId`。
- 新会话必须走 `POST /v1/chat/conversations` 创建并激活。
- 历史会话切换必须走 `POST /v1/chat/current`。
- 当前 agent 运行中禁止新建和切换，避免同一个 agent 同时被拖到两条产线。
- 切换会话后，`GET /v1/chat/state` 是 canonical state。

**测试重点：**

- 空状态新建会话。
- 有历史时切换。
- 当前 running 时按钮禁用。
- 刷新页面后当前会话跟随后端。
- 手机抽屉列表和桌面历史列表一致。

**建议提交：**

```powershell
git add src/ui/playground.ts src/ui/playground-conversations-controller.ts docs/playground-current.md docs/change-log.md
git commit -m "refactor: split playground conversations controller"
```

### Phase 3: 拆 layout / scroll / resume controller

**目标：**

把布局同步、滚动跟随、底部 buffer、刷新恢复相关逻辑从主文件中抽出。

**建议文件：**

- `src/ui/playground-layout-controller.ts`

**范围：**

- composer 高度变化后的 layout sync。
- transcript bottom buffer。
- 是否靠近底部的判断。
- “回到底部”按钮。
- 用户上滑时不强制滚到底部。
- resize / visual viewport 相关逻辑。
- localStorage 中与布局/草稿恢复有关的 debounce，可视情况拆。

**必须保持的行为：**

- `transcript-current` 底部保留 `--transcript-bottom-scroll-buffer` 余量。
- 最后一条消息必须能继续上拖到 composer 上方。
- 流式更新只有靠近底部时才自动跟随。
- 用户离开底部后显示“回到底部”按钮。

**验证：**

- 发送一条会产生较长输出的消息。
- 输出过程中手动上滑，确认页面不抢滚动。
- 点击“回到底部”，确认恢复跟随。
- 手机端 composer 不遮挡最后一条消息。

### Phase 4: 拆 transcript / message renderer

这是高风险阶段，建议单独计划后再做。

**目标：**

把消息渲染、markdown hydration、复制正文、文件卡片挂载、历史恢复合并逻辑从主文件中拆出。

**建议文件：**

- `src/ui/playground-transcript-renderer.ts`

**高风险点：**

- 后端 canonical history 中连续 assistant 消息片段需要合并成一条助手回复。
- active assistant 正文、过程区、系统反馈视觉要保持一致。
- conn / activity 通知不应污染聊天主历史。
- 文件下载卡片依赖 assets controller 暴露的 hook。
- 复制正文按钮必须保持小型灰色裸 icon，不要改回可见文字按钮。

**先补测试，再改实现：**

- 刷新后同一轮 assistant 不拆成多条气泡。
- 用户消息靠右，助手消息跟 composer 宽度一致。
- 文件卡片按钮存在且行为不报错。
- copy button 的可见文本不占位。

### Phase 5: 拆 stream lifecycle controller

这是最高风险阶段，建议最后做。

**目标：**

把 chat submit、SSE streaming、events 续订、active run recovery、interrupt / queue 从主文件中收口。

**建议文件：**

- `src/ui/playground-stream-controller.ts`

**必须守住：**

- 手机前后台切换或 `/v1/chat/stream` 短断不等于 agent 失败。
- 只要 `GET /v1/chat/state` 仍显示 running，前端应切到 `/v1/chat/events` 续订事件流。
- 刷新恢复运行态以 `GET /v1/chat/state` 的 canonical state 为准。
- `GET /v1/chat/events` 只负责同一 active run 后续增量续订。
- 文案统一是“当前正在运行”，不要写回“上一轮仍在运行”。

---

## 7. 执行节奏

每一阶段都按这个节奏：

1. 读当前函数和调用点。
2. 先找出旧逻辑边界，不急着搬。
3. 创建一个新 controller 文件。
4. 只移动一组职责。
5. 保持函数名和行为尽量不变。
6. 在 `playground.ts` 中只留下组装、state 所有权和 controller 注入。
7. 跑类型检查和测试。
8. 重启 `ugk-pi`。
9. 用真实浏览器验收桌面和手机。
10. 更新 `docs/playground-current.md` 和 `docs/change-log.md`。
11. 小步提交。

不要一次拆多个 controller。一次拆多个看起来很爽，回归时会让人想把键盘合上。

---

## 8. 验证标准

### 8.1 每次源码改动后必须跑

```powershell
git diff --check
npx tsc --noEmit
node --test --import tsx test/server.test.ts
npm test
docker compose restart ugk-pi
curl.exe -s http://127.0.0.1:3000/healthz
```

Expected:

- `git diff --check` 无输出。
- `npx tsc --noEmit` exit code 0。
- `test/server.test.ts` 全部通过。
- `npm test` 全部通过。
- `/healthz` 返回 `{"ok":true}`。

不要并行跑 `node --test --import tsx test/server.test.ts` 和 `npm test`。之前并发测试触发过 SQLite `database is locked`，这不是玄学，是自己踩自己脚。

### 8.2 浏览器烟测

桌面视口建议：`1280x900`

必须检查：

- 页面能正常打开。
- 新会话按钮可用。
- 历史会话可见。
- 输入框自适应高度。
- 发送消息后有用户气泡和助手气泡。
- context usage 圆环可展开详情。
- 文件上传 / 资产库入口不报错。
- conn 管理器可打开。
- 全局活动可打开。

手机视口建议：`390x844`

必须检查：

- 顶部品牌栏正常。
- 左侧历史抽屉可打开/关闭。
- 右上更多菜单可打开/关闭。
- 新会话 icon 可用。
- composer 不遮挡最后一条消息。
- context usage 详情弹层可打开。

### 8.3 Conn 专项烟测

至少做一遍：

- 打开 conn 管理器。
- 查看已有 conn 列表。
- 打开一个 conn 详情。
- 点击立即执行。
- 新建会话后确认 toast / 全局活动能看到 run。
- 查看 run 详情，确认结果摘要不是 manifest 字段胡说八道。

如果要测试定时但不想等一天：

- 用“定时执行”设置当前时间后 1-2 分钟。
- 或用“间隔执行”设置首次执行时间为 1-2 分钟后，间隔设为很短的测试值。
- 不要为了测试直接改数据库时间，除非本轮目标就是后端 worker 排障。

---

## 9. 文档规则

任何影响外部行为、运行方式、接口、文档结构或协作约定的改动，必须同步更新：

- `docs/playground-current.md`
- `docs/change-log.md`

`docs/change-log.md` 至少写：

- 日期。
- 改动主题。
- 影响范围。
- 对应源码或文档入口。

如果只是本文件这种交接计划，不必更新 `docs/change-log.md`，因为没有改变运行行为。

---

## 10. 不要踩的坑

- 不要改 `references/pi-mono/`，它是官方参考镜像，不是业务源码。
- 不要清 `.data/`，不要删除用户的 conn / session / asset 数据。用户说过测试 conn 可以自己删。
- 不要把 conn 的目标理解成“当前打开哪个会话就投哪里”。conn 创建/编辑时的绑定是运行事实，全局活动是观察层。
- 不要把 controller 写成浏览器 ES module。当前是 server-rendered inline classic script，共享同一个作用域。
- 不要把 `contextUsage` state 强行全部搬走。先保持主 state ownership。
- 不要用“页面 HTML 里有某个字符串”证明修复完成。要真实打开页面操作。
- 不要恢复复杂的 conn 调度选项。用户已经把它砍成三类，这是正确产品判断。
- 不要把复制正文按钮改回可见文字按钮。现有口径是小型灰色裸 icon，文字只保留在 `aria-label` / 隐藏文本。
- PowerShell 偶尔会有 shell profile / oh-my-posh 的权限噪声；非任务失败不要误判。必要时命令用 `login:false`。

---

## 11. 建议给下一位 agent 的第一轮操作

```powershell
git status --short
git log --oneline -8
Get-Content -Path AGENTS.md -TotalCount 220
Get-Content -Path docs/playground-current.md -TotalCount 260
Get-Content -Path src/ui/playground.ts -TotalCount 260
```

然后不要马上改。先在 `src/ui/playground.ts` 中定位 mobile shell 相关函数和 DOM refs：

```powershell
Select-String -Path src/ui/playground.ts -Pattern "mobile|drawer|overflow|more|conversation"
```

如果确认下一刀是 Phase 1，创建：

- `src/ui/playground-mobile-shell-controller.ts`

并在 `src/ui/playground.ts` 中按当前已有 controller 注入方式接入。

---

## 12. 完成定义

下一位 agent 做完任一 phase 后，必须满足：

- 功能行为不倒退。
- `src/ui/playground.ts` 行数下降，且职责更清晰。
- 新 controller 文件职责单一，没有把主文件的混乱原样搬家。
- `docs/playground-current.md` 反映当前真实 UI。
- `docs/change-log.md` 有更新记录。
- 测试和浏览器烟测通过。
- 提交已完成，必要时推送到 GitHub。

---

## 13. 当前交接结论

现在最适合继续做的不是新增 conn 大功能，而是继续拆 `playground` 运行时。功能已经够多，结构再不治理，后面每个小按钮都会变成一次考古。

推荐下一位 agent 从 Phase 1 的 mobile shell controller 开始。这个切口收益清楚、风险可控、回归路径短。等 mobile shell 和 conversation catalog 拆干净后，再碰 transcript 和 stream lifecycle。

如果用户要求直接执行本计划，使用：

```text
$do-plan .codex/plans/2026-04-22-playground-runtime-split-handoff-plan.md
```
