---
name: mastergo-subdsl-package
description: Extract real MasterGo child DSL nodes from an outer-container link and pair them with supplied screenshots/assets into a design handoff package with interaction copy and a linked document. Supports optional deeper node audits. Use when the user asks to package or document a design, not to implement its UI.
metadata:
  version: 1.0.0
  short-description: MasterGo outer DSL to paired child-DSL package
---

# MasterGo 子 DSL 交付包

## 独立触发与编排

用户要求“整理设计稿 / 子 DSL / 设计文档 / 递归细查”或明确点名本 skill 时独立执行，交付包完成即结束。可以由 `module-flow` 在多阶段任务中调用，但出包成功不自动启动后端分析或页面开发。

## Purpose

将一个 MasterGo 最外层容器整理为可直接喂给页面生成 AI 的交付包：

- 通过 MasterGo MCP 的 `mcp__getDsl` 获取真实外层 DSL。
- 从外层 DSL 中提取真实的最内层/业务子节点，保留原始节点 JSON。
- 将子节点与用户提供的截图、切图或图片资源建立可追溯映射。
- 生成语义化图片副本、子 DSL JSON、`manifest.json` 和总文档。
- 交互说明必须从 DSL 原文抽取，禁止改写、润色、补写或根据截图猜测。
- 对只有交互文案、没有独立画面节点的“编辑/修改/查看”等行为，生成行为变体，复用对应基础场景的图片和 DSL。
- 文档中的画面信息使用结构化“关键元素摘要”，不要把完整画面文字重复堆在文档里；完整原始文字只保存在 DSL 和必要的原文区块中。
- 输出 `assetInventory`（矢量图标 / 位图清单 + 图片目录状态），让下游页面生成阶段知道**资源在哪、以及哪些资源本包根本没有**。
- 本 Skill **不生成任何图片或图标文件**：`images/` 只能来自用户提供的截图/切图目录。拿不到就显式声明缺口，禁止自绘近似图形充数。

## Required Input

用户通常会提供一个图片目录、一个包含 `file`/`page_id`/`layer_id` 的 MasterGo 外层链接，以及可选的输出目录或业务名称。

三样输入的强制性不同，必须区分对待：

| 输入 | 是否必需 | 缺失时怎么做 |
| --- | --- | --- |
| MasterGo 外层链接（含 `file`/`page_id`/`layer_id`） | 必需 | 停下来向用户要，不得用别的链接、旧包缓存或记忆里的 DSL 顶替 |
| 图片目录（设计稿整页截图 + 切图，png/jpg） | 必需，缺失必须显式声明 | 见下方「无图片目录时的强制声明」 |
| 输出目录 / 业务名称 | 可选 | 按外层节点名推导，并在文档里写明是推导的 |
| `auditDepth`（细查深度） | 可选，默认 `2` | 仅需局部视觉/样式核对时填写 `3` 或更大；详见「细查深度」 |

图片目录的用途是把设计稿画面和 DSL 子节点对应起来，供人工视觉比对与后续页面生成参考。图片只做**复制**到 `<output>/images/<语义名>.png`，不改名、不移动、不覆盖用户原目录（见完成后检查 4）。

### 无图片目录时的强制声明

没有拿到图片目录时，不要静默继续，也不要事后才承认。必须：

1. 先问用户一次是否能提供截图/切图目录。
2. 用户明确说不提供、或暂时找不到时，才继续出包，但要在 `ai-page-context.md` 顶部和 `manifest.json` 里写清：
   - `imagesStatus: "missing"`（manifest 顶层字段）；
   - 文档里一行声明：**「本次未提供截图/切图目录，`images/` 为空，全部场景 `image` 标记为 `unmatched`，视觉比对不可用。」**
3. 所有 `items[].image` 一律 `unmatched`，禁止凭 DSL 结构“推测”一个图片文件名填进去。

### 本 Skill 不产出任何图片资源

这一点必须写在文档里，避免下游误以为图标已经备好：

