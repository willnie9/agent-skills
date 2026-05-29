# Claude Code Skills · 前端 SaaS 项目通用 skill 体系

本目录是项目的"能力包"集合,工程化规范(v1.0.0 重构)。每个 skill 是一个**独立的工程级流水线**:SKILL.md 简短决策树 + references/ 详细规范 + schemas/ 硬契约 + scripts/ 校验脚本。

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

## 工程化目录约定(v1.0.0)

每个 skill 是独立目录:

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

## Skill 清单(v1.0.0 工程化规范)

| Skill | 版本 | 行数(SKILL.md) | references | schemas | scripts |
|-------|------|------|---|---|---|
| [module-flow](./module-flow/SKILL.md) | v1.0.0 | 177 | 6 个 | 1 个 | - |
| [master-go-to-code](./master-go-to-code/SKILL.md) | v1.0.0 | 142 | 4 个 | 2 个 | 1 个 ✅ |
| [yapi-to-code](./yapi-to-code/SKILL.md) | v1.0.0 | 157 | 5 个 | - | - |
| [frontend-page-design](./frontend-page-design/SKILL.md) | v1.0.0 | 210 | 6 个 | - | - |
| [playwright-skill](./playwright-skill/SKILL.md) | v1.0.0 | 200+ | - | 1 (config) | 仅 config + SKILL.md |
| [yunxiao-bug-fix](./yunxiao-bug-fix/SKILL.md) | v1.0.0 | 612 | - | - | - |

**说明**:
- playwright-skill 和 yunxiao-bug-fix 已是实战派 SOP 风格,行数合理,本次未重构
- 4 个新 skill 全部从"教科书风格"(平均 550 行) → 工程化规范(平均 170 行,压缩 70%)

## _shared 共享层

跨多个 skill 复用的资源:

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

1. **少即是多**:SKILL.md 只放"决策 + 委托",详细规范拆 references/
2. **硬契约 > 软文档**:中间产物用 JSON Schema 锁死,Step 0/4 自动校验,不让脏数据传到下游
3. **Reconnaissance-Then-Action**:先自检环境/读项目状态再动手,违反这一条踩坑最多
4. **委托优于复制**:能委托给下游 skill 的工作绝不重复实现
5. **失败立即停 / Stage D 例外**:A/B/C 失败雪崩;D 失败警告不打断

## 上下游契约(关键)

每个 skill 的 SKILL.md 末尾必含「上下游契约」段:输入 schema + 输出 schema。这是 skill 之间"咬合"的硬接口。

跨 skill 共用的中间产物:

| 产物 | 生产者 | 消费者 | Schema |
|------|--------|--------|--------|
| `dom-tree.json` | master-go-to-code | frontend-page-design | `master-go-to-code/schemas/dom-tree-v1.schema.json` |
| `svg-paths.json` | master-go-to-code | frontend-page-design | `master-go-to-code/schemas/svg-paths.schema.json` |
| `define.ts / api.ts` | yapi-to-code | frontend-page-design | TS 类型系统(编译器即校验) |
| `.claude/skills/playwright-skill/runtime/screenshots/*.png` | Claude(MCP browser_take_screenshot) | yunxiao-bug-fix / module-flow Stage D | — |
| API 响应 | 项目后端 | 全 skill | `_shared/schemas/common-response.schema.json` |

## MCP 配置

需要在 `.kiro/settings/mcp.json` 或 `packages/frontend/.mcp.json` 配置:

| MCP | 用于 |
|-----|------|
| `mastergo-magic-mcp` | master-go-to-code |
| `yapi-auto-mcp` | yapi-to-code |
| `aliyun-yunxiao` | yunxiao-bug-fix |
| `playwright` | playwright-skill(MCP browser_* 工具) |

## 典型用例与使用手册

为了保持架构文档的精简，我们将日常高频使用的 6 种 AI 对话触发方式（例如：全流程一键生成、纯前端页面开发、QA 测试验证、云效 Bug 自动修复等话术模板）整理到了专门的手册中。

👉 **详细的操作指南请点击参阅：[《使用手册.md》](./使用手册.md)**

## 核心源码文件树说明

本文件为项目全景和核心规范。如果您需要排查底层逻辑，查看本模块内**每一个** Python 处理脚本、JSON Schema 硬契约文件、各细分场景参考文档（references）的具体作用，我们为您准备了一份零死角的详尽对照表。

👉 **完整的底层结构请点击参阅：[《文件树.md》](./文件树.md)**

## 改 / 扩 skill 的约定

新增 skill:
1. 建 `<name>/` 目录,创建 `SKILL.md` + 可选 `references/` `schemas/` `scripts/`
2. `SKILL.md` 控制 100-200 行(超 250 行说明可以拆 reference)
3. frontmatter:`name` / `description` / `version`,**description 禁止含 `---`**(YAML 会断)
4. 在 SKILL.md 末尾加 `## Changelog`
5. 同步更新 [STATUS.md](./docs/STATUS.md)

升级现有 skill:
- 改 `version`(SemVer)
- Changelog 加新条
- 同步 docs/STATUS.md

## 历史演进

- **2026-05-13 初版**:6 个 skill 协同,引入 module-flow
- **2026-05-13 优化版**:补 12 项 P0/P1/P2,加 Changelog,docs/STATUS.md
- **2026-05-13 v1.0.0 工程化规范重构**:压缩主 SKILL.md → 100-200 行,拆 references/schemas/scripts,建 _shared 共享层

## 借鉴的官方/社区实践

| 来源 | 借鉴点 |
|------|--------|
| [anthropics/skills](https://github.com/anthropics/skills) | frontmatter 规范、references/scripts 子目录结构、>300 行附 TOC |
| [anthropics/skills/skill-creator](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md) | 祈使句 + Theory of Mind 风格 |
| anthropic/webapp-testing(70 行) | 决策树 + 模式 + Common Pitfall 风格 |
| anthropic/mcp-builder(120 行) | Zod/JSON Schema 硬契约的应用 |
| [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) | skill 沉淀知识 / hook 触发 / agent 隔离的三层架构 |

**写作核心原则**:解释 Why 优先于堆砌 ❌ 列表;少即是多;硬 schema 优于软文档;先自检再动手。
