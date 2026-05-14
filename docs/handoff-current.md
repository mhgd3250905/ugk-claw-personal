# 当前交接快照

更新时间：`2026-05-14`

这份文档给新接手 `ugk-pi / UGK CLAW` 的同事或 coding agent 看。先读这里，再按任务类型展开其他文档。不要靠聊天记录拼现状，聊天记录容易把历史事实和当前事实搅成一锅。

## 给新接手者的第一条消息

可以直接把下面这段发给同事：

```text
请接手 `E:\AII\ugk-pi`。你维护的是 ugk-pi 代码仓库，不是产品运行时 Playground agent。

开始前先读 `AGENTS.md`、`docs/handoff-current.md`、`docs/traceability-map.md`。如果要跑本地，只用 Docker：`docker compose up -d` 或 `docker compose restart ugk-pi`，标准入口是 `http://127.0.0.1:3000/playground`，健康检查是 `http://127.0.0.1:3000/healthz`。不要把宿主机 `npm start` / `npm run dev` 当正规入口。

开始前执行 `git status --short` 和 `git log -1 --oneline`。截至本交接更新，本地 Team Runtime 阶段性改动已提交为 `ce620bb Add Team role profiles and editable prompts`，工作区应为干净；如果现场不一致，先查清楚是谁的新改动，不要直接回滚。当前生产发布点仍以服务器 `git log -1 --oneline` 为准；本地新提交不要默认已经上线。

服务器发布默认走增量更新。腾讯云拉 GitHub `origin/main`，阿里云拉 Gitee `gitee/main`。不要整目录覆盖，不要删除 shared 运行态，不要提交 `.env`、`.data/`、Chrome profile、runtime 临时产物或本地截图。
```

## 当前状态

- 当前本地 HEAD：`ce620bb Add Team role profiles and editable prompts`
- 当前本地工作区：本快照更新时 `git status --short` 干净
- 当前 `origin/main` / `gitee/main`：以现场 `git branch -vv` 和远端状态为准；不要假设本地 `ce620bb` 已推送或已部署
- 当前稳定 tag：已有 `snapshot-20260513-v4.5.0-stable`，但最新交接提交在该 tag 之后
- 本轮最新功能：
  - Team Runtime 已进入重点开发阶段。当前主线不是 Conn，也不是 Feishu，而是 `/playground/team`、Team role 调度、Agent profile 绑定、可观测运行状态和 domain discovery 质量
  - Team 全角色已可绑定 Agent profile：Discovery / Evidence / Classifier / Reviewer / Finalizer 都能继承对应 profile 的模型源、skills、规则文件和默认 Chrome；未绑定时仍走默认 Team LLM runner
  - `/playground/team` 左侧保留创建任务基础输入和 Runs 列表；右侧按模板动态渲染角色卡。每个角色卡可选择 Agent profile，也可编辑 role prompt。模板 `GET /v1/team/templates*` 会返回 `roles`
  - 创建 Team run 时支持 `roleProfileIds` 和 `rolePromptOverrides`；override 会传入角色任务，但默认 RoleBox、submit tool、allowed streams 和输出格式约束仍保留
  - Discovery 已升级为“专业域名调查员”默认 prompt：用户不需要知道 `crt.sh`、证书透明日志、DNS、区域 TLD、login / portal / app / support、docs、partners、social、app stores、code refs 等具体方法；Discovery 应自行规划路径，并结构化提交候选域名。使用证书透明日志时应标注 `sourceType: certificate_transparency`
  - 绑定 Agent profile 的 Discovery 作为后台活跃任务运行，使用 heartbeat / session JSONL 活跃度 watchdog，不再按启动后的固定墙钟时间直接判失败；它可以一边提交候选域名，一边让 Evidence 等下游逐条接力
  - Evidence / Classifier / Reviewer 已按单条上游 item 推进，便于页面观察每个角色正在处理哪个域名；`role_task_started.data.consumes` 记录 stream、itemId 和 domain
  - 当前仍缺一个正式的“任务取消 / 强制终止 API”和“所有角色活跃状态面板”。现在 Discovery 有 `activeRoleTasks`，但普通同步角色卡住时页面仍不够直观，这是下一阶段最该补的东西之一
  - 当前还有一条本地测试 run 在跑：`teamrun_mp5kt5db_8mir`。截至本快照查询，它状态为 `running`，计数约为 `candidateDomains=23`、`domainEvidence=10`、`classifications=10`、`reviewFindings=10`，角色绑定为 `teamagent` / `teamagent2` / `teamagent3`。如果新 agent 要继续观察，先查 `GET /v1/team/runs/teamrun_mp5kt5db_8mir` 和 events，不要猜
  - DeepSeek 当前已收口为项目统一模型源 `deepseek`，走 `https://api.deepseek.com/anthropic` / `anthropic-messages` / `DEEPSEEK_API_KEY`；Team Runtime、前台 chat 和 conn worker 都应消费同一套 registry/settings
  - 智谱 GLM 使用 `ZHIPU_GLM_API_KEY` + `authHeader: true`，不要再复用 `ANTHROPIC_AUTH_TOKEN`；`ANTHROPIC_AUTH_TOKEN` 不是多 provider 公共 key
  - `zhipu-api.txt`、`deepseek-api.txt`、`小米api.txt` 只允许作为本地临时说明；默认 `UGK_ALLOW_LOCAL_API_TXT_BOOTSTRAP=false`，正常 Docker / 生产不读取这些文件
  - Conn 后台 runner 已补 provider error 闸门：assistant `stopReason: "error"` 应写成 `failed`，不能再出现 401 却 `succeeded` 的假成功
  - 当前可见前端异步按钮补齐 pending 文案与禁用态，覆盖聊天追加 / 中断、文件库、任务消息、Agent 管理、Conn 管理等入口
  - `/playground/conn` 新建任务保存 / 取消修复，左侧任务卡片不再嵌套非法 button，表单底部增加明确保存 / 取消按钮，新建任务默认给出可保存的执行时间
  - Conn 列表排序改为“未读结果优先”，未读按最新未读 run 时间倒序，其余按运行中、暂停、已完成分组；运行中绿色、暂停橙黄、已完成灰色
  - 手机首页 Agent 卡片多时可滚动，滚到顶部能看到 UGK logo，避免 Agent 增多后撑出视口
  - 生产 artifact 交付链接保障已在上一提交收口，继续保持以 `PUBLIC_BASE_URL` 和 artifact 路由为准