- 本 Skill 只调用 `mcp__getDsl` 拿 **DSL 文本数据**，不下载、不导出、不生成任何 png/jpg/svg 文件。
- `images/` 里的文件**只可能来自用户提供的图片目录**；用户没给就是空的，Skill 不会自己补。
- DSL 里出现的 `image-resource.mastergo.com/...` 链接是**设计稿内嵌的示例位图**（例如样例照片），不是 UI 切图，不得当作图标资源，也不得写进图片映射。
- 矢量图标在 DSL 里表现为 `VECTOR`/`PATH` 节点的 `path` 数据，属于**结构数据**，需要页面生成阶段自己解析或走 `master-go-to-code` 的 `svg-paths.json`；本 Skill 不负责把它们变成可用图片。

## Mandatory Workflow

### 1. Call MasterGo MCP first

使用当前环境可用的 MasterGo MCP 工具 `mcp__getDsl`，优先传入：

```json
{
  "shortLink": "<用户提供的 MasterGo 链接>"
}
```

不要把 MasterGo 链接当网页打开，不要手写 API 请求替代 MCP，不要使用旧项目缓存的 DSL 代替本次请求。保存 MCP 返回的完整结果，并从返回值取得 `dsl.nodes`、`dsl.styles`、`dsl.components`。MCP 报错时停止并报告具体错误。

### 2. Identify the outer container

以返回 DSL 的根节点作为 `sourceOuterNode`，记录 `sourceOuterLayerId`、`sourceOuterName`、`fileId`、`pageId` 和原始链接。外层节点 ID 只代表来源容器，不能被写成所有子 DSL 的当前节点 ID。

### 3. Extract child nodes by actual tree structure

从 `sourceOuterNode.children` 递归分析节点，优先将承载画面或弹窗的 `FRAME`、`INSTANCE`、明确承载画面的 `GROUP` 视为可交付子场景。单独的文字、路径、连接线、箭头、编号和空白占位通常只作为父场景内部结构保留；独立交互说明必须保留为 interaction 文档。

每个子 DSL 至少包含：

```json
{
  "sourceOuterLayerId": "外层节点 ID",
  "selectedLayerId": "当前子节点 ID",
  "selectedLayerLink": "带当前 layer_id 的 MasterGo 链接",
  "nodes": ["当前子节点原始 JSON"]
}
```

禁止创建只包含外层 ID 的伪子 DSL。`selectedLayerId` 必须等于 `nodes[0].id`。

### 3.1 细查深度（可选）

默认交付使用 **2 级**：

- 第 1 级：用户给出的最外层容器。
- 第 2 级：该容器下可交付的页面、弹窗或业务画面节点。

这正是普通“出包/生成页面”所需的最小结构，默认不要为了完整而继续拆解。只有用户要做局部视觉还原、样式调优、代码与设计稿逐块对照，或明确要求递归时，才询问/接受 `auditDepth`：

- `3`：在每个第 2 级页面/弹窗内再提取一层业务区块、卡片、弹窗或组件节点，适合大多数局部样式核对。
- `4+`：继续按真实父子树向下提取，适合用户明确指定的复杂局部区域；不要默认无限递归。

当用户仅说“看看/改样式”但未指定深度时，提供三个可选项：**保持两级（默认）**、**三级细查（推荐用于局部样式）**、**自定义深度**。普通设计交付不必额外打断用户询问。

三级及以上的节点必须写进独立审计目录，不能污染正式场景目录或改变其语义：

```text
<output>/
└── audit/
    ├── manifest.json
    └── level-3/<页面场景 key>/<局部节点>.json
```

审计节点只提取真实树中的 `FRAME`、`INSTANCE`、明确承载局部画面的 `GROUP`；单独 `TEXT`、`PATH`、连接线、箭头、编号和纯装饰节点仍保留在其父 DSL 内，不单独生成伪场景。每个审计 DSL 必须记录 `auditLevel`、父页面场景 key / layerId 和自己的 `selectedLayerId` / link；`selectedLayerId` 仍必须等于 `nodes[0].id`。

### 3.2 Handle text-only behavior variants

如果某个能力只有交互说明，没有独立截图或独立弹窗/页面节点，例如：

