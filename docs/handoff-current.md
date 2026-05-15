# 当前交接快照

更新时间：`2026-05-15`

这份文档给新接手 `ugk-pi / UGK CLAW` 的同事或 coding agent 看。先读这里，再按任务类型展开其他文档。不要靠聊天记录拼现状，聊天记录容易把历史事实和当前事实搅成一锅。

## 给新接手者的第一条消息

可以直接把下面这段发给同事：

```text
请接手 `E:\AII\ugk-pi`。你维护的是 ugk-pi 代码仓库，不是产品运行时 Playground agent。

开始前先读 `CLAUDE.md`、`docs/handoff-current.md`。如果要跑本地，只用 Docker：`docker compose up -d` 或 `docker compose restart ugk-pi`，标准入口是 `http://127.0.0.1:3000/playground`，健康检查是 `http://127.0.0.1:3000/healthz`。不要把宿主机 `npm start` / `npm run dev` 当正规入口。

开始前执行 `git status --short` 和 `git log -1 --oneline`。截至本交接更新，本地最新提交为 `a2d962c team: remove submit tool mechanism, use JSON envelope output`，工作区应为干净；如果现场不一致，先查清楚是谁的新改动，不要直接回滚。当前生产发布点仍以服务器 `git log -1 --oneline` 为准；本地新提交不要默认已经上线。

服务器发布默认走增量更新。腾讯云拉 GitHub `origin/main`，阿里云拉 Gitee `gitee/main`。不要整目录覆盖，不要删除 shared 运行态，不要提交 `.env`、`.data/`、Chrome profile、runtime 临时产物或本地截图。
```

## 当前状态

- 当前本地 HEAD：以 `git log -1 --oneline` 为准（本轮提交后更新）
- 当前本地工作区：本快照更新时 `git status --short` 干净
- 当前 `origin/main` / `gitee/main`：以现场 `git branch -vv` 和远端状态为准；不要假设本地 `a2d962c` 已推送或已部署
- 当前稳定 tag：`snapshot-20260513-v4.5.0-stable`（在最近 7 个 team 提交之前）
- 本轮最新功能（2026-05-14 ~ 2026-05-15，共 7 个提交）：

### 核心架构变更：移除 Submit Tool 机制

这是最近最重要的变更。原来的 Team Runtime 让 agent 通过结构化 tool call（submitCandidateDomain、submitDomainEvidence 等）提交结果。实测发现 submit tool 消耗了 LLM 的注意力预算，"同样的 agent 在对话式表现更好"。

**改动**：所有 Agent profile 绑定的角色现在走"自然输出 + JSON envelope"路径——agent 跑完后一次性输出 JSON，不再有 realtime submit。

**影响文件**：
- `src/team/agent-profile-team-role-task-runner.ts`：移除 submit tool 注入，删除 `buildAgentSubmitPrompt` 和 `buildTeamSubmitToolDefinitions`，各角色（discovery/evidence/classifier/reviewer）用 `team-role-prompts.ts` 的基础 prompt + roleBox
- `src/team/role-box.ts`：CONTRACT 文本从 "submit tools" 改为 "JSON envelope output instructions"；`submitTools` 字段保留供 LLM runner 路径使用
- `src/team/team-orchestrator.ts`：删除 `createSubmitToolHandler`，`runTaskWithTimeout` 简化为直接调用 `runner.runTask(task)`，`runTaskWithoutRoleTimeout` 同理；`shouldRunRoleInBackground` 不再检查 `runTaskWithSubmitToolHandler`

**未改动的**：`src/team/team-submit.ts`、`src/team/team-submit-tools.ts`、`src/team/llm-tool-loop.ts` 保留供 LLM runner 路径使用，agent profile 路径不再调用它们。

### Pipeline 并行执行

原来的 while 循环里角色串行执行（for + await），改为 `Promise.all` 并行——只要手上有未处理的数据就可以干活。配合 `freshState` 每轮从磁盘重读状态，解决了 background task 完成后 in-memory state 不更新的 bug。

### 其他功能补充

- **Team Run 手动取消**：`POST /v1/team/runs/:teamRunId/cancel`，页面有取消按钮
- **Dockerfile 补 dnsutils**：容器内可使用 dig、nslookup
- **Team 页面角色卡**：每个角色可选择 Agent profile、编辑 role prompt
- **Discovery 专业调查员 prompt**：自动规划发现路径（搜索、CT、DNS、TLD 等）

## 已知问题（2026-05-15）

### 1. Classifier 频繁 JSON 解析失败

最近一次运行 `teamrun_mp666loj_k629` 中，classifier 角色出现大量 `"Agent profile runner returned non-JSON output: JSON repair failed"` 错误（`failedRoleTasks: 13`）。

**原因分析**：Agent 没有按 JSON envelope 格式输出，可能输出了自然语言文本。`parseAgentJsonEnvelope` 在 `stripMarkdownFence` + `JSON.parse` + `repairJson` 全部失败后返回 failed。

**建议修复方向**：
- 加强 classifier prompt 的 JSON 格式约束
- 考虑在 `parseAgentJsonEnvelope` 中增加更宽松的提取逻辑（比如从文本中查找 `{` 到 `}` 的 JSON 块）
- 检查 agent profile 的 model 和 system prompt 是否与 JSON 输出兼容

### 2. Discovery Round 2 可能卡住

Discovery 绑定 Agent profile 后作为 background task 运行。移除 submit tool 后，heartbeat 机制仅依赖 session 文件 mtime。如果 agent 在长时间 API 调用中不写 session 文件，watchdog 可能误判为活跃（靠 mtime）或误判为超时（靠 heartbeat）。

**建议**：考虑在 `runBackgroundRoleTask` 中增加定期 heartbeat 更新，或者依赖 `getRoleTaskSessionActivityTime` 就够了但需要确认 agent 运行时确实会持续写 session。

### 3. 超预算未停止

`maxMinutes: 20` 的 run 实际跑了 38 分钟仍为 running。Discovery 的 session 文件持续更新让 watchdog 认为它仍然活跃。

### 4. Counters 与 Stream 不一致

state.json 中 `candidateDomains: 10` 但实际 stream 文件有 17 条。可能是并发 tick 之间的 race condition。

## 生产部署状态

腾讯云：

- Playground：`http://43.156.19.100:3000/playground`
- Health：`http://43.156.19.100:3000/healthz`
- 主部署目录：`/home/ubuntu/ugk-claw-repo`
- shared 运行态：`/home/ubuntu/ugk-claw-shared`
- 更新方式：`npm run server:ops -- tencent preflight|deploy|verify`
- 当前已知部署点：`2090fa4 Improve conn UX and mobile home scrolling`（本轮 team 提交均未部署）

