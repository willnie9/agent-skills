# Agent Skill Pipeline · 多智能体技能编排框架

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Skills](https://img.shields.io/badge/Skills-9-blue.svg)](#skill-清单)
[![Framework](https://img.shields.io/badge/Framework-Claude%20Code-green.svg)](https://docs.anthropic.com/claude-code)
[![Stack](https://img.shields.io/badge/Stack-Vue3%20%7C%20Element%20Plus%20%7C%20Vite-orange.svg)](#两层架构架构通用实现可换)

**面向前端工程化研发的 AI Skill 体系——「模块开发」与「Bug 修复 / 浏览器验证」两条平行主线，按需独立触发或自由组合。**

用 **JSON Schema 硬契约 + Harness Hook 拦截 + Stage Gate 门禁** 替代纯 prompt 约束——上下文越长 AI 越漂移，单靠 prompt 约束不可靠，必须把约束做进 harness 层。

## 为什么需要这个

现有的 AI 编程工具（Cursor / Copilot / Windsurf）擅长写单文件代码，但在"从设计稿到完整模块"这类**多步骤、跨工具、需要严格契约**的任务上会出问题：丢步骤、漏校验、上下文越长漂移越严重。

本项目用 **skill 编排 + 硬契约** 解决：

- **Schema 强制校验**每个阶段的产物——不依赖 AI 自觉遵守流程
- **Harness Hook 拦截**非法操作——不是 prompt 里写一句"请遵守"的软约束
- **Stage Gate 门禁**验证上游产物通过才放下游执行
- **失败语义分级**——关键阶段（A/B/C）失败熔断，非关键阶段（A.recall/D）警告不打断

> 当前实现基于 Claude Code skill 体系，但**架构层**（schema / hook / 决策树 / stage-gate）与具体 agent 框架无关。换到 LangGraph / AutoGen / QoderWork 等平台只需替换实现层脚本，骨架和契约不动。

---

## 两层架构：架构通用，实现可换

- **架构层**：JSON Schema 硬契约 / SKILL.md 决策树 / Step 0 自检 / harness hook 拦截 / 失败语义分级。这部分跟具体技术栈无关。
- **实现层**：当前跑通的是 MasterGo + YApi + Vue3 + Element Plus + 阿里云效。换栈只需要替换实现层脚本，骨架和契约不动。

## 体系全景图

> **核心设计**：**开发流**与**修 Bug 流**是两条完全平行的主线，**浏览器验证**是两者共用的公共平行底座（也可单独直跑）。各模块通过 `project.config.json` 与标准中间契约解耦，输入源（MasterGo / YApi）、前端框架（Vue3）和工单插件（云效）均可按需替换或裁剪。

```
================================================================================
              两条平行研发主线（互不隶属，各自闭环，按场景独立触发）
================================================================================

  【主线 A：功能/模块开发流】                  【主线 B：缺陷修复流 (独立)】
   module-flow (按目标调度开发)                yunxiao-bug-fix (可选独立 SOP)
   A→B→C→A.recall→D                           拉取单据 → 源码定位 → 最小化修复
     ├─ [输入源·可换] master-go-to-code
     ├─ [输入源·可换] yapi-to-code
     └─ [框架层·可选] frontend-page-design

  【可选前置能力（可独立运行或按需串联）】
   mastergo-subdsl-package → backend-gap-mock-plan → module-flow
   设计交付包                 后端方案               完整开发
   只要文档时在对应步骤结束，不继续向下运行
================================================================================
              公共平行能力：浏览器验证底座 & Harness 质量门禁
================================================================================
  • playwright-skill   ── 通用 MCP 浏览器操作底座（打开 / 点击 / 截图 / 验收）
  • auto-ui-explorer   ── 按前端框架定制的全模块 E2E 扫描与增量回归
  • hooks/ + _shared/  ── 6 个 Pre/PostToolUse 硬门禁 + JSON Schema 产物校验
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
cp -r /tmp/agent-skills/{module-flow,mastergo-subdsl-package,backend-gap-mock-plan,master-go-to-code,yapi-to-code,frontend-page-design,playwright-skill,auto-ui-explorer,yunxiao-bug-fix,_shared} .claude/skills/
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

## Skill 清单（按工程定位分类）

| 分类 | Skill | 版本 | 定位与可替换性 |
|---|---|---|---|
| **开发流编排** | [module-flow](./module-flow/SKILL.md) | v2.3.0 | 目标分流与模块开发编排器（新建 / 增量 / 迭代 / 重构），**换框架不用动** |
| **独立前置能力** | [mastergo-subdsl-package](./mastergo-subdsl-package/SKILL.md) | v1.0.0 | 外层容器 → 子 DSL、截图映射、设计文档，可选深层审计 |
| **独立前置能力** | [backend-gap-mock-plan](./backend-gap-mock-plan/SKILL.md) | v1.0.0 | 需求/设计包 + 现有代码 → 后端缺口方案与 Mock 接入约定 |
| **输入源 (可换)** | [master-go-to-code](./master-go-to-code/SKILL.md) | v2.3.1 | UI 设计源：MasterGo DSL → `dom-tree.json`（可换 Figma 等） |
| **输入源 (可换)** | [yapi-to-code](./yapi-to-code/SKILL.md) | v2.2.0 | API 契约源：YApi → `define.ts` + `api.ts`（可换 Swagger/Apifox） |
| **框架层 (可选)** | [frontend-page-design](./frontend-page-design/SKILL.md) | v2.2.0 | DSL → Vue3 SFC + 路由 + 菜单（随前端技术栈选配） |
| **公共验证底座** | [playwright-skill](./playwright-skill/SKILL.md) | v8.0.0 | **通用** MCP 浏览器操作与 smoke 验收底座（开发/修 Bug 共用） |
| **公共验证底座** | [auto-ui-explorer](./auto-ui-explorer/SKILL.md) | v7.1.0 | 全模块 E2E 扫描 + `baseline.json` 增量回归（组件规则随框架） |
| **独立流 (可选)** | [yunxiao-bug-fix](./yunxiao-bug-fix/SKILL.md) | v3.2.0 | **独立可选**：云效 Bug 定位、修复、浏览器验证与回帖闭环 |

## 按目标独立使用或串联

两个前置 skill 可单独运行，由 `module-flow` 按用户目标关联调用。MasterGo 链接本身不会启动开发，出包完成也不会自动分析后端。

| 目标示例 | 执行方式 |
|---|---|
| “整理这个外层容器，出设计文档，递归到三级” | 只运行 `mastergo-subdsl-package`，交付即结束 |
| “根据设计包和现有模块，看看后端缺什么” | 只运行 `backend-gap-mock-plan`，交付方案即结束 |
| “先整理设计，再出接口方案，先不开发” | 设计出包 → 后端分析 |
| “按这个设计做功能，后端没好，先 Mock” | 按需出包 → 后端分析 → 原开发与验证阶段 |
| “设计包和方案已有，继续开发” | 核对并复用产物，补齐实现与验证 |

`auditDepth` 默认 2，子 DSL 已包含完整子树；3 及以上额外导出 `audit/` 中的局部节点。设计包仍需通过 `master-go-to-code` 生成 `dom-tree.json` / `svg-paths.json` 才能交给页面组装。编排字段和衔接细节见 [目标分流规则](module-flow/references/intent-routing.md)。

## 7 大场景暗号与人机交互规则

> **硬性规则**：**只要用户没有明确指认 `场景1`~`场景7`（或 `#1`~`#7`），无条件直接触发 `AskUserQuestion` 确认场景**（严禁靠猜直接开跑，哪怕带了 `auto` 也必须先确认场景）。确认场景后，再按对应清单追问缺参及执行范围。

| 场景 | 固定暗号 | 涉及 Skill 组合 | 必触发的人机交互 |
|---|---|---|---|
| **场景 1** *(新模块·有接口)* | `场景1` / `#1` / `新模块` | `module-flow` → `master-go-to-code` + `yapi-to-code` → `frontend-page-design` → `playwright-skill` | 缺设计稿/YApi 先追问（缺 YApi 问补接口还是改走 Mock）；参数齐后必问：**是否组装 Vue？是否浏览器验证？** |
| **场景 2** *(新模块·先 Mock)* | `场景2` / `#2` / `Mock开发` | `module-flow` → *(可选)* `mastergo-subdsl-package` + `backend-gap-mock-plan` → `master-go-to-code` → `frontend-page-design` → `playwright-skill` | 必问：**是否先出设计包/后端缺口方案？Mock 还是静态？是否组装 Vue 及浏览器验证？** |
| **场景 3** *(只出前置文档)* | `场景3` / `#3` / `只出文档` | `mastergo-subdsl-package` / `backend-gap-mock-plan` | 必问：**只出设计包 / 只出后端方案 / 两个都出？截图目录与细查深度？**（出完即停） |
| **场景 4** *(老模块迭代改造)* | `场景4` / `#4` / `增量` / `迭代` / `重构` | `module-flow` → `playwright-skill`(定位) → `master-go-to-code` + *(可选)* `yapi-to-code` → `frontend-page-design` → `playwright-skill` | 必问：**模块名？改造方式（增量/迭代/重构）？有无新接口？改完是否浏览器回归？** |
| **场景 5** *(纯接口/换真接口)* | `场景5` / `#5` / `只转接口` / `换真接口` | `yapi-to-code` + *(可选)* `backend-gap-mock-plan` + `playwright-skill` | 必问：**仅生成 `define.ts/api.ts`，还是对照方案替换现有 Mock？是否浏览器联调？** |
| **场景 6** *(修 Bug 闭环)* | `场景6` / `#6` / `修bug` | `yunxiao-bug-fix`*(可选)* + `playwright-skill` | 必问：**有无云效单号（走云效还是纯本地修）？修完是否开浏览器验真？** |
| **场景 7** *(独立测试/E2E)* | `场景7` / `#7` / `测一下` / `E2E` | `playwright-skill` / `auto-ui-explorer` | 必问：**用 `playwright-skill` 临时点检页面，还是用 `auto-ui-explorer` 跑模块 E2E 回归？目标路由/模块？** |

完整交互协议与阶段门禁见 [module-flow/SKILL.md](./module-flow/SKILL.md)。

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
| `manifest.json` / `ai-page-context.md` / 子 DSL | mastergo-subdsl-package | backend-gap-mock-plan / module-flow（选择场景） | `mastergo-subdsl-package/references/output-schema.md`（格式说明） |
| `backend-interface-plan.md` | backend-gap-mock-plan | 开发任务的接口 / Mock 实现阶段 | `backend-gap-mock-plan/references/plan-template.md`（模板） |
| `dom-tree.json` | master-go-to-code | frontend-page-design | `master-go-to-code/schemas/dom-tree-v1.schema.json` |
| `svg-paths.json` | master-go-to-code | frontend-page-design | `master-go-to-code/schemas/svg-paths.schema.json` |
| `define.ts / api.ts` | yapi-to-code | frontend-page-design | TS 类型系统 |
| `.claude/results/<module>/stage-*.json` | 每个 skill 末尾产 | module-flow gate + hook | `_shared/schemas/stage-report.schema.json` |
| API 响应 | 项目后端 | 全 skill | `_shared/schemas/common-response.schema.json` |

## MCP 配置

需要在项目根 `.mcp.json` 配置：

| MCP | 用于 |
|---|---|
| `mastergo-magic-mcp` | master-go-to-code / mastergo-subdsl-package |
| `yapi-auto-mcp` | yapi-to-code |
| `aliyun-yunxiao` | yunxiao-bug-fix |
| `playwright` | playwright-skill / auto-ui-explorer |

## 文档导航

- [Quick Start](#quick-start) — 5 分钟安装到你的项目
- [使用手册](./使用手册.md) — 独立出包、后端方案及开发/验证触发示例
- [文件树](./文件树.md) — 每个脚本和 schema 的具体作用
- [docs/STATUS.md](./docs/STATUS.md) — 各 skill 版本和触发关键词速查
- [docs/WORKFLOW.md](./docs/WORKFLOW.md) — 文档目标分流及 7 个开发/验证场景详解
- [docs/GLOSSARY.md](./docs/GLOSSARY.md) — 术语中英对照
- [docs/DESIGN-DECISIONS.md](./docs/DESIGN-DECISIONS.md) — 架构设计思路与 trade-off 分析
- [examples/](./examples/) — 示例产物（stage-report、dom-tree 片段）

## 改 / 扩 skill 的约定

新增 skill：

1. 建 `<name>/` 目录，创建 `SKILL.md` + 可选 `references/` `schemas/` `scripts/`
2. SKILL.md 主流程控制在合理范围（决策树+委托规则为主，详细规范拆 references/）
3. frontmatter：`name` / `description`；版本可用仓库既有 `version` 或兼容 Codex 校验的 `metadata.version`，description 禁止含 `---`
4. 末尾加 `## Changelog`
5. 同步更新 [docs/STATUS.md](./docs/STATUS.md)

## 借鉴的官方 / 社区实践

| 来源 | 借鉴点 |
|---|---|
| [anthropics/skills](https://github.com/anthropics/skills) | frontmatter 规范、references/scripts 子目录结构 |
| anthropic/skill-creator | 祈使句 + Theory of Mind 风格 |
| anthropic/webapp-testing | 决策树 + 模式 + Common Pitfall 风格 |
| anthropic/mcp-builder | JSON Schema 硬契约的应用 |
