# Medtrum 舆情监控周期任务优化记录

> 文档创建时间：UTC 2026-04-27 07:31（北京时间 2026-04-27 15:31）
> 优化执行时间：UTC 2026-04-27 01:04（北京时间 2026-04-27 09:04）

---

## 一、问题背景

### 1.1 任务概况

Medtrum 舆情监控周期任务是一个每天自动执行的后台任务，用于监控 Medtrum 品牌在多个社交媒体平台上的舆情动态。

**任务配置：**
- Conn ID: `649f95fa-a173-4cc4-9f00-006e4ae1b89a`
- 执行时间：北京时间每天 07:00（UTC 23:00）
- 监控平台：X、Instagram、TikTok、LinkedIn、Reddit
- 监控关键词：touchcare、Medtrum、Touch Care、移宇
- 输出：邮件报告发送到 `294851575@qq.com` 和 `ning.zhou@medtrum.com`

### 1.2 发现的问题

2026-04-26 的任务执行（Run ID: `e11ec5fb-a53d-4cd0-81a6-8d1d930a8b8c`）耗时异常长达 **78 分钟**：
- 任务启动：UTC 23:00:07（北京时间 07:00）
- 任务结束：UTC 00:18:03（北京时间 08:18）

这远超预期的 20-30 分钟，需要分析根因并优化。

---

## 二、问题分析

### 2.1 时间线分析

通过分析 session 日志文件：
```
/app/.data/agent/background/runs/e11ec5fb-a53d-4cd0-81a6-8d1d930a8b8c/session/2026-04-26T23-00-07-550Z_019dcc05-86fe-75e3-9cdb-bc623dcc2153.jsonl
```

发现以下关键时间节点：

| 阶段 | 时间（UTC） | 北京时间 | 耗时 | 说明 |
|------|------------|----------|------|------|
| 任务启动 | 23:00:07 | 07:00 | - | 接收到 conn 触发 |
| 模型首次响应 | 23:00:31 | 07:00 | 24秒 | GLM-5 思考后开始执行 |
| 清理步骤 | 23:00:31-23:09:00 | 07:00-07:09 | ~9分钟 | **异常延迟** |
| X 平台检索 | 23:09-23:18 | 07:09-07:18 | ~9分钟 | 4关键词并行 |
| Instagram 检索 | 23:18-23:23 | 07:18-07:23 | ~5分钟 | 正常 |
| TikTok 检索 | 23:23-23:34 | 07:23-07:34 | ~11分钟 | 正常 |
| LinkedIn 检索 | 23:34-23:43 | 07:34-07:43 | ~9分钟 | 正常 |
| Reddit 检索 | 23:43-23:53 | 07:43-07:53 | **10分39秒** | **空白延迟** |
| 总汇总 | 23:53-23:55 | 07:53-07:55 | ~2分钟 | 正常 |
| 邮件渲染 | 23:55-23:58 | 07:55-07:58 | ~3分钟 | 正常 |
| 邮件发送（第一次） | 00:00-00:06 | 08:00-08:06 | ~6分钟 | 失败 |
| 邮件发送卡死 | 00:06-00:16 | 08:06-08:16 | **10分钟** | **超时卡死** |
| 邮件发送（第二次） | 00:16-00:18 | 08:16-08:18 | ~2分钟 | 成功 |
| **总计** | 23:00-00:18 | 07:00-08:18 | **78分钟** | |

### 2.2 发现的三个主要问题

#### 问题 1：29 个 prompt 文件（耗时叠加）

检查 work 目录发现主模型构造了 29 个 prompt 文件：

```
work/x-touchcare-prompt.md          # X 平台 4个关键词
work/x-medtrum-prompt.md
work/x-touch-care-prompt.md
work/x-yiyu-prompt.md
work/x-summary-prompt.md            # X 平台汇总

work/instagram-touchcare-prompt.md  # Instagram 平台 4个关键词
work/instagram-medtrum-prompt.md
...（同上结构）

work/tiktok-*.md                    # TikTok 平台 5个
work/linkedin-*.md                  # LinkedIn 平台 5个
work/reddit-*.md                    # Reddit 平台 5个

work/final-summary-prompt.md        # 总汇总
work/email-render-prompt.md         # 邮件渲染
work/email-send-prompt.md           # 邮件发送
work/send-email-direct.md           # 邮件重试
```

**根因：任务定义要求主模型手动构造 prompt 文件 + CLI 调用**

原任务定义中的执行方式：
```markdown
创建新的独立子代理时，必须严格遵循下面模板...

（主模型执行流程）
1. write(prompt文件)
2. bash(node cli.js --append-system-prompt prompt.md)
3. 等待返回
4. 下一个...
```

这意味着：
- 每个子代理都要：思考 → 构造 prompt → write 文件 → 启动 CLI → 等待
- 每次循环消耗几秒思考时间 + 几秒 write 时间 + 几十秒 CLI 启动时间
- 29 个循环叠加，耗时严重

