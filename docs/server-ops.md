# Server Ops

这是服务器更新的唯一入口。以后不要再从聊天记录、旧部署手册或上一次终端历史里复制一串命令，那种操作看起来快，实际是在给下一轮排障续命。

## 固定边界

- 代码目录只放 Git 工作树：腾讯云 `~/ugk-claw-repo`，阿里云 `/root/ugk-claw-repo`
- 运行态统一放 shared：腾讯云 `~/ugk-claw-shared`，阿里云 `/root/ugk-claw-shared`
- 用户 skills 属于运行态，不属于 clean Git 工作树：
  - 腾讯云：`~/ugk-claw-shared/runtime/skills-user`
  - 阿里云：`/root/ugk-claw-shared/runtime/skills-user`
- 生产 compose 必须通过 `UGK_RUNTIME_SKILLS_USER_DIR` 把 shared skills 挂到容器 `/app/runtime/skills-user`
- 禁止把 `.env`、`.data`、skills、Chrome profile、日志、临时 tar 包当作代码发布内容
- 标准 SSH 入口使用本机别名：腾讯云 `ugk-claw-prod`，阿里云 `ugk-claw-aliyun`。`scripts/server-ops.mjs` 固定走这两个 alias；不要再让发布脚本裸连 IP 后卡在密码交互里，太原始。

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
- `docker compose config --quiet`
- 容器状态
- 容器内 `/app/.data/agent` 是否是可写挂载
- `WEB_ACCESS_BROWSER_PROVIDER` 是否为 `direct_cdp`
- sidecar 本机 `127.0.0.1:9222/json/version` 是否可达
- app 容器到 `172.31.250.10:9223/json/version` 是否可达
- 内网 `/healthz`
- 公网 `/healthz`
- 容器内 `/app/runtime/skills-user` 的真实技能清单
- `GET /v1/debug/skills` 是否能返回技能注册表
- `GET /v1/debug/runtime` 是否能通过运行时目录和关键公开配置检查

## 异常处理

`/healthz` 只回答“app 进程是否活着”。`/v1/debug/runtime` 回答“运行态是否像生产应该有的样子”：包括 agent data、session、skills、conn SQLite 目录和公开 URL / browser provider 这类非敏感配置。只看 `/healthz` 就宣布发布成功，基本等于只摸了下服务器还有脉搏，离体检还差得远。

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

如果 web-access 或 sidecar 异常，优先跑脚本自带的 CDP 检查。`/healthz` 只能证明 app 进程活着，不能证明 Chrome sidecar、CDP 转发、shared data 和 skills 都在正确位置。把 `200` 当全身健康证明，这种偷懒很快会反噬。

## 详细手册

- 高频速查：[server-ops-quick-reference.md](./server-ops-quick-reference.md)
- 腾讯云历史与部署事实：[tencent-cloud-singapore-deploy.md](./tencent-cloud-singapore-deploy.md)
- 阿里云历史与部署事实：[aliyun-ecs-deploy.md](./aliyun-ecs-deploy.md)
