# dom-tree.v1.json 输出格式规范

> 本文件被 [SKILL.md](./SKILL.md) Step 2 精修阶段引用。AI 精修 MasterGo DSL 时，输出 `<skill>/output/dom-tree.json`(默认 `.claude/skills/master-go-to-code/output/dom-tree.json`,支持 `MASTERGO_OUT_DIR` 覆盖) 必须严格遵循以下格式。

## 节点结构

```json
{
  "tag": "div | span | img | svg | path",
  "attrs": { "id": "可选", "data-name": "语义化名称", "src": "仅img" },
  "style": { "CSS属性": "值" },
  "text": "仅文本节点",
  "children": []
}
```

## 字段规则

| 字段 | 规则 |
|------|------|
| `tag` | FRAME/GROUP/INSTANCE → `div`；TEXT → `span`；图片 fill → `img`；矢量 → `svg` + `path` |
| `attrs.data-name` | 语义化名称（如 "集团发文卡片"、"统计数字"），不要用 DSL 原始命名 |
| `attrs.src` | 仅 img 节点用，值是 `@/assets/images/xxx.png` 格式（不是 CDN）|
| `style` | kebab-case CSS 属性，数值四舍五入为整数 px |
| `text` | 仅 span 节点有 |
| `children` | 子节点数组 |

SVG 标签必须加 `viewBox` / `width` / `height`；path 必须有 `fill` / `d`。

---

## DSL → v1 标签映射

| DSL type | v1 tag | 备注 |
|---|---|---|
| FRAME / GROUP / INSTANCE | `div` | 真实容器 |
| TEXT | `span` | **不设 width / height** |
| LAYER（图片 fill） | `img` | 图片容器 |
| LAYER（纯色 fill） | `div` | 色块 |
| SVG_ELLIPSE | `div` | `border-radius: 50%` |

---

## 布局处理

**核心原则：有 `flexContainerInfo` 就用 flex，没有才用 absolute。**

| DSL 状态 | 处理 |
|---|---|
| 有 `flexContainerInfo` | `display: flex` + 对应方向/对齐，子节点不需 absolute |
| 无 `flexContainerInfo`，子节点有 `relativeX/Y` | 父容器 `position: relative`，子 `position: absolute` |

`position` 和 `display` 不互斥：一个节点可以同时是 `position: absolute` 且 `display: flex`。

### absolute 子要求父 relative（强制约束）

> 这是 CSS 的硬性规则,不是约定。`position:absolute` 参照"最近的 positioned 祖先",祖先链上没有 positioned 节点时会一路上溯到画板,绕过中间所有 `overflow:hidden` 裁切,导致子元素"逃逸"出容器。

**规则**:任何节点的 style 里出现 `position: absolute`,该节点的**直接父**必须显式声明 `position: relative` (或 absolute / fixed / sticky)。精修时不能假设"父是 div 默认就行"。

适用场景:
- shell 容器(只有 `_children_placeholder`,自身无 flex)的精修产物,如果子是 absolute 定位的 chunk,**父必须加 `position: relative`**
- 子是装饰 LAYER(滚动条 / 投影 / 氛围图)用 absolute 时,父也必须 relative
- 父若已经是 flex,改成 `position: relative; display: flex` 即可,relative 不影响 flex 流

### flex 容器混合定位(常见陷阱)

flex 容器(`display: flex` 或带 `flexContainerInfo`)的子节点中,**FRAME / INSTANCE 类型必须保持 flex item**(走主轴排布),**只有装饰类 LAYER**(滚动条 / 投影 / 阴影 / 氛围背景)才允许用 `position: absolute` 浮在 flex 流之外。

判定:
- DSL 子节点 type 是 `FRAME` / `INSTANCE` / `GROUP` → 必为 flex item,不允许写 `position: absolute`
- DSL 子节点 type 是 `LAYER` 且 name 含"滚动轴 / 投影 / 阴影 / 氛围"等装饰语义 → 可用 absolute,但父必须 `position: relative`

反例:看到一个 absolute 的 LAYER 兄弟就把同级 FRAME 也写成 absolute(传染),会导致 FRAME 脱离 flex 主轴定位错乱。

### 无 flexContainerInfo 时的纵横判断（重要）

没有 `flexContainerInfo` 的容器，**不能直接用 absolute**，要先判断子节点的排列方向：

- 子节点 `relativeY` 各不相同（纵向偏移不同）且 `relativeX` 相近 → `flex-direction: column`
- 子节点 `relativeX` 各不相同（横向偏移不同）且 `relativeY` 相近 → `flex-direction: row`
- 子节点 x/y 都不同（真正的自由布局）→ 才用 `position: relative` + 子 `position: absolute`

