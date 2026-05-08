# Server Ops

这是服务器更新的唯一入口。以后不要再从聊天记录、旧部署手册或上一次终端历史里复制一串命令，那种操作看起来快，实际是在给下一轮排障续命。

## 固定边界

- 代码目录只放 Git 工作树：腾讯云 `~/ugk-claw-repo`，阿里云 `/root/ugk-claw-repo`
- 运行态统一放 shared：腾讯云 `~/ugk-claw-shared`，阿里云 `/root/ugk-claw-shared`
- 用户 skills 属于运行态，不属于 clean Git 工作树：
  - 腾讯云：`~/ugk-claw-shared/runtime/skills-user`
  - 阿里云：`/root/ugk-claw-shared/runtime/skills-user`
- 生产 compose 必须通过 `UGK_RUNTIME_SKILLS_USER_DIR` 把 shared skills 挂到容器 `/app/runtime/skills-user`
- 多 Chrome 实例必须各自使用独立 config/profile 目录；`UGK_BROWSER_INSTANCES_JSON` 只登记 CDP/GUI 元数据，不负责复制登录态。现有 `UGK_BROWSER_CONFIG_DIR` 对应 `default`，不要让新增实例复用它。
- Web 里选择的默认 API 源 / 模型属于运行态，生产容器必须设置 `UGK_MODEL_SETTINGS_PATH=/app/.data/agent/model-settings.json`，让它落在 shared agent data 挂载里；仓库 `.pi/settings.json` 只做首次默认值
- 禁止把 `.env`、`.data`、skills、Chrome profile、日志、临时 tar 包当作代码发布内容
- 发布拉取远端由 `scripts/server-ops.mjs` 固定选择：腾讯云默认 `origin`，阿里云默认 `gitee`。阿里云不要再优先连 GitHub，国内网络下这属于浪费时间还增加失败面。
- 标准 SSH 入口使用本机别名：腾讯云 `ugk-claw-prod`，阿里云 `ugk-claw-aliyun`。`scripts/server-ops.mjs` 固定走这两个 alias；不要再让发布脚本裸连 IP 后卡在密码交互里，太原始。
- `scripts/server-ops.mjs deploy` 不会自动备份 shared 运行态；正式发布前必须手动备份 `.data/agent`、`.data/agents` 和 `runtime/skills-user` 到 shared `backups/`，再执行 `deploy`。别裸奔更新，尤其是刚处理过自定义 Agent 数据事故之后还裸奔，那就不是快，是莽。
- `scripts/server-ops.mjs deploy` 会在重建容器前做一次模型默认选择迁移：如果 shared 里还没有 `.data/agent/model-settings.json`，就从旧 `ugk-pi` 容器的 `/app/.pi/settings.json` 拷贝过去，避免第一次切换到运行态设置时把当前选择再丢一次。

## 推荐命令

先做只读检查：

```bash
npm run server:ops -- tencent preflight
npm run server:ops -- aliyun preflight
```

正式更新单台服务器：

```bash
npm run server:ops -- tencent deploy
npm run server:ops -- aliyun deploy
```

只做发布后验收：

```bash
npm run server:ops -- tencent verify
npm run server:ops -- aliyun verify
```

脚本会固定检查：

- 远端 Git 工作树是否干净
- `UGK_RUNTIME_SKILLS_USER_DIR` 是否指向 shared skills
- `UGK_AGENT_DATA_DIR` 是否指向 shared agent data
- `UGK_AGENTS_DATA_DIR` 是否指向 shared agent profile data
- `docker compose config --quiet`
- 容器状态
- 容器内 `/app/.data/agent` 是否是可写挂载
- 容器内 `/app/.data/agents` 是否是可写挂载
- app 与 conn worker 的 `UGK_MODEL_SETTINGS_PATH` 是否指向 `/app/.data/agent/model-settings.json`
- `WEB_ACCESS_BROWSER_PROVIDER` 是否为 `direct_cdp`
- `GET /v1/browsers` 是否至少返回 `default`，且 `default` 仍指向当前生产 CDP
- Chrome sidecar 容器是否真的有 Docker memory limit
- Chrome 实际进程命令行是否包含 `max-old-space-size=1536`
- sidecar 本机 `127.0.0.1:9222/json/version` 是否可达
- app 容器到 `172.31.250.10:9223/json/version` 是否可达
- 内网 `/healthz`
- 公网 `/healthz`
- 容器内 `/app/runtime/skills-user` 的真实技能清单
- `GET /v1/debug/skills` 是否能返回技能注册表
- `GET /v1/debug/runtime` 是否能通过运行时目录和关键公开配置检查

