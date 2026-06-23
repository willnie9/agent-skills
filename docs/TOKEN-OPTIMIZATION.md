# Token 优化方案

> 目标：在不影响核心质量（决策树/铁律/Gate/反模式）的前提下，降低 skill 体系的 token 消耗。

## 一、Token 消耗现状分析

### 上下文膨胀来源

| 来源 | 估算 token | 说明 |
|---|---|---|
| 7 个 SKILL.md 全文 | ~6k | 3190 行，每次触发 skill 全量加载 |
| references 全量加载 | ~7k | 3638 行，Claude Code 默认全读 |
| MasterGo DSL 原始数据 | ~10k+ | Stage A 拉 DSL，画板越大 token 越多 |
| 浏览器 MCP snapshot | ~10k+/次 | 每次 `browser_snapshot()` 返回完整 DOM |
| dom-tree.json + define.ts | ~8k | Stage C 的输入产物 |
| YApi 接口 JSON | ~3k | Stage B 的输入 |

### 最大的 token 消耗者

| Skill | SKILL.md 行数 | references 行数 | 单次触发 token |
|---|---|---|---|
| **auto-ui-explorer** | 733 (原975) | 702 | ~30k+（含大量 MCP snapshot） |
| frontend-page-design | 268 | 1221 | ~20k+（references 最重） |
| master-go-to-code | 380 | 1031 | ~15k+（含 DSL 数据） |
| module-flow | 418 | 740 | ~8k |
| yunxiao-bug-fix | 711 | 0 | ~10k |
| yapi-to-code | 235 | 180 | ~5k |
| playwright-skill | 203 | 0 | ~10k（含 snapshot） |

### 核心瓶颈

**所有 references 默认全量加载。** Claude Code 的 skill 机制是：触发一个 skill 就把整个 SKILL.md + references/ 全部塞进上下文。即使某个 reference 在当前场景用不到，它也占着 token。

## 二、已实施的优化

### v7.1.0 — auto-ui-explorer SKILL.md 瘦身（-242 行，-25%）

- SKILL.md：975 行 → 733 行
- 拆出 `references/execution-templates.md`（236 行）：搜索/分页/CRUD SP 模板、执行初始化、标准执行流程、报告模板、完成自检清单
- **保留不动**：决策树、9 个 Step 的流程骨架、铁律 14 条、Hooks 16 条、Gate 逻辑、反模式、上下游契约

## 三、后续可做的优化

### 优化 1：references 懒加载提示（立即可做，效果中等）

在 SKILL.md 的 references 引用处加**条件加载提示**，告诉 AI 何时需要读：

```markdown
# 当前写法
用例编写规范详见 [references/single-point-spec.md](./references/single-point-spec.md)。

# 优化写法
用例编写规范详见 [references/single-point-spec.md](./references/single-point-spec.md)（仅 Step 2.3 生成 SP 时读）。
```

效果：AI 在不需要时不会主动读 reference，但 Claude Code 的 skill 机制可能仍会预加载。

### 优化 2：frontend-page-design references 拆分（效果大）

`frontend-page-design/references/` 有 1221 行，是最重的 references 目录。可将以下文件按场景拆分：
- `code-style.md`（431 行）→ 拆成 BEM 规范 / 命名约定 / 组件选用 三个独立小文件
- `page-templates.md`（261 行）→ 仅在生成新页面时加载，增量场景不需要

### 优化 3：module-flow 编排粒度控制（效果大）

module-flow 委托下游 skill 时，可以只传**当前 Stage 需要的 context**，而不是把整个上游产物都传下去：
- Stage C 只需要 dom-tree.json + define.ts，不需要 MasterGo 原始 DSL
- Stage D 只需要路由配置，不需要 dom-tree.json

在 module-flow SKILL.md 的 Step 4 中明确**每阶段的最小 context 传递**。

### 优化 4：浏览器 snapshot 精简（效果大但需改 MCP 调用习惯）

