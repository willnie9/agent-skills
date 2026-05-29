---
name: master-go-to-code
description: 从 MasterGo 设计稿 DSL 生成前端代码的视觉还原流水线。给定 MasterGo URL (含 fileId + layerId),产出 dom-tree.json + svg-paths.json + 图片资源,可独立使用或被 module-flow 编排。当用户提到"设计稿"、"MasterGo"、"还原 UI" 或贴出 mastergo.com 链接时主动触发。
version: 2.3.0
---

# Master-Go-to-Code · 视觉还原流水线

## Auto Mode(无确认模式)

**触发**:用户输入含任一关键词 → `全跑 / 一气呵成 / auto / yolo / 别问 / 自动`,或被 module-flow 委托(auto 透传)。

**行为**:
- 跳过所有"报告 + 等用户继续"检查点(Step 1 报告下载数 / Step 2 报告 dom-tree 大小)
- `compare-tokens.mjs` 失败不阻断(verdict=fail 也继续,落 issues 给上层处理)

**保留**:
- Step 2 `validate-dom-tree.mjs` 失败必停(schema 错下游全废)
- 铁律 1-5 不变

## 决策

本 skill 专做"设计稿 → dom-tree.json + svg-paths.json + 图片资源"。**永远委托给 module-flow / frontend-page-design 完成 Vue 组装**(不在本 skill 直出)。

```
用户给 MasterGo URL
  │
  ├─ 含 auto 关键词 ──→ 直接进 Step 1,跳所有检查点
  └─ 默认           ──→ Step 0 自检后进 Step 1,Step 1-2 完后给报告等用户继续
```

## 工作流（3 个 Step + 1 个委托点 + 1 个回收验证)

> Step 1 拉资源 + 切 chunk → Step 2 分块精修 + 合并 + 校验 → Step 3 渲染预览 + 自检 → Step 4 委托 → Step 5 token diff 回收。

### Step 0 · Reconnaissance（自检）

启动前必须通过:

```bash
# 1. MCP 可用性
test -n "$(grep MASTERGO_TOKEN .env)"           # Token 存在(在项目根 .env 或 skill 父级)
# 2. skill 自带脚本齐全
test -f .claude/skills/master-go-to-code/scripts/fetch-and-parse.mjs
# 3. skill 依赖装好(首次使用前)
test -d .claude/skills/master-go-to-code/node_modules/sharp \
  || (cd .claude/skills/master-go-to-code && npm install)
# 4. 解析 URL → fileId + layerId(从 ?layer_id= 提取)
```

任一失败即停,告诉用户具体原因。

### Step 1 · 提取资源 + 切分 chunk

#### 1.1 拉 DSL + 资源

```bash
# 默认: 下载图片 + 提取 SVG path + SVG → PNG (2x 图,适合直接当图片用)
node .claude/skills/master-go-to-code/scripts/fetch-and-parse.mjs <fileId> <layerId> <imgDir>

# 选项: 项目要保留 SVG(轻量/缩放无损),加 --keep-svg 关闭 PNG 转换
node .claude/skills/master-go-to-code/scripts/fetch-and-parse.mjs <fileId> <layerId> <imgDir> --keep-svg

# 选项: 想要有意义的英文文件名(user-mgmt.png 而不是 716-294400.png)
node .claude/skills/master-go-to-code/scripts/fetch-and-parse.mjs <fileId> <layerId> <imgDir> --icon-names=<path/to/icon-names.json>
```

`imgDir` 推断规则见 [references/imgdir-mapping.md](./references/imgdir-mapping.md)。
SVG → PNG 详细说明 + icon-names 映射格式见 [references/svg-to-png.md](./references/svg-to-png.md)。

**产物目录**(下文统称 `<outDir>`):**默认 `.claude/skills/master-go-to-code/output/`** —— 跨项目复用 skill 时,产物落在 skill 自身目录,不污染项目根。可被以下机制覆盖(优先级从高到低):
1. 命令行参数(部分脚本支持)
2. 环境变量 `MASTERGO_OUT_DIR`
3. (历史)`project.config.json.mastergoOutput.outDir` 仍兼容