### TEXT 在 flex 容器内的尺寸保留(重要修正)

> 此前规则"TEXT 不设 width/height"过于绝对。在 flex 容器内,TEXT 默认 `flex-shrink: 1`,被 fixed-width 兄弟挤压会换行/溢出,丢掉 figma 的尺寸约束信息。

**规则细化**:

| 场景 | 处理 |
|---|---|
| TEXT 在 absolute 父下(无 flex) | 不设 width/height,文字按 `white-space: nowrap` 自然展开 |
| TEXT 在 flex 容器内,**所有兄弟都是 auto-size** | 不设 width/height |
| TEXT 在 flex 容器内,**有 fixed-width 兄弟**(如 240px 输入框) | 必须保留 figma 的 width 作为 `min-width`,或加 `flex-shrink: 0`,二选一 |

判断依据:DSL `mainSizing: "fixed"` 的兄弟即为 fixed-width 兄弟。

### 兄弟节点独立性（重要）

DSL 中同级的多个 FRAME/节点，精修时**必须保持平级**，**不允许合并进同一个新父容器**——除非 DSL 中它们本来就有共同父节点。

### 精修自检 checklist

精修完成后逐项打勾：

- [ ] 每个有 `flexContainerInfo` 的节点是否用了 `display: flex`
- [ ] 没有 `flexContainerInfo` 的节点，子节点 `relativeY` 不同的是否用了 `flex-direction: column`（而不是 absolute）
- [ ] **凡子节点用 `position: absolute`,父是否显式 `position: relative`**
- [ ] **flex 容器内 FRAME/INSTANCE 兄弟是否保持 flex item(没被错误写成 absolute)**
- [ ] **flex 容器内 TEXT 兄弟有 fixed-width 兄弟时,是否设了 `flex-shrink: 0` 或保留 width**
- [ ] DSL 里平级的兄弟节点在 dom-tree 里是否保持平级（没有被错误合并）
- [ ] 没有把不同层级的节点合并进同一个容器
- [ ] 所有装饰节点（背景图、渐变、模糊圆形）是否保留
- [ ] 所有 svgRef 是否用 DSL 节点 ID 作为 key
- [ ] **`svg-as-png/` 存在时,是否全部用 IMG+PNG（禁止 svgRef）**
- [ ] **表格列是否加了 `border-right`（竖线）、行是否加了 `border-bottom`（横线）**
- [ ] **DSL 有 height 的 flex 容器是否用了 `min-height` 而不是 `height`**
- [ ] **`_deleted` 节点是否保留了 `tag` / `attrs` / `style` 三件套**
- [ ] **表格数据列是否用了 `flex: 1 1 0; min-width: <DSL值>px` 防截断**

---

## 坐标转换

DSL 的 `x` / `y` 是画布绝对坐标，必须转换为相对父容器：

```
css_left = node.x - parent.x
css_top  = node.y - parent.y
```

### 靠右/底锚点处理

`constraints` 为 `RIGHT` / `BOTTOM`、或节点明显靠右下时，用 `right:` / `bottom:` 而不是 `left:` / `top:`：

```
css_right  = parent.width  - (node.x - parent.x) - node.width
css_bottom = parent.height - (node.y - parent.y) - node.height
```

### 水平居中的节点

不要用绝对值，用：
- `display: flex; justify-content: center`，或
- `left: 50%; transform: translateX(-50%)`

---

## SVG / 图标处理（精修阶段）

### ❗ 默认模式 = PNG，不是 svgRef

`fetch-and-parse.mjs` 默认将 SVG 转 PNG（`svg-as-png/` + `svg-icons/`）。**精修时必须用 `<img>` 标签引用 PNG，禁止用 `svgRef`。**

判断方法：`<outDir>/svg-as-png/` 目录存在 → 默认模式；不存在 → `--keep-svg` 模式。

| 模式 | 纯 SVG 图标（`_svgRef` 无 children） | 混合容器（`_svgRef` 有 children） |
|---|---|---|
| 默认（有 svg-as-png/） | `{ tag: "img", attrs: { src: "@/assets/<imgDir>/svg-icons/<文件名>.png" } }` | 容器层 div，子节点递归 |
| --keep-svg | `{ tag: "div", attrs: { svgRef: "<id>" } }` | 同上 |

> svgRef 必须用 DSL 节点 ID（`数字:hex` 格式），禁止语义名。小型 SVG（path data < 200 字符）可内联。

### `_svgRef` 标记处理

dsl.json 里某些 FRAME / GROUP 节点会带 `_svgRef: "<节点 ID>"` 字段，**这是 Step 1 脚本标记的**。

