# Background Agent 模型选择问题报告

## 问题摘要

**现象：** conn 后台任务执行时使用了错误的模型（`dashscope-coding/glm-5`），而非项目配置的默认模型（`deepseek-anthropic/deepseek-v4-flash`）。

**影响：** 
- 任务执行耗时 36 分钟，其中模型推理占 28 分钟（77%）
- GLM-5 推理速度较慢，调用 69 次，累计耗时显著
- 如果使用配置的 DeepSeek V4 Flash，预估可缩短至 15-20 分钟

---

## 问题详情

### 1. 实际使用模型 vs 配置模型

| 维度 | 配置值 | 实际值 |
|------|--------|--------|
| Provider | `deepseek-anthropic` | `dashscope-coding` |
| Model | `deepseek-v4-flash` | `glm-5` |
| API | `anthropic-messages` | `openai-completions` |

### 2. 配置文件现状

| 文件路径 | 内容 | 状态 |
|----------|------|------|
| `/app/.pi/settings.json` | `defaultProvider: deepseek-anthropic`, `defaultModel: deepseek-v4-flash` | 存在，但未生效 |
| `/app/runtime/pi-agent/models.json` | 定义了两个 provider 的模型配置 | 正常加载 |
| `/app/runtime/pi-agent/settings.json` | - | **不存在** |

### 3. Session 启动时的模型选择日志

```json
{
  "type": "model_change",
  "timestamp": "2026-04-27T10:08:56.291Z",
  "provider": "dashscope-coding",
  "modelId": "glm-5"
}
```

**问题：** Session 启动时直接选择了 `dashscope-coding/glm-5`，完全没有读取项目配置。

---

## 根因分析

### 问题链路

1. **Background agent 工作目录问题**
   - Background agent 的 `cwd` 设置为 `/app/.data/agent/background/runs/<runId>/`
   - 该目录下不存在 `.pi/settings.json`

2. **SettingsManager 的项目配置读取逻辑**
   - `SettingsManager.create(cwd, agentDir)` 会尝试读取 `cwd/.pi/settings.json` 作为项目配置
   - 由于工作目录下没有 `.pi/`，项目配置读取失败，返回空对象

3. **模型选择 fallback 逻辑**
   - `findInitialModel()` 的选择顺序：
     - 第 1 步：CLI 参数 → 无
     - 第 2 步：scopedModels → 空（后台任务不指定）
     - **第 3 步：settings default → 跳过（defaultProvider/defaultModel 为 undefined）**
     - 第 4 步：第一个可用模型 → `dashscope-coding/glm-5`

4. **models.json 的加载顺序**
   - Provider 按对象 key 顺序加载：`dashscope-coding` 排在第一位
   - 第一个 provider 的第一个模型即为 `glm-5`

### 关键代码位置

**pi-coding-agent 模型选择逻辑：**

```javascript
// src/core/model-resolver.js - findInitialModel()
// 3. Try saved default from settings
if (defaultProvider && defaultModelId) {
    const found = modelRegistry.find(defaultProvider, defaultModelId);
    if (found) {
        model = found;
        return { model, thinkingLevel, fallbackMessage: undefined };
    }
}
// 4. Try first available model with valid API key
const availableModels = await modelRegistry.getAvailable();
if (availableModels.length > 0) {
    // ... 按 defaultModelPerProvider 顺序查找
    // 如果找不到任何默认模型，使用第一个 available
    return { model: availableModels[0], ... };
}
```

**pi-coding-agent settings 读取逻辑：**

```javascript
// src/core/settings-manager.js - FileSettingsStorage
constructor(cwd = process.cwd(), agentDir = getAgentDir()) {
    this.globalSettingsPath = join(agentDir, "settings.json");
    this.projectSettingsPath = join(cwd, CONFIG_DIR_NAME, "settings.json");  // cwd/.pi/settings.json
}
```

**ugk-pi conn-worker session 创建：**

```javascript
// src/workers/conn-worker.ts - ProjectBackgroundSessionFactory
async createSession(input) {
    const sessionManager = SessionManager.create(input.workspace.rootPath, ...);
    // ... 
    const { session } = await createAgentSession({
        cwd: input.workspace.rootPath,  // /app/.data/agent/background/runs/<runId>/
        // SettingsManager 会从 cwd/.pi/settings.json 读取项目配置，但该目录没有这个文件
    });
}
```

---

## 问题验证

### 验证命令 1：检查工作目录

```bash
ls -la /app/.data/agent/background/runs/<runId>/.pi/
# 输出：不存在
```

### 验证命令 2：检查 models.json 加载顺序

```bash
node -e "
const models = require('/app/runtime/pi-agent/models.json');
console.log(Object.keys(models.providers));
"
# 输出：['dashscope-coding', 'deepseek-anthropic']
# dashscope-coding 排第一
```

### 验证命令 3：检查 settings 是否正确

```bash
cat /app/.pi/settings.json | grep -E 'defaultProvider|defaultModel'
# 输出：
# "defaultProvider": "deepseek-anthropic"
# "defaultModel": "deepseek-v4-flash"
```

### 验证命令 4：检查 API key 配置

```bash
env | grep -E 'DEEPSEEK_API_KEY|DASHSCOPE_CODING_API_KEY'
# 输出：两者都已配置
```

---

## 影响范围

### 已确认受影响的场景

