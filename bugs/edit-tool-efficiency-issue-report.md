# pi edit 工具使用效率问题分析报告

**报告日期**：2026-04-28  
**问题类型**：文件编辑效率低下  
**影响任务**：Medtrum 舆情监控任务文件优化  

---

## 一、问题描述

### 1.1 任务背景

用户要求优化 Medtrum 舆情监控周期任务文件（`medtrum-sentiment-monitor-v5.md`），具体操作：
1. 去掉关键词 `Touch Care`
2. 舆情明细列表改为"先分平台，再时间倒序"

### 1.2 实际耗时

- **任务开始时间**：UTC 04:01
- **任务完成时间**：UTC 05:02
- **总耗时**：约 61 分钟

### 1.3 任务本质

这是一个简单的文件修改任务：
- 文件约 400 行
- 需修改约 10 处文本
- **理论上应 3-5 分钟完成**

---

## 二、效率低下的原因分析

### 2.1 主要原因：edit 工具多次失败

Agent 在修改文件时反复使用 `edit` 工具，但多次失败，错误信息：

```
Could not find the exact text in ... 
The old text must match exactly including all whitespace and newlines.
```

**失败次数统计**：
- 第 1 次：尝试修改 KEYWORDS 常量 → 成功
- 第 2 次：尝试修改 HTML 模板大段内容 → 失败
- 第 3 次：再次尝试（调整格式）→ 失败
- 第 4-6 次：反复尝试不同范围的文本 → 失败
- 最终被迫使用 `bash + sed` 补救

### 2.2 失败的根本原因

#### 2.2.1 edit 工具的匹配机制

pi 的 edit 工具使用 **精确文本匹配**，处理流程：

| 步骤 | 处理内容 |
|------|----------|
| 1 | `stripBom()` - 去除 UTF-8 BOM |
| 2 | `detectLineEnding()` - 检测换行符类型 |
| 3 | `normalizeToLF()` - 规范化换行符为 LF |
| 4 | `normalizeForFuzzyMatch()` - 模糊匹配备用（NFKC、智能引号→ASCII） |
| 5 | 在规范化内容中查找唯一匹配 |

#### 2.2.2 Agent 犯的错误

1. **oldText 太大**：尝试匹配大段 HTML（包含多行、中文、引号、特殊字符）
2. **肉眼复制不精确**：从 read 输出"复制"文本到 edit 输入，丢失隐形字符或格式差异
3. **违反最佳实践**：pi 的 `promptGuidelines` 明确要求：
   ```
   "Keep edits[].oldText as small as possible while still being unique in the file."
   ```

#### 2.2.3 为什么模糊匹配也失败了

edit 工具的模糊匹配只处理：
- 智能引号 → ASCII
- 特殊空格 → 普通空格
- Unicode 规范化（NFKC）
- 行末空白去除

**不处理**：
- HTML 标签结构差异
- 大段文本中的任意字符差异
- 复制粘贴过程中的内容丢失

当 oldText 是大段文本时，任何微小差异都会导致匹配失败。

---

## 三、pi 官方的最佳实践

### 3.1 edit 工具内置的 promptGuidelines

pi 源码中硬编码的规则（每次调用 edit 工具都会注入）：

```typescript
promptGuidelines: [
  "Use edit for precise changes (edits[].oldText must match exactly)",
  "When changing multiple separate locations in one file, use one edit call with multiple entries in edits[] instead of multiple edit calls",
  "Each edits[].oldText is matched against the original file, not after earlier edits are applied. Do not emit overlapping or nested edits. Merge nearby changes into one edit.",
  "Keep edits[].oldText as small as possible while still being unique in the file. Do not pad with large unchanged regions.",
]
```

### 3.2 正确用法示例

