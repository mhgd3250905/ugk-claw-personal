# Team Runtime v0.1 — 交接文档

## 一句话概述

给定一个品牌关键词（如 "Medtrum"），系统自动搜索相关域名，判断每个域名是官方的、第三方的还是可疑的，最终生成调查报告。

## 项目当前状态

- 全部 **828 测试通过**，0 失败
- Docker 全服务运行正常（main server + 3 Chrome sidecars + conn-worker + feishu-worker + team-worker + SearXNG）
- Team Runtime 已用真实关键词验证通过

## 怎么跑起来

### Docker 一键启动

```bash
docker compose up -d
```

等 Chrome sidecar 健康检查通过后（约 30s），所有服务就绪。访问 `http://127.0.0.1:3000`。

### 跑测试

```bash
npm test                              # 全量测试（828 个）
npm run test:team                     # Team Runtime 模块测试（workspace, gate, orchestrator）
npx tsc --noEmit                      # 类型检查
```

## 怎么测试 Team Runtime

### 创建一个调查

```bash
curl -s -X POST http://127.0.0.1:3000/v1/team/runs \
  -H "Content-Type: application/json" \
  -d '{"keyword":"Medtrum","companyNames":["Medtrum","上海移宇科技"],"maxRounds":1}'
```

返回 `teamRunId`，worker 会自动处理。

### 查看结果

```bash
# 运行状态
curl -s http://127.0.0.1:3000/v1/team/runs/<RUN_ID> | jq .state.status

# 各 stream 数据量
curl -s http://127.0.0.1:3000/v1/team/runs/<RUN_ID>/streams/candidate_domains | jq '.items | length'
curl -s http://127.0.0.1:3000/v1/team/runs/<RUN_ID>/streams/domain_evidence | jq '.items | length'
curl -s http://127.0.0.1:3000/v1/team/runs/<RUN_ID>/streams/domain_classifications | jq '.items | length'
curl -s http://127.0.0.1:3000/v1/team/runs/<RUN_ID>/streams/review_findings | jq '.items | length'

# 最终报告
curl -s http://127.0.0.1:3000/v1/team/runs/<RUN_ID>/artifacts/final_report.md

# 事件日志
curl -s http://127.0.0.1:3000/v1/team/runs/<RUN_ID>/events | jq '.events[].eventType'

# Worker 日志
docker compose logs -f ugk-pi-team-worker
```

### API 一览

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/v1/team/healthz` | 健康检查 |
| POST | `/v1/team/runs` | 创建调查 run |
| GET | `/v1/team/runs` | 列出可运行的 run |
| GET | `/v1/team/runs/:id` | 查看状态和计划 |
| GET | `/v1/team/runs/:id/events` | 事件日志 |
| GET | `/v1/team/runs/:id/streams/:name` | 查看某个 stream 的数据 |
| GET | `/v1/team/runs/:id/artifacts/:name` | 下载产物（报告等） |

## 架构

```
POST /v1/team/runs {keyword: "Medtrum"}
         │
         ▼
  ┌─── team-worker (轮询) ───┐
  │                            │
  │  TeamOrchestrator.tick()   │
  │  ┌──────────────────────┐  │
  │  │ Discovery            │──┼──→ candidate_domains stream
  │  │ (SearXNG搜索 + LLM)  │  │     （发现的候选域名）
  │  └──────────────────────┘  │
  │  ┌──────────────────────┐  │
  │  │ Evidence Collector   │──┼──→ domain_evidence stream
  │  │ (LLM 分析域名特征)   │  │     （每个域名的证据）
  │  └──────────────────────┘  │
  │  ┌──────────────────────┐  │
  │  │ Classifier           │──┼──→ domain_classifications stream
  │  │ (LLM 分类)           │  │     （分类结果）
  │  └──────────────────────┘  │
  │  ┌──────────────────────┐  │
  │  │ Reviewer             │──┼──→ review_findings stream
  │  │ (LLM 独立审查)       │  │     （审核意见）
  │  └──────────────────────┘  │
  │  ┌──────────────────────┐  │
  │  │ Finalizer            │──┼──→ final_report.md
  │  │ (生成报告)           │  │     （最终报告）
  │  └──────────────────────┘  │
  └────────────────────────────┘