## 生产部署状态

腾讯云：

- Playground：`http://43.156.19.100:3000/playground`
- Health：`http://43.156.19.100:3000/healthz`
- 主部署目录：`/home/ubuntu/ugk-claw-repo`
- shared 运行态：`/home/ubuntu/ugk-claw-shared`
- 更新方式：`npm run server:ops -- tencent preflight|deploy|verify`
- 当前已知部署点：`2090fa4 Improve conn UX and mobile home scrolling`
- 本轮发布状态：已执行 `preflight`、shared 运行态备份、`deploy`、`verify`
- 本轮备份位置：`/home/ubuntu/ugk-claw-shared/backups/pre-deploy-2090fa4-20260513-233453/shared-runtime.tgz`

阿里云：

- Playground：`http://101.37.209.54:3000/playground`
- Health：`http://101.37.209.54:3000/healthz`
- 主部署目录：`/root/ugk-claw-repo`
- shared 运行态：`/root/ugk-claw-shared`
- 更新方式：`npm run server:ops -- aliyun preflight|deploy|verify`
- 当前已知部署点：`2090fa4 Improve conn UX and mobile home scrolling`
- 本轮发布状态：已执行 `preflight`、shared 运行态备份、`deploy`、`verify`
- 本轮备份位置：`/root/ugk-claw-shared/backups/pre-deploy-2090fa4-20260513-233450/shared-runtime.tgz`

发布禁区：

- 不要 `git reset --hard`
- 不要整目录覆盖服务器仓库
- 不要删除或重建 shared 运行态
- 不要执行 `docker compose down -v`
- 不要把本地 Chrome profile 复制到服务器
- 不要提交 `.env`、token、cookie、`.data/`、部署包、runtime 临时文件

## 最小阅读顺序

继续开发 Team Runtime：

1. `docs/team-runtime.md`
2. `.codex/plans/2026-05-14-handoff-team-next-agent.md`
3. `.codex/plans/2026-05-14-handoff-team-realtime-submit.md`
4. `src/ui/team-page.ts`
5. `src/routes/team.ts`
6. `src/team/templates/brand-domain-discovery.ts`
7. `src/team/team-orchestrator.ts`
8. `src/team/agent-profile-team-role-task-runner.ts`
9. `src/team/team-role-task-runner.ts`
10. `test/team-orchestrator.test.ts`

普通 bugfix / 小功能：

1. `AGENTS.md`
2. `docs/handoff-current.md`
3. `docs/traceability-map.md`
4. 按模块读下面对应文档

Playground / UI：

1. `docs/playground-current.md`
2. `DESIGN.md`
3. `src/ui/playground.ts`
4. `src/ui/playground-page-shell.ts`
5. `src/ui/playground-styles.ts`

Conn / 后台任务 / artifact：

1. `docs/runtime-assets-conn-feishu.md`
2. `src/routes/conns.ts`
3. `src/routes/conn-route-presenters.ts`
4. `src/agent/conn-run-store.ts`
5. `src/workers/conn-worker.ts`