**INSTANCE 字段补全机制(自动)**:MasterGo MCP 返回里同 componentId 的多个 INSTANCE 字段深浅不一致(第一个含完整字段,后续只给最简版),且 dsl.components 数组通常为空。fetch-and-parse 自动:
1. 扫所有 instance,按 componentId 取字段并集
2. 对每个 componentId 都 `layerId=componentId` 单独拉一次组件定义,补充并集中缺失的字段
3. 落 `<outDir>/component-cache.json`,同 fileId+componentId 复用,后续运行 0 网络

涉及字段: `borderRadius / flexContainerInfo / fill / strokeColor / strokeType / strokeAlign / strokeWidth / effect / opacity`(实例独有字段如 layoutStyle/children/id 不补)。

**产出**(默认):`<outDir>/dsl.json`(精简后) + `<outDir>/svg-paths.json` + `<outDir>/component-cache.json` + `<imgDir>/*.png`(项目目录) + `<outDir>/images/*.png`(预览用) + `<outDir>/svg-as-png/*.png` + `<imgDir>/svg-icons/*.png`(SVG→PNG 2x 图)
**产出**(`--keep-svg` 时):同上但**不产** `svg-as-png/` 和 `svg-icons/`
**校验**:`svg-paths.json` 需符合 [schemas/svg-paths.schema.json](./schemas/svg-paths.schema.json)
**检查点**:报告下载图片数 + svg key 数 + INSTANCE 补全统计,等用户"继续"

#### 1.2 切 chunk(画板大于 30KB 必切)

dsl.json > 30KB 时直接精修会爆 context,先切:

```bash
python3 .claude/skills/master-go-to-code/scripts/split-dsl.py <outDir>/dsl.json
# 产 <outDir>/chunks/_manifest.json + <outDir>/chunks/<idx>-<slug>.json
```

切分策略:
- 节点 > 30KB → 继续向下递归切
- 节点 20-30KB → 默认切
- 节点 < 20KB → 整块落盘
- 叶子 / TEXT / PATH 不切

**shell chunk 与 leaf chunk**:
- 切到中间层时,父 chunk 仅保留壳(`type / id / name / layoutStyle / flexContainerInfo / fill / borderRadius / ...`),children 用 `_children_placeholder: ["ref:<子chunk source_node_id>"]` 占位
- 子 chunk 是独立文件,精修后由 merge-refined.py 通过 placeholder 还原

**产出**:`chunks/_manifest.json`(总目录,含 chunk_id / source_node_id / parent_id / position) + `chunks/<idx>-<slug>.json`

### Step 2 · 分块精修 + 合并(必须落盘)

#### 2.1 数据源

读 `<outDir>/chunks/_manifest.json` + 各 `<outDir>/chunks/<idx>-<slug>.json`。
不要再调 `mcp__getDsl` —— 同一份数据,二次调用浪费且可能不一致。

**`_svgRef` 标记处理**（⚠️ 默认走 PNG，不是 svgRef）:

先判断模式：`<outDir>/svg-as-png/` 目录存在 → 默认模式（SVG→PNG 已转）；不存在 → `--keep-svg` 模式。

| 条件 | 默认模式（有 svg-as-png/） | --keep-svg 模式 |
|---|---|---|
| `_svgRef` + **无 children** | **必须** `{ tag: "img", attrs: { src: "@/assets/<imgDir>/svg-icons/<文件名>.png" } }` | `{ tag: "div", attrs: { svgRef: "<id>" } }` |
| `_svgRef` + **有 children** | 容器层正常产 div，子节点递归；不引用 _svgRef | 同左 |

> **铁律**：默认模式下精修产物**禁止出现 `svgRef` 属性**。PNG 已经生成好了，用 IMG 标签引用。文件名查 `<outDir>/svg-as-png/` 目录或 `<imgDir>/svg-icons/` 目录。

#### 2.2 粗转全部 chunk（第一轮）

> ⚠️ **由 `enforce-rough-first.mjs` hook 强制**：粗转未完成前不允许进入精修。

**必须先把全部 chunk 粗转一遍**，目标是"不丢信息、能渲染出完整页面"，不追求完美：