- 所有 conn 后台周期任务（舆情监控、SSL 检查等）
- 使用 `BackgroundAgentRunner` 执行的任务

### 未受影响的场景

- Playground Web 交互（`cwd` 为 `/app`，可读取 `/app/.pi/settings.json`）
- 直接在 `/app` 目录下执行的 CLI 命令

---

## 可能的解决方案

### 方案 A：修改 conn-worker 的 cwd 设置

在 `ProjectBackgroundSessionFactory.createSession()` 中，将 `cwd` 设置为项目根目录 `/app`，而非 workspace 目录：

```typescript
const { session } = await createAgentSession({
    cwd: this.projectRoot,  // 使用项目根目录，而非 input.workspace.rootPath
    // ...
});
```

**优点：** 复用现有的 `/app/.pi/settings.json`，无需额外配置  
**风险：** 可能影响 session 文件存储路径，需确认不影响 sessionManager 行为

### 方案 B：添加 globalSettings 文件

在 `/app/runtime/pi-agent/settings.json` 创建一份 globalSettings：

```json
{
  "defaultProvider": "deepseek-anthropic",
  "defaultModel": "deepseek-v4-flash"
}
```

**优点：** 简单，不影响现有代码逻辑  
**缺点：** 需要维护两份配置文件，可能产生配置不一致

### 方案 C：在 session 创建时显式传递 model

在 `BackgroundAgentProfileResolver.resolve()` 返回的 snapshot 中，显式设置 provider 和 model：

```typescript
// BackgroundAgentRunner.run()
const snapshot = await this.options.profileResolver.resolve({
    // ...
});

// 在 createSession 时传递显式 model
const { session } = await createAgentSession({
    cwd: input.workspace.rootPath,
    model: {
        provider: snapshot.provider,  // 'deepseek-anthropic'
        modelId: snapshot.model,      // 'deepseek-v4-flash'
    },
    // ...
});
```

**优点：** 最直接，后台任务有自己的模型配置系统  
**缺点：** 需要扩展 `createAgentSession` 接口支持显式 model 参数

### 方案 D：conn 定义中添加 model 配置

允许 conn 定义时指定 `modelPolicyId` 或直接的 provider/model：

```typescript
interface ConnDefinition {
    // ...
    modelPolicyId?: string;  // 已有字段，但当前未生效
    // 或者：
    provider?: string;
    model?: string;
}
```

**优点：** 每个 conn 可以独立配置模型  
**缺点：** 需要扩展 conn 定义 schema 和 UI

---

## 需要后端团队确认的问题

1. **当前 behavior 是否符合预期？**
   - 是否认为 background agent 应该继承项目级 settings.json？
   - 还是认为 background agent 应有自己的配置来源？

2. **推荐哪个方案？**
   - 方案 A（修改 cwd）vs 方案 B（添加 globalSettings）vs 方案 C（显式传 model）vs 方案 D（conn 定义）

3. **modelPolicyId 的设计意图？**
   - 当前 conn 定义中有 `modelPolicyId` 字段，但 `BackgroundAgentProfileResolver` 里用的是硬编码的 `DEFAULT_MODEL_POLICY_ID = "model.default"`
   - 这个字段是否应该生效？如何生效？

4. **settings.json 的分层设计**
   - globalSettings vs projectSettings 的预期行为是什么？
   - background agent 应该使用哪一层？

---

## 附录：相关代码文件

| 文件 | 作用 |
|------|------|
| `/app/.pi/settings.json` | 项目级配置（defaultProvider, defaultModel） |
| `/app/runtime/pi-agent/models.json` | 模型定义（providers, models, apiKey env 变量名） |
| `/app/src/workers/conn-worker.ts` | conn worker 实现，包含 `ProjectBackgroundSessionFactory` |
| `/app/src/agent/background-agent-runner.ts` | 后台任务 runner，调用 sessionFactory 创建 session |
| `/app/src/agent/background-agent-profile.ts` | 后台 agent profile 解析，包含 modelPolicyId 处理 |
| `@mariozechner/pi-coding-agent/dist/core/model-resolver.js` | `findInitialModel()` 模型选择逻辑 |
| `@mariozechner/pi-coding-agent/dist/core/settings-manager.js` | `SettingsManager` 配置读取逻辑 |
| `@mariozechner/pi-coding-agent/dist/core/sdk.js` | `createAgentSession()` session 创建入口 |

---

## 附录：任务执行耗时详情

| 类别 | 耗时 | 占比 |
|------|------|------|
| 总执行时间 | 36 分钟 | 100% |
| 工具调用（浏览器搜索等） | 8 分钟 | 23% |
| GLM-5 模型推理 | 28 分钟 | 77% |
| GLM-5 调用次数 | 69 次 | - |

| 平台搜索耗时 | 总耗时 | 平均耗时 |
|--------------|--------|----------|
| X 平台 | 4分32秒 | 35秒/次 |
| Instagram | 3分37秒 | 39秒/次 |
| TikTok | 1分52秒 | 13秒/次 |
| LinkedIn | 1分40秒 | 10秒/次 |
| Reddit | 6秒 | 2秒/次 |

---

**报告时间：** 2026-04-27 UTC 11:13  
**报告人：** ugk-pi agent  
**问题发现任务：** conn run `a43669a3-f903-4b75-a5a8-4c1eaba2145a` (Medtrum 舆情监控)