## 异常处理

`/healthz` 只回答“app 进程是否活着”。`/v1/debug/runtime` 回答“运行态是否像生产应该有的样子”：包括主 Agent data、自定义 agents data、session、skills、conn SQLite 目录和公开 URL / browser provider 这类非敏感配置。只看 `/healthz` 就宣布发布成功，基本等于只摸了下服务器还有脉搏，离体检还差得远。

如果脚本提示远端工作树是 dirty，先停，不要 `git reset --hard`。把远端 diff 或文件备份到 shared backups，再判断是生产热修、运行态误入仓库，还是应该正式回收入库的代码改动。

如果公网 `/healthz` 失败但 app 容器内健康，优先重启 nginx。nginx 对 upstream 的解析在 app 容器重建后容易卡旧状态，这个坑已经出现过太多次，别继续装没见过。

如果 skills 清单异常，先查 shared skills 和 compose env：

```bash
grep -n '^UGK_RUNTIME_SKILLS_USER_DIR=' ~/ugk-claw-shared/compose.env
find ~/ugk-claw-shared/runtime/skills-user -maxdepth 2 -name SKILL.md -printf '%h\n' | sort
```

阿里云把路径换成 `/root/ugk-claw-shared/...`。

如果历史会话、资产或 session 像是“更新后消失”，先查 agent data 挂载，别急着甩锅给浏览器刷新：

```bash
grep -n '^UGK_AGENT_DATA_DIR=' ~/ugk-claw-shared/compose.env
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T ugk-pi sh -lc "test -d /app/.data/agent && test -w /app/.data/agent"
```

如果自定义 Agent 更新后消失，先查独立 agent profile 挂载：

```bash
grep -n '^UGK_AGENTS_DATA_DIR=' ~/ugk-claw-shared/compose.env
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T ugk-pi sh -lc "test -d /app/.data/agents && test -w /app/.data/agents"
```

阿里云同样把 shared 路径换成 `/root/ugk-claw-shared/...`。自定义 agent profile 不在 `/app/.data/agent`，而在 `/app/.data/agents`；只挂主 Agent 数据会让重建容器时自定义 Agent 落进容器可写层，这种坑非常阴险。

如果 web-access 或 sidecar 异常，优先跑脚本自带的 CDP 检查。`/healthz` 只能证明 app 进程活着，不能证明 Chrome sidecar、CDP 转发、shared data 和 skills 都在正确位置。把 `200` 当全身健康证明，这种偷懒很快会反噬。

如果脚本提示 `browser memory limit` 或 `Chrome V8 old space limit` 失败，先查：

```bash
grep -n '^UGK_BROWSER_MEM_' ~/ugk-claw-shared/compose.env
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml ps -q ugk-pi-browser | xargs docker inspect --format '{{.HostConfig.Memory}}'
docker compose --env-file ~/ugk-claw-shared/compose.env -p ugk-pi-claw -f docker-compose.prod.yml exec -T ugk-pi-browser sh -lc "CHROME_PID=\$(pgrep -n -x google-chrome || pgrep -n -x chrome); tr '\0' ' ' < /proc/\$CHROME_PID/cmdline"
```

阿里云把 shared 路径换成 `/root/ugk-claw-shared/...`。如果 `HostConfig.Memory` 是 `0`，说明 compose memory limit 没真正应用；如果命令行没有 `max-old-space-size=1536`，说明某条 Chrome 启动路径漏改或容器还没重建。

## 详细手册

- 高频速查：[server-ops-quick-reference.md](./server-ops-quick-reference.md)
- 腾讯云历史与部署事实：[tencent-cloud-singapore-deploy.md](./tencent-cloud-singapore-deploy.md)
- 阿里云历史与部署事实：[aliyun-ecs-deploy.md](./aliyun-ecs-deploy.md)
