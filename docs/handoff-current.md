# 当前交接总览

更新时间：`2026-04-26`

这份文档给下一位接手 `ugk-pi / UGK CLAW` 的 agent 看。先读这里，再读 `AGENTS.md` 和追溯地图。别靠聊天记录拼现状，聊天记录会骗人，仓库里的事实比较不会装。

## 当前结论

- 代码主仓库：`https://github.com/mhgd3250905/ugk-claw-personal.git`
- 主分支：`main`
- 上一轮架构整理代码落点：`524fb71 Extract assistant run result checks`
- 本轮架构整理前备份 tag：`backup-pre-architecture-cleanup-20260426`
- 云端正式入口：`http://43.134.167.179:3000/playground`
- 云端健康检查：`http://43.134.167.179:3000/healthz`
- 服务器主部署目录：`~/ugk-claw-repo`
- shared 运行态目录：`~/ugk-claw-shared`
- 服务器更新方式：默认且本次明确为“增量更新”，不要整目录替换
- 当前未跟踪 runtime 文件不要顺手提交：`runtime/commit-playground-asset-detail-hydration.ps1`、`runtime/pudong-weather.md`、`runtime/zhihu-collection-ai-agent-summary.md`

## 最近已完成

这一轮已经完成一批“低风险、小切片、可测试”的整理，核心目标是减少胖文件和隐性坏数据风险：

- 路由 parser / presenter / SSE helper 拆分：chat、conn、activity、notification、files。
- `AgentService` 继续瘦身：会话 catalog、context loading、session lifecycle、run scope、run result、terminal snapshot、event buffering 等逻辑已经拆到独立 helper。
- playground 运行时代码继续模块化：page shell、base styles、status、notification、confirm dialog、panel focus、conversation API / sync / state / history pagination / process controller、active run normalizer。
- conn run 租约防护：过期 worker 不能迟到写入终态、runtime metadata、events 或 output files。
- 数据索引读边界加固：`ConversationStore`、`AssetStore`、session JSONL 全量读取都已经补回归测试，坏索引 / 坏 JSONL 行不会直接拖垮页面恢复。
- 资产库并发写入、会话索引写入、Feishu map 并发写入都已有串行队列和原子替换防护。注意：Feishu 后续现阶段不继续做。

关键提交从 `backup-pre-architecture-cleanup-20260426` 到 `524fb71` 可查：

```bash
git log --oneline backup-pre-architecture-cleanup-20260426..HEAD
```

## 当前测试状态

最近一轮完整验证口径：

- `git diff --check`
- `npx tsc --noEmit`
- `npm test`

截至最近一次全量测试，测试总数为 `390`，通过 `388`，跳过 `2`。下一个 agent 不要把 `test.skip` 当不存在，它们就是明晃晃的待判断债。

## 下一步建议

### 1. 处理两个 `test.skip`

优先级最高。先判断这两个 skipped 是旧行为过时、测试应删除，还是现有能力缺口。不要为了“看起来全绿”机械取消 skip，测试不是许愿池。

重点入口：
- [test/agent-service.test.ts](/E:/AII/ugk-pi/test/agent-service.test.ts)
- [src/agent/agent-service.ts](/E:/AII/ugk-pi/src/agent/agent-service.ts)
- [src/agent/agent-conversation-catalog.ts](/E:/AII/ugk-pi/src/agent/agent-conversation-catalog.ts)

### 2. 继续扫 SQLite / JSON 字段边界

优先看非 Feishu 区域：
- [src/agent/agent-activity-store.ts](/E:/AII/ugk-pi/src/agent/agent-activity-store.ts)
- [src/agent/conversation-notification-store.ts](/E:/AII/ugk-pi/src/agent/conversation-notification-store.ts)
- [src/agent/conn-sqlite-store.ts](/E:/AII/ugk-pi/src/agent/conn-sqlite-store.ts)
- [src/agent/conn-run-store.ts](/E:/AII/ugk-pi/src/agent/conn-run-store.ts)

检查点：
- JSON 字段解析失败时是否会拖垮列表或详情。
- 重复投递 / 重复 run 是否有真实唯一约束或幂等防护。
- 分页排序是否有稳定 tie-breaker。
- 删除 conn / conversation 后是否还会留下脏引用。

### 3. 继续拆 `AgentService` 剩余编排代码

不要为了拆而拆。只拆能让行为更可测、职责更清晰的片段。优先选择有纯函数边界、能补单测的 helper。已经拆过的模块不要重复造第二套名字。

### 4. 文档整理只做事实校准

当前文档体系已经很重，后续不要再新增散落文档。优先更新：
- [docs/handoff-current.md](/E:/AII/ugk-pi/docs/handoff-current.md)
- [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
- [docs/change-log.md](/E:/AII/ugk-pi/docs/change-log.md)
- [docs/server-ops-quick-reference.md](/E:/AII/ugk-pi/docs/server-ops-quick-reference.md)
- [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)

如果只是代码内部小重构、外部行为不变，可以不写长篇发布故事；但影响运行口径、部署、接口、用户体验或接手路径时，必须更新 `docs/change-log.md`。

## 暂时不要做

- 不要继续推进 Feishu 业务闭环。用户已经明确：现阶段飞书部分可以跳过。
- 不要整目录替换服务器目录。
- 不要动 `references/pi-mono/`，那是参考镜像，不是业务源码。
- 不要把 `.data/`、`.env`、部署 tar 包、截图报告、runtime 临时产物提交进仓库。
- 不要为了“优化”把已稳定的 playground 手机端又改成桌面压缩版。

## 发布口径

本次用户已经明确要求服务器“增量更新”。标准流程：

1. 本地确认工作区，只提交本轮文档 / 代码改动。
2. 本地跑 `git diff --check`、`npx tsc --noEmit`、`npm test`。
3. 提交并推送 `main` 到 GitHub。
4. 服务器进入 `~/ugk-claw-repo`。
5. 备份 sidecar 登录态到 `~/ugk-claw-shared/backups/`。
6. 给服务器旧 `HEAD` 打 `server-pre-deploy-*` 本地 tag。
7. `git fetch --tags origin`。
8. `git pull --ff-only origin main`。
9. `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml config --quiet`。
10. `docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml up --build -d`。
11. 验收内外网 `/healthz`、`/playground`、compose 状态和 `check-deps.mjs`。

生产 shared 状态不能洗：
- `~/ugk-claw-shared/.data/agent`
- `~/ugk-claw-shared/.data/chrome-sidecar`
- `~/ugk-claw-shared/app.env`
- `~/ugk-claw-shared/compose.env`
- `~/ugk-claw-shared/logs`

## 阅读顺序

1. [AGENTS.md](/E:/AII/ugk-pi/AGENTS.md)
2. [README.md](/E:/AII/ugk-pi/README.md)
3. [docs/traceability-map.md](/E:/AII/ugk-pi/docs/traceability-map.md)
4. [docs/playground-current.md](/E:/AII/ugk-pi/docs/playground-current.md)
5. [docs/runtime-assets-conn-feishu.md](/E:/AII/ugk-pi/docs/runtime-assets-conn-feishu.md)
6. [docs/server-ops-quick-reference.md](/E:/AII/ugk-pi/docs/server-ops-quick-reference.md)
7. [docs/tencent-cloud-singapore-deploy.md](/E:/AII/ugk-pi/docs/tencent-cloud-singapore-deploy.md)
8. [docs/change-log.md](/E:/AII/ugk-pi/docs/change-log.md)