- 读 DSL chunk，**机械翻译**为 dom-tree v1 格式（参考 [references/dsl-css-mapping.md](./references/dsl-css-mapping.md)）
- shell chunk：容器 + `_children_placeholder`
- 装饰 chunk（滚动轴等）：标 `_deleted: true` + tag/attrs/style
- 内容 chunk：按 DSL 结构直译，保留所有节点和文本

写到 `<outDir>/chunks-refined/<chunk_id>.refined.json`。

全部 chunk 写完后，hook 自动把 `.workflow-phase` 切为 `preview-needed`。

#### 2.3 合并 + 渲染第一版

```bash
node .claude/skills/master-go-to-code/scripts/iterate.mjs
# 自动: merge → render → .workflow-phase 切为 refine
```

截图 preview.html，**看图找问题**。

#### 2.4 按需精修（看图驱动）

> `.workflow-phase` = `refine` 后才允许此步。

看截图，对照设计稿，找到有问题的区域 → 定位到对应 chunk → 精修该 chunk → 重新 iterate → 截图检查。**循环直到无问题。**

精修规则详见:
- [references/dom-tree-spec.md](./references/dom-tree-spec.md) — 输出格式规范 + 布局陷阱清单
- [references/dsl-css-mapping.md](./references/dsl-css-mapping.md) — DSL → CSS 翻译表

**shell chunk 的产物保留 `_children_placeholder`**（merge 阶段会替换），不要塞死值。

#### 2.5 自校验

```bash
node .claude/skills/master-go-to-code/scripts/validate-dom-tree.mjs <outDir>
```

退出码非 0 必须修正后再进入 Step 3。

**输出契约**：`<outDir>/dom-tree.json` 必须符合 [schemas/dom-tree-v1.schema.json](./schemas/dom-tree-v1.schema.json)

### Step 3 · 渲染预览 + 自检

Step 2 完成后必须渲染预览，目视检查精修质量。

```bash
# 3.1 渲染 preview.html
node .claude/skills/master-go-to-code/scripts/iterate.mjs

# 3.2 截图（headless Chrome）
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1440,900 --force-device-scale-factor=1 \
  --screenshot="<outDir>/screenshots/latest.png" \
  "file://<outDir>/preview.html"
```

**3.3 自检 checklist**（看截图检查）:
- [ ] 侧边栏布局正确（logo + 菜单项 + 氛围图）
- [ ] 面包屑文字正确显示（不乱码）
- [ ] 筛选区域完整（输入框 + 下拉 + 按钮）
- [ ] 表格有竖线和横线（border 完整）
- [ ] 表头背景色区分于数据行
- [ ] 操作列有左边框
- [ ] 分页器布局正常
- [ ] 无元素重叠 / 溢出

**发现问题 → 回 Step 2 修改对应 chunk，重新合并渲染，直到自检通过。**

### Step 4 · 委托给 frontend-page-design

本 skill 完成 Step 1-2 后,**永远委托给 frontend-page-design** 完成 Vue SFC 生成。

**委托前自检**(图片是否全部下载 + `@/assets/` 规范):
```bash
node .claude/skills/master-go-to-code/scripts/extract-image-names.mjs <outDir>/dom-tree.json
# 输出 JSON: { count: N, images: [{ src, dataName, parentName }] }
# 任何 src 不以 @/assets/ 开头 → 违反铁律 3,回 Step 2 改
```

```
传给 frontend-page-design:
  {
    domTreePath: "<outDir>/dom-tree.json",
    svgPathsPath: "<outDir>/svg-paths.json",
    imgDir: <Step 1 推断>,
    pagePath, module, targetPath, styleRules, dataStrategy, ...
  }
```

为什么不在本 skill 直出?
- 视觉还原 (Step 1-2) 和 模块组装 (路由/菜单/API/弹窗) 是不同关注点,混在一起 SKILL.md 会膨胀
- frontend-page-design 已经覆盖"简单单文件"到"完整模块"全场景,无需重复实现

### Step 5 · token diff 收敛(回收验证)

frontend-page-design 完成后,**回到本 skill** 做一轮 DSL ↔ SCSS 语义级对齐:

