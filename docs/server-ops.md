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
- `docker compose config --quiet`
- 容器状态
- 内网 `/healthz`
- 公网 `/healthz`
- 容器内 `/app/runtime/skills-user` 的真实技能清单
- `GET /v1/debug/skills` 是否能返回技能注册表

## 异常处理

如果脚本提示远端工作树是 dirty，先停，不要 `git reset --hard`。把远端 diff 或文件备份到 shared backups，再判断是生产热修、运行态误入仓库，还是应该正式回收入库的代码改动。

如果公网 `/healthz` 失败但 app 容器内健康，优先重启 nginx。nginx 对 upstream 的解析在 app 容器重建后容易卡旧状态，这个坑已经出现过太多次，别继续装没见过。

如果 skills 清单异常，先查 shared skills 和 compose env：

```bash
grep -n '^UGK_RUNTIME_SKILLS_USER_DIR=' ~/ugk-claw-shared/compose.env
find ~/ugk-claw-shared/runtime/skills-user -maxdepth 2 -name SKILL.md -printf '%h\n' | sort
```

阿里云把路径换成 `/root/ugk-claw-shared/...`。

## 详细手册

- 高频速查：[server-ops-quick-reference.md](./server-ops-quick-reference.md)
- 腾讯云历史与部署事实：[tencent-cloud-singapore-deploy.md](./tencent-cloud-singapore-deploy.md)
- 阿里云历史与部署事实：[aliyun-ecs-deploy.md](./aliyun-ecs-deploy.md)