- `编辑安保巡逻班次` 复用 `新增安保巡逻班次`
- `编辑巡逻时段` 复用 `新增巡逻时段`

必须作为 `kind: "行为变体"` 输出。不生成假的独立画面 DSL，不复制或伪造一张独立图片；当前交互说明仍要保存为独立 interaction DSL，且原文不改字。`reuseOf` 指向被复用的基础场景，包含基础场景的 `key`、`selectedLayerId`、`selectedLayerLink`、`dsl`、`image`。文档中要明确写出“复用图片/复用 DSL/当前交互文案”。

复用匹配要基于交互标题和业务对象，而不是文件名残留。通用判断是：`编辑/修改/查看 <对象>` 优先复用同对象的 `新增/创建/配置 <对象>`；对象名称可以去掉动作词、巡逻类型词和“弹窗”等展示词后比较。匹配不到时标为待确认，不能把最近节点硬当作复用目标。

### 4. Group related nodes without changing text

使用节点的 `relativeX`、`relativeY`、`width`、`height`、名称、类型、文本和邻近关系建立页面状态、弹窗和交互说明的关联。连接线只能作为辅助证据，不能覆盖真实父子树关系。一个交互说明若适用于多个状态，可以复用，但必须在 manifest 中列出所有关系。

### 5. Pair images conservatively

图片匹配证据优先级：

1. 已有语义命名或明确业务关键词。
2. 图片像素尺寸与 DSL 节点尺寸或导出倍率匹配。
3. 图片内容与 DSL 文本/结构一致。
4. 文件名序号只作为弱证据。

不能根据“评估管理”“新建客户”“容器 1358”等复制残留名称直接命名业务场景。图片必须复制到新包，不能修改原始目录。无法可靠匹配时标记 `candidate` 或 `unmatched`，不能硬配。

### 6. Preserve interaction copy exactly

从 DSL 的 `TEXT.text[].text` 按节点顺序抽取交互文案，保留原始标点、换行、编号、占位符和特殊字符。不得修正、润色、统一空格、改写标题或把推断写进原文区块。

### 6.1 Summarize visual content for AI

每个有画面的场景在 manifest 和 Markdown 中增加 `visualSummary`，只保留帮助 AI 快速理解界面的结构化信息：

- 页面/弹窗标题
- 查询条件或输入字段
- 主要操作按钮
- 表格字段或核心信息块
- 关键状态
- 关联交互名称

`visualSummary` 是辅助摘要，不是设计稿事实的替代品。不能把复制残留图层名当作标题；优先使用图片语义名、真实业务词和 DSL 中的界面文本。不要把整页导航、重复表格数据、坐标、样式 token 或完整 `extractText` 当作画面摘要。原始画面文本仍保存在子 DSL 中，交互文案仍按原文保存。

### 6.2 Inventory vector icons and images for downstream

页面生成阶段最容易在这里出幻觉：拿不到切图就自己“画一个差不多”的图标。为了让下游不必猜，本 Skill 必须在 `manifest.json` 增加 `assetInventory`，并在 `ai-page-context.md` 末尾输出同名清单：

```json
{
  "assetInventory": {
    "imagesStatus": "missing | supplied",
    "vectorIcons": [
      {
        "name": "DSL 图层名（原文，不翻译不改写）",
        "layerId": "节点 id",
        "sceneKeys": ["引用它的场景 key"],
        "width": 24,
        "height": 24,
        "pathCount": 2,
        "hasGradient": false,
        "sourceDsl": "dsl/<semantic-child>.json"
      }
    ],
    "bitmaps": [
      { "name": "图层名", "layerId": "节点 id", "url": "DSL 原文里的 image-resource 链接", "note": "设计稿示例位图，非 UI 切图" }
    ]
  }
}
```

规则：