```bash
node .claude/skills/master-go-to-code/scripts/compare-tokens.mjs \
  <outDir>/dom-tree.json \
  <config.structure.viewsDir>/<module>/Index.vue [其它 Vue 文件...]
```

脚本会扫两边的 **颜色 / 字号 / 字体 / 圆角 / gap / padding** token,输出:

- 🔴 **关键漏写**: DSL 高频 token 但 SCSS 没用上 → 几乎必须补
- 🟡 **凭印象写**: SCSS 用了但 DSL 没有的值 → 改回 DSL 真值 或 写注释说明为什么保留

**关键观念**:
- **不追加权综合分数**(DSL 把每个装饰图标的 padding 也算 token,分母虚高,意义不大)
- **追 actionable 清单**(漏写 0 + 凭印象都能解释 = 收敛)
- DSL 频次 ≥ 3 才算"关键 token",过滤掉边缘装饰
- 项目公共组件(如 Tab/Table/Pagination 等)的内部细节可合理保留,在 SCSS 注释里写明 "公共组件细节,不强行覆盖"

**收敛标准**:
- 关键漏写 = 0
- 凭印象项每条都能解释(等价表达 / element-plus 默认 / 公共组件 / 弹窗组件 DSL 未设计)
- 不要为追"零差异"而强行 1:1 复刻所有 DSL 装饰节点

报告差异给用户,问"剩下这些保留还是补",再决定。

**实战经验**:首轮通常 5-10 项,改 3-5 轮收敛到 2-3 项合理保留。最容易暴露的真 bug:
- 表格表头/行底色错(SCSS 凭印象写一个浅灰,DSL 实际是不同色值的表头和行底)
- 操作列字号错(写 14px,DSL 是 12px)
- 字体 fallback 缺少 DSL 指定的中文字体族

## 产物清理(谁清谁)

每次跑流程产物 = 临时文件,**不缓存、不对比、覆盖即重来**。

| 脚本 | 清啥 | 时机 |
|---|---|---|
| `fetch-and-parse.mjs` | `<outDir>/{dom-tree.json, svg-paths.json, preview.html, dsl.json, images/, svg-as-png/, chunks/, chunks-refined/}` | 跑脚本最开始 |
| `fetch-and-parse.mjs` | `<imgDir>/svg-icons/`(若 SVG→PNG) | 转换前清空再写 |
| `split-dsl.py` | 整个 `<outDir>/chunks/`(包含 `_manifest.json` 和所有 chunk 文件) | 切片前清空 |
| `merge-refined.py` / `validate-dom-tree.mjs` / `render.mjs` | 不清,只读/只产 |

**保留**:`<outDir>/component-cache.json`(跨运行复用,key 含 fileId 不会污染)、`<outDir>/REFINE-PLAN.md`(用户文档)。

**没有"智能比对上次的 fileId/layerId 决定清不清"的逻辑**——临时产物就是临时产物,重跑等于重新开始。

## 强制约束(harness 层 hook)

写在 `.claude/settings.json`,绕不过去:

