# Team Runtime 下一阶段交接

日期：2026-05-14  
接手目标：继续开发 Team Runtime，重点提升角色运行可观测性、任务取消能力、Discovery 质量和模板化角色配置。

## 当前状态

- 本地最新提交：`ce620bb Add Team role profiles and editable prompts`
- 本地工作区：本交接生成前已确认干净；生成本交接后会有本文件和 `docs/handoff-current.md` 的新改动，需要单独提交
- 已完成阶段：
  - Team 全角色支持绑定 Agent profile
  - Team role 执行继承 Agent profile 的模型源、skills、规则文件和默认 Chrome
  - `/playground/team` 左侧改为基础创建表单 + Runs，右侧按模板动态渲染角色卡
  - 每个角色卡可选 Agent profile，并可编辑 role prompt
  - `POST /v1/team/runs` 支持 `roleProfileIds` 和 `rolePromptOverrides`
  - Discovery profile task 后台运行，提交 candidate 后下游可立即逐条接力
  - Evidence / Classifier / Reviewer 单条上游 item 推进，事件里带 `consumes`
  - Discovery 默认 prompt 升级为“专业域名调查员”：用户不需要知道 `crt.sh` / CT logs / DNS / regional TLD 等具体方法，Discovery 要自己规划公开线索调查路径
  - `docs/team-runtime.md` 和 `docs/change-log.md` 已记录上述行为

## 当前运行态

- 当前本地 Docker 服务已启动并重启过 `ugk-pi` / `ugk-pi-team-worker`
- 当前仍有一条本地测试 Team run 可观察：
  - `teamrun_mp5kt5db_8mir`
  - 最近查询状态：`running`
  - 最近计数约为：`candidateDomains=23`、`domainEvidence=10`、`classifications=10`、`reviewFindings=10`
  - 角色绑定：Discovery=`teamagent`，Evidence=`teamagent2`，Classifier/Reviewer/Finalizer=`teamagent3`
- 如果继续观测，先查：
  - `GET http://127.0.0.1:3000/v1/team/runs/teamrun_mp5kt5db_8mir`
  - `GET http://127.0.0.1:3000/v1/team/runs/teamrun_mp5kt5db_8mir/events`
  - `docker compose logs --tail=120 ugk-pi-team-worker`

## 关键文件

- Team 页面：`src/ui/team-page.ts`
- Team API：`src/routes/team.ts`
- 模板和角色声明：`src/team/templates/brand-domain-discovery.ts`
- 调度核心：`src/team/team-orchestrator.ts`
- Agent profile role runner：`src/team/agent-profile-team-role-task-runner.ts`
- 默认 LLM runner：`src/team/team-role-task-runner.ts`
- Role prompts：`src/team/team-role-prompts.ts`
- 类型：`src/team/types.ts`
- 运行文档：`docs/team-runtime.md`
- 变更记录：`docs/change-log.md`

## 验证记录

`ce620bb` 提交前已通过：

- `node --test --import tsx test/team-page-ui.test.ts test/team-routes.test.ts test/team-orchestrator.test.ts test/team-agent-profile-role-task-runner.test.ts test/team-role-task-runner.test.ts`
- `node --test --import tsx test/team-agent-profile-role-task-runner.test.ts test/team-role-task-runner.test.ts test/team-template-brand-domain.test.ts test/team-page-ui.test.ts`
- `npx tsc --noEmit`
- `npm run test:team`（136 pass / 0 fail）
- `git diff --check`
- `docker compose restart ugk-pi ugk-pi-team-worker`
- `GET /healthz`
- `GET /v1/team/templates`
- `/playground/team` HTML 标记检查

## 已知问题

- 当前缺少正式的 Team run cancel / force-stop API。之前手动取消 run 是直接停 worker + 改 `state.json`，这不是产品能力，别把它当最终方案。
- 页面缺少“所有角色当前活跃状态”面板。Discovery 有 `activeRoleTasks`，但 Evidence / Classifier / Reviewer 这种同步角色卡住时，用户只能感觉“很久没动”，体验很糟。
- `role_task_completed.data.emitCount` 对 Agent profile submit-tool 路径经常是 0，因为实际结果已经通过 submit tool 写入 stream。后续 UI 不应单靠 emitCount 判断角色产出。
- Discovery 新 prompt 只是提升模型自主规划能力，还没有内置固定 CT/DNS 工具。如果要稳定覆盖 `crt.sh`，下一阶段应考虑给 Discovery 增加可观测 discovery sources 或专用工具，而不是继续赌 prompt。
- Browser scope 映射之前观察到角色绑定浏览器未完全按预期落到用户选择的 Chrome，后续如果继续隔离 Chrome，需要重点验证 `resolveBackgroundBrowserId`、profile default browser 和 `WEB_ACCESS_BROWSER_INSTANCES`。
- `teamrun_mp5kt5db_8mir` 是运行态数据，不能提交 `.data/`。观察它即可，不要把它打包进 Git。

## 下一步建议

1. 给 Team Runtime 增加正式取消接口：
   - `POST /v1/team/runs/:id/cancel`
   - 写 `status=cancelled`、`finishedAt`、`stopSignals`
   - 清理或标记 active role task
   - 追加 `team_run_cancelled` 事件
   - worker tick 不再处理 cancelled run

2. 增加角色运行状态面板：
   - 当前正在处理的 role
   - 当前处理的 domain / itemId
   - profileId
   - startedAt / last activity
   - 最近 stream item 时间
   - 是否疑似 idle

3. 改进 round 可解释性：
   - 增加 `round_started` / `round_completed` 或至少在 Discovery 完成事件里记录 reason
   - 页面能解释“为什么第一轮结束、为什么进入第二轮”

4. 改进 Discovery source 设计：
   - 短期：继续优化默认 prompt
   - 中期：把 `certificate_transparency` / `crt.sh`、official links、DNS/subdomain、regional TLD、portal/login probes 做成可观测 discovery source
   - 长期：允许模板声明 recommended discovery channels，但保持 Agent 自主规划，不退回死清单脚本

5. 如果继续跑真实测试：
   - 新建 run 前确认右侧每个角色卡选中了正确 Agent profile
   - Discovery 用有 web-access / browser 能力的 profile
   - Evidence 用可联网 / 可浏览 profile
   - Classifier / Reviewer / Finalizer 可用轻模型，但要确认模型能稳定调用 submit tool

## 推荐技能

新 agent 继续开发时建议使用：

- `brainstorming`：修改 Team 行为或 UI 前，先约束需求，避免把用户想要的“Agent 自主能力”做成死流程
- `test-driven-development` 或 `tdd`：新增 cancel/status API 时先补测试
- `systematic-debugging`：排查 worker 卡住、browser profile 绑定错误、submit tool 未触发
- `feature-handoff`：每次阶段性保存前同步 `docs/change-log.md` 和相关 Team 文档