`_svgRef` 字段本身**不要**写进 dom-tree.json，它只是 dsl.json 的标记。

---

## 精修内容（必做）

1. **语义重命名**：`data-name` 改为有意义的名称（如 "统计卡片" / "用户头像" / "查看更多按钮"）
2. **INSTANCE 展开**：DSL 的 INSTANCE 在 v1 里就是普通 div，不要保留组件引用
3. **蒙版节点不生成元素**：父容器加 `overflow: hidden`
4. **无样式单子节点空壳可删除**（同时满足：无任何 style、只有一个子节点、删除不影响布局）

---

## 表格布局（精修规范）

设计稿中的表格（列表数据）通常由多个“普通列”+ “操作列”组成，每列是一个竖向 flex 容器，包含表头 + N 行数据。

### 列宽策略

| 场景 | 处理 |
|---|---|
| 序号列（固定窄列） | `width: <DSL值>px; flex-shrink: 0` |
| 普通数据列 | `flex: 1 1 0; min-width: <DSL值>px`（防文字截断） |
| 操作列 | `width: <DSL值>px; flex: 0 0 <DSL值>px`（固定宽度） |

### 边框规则（必须加）

| 元素 | 边框 |
|---|---|
| 表头单元格 | `border-bottom: 1px solid <表格线色>` + `border-right: 1px solid <表格线色>` |
| 数据行单元格 | `border-bottom: 1px solid <表格线色>` + `border-right: 1px solid <表格线色>` |
| 表格外框（shell） | `border: 1px solid <表格线色>; border-radius; overflow: hidden` |
| 最右列 | 可不加 `border-right`（外框已有） |

> 表格线色从 DSL 的 `strokeColor` token 查（常见值：`#DEE6F7`）。

### 表头 vs 数据行

| 元素 | 背景色 | 字重 | 字号 |
|---|---|---|---|
| 表头 | DSL `fill` token（常见 `#ECF0FA`） | 500 | 从 DSL `font` token 取 |
| 奇数行 | `#FFFFFF` | normal | 同上 |
| 偶数行 | DSL `fill` token（常见 `#F3F5FA`） | normal | 同上 |

---

## 容器高度处理

DSL 里的容器有固定 `height`，但精修时不要直接用 `height`，应用 `min-height`：

| DSL 属性 | CSS 转换 | 原因 |
|---|---|---|
| 容器有 `height` + `flexContainerInfo` | `min-height: <值>px`（不设 height） | flex 内容可能超出设计稿预设高度 |
| 容器有 `height` + 无 flex（absolute 子） | `height: <值>px` | absolute 子不擑父高度，需要显式设 |

---

## `_deleted` 节点格式

装饰性节点（滚动轴、兑底空白列等）标记 `_deleted: true` 时，仍然必须保留 `tag` / `attrs` / `style` 字段（hook 会校验）：

```json
{
  "_deleted": true,
  "reason": "横向滚动轴 - 装饰元素，无需渲染",
  "tag": "div",
  "attrs": {},
  "style": {}
}
```

---

## 示例

```json
{
  "tag": "div",
  "attrs": { "data-name": "统计卡片" },
  "style": {
    "display": "flex",
    "flex-direction": "column",
    "gap": "12px",
    "padding": "20px",
    "background": "#fff",
    "border-radius": "16px",
    "box-shadow": "0 10px 30px rgba(28,55,94,0.08)"
  },
  "children": [
    {
      "tag": "span",
      "attrs": { "data-name": "数字" },
      "style": {
        "font-family": "PingFang SC, sans-serif",
        "font-size": "32px",
        "font-weight": "500",
        "color": "#233a6d"
      },
      "text": "128"
    },
    {
      "tag": "span",
      "attrs": { "data-name": "标签" },
      "style": {
        "font-size": "14px",
        "color": "#677998"
      },
      "text": "用户数"
    }
  ]
}
```

---

## 反模式（✘ 明确禁止）

- ✘ 把多个独立卡片合并进一个 wrapper div
- ✘ TEXT 节点设 `width` / `height`
- ✘ 用绝对值（如 `left: 420px`）实现水平居中
- ✘ 删除装饰节点说"看起来没用"
- ✘ **默认模式下用 svgRef**（必须用 IMG+PNG）
- ✘ svgRef 用语义名（如 `svgRef:导航图标`）
- ✘ 内联超过 200 字符的 path data
- ✘ DSL 节点合并跨越原本的层级关系
- ✘ 表格列/行不加 border（表格必须有竖线和横线）
- ✘ `_deleted` 节点缺少 tag/attrs/style