`browser_snapshot()` 默认返回完整 DOM。在 auto-ui-explorer 的 Step 4 中：
- 弹窗内操作用 `browser_snapshot({ target: <dialog-ref> })` 局部抓
- 大表格用 `browser_snapshot({ depth: 3 })` 限制深度
- 已在 SKILL.md 的 Common Pitfalls 中提到，可在铁律中强化

## 四、Ollama 本地化的价值评估

### 你的 ollama 现状

```
bge-m3:latest     1.2 GB    ← embedding 模型（可用于语义检索）
deepseek-r1:7b    4.7 GB    ← 推理模型（7B 参数，能力有限）
```

### 方案 A：ollama 做 embedding 检索（推荐，投入产出比最高）

**思路**：用 `bge-m3` 对所有 SKILL.md + references 做向量化，构建本地检索索引。AI 触发 skill 时先检索相关段落，只加载 top-3 相关的 reference，而不是全量加载。

**价值**：
- token 消耗降低 40-60%（references 不再全量加载）
- 不影响核心质量（决策树和铁律仍在 SKILL.md 全量加载）
- bge-m3 中文 embedding 质量好，适合你的中文 skill 体系

**实现**：
```bash
# 1. 构建索引（一次性）
ollama embed bge-m3 < references/execution-templates.md → vector

# 2. 运行时检索
用户输入 "搜索 SP 怎么测" → bge-m3 embed → 检索 → 命中 execution-templates.md
→ 只加载这一个 reference，跳过 single-point-spec.md / failure-tags.md
```

**问题**：需要写一个 retrieval 脚本（.mjs），Claude Code 目前没有原生的 "skill 内 reference 按需加载" 机制，需要用 hook 或脚本来拦截。

### 方案 B：ollama 做轻量任务分流（有价值但有限）

**思路**：把一些不需要强推理的任务分流到本地 `deepseek-r1:7b`：
- URL 解析（mastergo/yapi/云效）→ 已有 `_shared/lib/parse-urls.mjs`，不需要 LLM
- 词典校验（JSON vs 源码比对）→ deepseek-r1 能做，但准确率不如 Claude
- FLOW-PLAN 格式校验 → deepseek-r1 能做

**价值**：省 token，但 deepseek-r1:7b 的代码理解能力远弱于 Claude，不适合做代码生成和测试编排这类核心任务。

**建议**：只分流纯校验类任务（格式检查、字段完整性检查），核心生成逻辑仍走 Claude。

### 方案 C：ollama 做测试报告摘要（边际价值）

**思路**：auto-ui-explorer 的 Step 6 测试报告很长，用 deepseek-r1:7b 在本地生成摘要，只把摘要传给 Claude 做 stage-report。

**价值**：小，因为报告本身是结构化的 markdown，Claude 生成它花不了多少 token。

### 结论

| 方案 | 投入 | token 节省 | 核心质量影响 | 推荐 |
|---|---|---|---|---|
| A. embedding 检索 | 中（写 retrieval 脚本） | 40-60% | 无 | ★★★ |
| B. 轻量任务分流 | 低 | 10-15% | 低（校验类不影响） | ★★ |
| C. 报告摘要 | 低 | 5% | 无 | ★ |

**推荐路径**：先做优化 1-4（零成本，立即见效），再投入方案 A（embedding 检索）做长期优化。方案 B/C 作为补充。

## 五、预期效果

| 优化项 | 状态 | 预期 token 节省 |
|---|---|---|
| auto-ui-explorer SKILL.md 瘦身 | ✅ 已做 | 5-8% |
| references 懒加载提示 | 待做 | 10-15% |
| frontend-page-design references 拆分 | 待做 | 8-12% |
| module-flow context 精简 | 待做 | 10-15% |
| snapshot 精简 | 待做 | 15-20% |
| ollama embedding 检索 | 待做 | 40-60% |

**零成本优化合计预期**：40-50% token 节省
**加上 ollama 后**：60-70% token 节省