阿里云：

- Playground：`http://101.37.209.54:3000/playground`
- Health：`http://101.37.209.54:3000/healthz`
- 主部署目录：`/root/ugk-claw-repo`
- shared 运行态：`/root/ugk-claw-shared`
- 更新方式：`npm run server:ops -- aliyun preflight|deploy|verify`
- 当前已知部署点：`2090fa4 Improve conn UX and mobile home scrolling`（本轮 team 提交均未部署）

发布禁区：

- 不要 `git reset --hard`
- 不要整目录覆盖服务器仓库
- 不要删除或重建 shared 运行态
- 不要执行 `docker compose down -v`
- 不要把本地 Chrome profile 复制到服务器
- 不要提交 `.env`、token、cookie、`.data/`、部署包、runtime 临时文件

## 最小阅读顺序

继续开发 Team Runtime：

1. `CLAUDE.md`（Team Runtime 章节）
2. `docs/team-runtime.md`
3. `src/team/team-orchestrator.ts` — 调度核心
4. `src/team/agent-profile-team-role-task-runner.ts` — Agent profile 角色执行器
5. `src/team/team-role-prompts.ts` — 各角色基础 prompt
6. `src/team/role-box.ts` — 角色契约包装
7. `src/team/templates/brand-domain-discovery.ts` — 域名调查模板（角色定义、stream、finalize）
8. `src/ui/team-page.ts` — Team 页面 UI
9. `src/routes/team.ts` — Team API 路由

普通 bugfix / 小功能：

1. `CLAUDE.md`
2. `docs/handoff-current.md`
3. 按模块读 CLAUDE.md 中列出的对应文档