#### 问题 2：Reddit 检索后空白延迟（10分39秒）

分析发现 Reddit 检索本身只耗时 1-2 分钟（技能执行正常），但检索完成后到汇总之间有 10分39秒 的空白。

**根因：GLM-5 模型在步骤转换时的 API 响应延迟**

日志显示：
```
Reddit 检索完成：23:43
下一步汇总开始：23:53
中间空白：10分39秒
```

这不是技能执行慢，而是主模型收到 Reddit 检索结果后，思考"下一步做什么"时，GLM-5 API 响应延迟。

#### 问题 3：邮件发送卡死（12分钟）

第一次邮件发送调用：
```json
{
  "command": "cd /app && node cli.js ... | tee logs/email-send.log | tail -50",
  "timeout": 300
}
```

第二次邮件发送调用：
```json
{
  "command": "timeout 120 node cli.js ...",
  "no tee/tail": true,
  "prompt": "请立即执行，不要等待进一步指示"
}
```

**根因：tee/tail 管道截断输出 + 缺少"立即执行"指令**

子代理在执行时，如果使用了 `tail -50` 管道截断，可能导致：
1. 子代理的输出被截断
2. 子代理认为自己还没完成，继续等待/尝试
3. 最终 300 秒超时被主模型强制终止

第二次成功的关键改动：
- 移除 tee/tail 管道
- 添加 "请立即执行，不要等待进一步指示"
- 缩短 timeout 到 120 秒

---

## 三、优化方案

### 3.1 核心改动：使用 subagent 工具替代手动 CLI

**原方式（慢）：**
```
每个子代理 → 思考 → 构造 prompt → write 文件 → bash CLI → 等待 → 下一个
```

**优化方式（快）：**
```
subagent({tasks: [...]}) → 一条工具调用启动多个并行子代理 → 等待全部完成 → 下一步
```

### 3.2 具体改动

#### 改动 1：平台检索使用 subagent parallel 模式

原任务定义要求主模型"一次性创建 4 个新的独立子代理，并行执行"，但实际实现是手动构造 4 个 prompt 文件 + CLI 调用。

优化后的任务定义明确要求使用 subagent 工具：

```markdown
#### 1.1 并行检索（一次 subagent 调用）

调用 subagent 工具，tasks 参数：

[
  {agent: "worker", task: "执行 X 平台 touchcare 检索。立即调用 /x-search-latest:touchcare:30。将结果整理为中文报告写入 output/x-touchcare.md。报告必须包含：平台、关键词、时间范围、结果总览、舆情条目、风险小结。立即执行。"},
  {agent: "worker", task: "执行 X 平台 Medtrum 检索。立即调用 /x-search-latest:Medtrum:30。写入 output/x-medtrum.md。立即执行。"},
  {agent: "worker", task: "执行 X 平台 Touch Care 检索。立即调用 /x-search-latest:Touch Care:30。写入 output/x-touch-care.md。立即执行。"},
  {agent: "worker", task: "执行 X 平台 移宇 检索。立即调用 /x-search-latest:移宇:30。写入 output/x-yiyu.md。立即执行。"}
]
```

**效果：**
- 主模型只需 1 次思考 + 1 次工具调用（而不是 4 次思考 + 4 次写文件 + 4 次 CLI 调用）
- 每个平台步骤节省约 3-5 分钟
- 5 个平台总共节省约 15-25 分钟

#### 改动 2：平台汇总使用 subagent single 模式

原方式：
```
思考 → 构造 prompt → write 文件 → bash CLI → 等待
```

优化后：
```
subagent({agent: "worker", task: "...汇总任务..."})
```

**效果：**
- 每个平台汇总节省约 1-2 分钟思考时间
- 5 个平台总共节省约 5-10 分钟

#### 改动 3：邮件发送由主模型直接执行

原任务定义要求"创建新的独立子代理"发送邮件，导致：
- 子代理启动开销
- tee/tail 管道截断风险
- 缺少"立即执行"指令导致的等待

优化后明确禁止子代理发送邮件：

```markdown
## 步骤8：发送邮件（主模型直接执行）

**禁止通过子代理发送邮件。主模型必须直接执行以下命令：**

node runtime/skills-user/send-email/scripts/email_sender.mjs \
  -t "294851575@qq.com,ning.zhou@medtrum.com" \
  -s "每日 Medtrum 多平台多关键词舆情监测报告" \
  --html \
  -b "$(cat output/final-report-email.html)"

**注意事项：**
- 不使用 tee 或 tail 管道截断输出
- 如果发送失败，最多重试 2 次
```

**效果：**
- 避免子代理启动开销
- 避免 tee/tail 管道截断风险
- 直接看到发送结果
- 节省约 10-12 分钟（原来卡死的时间）

#### 改动 4：添加"立即执行"指令

在每个 subagent task 中添加：
```
立即执行，不要等待指示。
```

**效果：**
- 减少子代理在收到任务后的思考等待时间
- 预计每个子代理节省 10-30 秒