| 触发 | hook | 拦截内容 |
|---|---|---|
| PreToolUse · Agent | `block-agent-refine.mjs` | 用 sub-Agent 跑精修任务(prompt 含"dom-tree/精修/refine") → exit 2 |
| PreToolUse · AskUserQuestion | `auto-mode-guard.mjs` | auto 模式下问用户 → 拦下 |
| PostToolUse · Write/Edit/MultiEdit dom-tree.json | `post-write-validate.mjs` | dom-tree.json 写入后:1) 检查残留 _children_placeholder;2) 跑 validate-dom-tree.mjs schema 校验。任一失败 exit 2 |
| PostToolUse · Write/Edit/MultiEdit chunks-refined/*.refined.json | `post-write-refined-chunk.mjs` | 单个 refined chunk 写入后:1) JSON 可解析;2) 顶层 tag/attrs/style 三件套;3) shell chunk 必须含 `_children_placeholder` 且 ref 集合与 manifest 子 chunk 一致;4) absolute 子节点的直接父必须 positioned。任一失败 exit 2 |

破坏这些约束的代价:工具调用直接被打回,模型必须修正后重发。

## 铁律(6 条)

1. **dom-tree.json 必须落盘**,禁止只在内存里直接进 Step 4。
2. **每步都是检查点**,不要从 Step 1 一气跑到 Step 5,违反会导致错精修传到下游。
3. **图片只用 `@/assets/` Vite alias**,禁止 CDN 链接、相对路径或 `output/images/`。
4. **svgRef 必须用 DSL 节点 ID**(`数字:hex` 格式,4-7 位,可用 `/` 拼 INSTANCE 嵌套路径),禁止语义名——validate 脚本会强制校验。
5. **Step 5 token diff 必须跑**——产物锚点 `<outDir>/token-diff-report.json` 是"Step 5 完成证据",下游 Stage D 开始前会自检它存在与否,**漏跑会被自动拦下**。不跑就委托完算交付的,视觉细节漏对齐(实测能暴露表头底色错、字号错、字体缺等真 bug)。
6. **Step 1.1 INSTANCE 字段补全不可跳**——MasterGo MCP 对同 componentId 的多 instance 字段去重,不补全圆角/padding/flex 等会丢。fetch-and-parse 已内置自动补全 + 缓存,只要正常跑脚本就生效;**禁止改脚本绕过此逻辑**。

## Common Pitfalls

详见 [references/common-pitfalls.md](./references/common-pitfalls.md)。最高频 3 个:

- 渐变背景渲染黑色 → fill 是渐变色的 PATH 别用 svgRef,父 div 直接 `background: linear-gradient(...)`
- TEXT 节点文字被截断 → TEXT 节点不设 width/height
- 兄弟节点被错合并 → DSL 同级 FRAME 必须保持平级

## 故障诊断工具(高级用法,非主流程)

主流程是「贴 mastergo URL → module-flow 全跑」。下面这些脚本**不在工作流里**,只在故障诊断或开发自查时手动跑:

### `render.mjs` — 渲染 preview.html 看视觉

```bash
node .claude/skills/master-go-to-code/scripts/render.mjs
# 产 <outDir>/preview.html
```

什么时候用:Stage A.recall 报关键 token 漏写,人工想看"哪里渲染错了"。
**前提**:`<outDir>/dom-tree.json` 必须还在(没被 fetch-and-parse 开跑前清掉)。

### `compare-tokens.mjs` — 单跑 DSL diff

```bash
node .claude/skills/master-go-to-code/scripts/compare-tokens.mjs \
  <outDir>/dom-tree.json \
  src/views/<module>/Index.vue [其它 Vue 文件...] \
  --module=<name>
```

什么时候用:**几乎不需要**。主流程的 Stage A.recall 已经自动跑。单跑只用在"上次跑过 + dom-tree.json 还在 + 想验证手动改的 SCSS 还对不对"。
**前提**:`<outDir>/dom-tree.json` 必须还在。

### `compare-pixel.mjs` — 像素级对比(可选,识图不准)

详见脚本顶部注释。`pixelmatch / pngjs` 是 optionalDependency,要用先 `npm install`。

### `seed-test-data.mjs` — 接口批量造测试数据

跟设计稿无关,独立工具,联调时手动跑。

## 上下游契约

**输入**(来自用户或 module-flow):
```ts
{
  fileId: string,            // 从 uiLink 解析,纯数字
  layerId: string,           // 格式 "数字:6位hex"
  imgDir: string,            // 形如 "<config.structure.imgDirBase>/<父级>/<模块>"
  pagePath?: string,         // 用于 imgDir 推断
  styleScope?: "content-only" | "full-page" | string,
  screenshot?: string,       // 截图路径(可选)
}
```

**输出**(交给下游 / 写给用户):
```ts
{
  domTreePath: "<outDir>/dom-tree.json",       // outDir 默认 .claude/skills/master-go-to-code/output,MASTERGO_OUT_DIR 可覆盖
  svgPathsPath: "<outDir>/svg-paths.json",
  previewPath: "<outDir>/preview.html",
  imgDir: "<imgDir>",        // 同输入
  imageCount: number,
  svgCount: number,
  warnings: string[],        // 精修非致命警告
}
```

