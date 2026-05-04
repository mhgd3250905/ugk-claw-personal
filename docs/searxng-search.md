# SearXNG 显式搜索试点

更新时间：`2026-05-04`

这份文档记录 `/searx:` 显式搜索技能的部署和使用口径。

## 1. 使用边界

SearXNG 只作为显式搜索入口，不接入默认 `web-access` staged router。

允许触发：

```text
/searx:国产大模型 最新进展
/searxng:SearXNG JSON API settings
```

不允许自动触发：

```text
帮我查一下最新 AI 新闻
搜索一下某个关键词
看看网上有没有相关信息
```

这个限制是故意的。SearXNG 会把搜索请求集中从服务器出口发出去，不能让所有 agent 的普通查资料行为默认压到同一个服务器 IP。

## 2. 服务拓扑

本地和生产 compose 都包含：

- `ugk-pi-searxng`：SearXNG 容器
- app / conn-worker 内部访问：`http://ugk-pi-searxng:8080`
- 宿主调试入口：`http://127.0.0.1:${SEARXNG_HOST_PORT:-48080}`

宿主端口只绑定 `127.0.0.1`，不要改成 `0.0.0.0` 裸露公网。

## 3. 配置

关键环境变量：

```text
SEARXNG_BASE_URL=http://ugk-pi-searxng:8080
SEARXNG_HOST_PORT=48080
SEARXNG_SECRET=<生产随机密钥>
UGK_SEARXNG_CONFIG_DIR=./deploy/searxng
UGK_SEARXNG_CACHE_DIR=./.data/searxng
UGK_SEARXNG_MEM_LIMIT=512m
UGK_SEARXNG_MEM_RESERVATION=128m
```

生产环境必须把 `SEARXNG_SECRET` 换成随机值，例如：

```bash
openssl rand -hex 32
```

`deploy/searxng/settings.yml` 已启用 JSON 输出：

```yaml
search:
  formats:
    - html
    - json
```

如果没有启用 `json`，`/search?q=...&format=json` 会失败，常见表现是 `HTTP 403`。

## 4. 启动和验证

本地启动：

```bash
docker compose up -d ugk-pi-searxng ugk-pi ugk-pi-conn-worker
```

验证宿主可达：

```bash
curl "http://127.0.0.1:48080/search?q=health&format=json"
```

验证 app 容器可达：

```bash
docker compose exec -T ugk-pi node /app/runtime/skills-user/searxng-search/scripts/searxng_search.mjs health
```

技能调用：

```text
/searx:国产大模型 最新进展
```

## 5. 运维注意

- SearXNG 不替代登录态浏览器；需要登录、截图、下载、发布内容时仍走 `web-access`。
- 不要开大量 engine 或无限翻页；试点阶段先观察失败率、耗时和搜索源封锁情况。
- 搜索失败不要无限重试。服务器 IP 被上游搜索源封锁后，重试只会让问题更难看。
- 当前 `limiter` 关闭，因为服务只在内网和本机回环入口使用；如果未来公网开放，必须重新设计 limiter / Valkey / 反向代理鉴权。

关键入口：

- [runtime/skills-user/searxng-search/SKILL.md](/E:/AII/ugk-pi/runtime/skills-user/searxng-search/SKILL.md)
- [runtime/skills-user/searxng-search/scripts/searxng_search.mjs](/E:/AII/ugk-pi/runtime/skills-user/searxng-search/scripts/searxng_search.mjs)
- [deploy/searxng/settings.yml](/E:/AII/ugk-pi/deploy/searxng/settings.yml)
- [docker-compose.yml](/E:/AII/ugk-pi/docker-compose.yml)
- [docker-compose.prod.yml](/E:/AII/ugk-pi/docker-compose.prod.yml)
