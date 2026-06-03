# Claude Code Skills · 长链路开发流水线

> **版本**：v1.1.0（2026-06-03）· 6 个真 hook 落盘到 `hooks/`，SKILL.md 区分真 hook 与软约束铁律

一套基于 Claude Code skill 体系的多 agent 编排，覆盖「设计稿 → 接口定义 → Vue3 页面 → E2E 验收 → Bug 修复」完整链路。

核心做法是**用工程手段（schema + harness hook + 决策树）替代 prompt 求模型**——上下文越长 AI 越漂移，靠 prompt 写"别忘 X"扛不住，必须把约束做进 harness 层。

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
              │  yunxiao-bug-fix ·业务 SOP                        │
              │  云效 Bug 全生命周期，可委托上面任一 skill         │
              └──────────────────────────────────────────────────┘

                              ⬇️ harness 层 hook 强制执行 ⬇️

              ┌──────────────────────────────────────────────────┐
              │  .claude/hooks/ · 6 个 PreToolUse / PostToolUse   │
              │  auto-mode-guard / validate-yunxiao-comment       │
              │  enforce-rough-first / enforce-source-read        │
              │  validate-stage-products / enforce-baseline-persist│
              └──────────────────────────────────────────────────┘
```

## Skill 目录约定

```
<skill-name>/
├── SKILL.md           ← 主入口，决策树 + 触发条件 + 委托规则
├── references/        ← 详细规范、模板、踩坑（按需加载）
├── schemas/           ← JSON Schema 硬契约（产物结构）
└── scripts/           ← 自动校验脚本（Step 0 / Stage 切换时跑）
```

## Skill 清单

| Skill | 角色 |
|---|---|
| [module-flow](./module-flow/SKILL.md) | 总调度器，5 个场景入口（新建 / 增量 / 迭代 / 重构） |
| [master-go-to-code](./master-go-to-code/SKILL.md) | MasterGo DSL → dom-tree + 图片资源 |
| [yapi-to-code](./yapi-to-code/SKILL.md) | YApi → TS 类型 + 请求函数 |
| [frontend-page-design](./frontend-page-design/SKILL.md) | 组装 Vue SFC + 路由 + 菜单 |
| [playwright-skill](./playwright-skill/SKILL.md) | MCP 浏览器 smoke 验收 |
| [auto-ui-explorer](./auto-ui-explorer/SKILL.md) | 自动化 UI 测试 + baseline 持久化 |
| [yunxiao-bug-fix](./yunxiao-bug-fix/SKILL.md) | 云效 Bug 全生命周期 SOP |

## 真 hook（已落盘到 `.claude/hooks/`）

`harness` 层强制执行的 6 个 hook，注册在项目根 `.claude/settings.json`：

| Hook | 触发 | 做什么 |
|---|---|---|
| `auto-mode-guard.mjs` | PreToolUse on AskUserQuestion / ExitPlanMode | auto 模式下拦截非白名单交互（白名单：MCP/git/输入缺失/schema fail/dev server/e2e 定位） |
| `validate-yunxiao-comment.mjs` | PreToolUse on `mcp__aliyun-yunxiao__create_work_item_comment` | 评论缺关键章节 → block |
| `enforce-rough-first.mjs` | PreToolUse on Write/Edit | 粗转 dom-tree 未完成不允许写精修产物 |
| `enforce-source-read.mjs` | PreToolUse on Write SP 用例 | 没读源码的 source-read flag → 不允许凭空写 SP |
| `validate-stage-products.mjs` | PreToolUse on Task | Stage B/C/A.recall/D 启动前查上一阶段 stage-report.json 是否 pass/warn |
| `enforce-baseline-persist.mjs` | PostToolUse on Write/Edit | SP 结果写完但 baseline.json >60s 未更新 → 警告 |

剩下散落在 SKILL.md 里的「铁律 N 条」是软约束（依赖 Claude 自觉遵守），覆盖命名规范、交互礼仪、组件选用这类 AI 一般能做到的规则。**取舍标准：AI 天然倾向违反 + 失败级联严重的才上真 hook，其他用文字约束。**

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

- [《使用手册.md》](./使用手册.md) — 6 种触发场景的话术 + 行为契约
- [《文件树.md》](./文件树.md) — 每个脚本和 schema 的具体作用
- [docs/STATUS.md](./docs/STATUS.md) — 各 skill 版本和触发关键词速查
- [docs/WORKFLOW.md](./docs/WORKFLOW.md) — 7 个场景的完整流程详解
- [docs/GLOSSARY.md](./docs/GLOSSARY.md) — 术语中英对照

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
