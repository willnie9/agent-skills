# AI Agent Skills · 长链路开发流水线

一套多 agent 编排的工程实践，核心是**用工程手段（schema + hook + 决策树）替代 prompt 求模型**，解决长链路开发里 AI 漂移、幻觉、忘字段的老问题。

## 核心定位：架构通用，实现可换

这套项目分两层：

- **架构层（完全通用）**：Stage-Gates / JSON Schema 硬契约 / SKILL.md 决策树 / Step 0 自检 / Auto mode hook 拦截 / 失败语义分级。**这 5 条不绑定任何技术栈，任何 AI 工作流都能用。**
- **实现层（参考实现 #1）**：当前跑通的是 MasterGo + YApi + Vue3 + Element Plus + 阿里云效这一套。这是**第一个落地的具体实现**，不是唯一答案。

**换技术栈不需要重写架构，只需要替换实现层的脚本**：MasterGo → Figma、YApi → Swagger、Vue → React 这些替换都是预期内的，整套流水线的步骤、契约、失败处理逻辑保持不变。这是设计意图，不是缺陷。

我们欢迎社区贡献「参考实现 #2、#3」：Figma + Swagger + React、Sketch + Apifox + Solid 等等。架构本身已经验证可行，你只要按 stage 契约产出符合 schema 的中间产物，就能无缝接入。

## 它解决的实际问题

把 LLM 用在长链路开发上，最大的坑不是"模型不够聪明"，而是**上下文越长、产物越漂移**。一段「读设计稿 → 拆组件 → 对接 API → 生成代码 → 跑测试」的工作流如果全靠一个超长 prompt 扛住，模型会在第三、第四步开始忘字段、改类型、漏接口。

这套实现的核心做法是**用工程手段替代 prompt 求模型**：

- **Stage 之间过 JSON Schema**——上游产物不符合 schema 直接熔断，不让脏数据流入下游 agent
- **SKILL.md 只放决策树**——详细规范拆 references/，按需加载，避免 skill 自身把上下文吃满
- **Auto 模式用 hook 拦截交互**——而不是在 prompt 里求模型"别问问题"
- **A/B/C 失败熔断、D 失败警告**——结构错误必须停，验收失败不该把已经生成的代码全否

这些做法都不是发明，都是在 Anthropic skill 体系、MCP 文档、社区博客里能找到的招式。**这套工程的价值在于把它们组合到一个真实跑通的业务链路上**，包含每一步的实际取舍。

## 换技术栈怎么换

整套流水线的"骨架"由 stage 契约和决策树定义，跟具体工具无关。要换栈，只动**实现层**这三类东西：

| 替换什么 | 改哪里 | 不动什么 |
|---|---|---|
| 设计源（MasterGo → Figma / Sketch / 自研） | `master-go-to-code/scripts/` 下的解析脚本 | dom-tree.schema.json（产物结构契约） |
| 接口源（YApi → Swagger / Apifox / Postman） | `yapi-to-code/scripts/` | TS define / api 文件结构 |
| 代码目标（Vue → React / Solid / Flutter） | `frontend-page-design/references/` 模板 | 决策树 + Stage C 输入契约 |
| Bug 系统（云效 → Jira / PingCode / 禅道） | `yunxiao-bug-fix/scripts/` 单号解析 + 评论接口 | SOP 流程 + 截图回收逻辑 |

只要你新写的脚本**产出符合既有 schema 的中间产物**，下游 stage 完全无感。这就是架构通用的含义。

架构层（5 条核心做法）跨栈零成本——这是最值得带走的东西。换栈时具体踩坑提示散落在各 skill 的 `references/common-pitfalls.md` 里，按需查阅。

## 体系全景图

```
                    ┌──────────────────────────────────────┐
                    │  module-flow (v1.0.0)·总调度器         │
                    │  解析任务指令 → 编排 A→B→C→D            │
                    └──────────────────────────────────────┘
                              │       │       │       │
                Stage A       │   Stage B  Stage C  Stage D
                              ▼       ▼       ▼       ▼
              ┌──────────────────┐  ┌─────────────┐  ┌──────────────────────┐  ┌──────────────────┐
              │ master-go-to-code│  │yapi-to-code │  │frontend-page-design │  │playwright-skill  │
              │     v1.0.0       │  │   v1.0.0    │  │      v1.0.0          │  │     v1.0.0       │
              │                  │  │             │  │                      │  │                  │
              │ MasterGo URL     │  │ YApi URL    │  │ dom-tree.json +     │  │ skill flows/     │
              │  → DSL → dom-tree│  │  → define.ts│  │  define.ts/api.ts   │  │  自包含 v7+      │
              │  → svg-paths.json│  │  → api.ts   │  │  → Vue SFC + 路由   │  │                  │
              │  → 图片资源       │  │             │  │  → 菜单 + Hooks      │  │                  │
              └──────────────────┘  └─────────────┘  └──────────────────────┘  └──────────────────┘
                       │                  │                   │
                       └──────────────────┴───────────────────┘
                              ⬇️ 通过 _shared/schemas + scripts 硬契约校验 ⬇️

              ┌──────────────────────────────────────────────────┐
              │  yunxiao-bug-fix (v1.0.0)·业务 SOP                │
              │  云效 Bug 全生命周期,Step 4 可委托上面任一 skill │
              └──────────────────────────────────────────────────┘
```

## 工程化目录约定

每个 skill 是独立目录：