```

### 文件清单

| 文件 | 职责 |
|------|------|
| `src/team/types.ts` | 所有类型定义 |
| `src/team/team-orchestrator.ts` | 核心状态机，驱动 5 个角色 |
| `src/team/team-workspace.ts` | 文件系统持久化（JSON + JSONL） |
| `src/team/team-gate.ts` | payload 验证、角色权限、去重 |
| `src/team/team-role-task-runner.ts` | 三种 runner：mock / LLM / composite |
| `src/team/team-role-prompts.ts` | 4 个角色的 prompt 模板 |
| `src/team/team-plan-brand-domain.ts` | 创建调查计划和初始状态 |
| `src/team/team-config.ts` | 从环境变量读取配置 |
| `src/team/team-events.ts` | 事件类型定义 |
| `src/team/team-id.ts` | ID 生成器 |
| `src/team/llm.ts` | LLM 客户端（DeepSeek API） |
| `src/routes/team.ts` | HTTP API 路由 |
| `src/workers/team-worker.ts` | 后台 worker 进程 |
| `src/team-lab/` | **不要修改** — spike 实验代码 |

### 关键配置

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `TEAM_RUNTIME_ENABLED` | 无（false） | 必须设为 `"true"` 才启用 |
| `TEAM_REAL_ROLES` | 无（全 mock） | 逗号分隔，如 `discovery,evidence_collector,classifier,reviewer` |
| `TEAM_ROLE_TASK_TIMEOUT_MS` | 180000 | 单个角色任务超时（毫秒） |
| `TEAM_ROLE_TASK_MAX_RETRIES` | 1 | 失败重试次数 |
| `DEEPSEEK_API_KEY` | — | LLM API key |

### 数据目录

```
.data/team/
  runs/<teamRunId>/
    plan.json          # 调查计划
    state.json         # 运行状态（含 counters, budgets, stopSignals）
    events.jsonl       # 事件日志（每行一个 JSON）
    streams/
      candidate_domains.jsonl
      domain_evidence.jsonl
      domain_classifications.jsonl
      review_findings.jsonl
    cursors/
      evidence_collector_candidate_domains.json
      classifier_domain_evidence.json
      reviewer_domain_classifications.json
    artifacts/
      final_report.md
      candidate_domains.json
      domain_evidence.json
      domain_classifications.json
      review_report.json
```

## 已知局限（MVP）

1. **Evidence Collector 不做真实 HTTP/DNS/证书检查** — 只做域名分析，全部标记 `checked: false`
2. **单轮 Discovery 搜索覆盖率有限** — `maxRounds=1` 只跑 3 个查询
3. **无 UI 页面** — 只能通过 API 操作
4. **LLM 依赖 DeepSeek** — `src/team/llm.ts` 硬编码了 DeepSeek API 格式
5. **JSON 输出可能损坏** — DeepSeek 偶尔输出未转义的引号，`repairJson()` 做字符级修复

## 数据流示例（Medtrum 测试结果）

```
关键词: Medtrum, 公司: 上海移宇科技
                    │
Discovery ──────────┤ SearXNG 搜索 68 条结果
                    │ LLM 提取出 10 个候选域名
                    ▼
  medtrum.com (官方, 高置信度)
  medtrum.nl, medtrum.co.uk, medtrum.eu (各国站点)
  easyview.medtrum.eu, easyview.medtrum.fr (患者门户)
  onetrum.com (不明关联)
  medtrum.redycare.ch (合作伙伴)
  medtrum.ec, cz.medtrum.com
                    │
Evidence → Classifier → Reviewer → final_report.md
                    │
最终: 10 域名, 0 失败, 全部审核通过
```