Agent profile / Agents 页面：

1. `src/routes/agent-profiles.ts`
2. `src/agent/agent-profile-catalog.ts`
3. `src/ui/agents-page.ts`
4. `src/ui/playground-agent-manager.ts`

本地 Docker / 端口 / 运行态：

1. `docs/docker-local-ops.md`
2. `docker-compose.yml`
3. `src/routes/runtime-debug.ts`

服务器发布：

1. `docs/server-ops.md`
2. `docs/server-ops-quick-reference.md`
3. `docs/tencent-cloud-singapore-deploy.md`
4. `docs/aliyun-ecs-deploy.md`

## 当前关键事实

- 本地固定入口：`http://127.0.0.1:3000/playground`
- 本地健康检查：`http://127.0.0.1:3000/healthz`
- 默认本地启动：`docker compose up -d`
- 常规代码改动后优先：`docker compose restart ugk-pi`
- 涉及 Dockerfile、系统依赖或 compose 结构时才 `up --build -d`
- 双云默认发布方式是增量更新，腾讯云拉 `origin/main`，阿里云拉 `gitee/main`
- Agent profile 运行时列表以 `GET /v1/agents` 为准
- 不要手写 `.data/agents/profiles.json` 来创建、归档或修复 Agent
- `conn` 后台任务产物标准出口是 workspace 的 `output/` 与 `artifact-public/`
- 模型源当前事实看 `docs/model-providers.md` 和 `/v1/model-config`；旧 change-log 里的 `deepseek-anthropic`、OpenAI-compatible DeepSeek 或 `ANTHROPIC_AUTH_TOKEN` 多源复用均是历史口径
- Chrome sidecar 登录态在 shared 运行态目录，不能被部署流程洗掉

## 最近验证记录

本轮本地与发布过程中已执行或确认：

- `git status --short`：提交后应为干净
- `git diff --check`：通过
- `npx tsc --noEmit`：通过
- `npm test`：最近一次全量本地验证为 866 passed
- DeepSeek / Team / Conn 状态传播相关验证：`npx tsc --noEmit` 通过；`node --test --import tsx test/background-agent-runner.test.ts test/agent-run-result.test.ts test/agent-service.test.ts` 通过；`node --test --import tsx test/background-agent-runner.test.ts test/config.test.ts test/model-config.test.ts test/team-llm-config.test.ts test/containerization.test.ts` 通过
- 手机视口真实验证：临时塞入 18 个 Agent 卡片，确认首页 logo 在 `scrollTop=0` 可见，Agent 列表可滚动
- 本地 Docker：已 `docker compose up --build -d ugk-pi`，并刷新 `/playground` runtime 资产
- 双云发布：腾讯云与阿里云均已增量更新到 `2090fa4`，并通过 `npm run server:ops -- tencent verify` / `npm run server:ops -- aliyun verify`
- 公网页面资源核验：两边 `/playground/styles.css` 与 `/playground/app.js` 均包含本轮移动首页滚动、Conn 未读排序和状态排序相关标记

如果新同事继续开发，不要只看字符串就宣称修复完成。改接口跑接口，改 UI 看真实页面，改部署跑 `preflight/deploy/verify`，这点别省，省了后面就会用线上事故补课。

## 交接给人的操作清单

需要给同事准备：

- GitHub 仓库权限：`https://github.com/mhgd3250905/ugk-claw-personal.git`
- Gitee 仓库权限：用于阿里云默认拉取 `gitee/main`
- 腾讯云 SSH 权限：`ugk-claw-prod` 或 `ubuntu@43.156.19.100`
- 阿里云 SSH 权限：`root@101.37.209.54`
- 服务器 shared 运行态说明：只能保护，不能覆盖
- 本地 `.env` 获取渠道：不要通过 Git 传
- Chrome sidecar 登录态维护方式：通过 sidecar GUI / SSH tunnel，不开放公网 `3901`

## 暂时不要做

- 不要继续无目标拆 `AgentService`；当前结构已经按可测边界拆过一轮，继续硬拆只会制造维护成本
- 不要把手机端 Playground 当桌面端压缩版改
- 不要把 Feishu 当当前主线推进，除非用户重新明确要求
- 不要动 `references/pi-mono/`，那是参考镜像，不是业务源码
- 不要把 `.data/`、`.env`、runtime 临时产物、截图报告、部署包提交进仓库

## 推荐下一步

新同事接手后的第一步不是写代码，而是做三件小事：

1. `git status --short`
2. `git log -1 --oneline`
3. 打开本地或服务器 `/healthz` 和 `/playground` 确认环境是真活的

确认完再动代码。先把地基摸清楚，别一上来就“优化一下”，这个项目已经吃过这种亏。
