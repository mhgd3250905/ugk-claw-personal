# 模型源管理

更新时间：`2026-05-05`

模型源只在 `runtime/pi-agent/models.json` 登记。用户在 Web 里选择的默认 API 源 / 模型属于运行态偏好：生产通过 `UGK_MODEL_SETTINGS_PATH=/app/.data/agent/model-settings.json` 保存到 shared 数据目录；仓库里的 `.pi/settings.json` 只作为首次启动或运行态文件缺失时的 bundled 默认值。不要把 provider、model、API key 和运行时策略混在一个地方，否则后面加模型会变成猜谜。

## 当前来源

| 来源 | provider | 模型 | 集群 | Key |
| --- | --- | --- | --- | --- |
| 阿里 | `dashscope-coding` | `glm-5` | `cn` | `DASHSCOPE_CODING_API_KEY` |
| DeepSeek | `deepseek` | `deepseek-v4-pro` / `deepseek-v4-flash` | `global` | `DEEPSEEK_API_KEY` |
| 小米 | `xiaomi-mimo-cn` | `mimo-v2.5-pro` | `cn` | `XIAOMI_MIMO_API_KEY` |
| 小米 | `xiaomi-mimo-sgp` | `mimo-v2.5-pro` | `sgp` | `XIAOMI_MIMO_API_KEY` |
| 小米 | `xiaomi-mimo-ams` | `mimo-v2.5-pro` | `ams` | `XIAOMI_MIMO_API_KEY` |

## 小米集群验证记录

- `2026-04-29`：在腾讯云新加坡 `ugk-pi` 容器内真实 POST 验证三套小米 endpoint。
- `xiaomi-mimo-cn` 返回 `200`，当前 key 可用。
- `xiaomi-mimo-sgp` 返回 `401 Invalid API Key`，endpoint 可达，但当前 key 不具备该集群权限。
- `xiaomi-mimo-ams` 返回 `401 Invalid API Key`，endpoint 可达，但当前 key 不具备该集群权限。
- 结论：不要把 SGP / AMS 误判成网络不通；当前问题是 key 的区域权限。腾讯云新加坡如需走 `xiaomi-mimo-sgp`，需要向小米侧获取或开通对 SGP 集群有效的 API key。

## 配置规则

- `provider.id` 是稳定机器标识，不随展示文案改名。
- `provider.vendor` 表示来源：`ali`、`deepseek`、`xiaomi`。
- `provider.region` 表示集群或区域。
- `provider.priority` 控制 Web 模型源下拉展示顺序。
- `provider.name` 是给用户看的名称，前端优先展示它，再附带 provider id。
- `model.contextWindow` 用真实上下文窗口。DeepSeek V4 Pro / Flash 当前登记为 `1000000`，小米 `mimo-v2.5-pro` 当前登记为 `1048576`。
- DeepSeek 当前走 `openai-completions` 链路和 `https://api.deepseek.com`，并通过 `compat.thinkingFormat = "deepseek"`、`requiresReasoningContentOnAssistantMessages = true` 与 `reasoningEffortMap` 对齐 pi 的 DeepSeek reasoning 行为。
- API key 只通过环境变量读取；本地兜底可以使用 `api.txt`、`deepseek-api.txt`、`小米api.txt`，这些文件必须保持 ignored。
- `GET /v1/model-config` 和后台 conn worker 的默认模型解析都读取同一个有效 settings：优先 `UGK_MODEL_SETTINGS_PATH`，缺失时回退 `.pi/settings.json`。保存默认选择时只写有效 settings 路径，不改仓库默认文件。

## 修改入口

- 模型注册：`runtime/pi-agent/models.json`
- 生产默认选择运行态：`/app/.data/agent/model-settings.json`
- 仓库 bundled 默认：`.pi/settings.json`
- key 兜底加载：`src/config.ts`
- Web API：`GET /v1/model-config`
- Web 设置入口：playground 的“模型源设置”
