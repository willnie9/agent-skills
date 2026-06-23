# Agent Skill Pipeline · 多智能体技能编排框架

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Skills](https://img.shields.io/badge/Skills-7-blue.svg)](#skill-清单)
[![Framework](https://img.shields.io/badge/Framework-Claude%20Code-green.svg)](https://docs.anthropic.com/claude-code)
[![Stack](https://img.shields.io/badge/Stack-Vue3%20%7C%20Element%20Plus%20%7C%20Vite-orange.svg)](#两层架构架构通用实现可换)

**一句自然语言指令 → 自动完成「设计稿解析 → 接口代码生成 → 页面组装 → 浏览器验收 → Bug 修复」全流程。**

7 个 AI Skill 协同编排，用 **JSON Schema 硬契约 + Harness Hook 拦截 + Stage Gate 门禁** 替代 prompt 约束——上下文越长 AI 越漂移，靠 prompt 写"别忘 X"扛不住，必须把约束做进 harness 层。

## 为什么需要这个

现有的 AI 编程工具（Cursor / Copilot / Windsurf）擅长写单文件代码，但在"从设计稿到完整模块"这类**多步骤、跨工具、需要严格契约**的任务上会出问题：丢步骤、漏校验、上下文越长漂移越严重。

本项目用 **skill 编排 + 硬契约** 解决：

- **Schema 强制校验**每个阶段的产物——不再靠"AI 别忘了生成 API 文件"
- **Harness Hook 拦截**非法操作——不是 prompt 里写一句"请遵守"的软约束
- **Stage Gate 门禁**验证上游产物通过才放下游执行
- **失败语义分级**——关键阶段（A/B/C）失败熔断，非关键阶段（A.recall/D）警告不打断

> 当前实现基于 Claude Code skill 体系，但**架构层**（schema / hook / 决策树 / stage-gate）与具体 agent 框架无关。换到 LangGraph / AutoGen / QoderWork 等平台只需替换实现层脚本，骨架和契约不动。

---

## 两层架构：架构通用，实现可换

- **架构层**：JSON Schema 硬契约 / SKILL.md 决策树 / Step 0 自检 / harness hook 拦截 / 失败语义分级。这部分跟具体技术栈无关。
- **实现层**：当前跑通的是 MasterGo + YApi + Vue3 + Element Plus + 阿里云效。换栈只需要替换实现层脚本，骨架和契约不动。

## 体系全景图

```
                    ┌──────────────────────────────────────┐
                    │  module-flow ·总调度器                 │
                    │  解析任务指令 → 编排 A→B→C→A.recall→D  │
                    └──────────────────────────────────────┘
                              │       │       │       │
                Stage A       │   Stage B  Stage C  Stage D
                              ▼       ▼       ▼       ▼
              ┌──────────────────┐  ┌─────────────┐  ┌──────────────────────┐  ┌──────────────────┐
              │ master-go-to-code│  │yapi-to-code │  │frontend-page-design │  │playwright-skill  │
              │                  │  │             │  │                      │  │                  │
              │ MasterGo URL     │  │ YApi URL    │  │ dom-tree + define   │  │ MCP 浏览器 smoke  │
              │  → dom-tree.json │  │  → define.ts│  │  → Vue SFC + 路由   │  │  → 截图 + 报告    │
              │  → svg-paths     │  │  → api.ts   │  │  → 菜单 + Hooks      │  │                  │
              │  → 图片资源       │  │             │  │                      │  │                  │
              └──────────────────┘  └─────────────┘  └──────────────────────┘  └──────────────────┘
                       │                  │                   │
                       └──────────────────┴───────────────────┘
                              ⬇️ stage-report.json + JSON Schema 硬契约校验 ⬇️

              ┌──────────────────────────────────────────────────┐
              │  auto-ui-explorer · E2E 测试编排                   │
              │  全模块扫描 → baseline 持久化 → 增量回归           │
              └──────────────────────────────────────────────────┘

              ┌──────────────────────────────────────────────────┐
              │  yunxiao-bug-fix ·业务 SOP                        │
              │  云效 Bug 全生命周期，可委托上面任一 skill         │
              └──────────────────────────────────────────────────┘

                              ⬇️ harness 层 hook 强制执行 ⬇️

              ┌──────────────────────────────────────────────────┐
              │  hooks/ · 6 个 PreToolUse / PostToolUse           │
              │  auto-mode-guard / validate-yunxiao-comment       │
              │  enforce-rough-first / enforce-source-read        │
              │  validate-stage-products / enforce-baseline-persist│
              └──────────────────────────────────────────────────┘
```

## 前置条件

- [Claude Code](https://docs.anthropic.com/claude-code) 已安装并配置
- Node.js >= 18
- 业务项目使用 Vue 3 + Element Plus（其他技术栈需自行替换实现层脚本）
- 配置好对应 MCP 服务（见 [MCP 配置](#mcp-配置)）：
  - `mastergo-magic-mcp` — 设计稿解析
  - `yapi-auto-mcp` — 接口生成
  - `aliyun-yunxiao` — 云效 Bug（可选）
  - `playwright` — 浏览器自动化

## Quick Start

```bash
# 1. 克隆仓库
git clone https://github.com/willnie9/agent-skills.git /tmp/agent-skills

# 2. 在你的项目根目录创建 .claude/skills/ 并复制技能
cd your-project
mkdir -p .claude/hooks .claude/skills .claude/state .claude/results

# 3. 复制所有技能（或按需选择）
cp -r /tmp/agent-skills/{module-flow,master-go-to-code,yapi-to-code,frontend-page-design,playwright-skill,auto-ui-explorer,yunxiao-bug-fix,_shared} .claude/skills/
cp /tmp/agent-skills/project.config.json .claude/skills/
cp -r /tmp/agent-skills/schemas .claude/skills/
cp /tmp/agent-skills/hooks/*.mjs .claude/hooks/
cp /tmp/agent-skills/settings.sample.json .claude/settings.json

# 4. 安装依赖（仅 master-go-to-code 需要）
cd .claude/skills/master-go-to-code && npm install && cd -

# 5. 配置 playwright-skill
cp .claude/skills/playwright-skill/config/playwright-skill.config.example.json \
   .claude/skills/playwright-skill/config/playwright-skill.config.json
# 编辑配置文件，填入你的 baseURL、登录 selector

# 6. 适配项目结构
# 编辑 .claude/skills/project.config.json，填入你的 viewsDir、cacheDir、routerFiles 等
```

配置完成后，在 Claude Code 中说一句话即可触发：

> "帮我建一个【客户列表】模块，设计稿链接是 `https://mastergo.com/...`，YApi 项目 ID 是 `28`。走 auto 模式直接跑全流程。"

详细安装步骤见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## Skill 目录约定

```
<skill-name>/
├── SKILL.md           ← 主入口，决策树 + 触发条件 + 委托规则
├── references/        ← 详细规范、模板、踩坑（按需加载）
├── schemas/           ← JSON Schema 硬契约（产物结构）
└── scripts/           ← 自动校验脚本（Step 0 / Stage 切换时跑）
```

## Skill 清单

| Skill | 版本 | 角色 |
|---|---|---|
| [module-flow](./module-flow/SKILL.md) | v2.2.0 | 总调度器，5 个场景入口（新建 / 增量 / 迭代 / 重构） |
| [master-go-to-code](./master-go-to-code/SKILL.md) | v2.3.0 | MasterGo DSL → dom-tree + 图片资源 |
| [yapi-to-code](./yapi-to-code/SKILL.md) | v2.2.0 | YApi → TS 类型 + 请求函数 |
| [frontend-page-design](./frontend-page-design/SKILL.md) | v2.2.0 | 组装 Vue SFC + 路由 + 菜单 |
| [auto-ui-explorer](./auto-ui-explorer/SKILL.md) | v7.1.0 | 全模块 E2E 测试编排 + baseline 持久化 + 增量回归 |
| [playwright-skill](./playwright-skill/SKILL.md) | v8.0.0 | MCP 浏览器 smoke 验收 |
| [yunxiao-bug-fix](./yunxiao-bug-fix/SKILL.md) | v3.2.0 | 云效 Bug 全生命周期 SOP |

## Harness Hook（已落盘到 `hooks/`）

`harness` 层强制执行的 6 个 hook，注册在项目根 `.claude/settings.json`：

| Hook | 触发 | 做什么 |
|---|---|---|
| `auto-mode-guard.mjs` | PreToolUse on AskUserQuestion / ExitPlanMode | auto 模式下拦截非白名单交互（白名单：MCP/git/输入缺失/schema fail/dev server/e2e 定位） |
| `validate-yunxiao-comment.mjs` | PreToolUse on `mcp__aliyun-yunxiao__create_work_item_comment` | 评论缺关键章节 → block |
| `enforce-rough-first.mjs` | PreToolUse on Write/Edit | 粗转 dom-tree 未完成不允许写精修产物 |
| `enforce-source-read.mjs` | PreToolUse on Write SP 用例 | 没读源码的 source-read flag → 不允许凭空写 SP |
| `validate-stage-products.mjs` | PreToolUse on Task | Stage B/C/A.recall/D 启动前查上一阶段 stage-report.json 是否 pass/warn |
| `enforce-baseline-persist.mjs` | PostToolUse on Write/Edit | SP 结果写完但 baseline.json >60s 未更新 → 警告 |

剩下散落在 SKILL.md 里的「铁律 N 条」是软约束（依赖 AI 自觉遵守），覆盖命名规范、交互礼仪、组件选用这类 AI 一般能做到的规则。**取舍标准：AI 天然倾向违反 + 失败级联严重的才上真 hook，其他用文字约束。** 详见 [设计决策](./docs/DESIGN-DECISIONS.md)。

## _shared 共享层

```
_shared/
├── schemas/
│   ├── stage-report.schema.json     ← 所有 stage 报告统一格式
│   ├── common-response.schema.json  ← 项目后端响应壳
│   └── module-code.schema.json      ← MODULE_CODE 权限编码
└── lib/
    ├── stage-validator.mjs   ← JSON Schema 通用校验器
    ├── stage-gate.mjs        ← stage 切换 gate 检查器
    ├── preflight.mjs         ← 通用环境自检
    ├── parse-urls.mjs        ← URL 解析（mastergo / yapi / 云效）
    └── report-generator.mjs  ← 产物清单 + git 建议
```

## 设计原则

1. **机制 > 文字**：能用 hook 拦的不靠 prompt 求；能用 schema 校验的不靠"读完铁律 N 条"
2. **决策树主入口**：SKILL.md 控制在主流程内，详细规范拆 references/
3. **Step 0 自检**：环境变量、依赖、配置文件、上游产物，任一缺失立即停
4. **失败语义分级**：A/B/C 任一失败熔断；A.recall / D 失败警告不打断
5. **委托优于复制**：能委托给下游 skill 的事不在本 skill 重复实现

## 上下游契约

跨 skill 共用的中间产物：

| 产物 | 生产者 | 消费者 | Schema |
|---|---|---|---|
| `dom-tree.json` | master-go-to-code | frontend-page-design | `master-go-to-code/schemas/dom-tree-v1.schema.json` |
| `svg-paths.json` | master-go-to-code | frontend-page-design | `master-go-to-code/schemas/svg-paths.schema.json` |
| `define.ts / api.ts` | yapi-to-code | frontend-page-design | TS 类型系统 |
| `.claude/results/<module>/stage-*.json` | 每个 skill 末尾产 | module-flow gate + hook | `_shared/schemas/stage-report.schema.json` |
| API 响应 | 项目后端 | 全 skill | `_shared/schemas/common-response.schema.json` |

## MCP 配置

需要在项目根 `.mcp.json` 配置：

| MCP | 用于 |
|---|---|
| `mastergo-magic-mcp` | master-go-to-code |
| `yapi-auto-mcp` | yapi-to-code |
| `aliyun-yunxiao` | yunxiao-bug-fix |
| `playwright` | playwright-skill / auto-ui-explorer |

## 文档导航

- [Quick Start](#quick-start) — 5 分钟安装到你的项目
- [使用手册](./使用手册.md) — 7 种触发场景的话术 + 行为契约
- [文件树](./文件树.md) — 每个脚本和 schema 的具体作用
- [docs/STATUS.md](./docs/STATUS.md) — 各 skill 版本和触发关键词速查
- [docs/WORKFLOW.md](./docs/WORKFLOW.md) — 7 个场景的完整流程详解
- [docs/GLOSSARY.md](./docs/GLOSSARY.md) — 术语中英对照
- [docs/DESIGN-DECISIONS.md](./docs/DESIGN-DECISIONS.md) — 架构设计思路与 trade-off 分析
- [examples/](./examples/) — 示例产物（stage-report、dom-tree 片段）

## 改 / 扩 skill 的约定

新增 skill：

1. 建 `<name>/` 目录，创建 `SKILL.md` + 可选 `references/` `schemas/` `scripts/`
2. SKILL.md 主流程控制在合理范围（决策树+委托规则为主，详细规范拆 references/）
3. frontmatter：`name` / `description` / `version`，description 禁止含 `---`
4. 末尾加 `## Changelog`
5. 同步更新 [docs/STATUS.md](./docs/STATUS.md)

## 借鉴的官方 / 社区实践

| 来源 | 借鉴点 |
|---|---|
| [anthropics/skills](https://github.com/anthropics/skills) | frontmatter 规范、references/scripts 子目录结构 |
| anthropic/skill-creator | 祈使句 + Theory of Mind 风格 |
| anthropic/webapp-testing | 决策树 + 模式 + Common Pitfall 风格 |
| anthropic/mcp-builder | JSON Schema 硬契约的应用 |