```typescript
// ❌ 错误：匹配大段文本
edit({
  path: "file.md",
  edits: [{ 
    oldText: "**设计原则：...大段HTML...",  // 太大！
    newText: "..."
  }]
})

// ✅ 正确：只匹配关键行
edit({
  path: "file.md",
  edits: [
    { 
      oldText: "**设计原则：按时间倒序、表格呈现、中文说明、突出负面。**",
      newText: "**设计原则：先分平台、平台内按时间倒序、表格呈现、中文说明、突出负面。**"
    },
    { 
      oldText: "<p style=\"color: #666; font-size: 12px; margin: 0 0 12px;\">按时间倒序排列",
      newText: "<p style=\"color: #666; font-size: 12px; margin: 0 0 12px;\">按平台分组"
    }
  ]
})
```

### 3.3 替代方案优先级

| 场景 | 推荐方案 |
|------|----------|
| 小文件（<500行）且多处修改 | `write` 重写全文 |
| 大文件 + 精确单点修改 | `edit`（oldText 尽可能小） |
| edit 连续失败 2 次 | 立即切换到 `write` 或 `bash + sed` |
| 简单文本替换 | `bash + sed`（宽松匹配） |

---

## 四、后续改进建议

### 4.1 项目级约束（AGENTS.md）

建议在 `/app/AGENTS.md` 添加：

```markdown
## 文件编辑效率规则

- 小文件（<500行）多处修改：直接用 `write` 重写
- 大文件：`edit` 时 `oldText` 只匹配要改的那几行
- `edit` 连续失败 2 次：立即切换方案（`write` 或 `bash + sed`）
- 禁止用大段文本作为 `oldText`
```

### 4.2 Agent 自身改进方向

1. **先评估文件大小**：判断应使用 write 还是 edit
2. **edit 策略优化**：只匹配最小必要文本
3. **失败快速切换**：edit 失败 2 次后不继续尝试，改用其他方案

### 4.3 为什么 LLM 无法自动"记住教训"

LLM 没有持久记忆，下次对话不会自动记住这次问题。需要通过：
- 项目级文档（AGENTS.md）约束
- pi 内置 promptGuidelines（每次都生效）
- 创建专用 Skill（更严格约束）

---

## 五、总结

| 维度 | 本次问题 | 正确做法 |
|------|----------|----------|
| oldText 范围 | 大段文本（多行 HTML） | 最小必要文本 |
| 失败处理 | 反复尝试 edit | 失败 2 次立即切换 |
| 文件策略 | 未评估文件大小 | <500行直接 write |
| 遵循指南 | 未遵守 promptGuidelines | 严格执行 |

**核心教训**：edit 工具是"精确手术刀"，不是"大块替换工具"。用错了会浪费大量时间。

---

**报告人**：Agent  
**审核**：待用户确认  
**后续行动**：建议将规则写入 AGENTS.md

---

## 2026-04-28 复核结论

本报告指出的核心问题成立：pi `edit` 的 `oldText` 必须匹配唯一、非重叠的原始文件片段，大段 HTML / Markdown / 模板文本很容易因为一个隐藏字符、空白或复制偏差直接失败。官方源码中的工具说明也明确要求：

- `edits[].oldText` 必须精确匹配；
- 同一文件多处独立修改应一次调用多个 `edits[]`；
- 每个 `oldText` 按原始文件匹配，不要重叠或嵌套；
- `oldText` 应尽量小但足够唯一，不能用大片不变区域硬凑上下文。

但报告里的“<500 行小文件多处修改就直接 `write` 重写全文”过于粗暴。它能省时间，也能一把覆盖掉用户并发修改，属于从一个坑跳到另一个坑。项目级规则已经按更稳的版本写入 `AGENTS.md`：

1. 首选小范围、唯一、非重叠的精确替换。
2. 同一文件多处独立小改动，一次调用多个非重叠替换。
3. 精确替换连续失败 2 次后必须停止猜测，重新读取目标片段，换更小锚点、结构化脚本，或在完整读过且文件较小、结构简单时重写全文。
4. 全文重写只作为有条件策略，不作为默认捷径。

后续不需要改 pi 官方 `edit` 工具本体；这个问题本质是 agent 操作策略和项目约束没写死。工具已经提醒了，agent 还拿大段 `oldText` 去赌，那就是操作人脑子短路，不是工具玄学。