```
<skill-name>/
├── SKILL.md           ← 主入口,~100-200 行,只放决策树+检查点+委托规则
├── references/        ← 详细规范、模板、踩坑(SKILL.md 用相对路径引用)
│   ├── *.md
│   └── ...
├── schemas/           ← JSON Schema 硬契约(中间产物结构锁死)
│   └── *.schema.json
└── scripts/           ← 自动校验脚本(在 Step 0/Step 4 自动跑)
    └── *.mjs
```

## Skill 清单

| Skill | 版本 | references | schemas | scripts |
|-------|------|---|---|---|
| [module-flow](./module-flow/SKILL.md) | v1.0.0 | 6 个 | 1 个 | - |
| [master-go-to-code](./master-go-to-code/SKILL.md) | v1.0.0 | 4 个 | 2 个 | 1 个 |
| [yapi-to-code](./yapi-to-code/SKILL.md) | v1.0.0 | 5 个 | - | - |
| [frontend-page-design](./frontend-page-design/SKILL.md) | v1.0.0 | 6 个 | - | - |
| [playwright-skill](./playwright-skill/SKILL.md) | v1.0.0 | - | 1 (config) | 仅 config + SKILL.md |
| [yunxiao-bug-fix](./yunxiao-bug-fix/SKILL.md) | v1.0.0 | - | - | - |

## _shared 共享层

跨多个 skill 复用的资源：

```
_shared/
├── schemas/
│   ├── common-response.schema.json   ← CommonResponse / CommonDataResponse / PaginationDataList
│   └── module-code.schema.json       ← MODULE_CODE 权限编码 + 占位策略
└── lib/
    └── stage-validator.mjs           ← 通用 JSON Schema 校验器(简易 + 可选 ajv)
```

详见 [_shared/README.md](./_shared/README.md)。

## 设计原则

1. **少即是多**：SKILL.md 只放“决策 + 委托”，详细规范拆 references/
2. **硬契约 > 软文档**：中间产物用 JSON Schema 锁死，Step 0/4 自动校验，不让脏数据传到下游
3. **Reconnaissance-Then-Action**：先自检环境/读项目状态再动手，违反这一条踩坑最多
4. **委托优于复制**：能委托给下游 skill 的工作绝不重复实现
5. **失败立即停 / Stage D 例外**：A/B/C 失败雪崩；D 失败警告不打断

## 上下游契约

每个 skill 的 SKILL.md 末尾必含「上下游契约」段：输入 schema + 输出 schema。这是 skill 之间“咬合”的硬接口。

跨 skill 共用的中间产物：

| 产物 | 生产者 | 消费者 | Schema |
|------|--------|--------|--------|
| `dom-tree.json` | master-go-to-code | frontend-page-design | `master-go-to-code/schemas/dom-tree-v1.schema.json` |
| `svg-paths.json` | master-go-to-code | frontend-page-design | `master-go-to-code/schemas/svg-paths.schema.json` |
| `define.ts / api.ts` | yapi-to-code | frontend-page-design | TS 类型系统(编译器即校验) |
| `playwright-skill/runtime/screenshots/*.png` | playwright-skill（MCP browser_take_screenshot） | yunxiao-bug-fix / module-flow Stage D | — |
| API 响应 | 项目后端 | 全 skill | `_shared/schemas/common-response.schema.json` |

## MCP 配置

需要在项目根目录的 `.mcp.json` 配置：

| MCP | 用于 |
|-----|------|
| `mastergo-magic-mcp` | master-go-to-code |
| `yapi-auto-mcp` | yapi-to-code |
| `aliyun-yunxiao` | yunxiao-bug-fix |
| `playwright` | playwright-skill（MCP browser_* 工具） |

## 典型触发方式

6 种日常触发场景（全自动生产线、纯 mock 页面、增量/重构、纯 API 对接、Playwright QA、云效 Bug 修复）的话术模板和行为契约整理在：

👉 **[《使用手册.md》](./使用手册.md)**

## 核心源码文件树说明

排查底层逻辑、查每一个处理脚本和 schema 的具体作用，参考：

👉 **[《文件树.md》](./文件树.md)**

## 改 / 扩 skill 的约定

新增 skill：

1. 建 `<name>/` 目录，创建 `SKILL.md` + 可选 `references/` `schemas/` `scripts/`
2. `SKILL.md` 控制 100-200 行（超 250 行说明可以拆 reference）
3. frontmatter：`name` / `description` / `version`，**description 禁止含 `---`**（YAML 会断）
4. 在 SKILL.md 末尾加 `## Changelog`
5. 同步更新 [STATUS.md](./docs/STATUS.md)

升级现有 skill：

- 改 `version`（SemVer）
- Changelog 加新条
- 同步 docs/STATUS.md

## 历史演进

- **2026-05-13 初版**：6 个 skill 协同，引入 module-flow
- **2026-05-13 优化版**：补 12 项 P0/P1/P2，加 Changelog，docs/STATUS.md
- **2026-05-13 v1.0.0 工程化规范重构**：压缩主 SKILL.md → 100-200 行，拆 references/schemas/scripts，建 _shared 共享层

## 借鉴的官方 / 社区实践

| 来源 | 借鉴点 |
|------|--------|
| [anthropics/skills](https://github.com/anthropics/skills) | frontmatter 规范、references/scripts 子目录结构、>300 行附 TOC |
| [anthropics/skills/skill-creator](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md) | 祈使句 + Theory of Mind 风格 |
| anthropic/webapp-testing | 决策树 + 模式 + Common Pitfall 风格 |
| anthropic/mcp-builder | Zod / JSON Schema 硬契约的应用 |
| [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) | skill 沉淀知识 / hook 触发 / agent 隔离的三层架构 |

**写作核心原则**：解释 Why 优先于堆砌列表；少即是多；硬 schema 优于软文档；先自检再动手。