---

## 四、实施过程

### 4.1 创建优化版任务定义

文件路径：
```
/app/.data/agent/background/runs/e11ec5fb-a53d-4cd0-81a6-8d1d930a8b8c/input/medtrum舆情监测任务定义-v2.md
```

### 4.2 上传到 asset store

新 Asset ID: `6d82261f-afb5-433c-a3c0-f11db172fb2a`

文件引用：`@asset[6d82261f-afb5-433c-a3c0-f11db172fb2a]`

### 4.3 更新 conn 配置

更新 conn 的 assetRefs：
```
conn ID: 649f95fa-a173-4cc4-9f00-006e4ae1b89a
原 assetRefs: fa83a387-59f2-4922-8b37-5060ff79334b (v1)
新 assetRefs: 6d82261f-afb5-433c-a3c0-f11db172fb2a (v2)
```

---

## 五、预期效果对比

| 指标 | 优化前 (v1) | 优化后 (v2) | 改善 |
|------|------------|------------|------|
| **总耗时** | 78 分钟 | 20-30 分钟 | 减少 48-58 分钟 |
| **prompt 文件数** | 29 个 | 0 个 | 减少 29 个 |
| **平台检索方式** | 手动 CLI | subagent parallel | 更高效 |
| **邮件发送方式** | 子代理执行 | 主模型直接执行 | 更稳定 |
| **邮件卡顿风险** | 300秒超时 | 无 | 已消除 |

---

## 六、验证方法

### 6.1 自动验证

下次任务执行（北京时间 2026-04-28 07:00）后，检查：

1. **耗时对比：**
   ```
   查看 Run 日志的 start/end 时间
   预期：20-30 分钟（而不是 78 分钟）
   ```

2. **prompt 文件数：**
   ```
   ls work/*.md | wc -l
   预期：0 个（而不是 29 个）
   ```

3. **邮件发送状态：**
   ```
   查看邮件发送日志
   预期：一次成功，无卡死
   ```

### 6.2 手动测试验证

立即触发测试：
```
conn run_now 649f95fa-a173-4cc4-9f00-006e4ae1b89a
```

观察：
- 是否使用 subagent 工具
- 是否生成 prompt 文件
- 邮件是否正常发送

---

## 七、相关文件

| 文件 | 路径 | 说明 |
|------|------|------|
| 原任务定义 (v1) | `@asset[fa83a387-59f2-4922-8b37-5060ff79334b]` | 已废弃 |
| 新任务定义 (v2) | `@asset[6d82261f-afb5-433c-a3c0-f11db172fb2a]` | 当前生效 |
| 本次 Run 日志 | `/app/.data/agent/background/runs/e11ec5fb-a53d-4cd0-81a6-8d1d930a8b8c/session/*.jsonl` | 分析依据 |
| conn 配置 | SQLite: `/app/.data/agent/conn/conn.sqlite` | 任务调度配置 |

---

## 八、变更记录

| 时间 | 变更内容 | 操作者 |
|------|----------|--------|
| 2026-04-27 01:04 UTC | 创建优化版任务定义 v2 | Agent |
| 2026-04-27 01:04 UTC | 上传到 asset store | Agent |
| 2026-04-27 01:04 UTC | 更新 conn assetRefs | Agent |
| 2026-04-27 07:31 UTC | 创建本文档 | Agent |

---

## 九、后续改进建议

### 9.1 短期改进

1. **监控下次执行结果**
   - 对比 v1 和 v2 的实际耗时
   - 确认优化效果

2. **优化 GLM-5 响应延迟**
   - 如果步骤转换延迟仍然严重，考虑：
     - 换用响应更快的模型
     - 调整 API timeout 配置

### 9.2 长期改进

1. **subagent 工具增强**
   - 支持更精细的并发控制
   - 支持任务失败自动重试

2. **任务定义模板化**
   - 创建通用的"多平台多关键词检索"任务模板
   - 支持动态配置平台、关键词、时间范围

3. **邮件发送稳定性**
   - 添加邮件发送队列
   - 支持发送失败自动重试 + 告警

---

## 十、附录：原问题分析日志片段

### 10.1 第一次邮件发送卡死

```json
{
  "timestamp": "2026-04-27T00:06:11.918Z",
  "message": {
    "role": "assistant",
    "content": [{
      "type": "toolCall",
      "name": "bash",
      "arguments": {
        "command": "node cli.js ... | tee logs/email-send.log | tail -50",
        "timeout": 300
      }
    }]
  }
}
```

**结果：** 300秒超时后返回 `(no output)`

### 10.2 第二次邮件发送成功

```json
{
  "timestamp": "2026-04-27T00:16:55.464Z",
  "message": {
    "role": "assistant",
    "content": [{
      "type": "toolCall",
      "name": "bash",
      "arguments": {
        "command": "timeout 120 node cli.js ...",
        "timeout": 180
      }
    }]
  }
}
```

**结果：** 41秒后成功返回邮件发送结果

---

> 文档结束