Playground / UI：

1. `docs/playground-current.md`
2. `DESIGN.md`
3. `src/ui/playground.ts`

Conn / 后台任务 / artifact：

1. `docs/runtime-assets-conn-feishu.md`
2. `src/routes/conns.ts`

本地 Docker / 端口 / 运行态：

1. `docs/docker-local-ops.md`
2. `docker-compose.yml`

服务器发布：

1. `docs/server-ops.md`
2. `docs/server-ops-quick-reference.md`

## 当前关键事实

- 本地固定入口：`http://127.0.0.1:3000/playground`
- 本地健康检查：`http://127.0.0.1:3000/healthz`
- 默认本地启动：`docker compose up -d`
- 常规代码改动后优先：`docker compose restart ugk-pi`
- Team worker 改动后：`docker compose restart ugk-pi-team-worker`
- 涉及 Dockerfile、系统依赖或 compose 结构时才 `up --build -d`
- 双云默认发布方式是增量更新，腾讯云拉 `origin/main`，阿里云拉 `gitee/main`
- Agent profile 运行时列表以 `GET /v1/agents` 为准
- 不要手写 `.data/agents/profiles.json` 来创建、归档或修复 Agent
- 模型源当前事实看 `docs/model-providers.md` 和 `/v1/model-config`
- Chrome sidecar 登录态在 shared 运行态目录，不能被部署流程洗掉
- `TEAM_RUNTIME_ENABLED=true` 才会注册 team 路由和启动 worker
- Team worker 是独立容器 `ugk-pi-team-worker`，与主服务器 `ugk-pi` 分开重启
- 所有 `.js` 扩展名 import 是 ESM 规范（`"type": "module"`），不是笔误

## 暂时不要做

- 不要继续无目标拆 `AgentService`；当前结构已经按可测边界拆过一轮
- 不要把手机端 Playground 当桌面端压缩版改
- 不要把 Feishu 当当前主线推进，除非用户重新明确要求
- 不要动 `references/pi-mono/`，那是参考镜像，不是业务源码
- 不要动 `src/team-lab/`，那是已验证的 spike 实验，冻结
- 不要把 `.data/`、`.env`、runtime 临时产物、截图报告、部署包提交进仓库

## 推荐下一步

### 优先级 1：修复 Classifier JSON 输出质量

这是当前最大的阻塞问题。Classifier 频繁输出无法解析的文本而不是 JSON envelope。建议：
1. 抓一次 classifier 失败时的 rawOutput 看具体输出了什么
2. 对应加强 prompt 约束或换更听话的模型
3. `parseAgentJsonEnvelope` 可能需要更鲁棒的提取逻辑

### 优先级 2：Discovery 超时治理

Discovery background task 可能卡住但 watchdog 无法检测。需要确认 session 文件更新频率，或增加显式 heartbeat。

### 优先级 3：推送到远端并部署

当前 7 个本地提交未推送也未部署。确认问题修复后：
```bash
git push && git push gitee main
npm run server:ops -- tencent preflight
npm run server:ops -- tencent deploy
npm run server:ops -- aliyun preflight
npm run server:ops -- aliyun deploy
```

## 最近验证记录

- `git status --short`：提交后应为干净
- `npx tsc --noEmit`：通过（0 错误）
- `docker compose restart ugk-pi ugk-pi-team-worker`：已执行
- 最近测试 run：`teamrun_mp666loj_k629`（keyword: medtrum），暴露了 classifier JSON 失败和 discovery 卡住问题

## 交接操作清单

需要给同事准备：

- GitHub 仓库权限：`https://github.com/mhgd3250905/ugk-claw-personal.git`
- Gitee 仓库权限：用于阿里云默认拉取 `gitee/main`
- 腾讯云 SSH 权限：`ugk-claw-prod` 或 `ubuntu@43.156.19.100`
- 阿里云 SSH 权限：`root@101.37.209.54`
- 服务器 shared 运行态说明：只能保护，不能覆盖
- 本地 `.env` 获取渠道：不要通过 Git 传
- Chrome sidecar 登录态维护方式：通过 sidecar GUI / SSH tunnel，不开放公网 `3901`