1. `vectorIcons` 从各子 DSL 递归收集 `VECTOR` / `PATH` / 只含路径的 `GROUP`，保留**原始图层名和 layerId**，不要重命名成“看起来像业务名”的名字。
2. 只登记事实（尺寸、路径条数、是否有渐变、在哪个 DSL 文件里），**不要把 path 数据抄进清单**，下游直接读 `sourceDsl` 对应节点即可。
3. `bitmaps` 用于说明“DSL 里确实有位图，但它是示例图片”，避免下游把它当切图或反过来以为完全没图。
4. 清单末尾固定加一句：**「本包不含任何图片/图标文件；矢量图标需从上述 DSL 节点解析 path，或由 `master-go-to-code` 产出 `svg-paths.json`。」**
5. 找不到对应节点时不要凑数，宁可不登记，并在文档里注明该场景图标待补。

### 7. Generate and validate the package

输出结构：

```text
<output>/
├── ai-page-context.md
├── manifest.json
├── source/outer-dsl.json
├── source/outer-dsl-wrapper.json
├── dsl/<semantic-child>.json
├── dsl/interaction-<semantic-child>.json
└── images/<semantic-image>.png   # 仅当用户提供了图片目录；未提供则为空目录 + imagesStatus: "missing"
    # auditDepth >= 3 时额外生成 audit/，不影响以上正式交付文件
```

使用 [scripts/package-subdsl.mjs](scripts/package-subdsl.mjs) 完成保存后的 DSL 的确定性落盘、图片匹配、命名和 manifest 生成。脚本不能替代 MCP 获取 DSL。

完成后检查：

1. 每个 DSL 的 `selectedLayerId === nodes[0].id`。
2. `sourceOuterLayerId` 可以相同，但 `selectedLayerId` 不应无理由全部相同。
3. 图片引用都存在、明确标记为 `unmatched`，或在行为变体中明确来自 `reuseOf`。
4. 原始图片目录未被重命名、删除或覆盖。
5. 文档中的交互原文与 DSL 抽取结果一致。
6. 子节点链接指向对应 `selectedLayerId`，而不是统一指向外层容器。
7. 行为变体的 `interactionDsl` 指向自身交互节点，`reuseOf.dsl` 指向基础画面节点，两者不能混淆。
8. **`images/` 为空时，`manifest.json` 有 `imagesStatus: "missing"`，且 `ai-page-context.md` 顶部有「无截图，视觉比对不可用」声明**；反之 `images/` 非空时，每张图都能在 `items[].image` 找到引用，没有孤儿文件。
9. **`assetInventory` 已生成**：`vectorIcons` 的每个 `layerId` 都能在对应 `sourceDsl` 文件里查到同名节点，`pathCount > 0`；`bitmaps` 里的链接全部是 DSL 原文里的 `image-resource` 地址，没有手写/猜测的 URL。
10. **全包没有任何由 Skill 生成的图片文件**（png/jpg/svg）；`images/` 下的文件哈希与原目录一致。
11. 交付说明里明确写出下游前提：**「本包不能直接喂给 `frontend-page-design`；矢量图标需先跑 `master-go-to-code`（Stage A）拿到 `svg-paths.json`，或从 `assetInventory` 指向的 DSL 节点逐字解析 path。」**
12. `auditDepth >= 3` 时，每个 `audit/manifest.json` 条目都能追溯到一个正式页面场景和真实父节点；审计节点不得替代正式 `dsl/` 场景，也不得被当成独立业务页面。

## Boundary

这个 Skill 只负责设计稿数据整理和映射，不负责直接生成 Vue/React 页面。除非用户另行要求，不修改业务代码，不把猜测写入 DSL，不把复制来的图层名当作业务事实。

同样禁止：

- 不下载、不导出、不绘制任何图片或图标文件（包括“先用一个差不多的图标占位”）。资源缺口只能**声明**，不能**伪造**。
- 不把 DSL 里的 `image-resource` 链接当成本地资源写进映射，也不把它下载下来充数。
- 不在缺少图片目录时假装完成视觉映射；宁可全量 `unmatched` + 显式声明。

## Changelog

### v1.0.0 (2026-11-20)
- 纳入 agent-skills，保留 Codex 版的可配置深度递归审计及现有交付脚本。
- 明确独立出包与可选开发前置步骤的触发边界。
