# DSL → CSS 翻译规则

> 本文件被 [SKILL.md](./SKILL.md) Step 2 精修阶段引用。规定 MasterGo DSL 字段如何翻译为 CSS 属性。

## 适用边界

仅当请求涉及 UI 设计、前端代码、视觉样式或组件实现时激活。与界面无关的问题不强制执行。

**临时绕过**：用户消息含 "不要读取 MasterGo" 或 "忽略设计稿规范" 时跳过。

## 通用原则

- **像素级还原**：颜色、间距、字体、圆角、阴影严格按设计稿
- **样式方案**：`<style lang="scss" scoped>`，class 用 BEM 命名（详见 `frontend-page-design/code-style.md`）
- **布局优先 flex**：除非设计稿明确要求绝对定位
- **数值取整**：所有 px 值四舍五入为整数

---

## 文字节点（TEXT）

**核心规则：TEXT 节点不设 `width` / `height`，让文字自然撑开。**

例外：`textMode: "multi-line"` 时才限制 `width`（让文字按设计稿宽度换行）。

## Font Token

| DSL 字段 | CSS 属性 | 翻译规则 |
|---|---|---|
| `family` | `font-family` | 追加 fallback：`'PingFang SC', sans-serif` |
| `size` | `font-size` | `{size}px` |
| `style: "Regular"` | `font-weight` | `normal` |
| `style: "Medium"` | `font-weight` | `500` |
| `style: "Bold"` | `font-weight` | `bold` |
| `lineHeight: "auto"` | `line-height` | `normal` |
| `lineHeight: "22"` | `line-height` | `22px` |
| `letterSpacing: "auto"` | `letter-spacing` | `0em` |
| `letterSpacing: "0.5"` | `letter-spacing` | `0.5em` |

## Paint Token

| DSL 类型 | CSS 处理 |
|---|---|
| 纯色 | `color: #xxxxxx` 或 `background-color: #xxxxxx` |
| 渐变 | `linear-gradient(...)` / `radial-gradient(...)`，直接使用 |
| RGBA | `rgba(r, g, b, a)`，直接使用 |
| 图片 fill | `<img src="...">` 或 `background-image: url(...)` |

## Effect Token

| DSL 值 | CSS 翻译 |
|---|---|
| `"filter: blur(173px);"` | `filter: blur(173px)` |
| `"backdrop-filter: blur(10px);"` | `backdrop-filter: blur(10px)` |
| `"box-shadow: 0 10px 30px rgba(28,55,94,0.08);"` | 直接使用（卡片容器统一阴影） |

---

## 布局

**核心原则：有 `flexContainerInfo` 就用 flex，没有才用 absolute。**

| DSL 状态 | CSS 处理 |
|---|---|
| 有 `flexContainerInfo` | `display: flex` + 对应方向/对齐属性，子节点不需 absolute |
| 无 `flexContainerInfo`，子节点有 `relativeX/Y` | 父容器 `position: relative`，子节点 `position: absolute` |
| 两者嵌套 | `position` 和 `display` 不互斥，可同时存在 |

### 无 flexContainerInfo 时的纵横判断（重要）

不能直接上 absolute，先判断子节点排列方向：

| 子节点偏移特征 | 处理 |
|---|---|
| `relativeY` 各不相同，`relativeX` 相近 | `flex-direction: column` |
| `relativeX` 各不相同，`relativeY` 相近 | `flex-direction: row` |
| `x` / `y` 都不同（真正的自由布局） | `position: relative` + 子 `position: absolute` |

### 兄弟节点独立性（重要）

DSL 中同级的多个 FRAME / 节点，精修时**必须保持平级**，**不允许合并进同一个新父容器**——除非 DSL 中它们本来就有共同父节点。

---

## 节点类型与尺寸

| DSL 类型 | 设 width/height | 说明 |
|---|---|---|
| FRAME / INSTANCE | ✅ | 真实容器 |
| TEXT | ❌ | 设了会导致截断 |
| LAYER / PATH / SVG | ✅ | 实际尺寸 |
| GROUP | ⚠️ 通常不需要 | 包围盒，没有视觉边界 |

---

## 坐标转换

DSL 的 `x` / `y` 是画布绝对坐标，必须转换为相对父容器：

```
css_left = node.x - parent.x
css_top  = node.y - parent.y
```

### 靠右/底锚点处理

`constraints` 为 `RIGHT` / `BOTTOM`、或节点明显靠父容器右下角时，用 `right:` / `bottom:` 而不是 `left:` / `top:`：

```
css_right  = parent.width  - (node.x - parent.x) - node.width
css_bottom = parent.height - (node.y - parent.y) - node.height
```

### 水平居中的节点

不要用绝对值，用：
- `display: flex; justify-content: center`，或
- `left: 50%; transform: translateX(-50%)`

---

## SVG 处理

| 场景 | 处理 |
|---|---|
| 普通图标 PATH 节点 | 用 `svgRef` 引用：`"data-name": "svgRef:138:046264"`（必须是 svg-paths.json 的 key） |
| 小型 SVG（path data < 200 字符） | 可直接内联 |
| PATH 作为容器背景（fill 渐变 + 尺寸覆盖父容器） | **不用 svgRef**，删除该节点，父容器直接 `background: linear-gradient(...)` |

### svgRef 命名禁忌

| 写法 | 说明 |
|---|---|
| `"data-name": "svgRef:74:000340"` | ✅ 正确（DSL 节点 ID） |
| `"data-name": "svgRef:工作台图标"` | ❌ 错误（语义名找不到对应数据） |

### svg-paths.json 数据结构

每个 key 对应 path 数组，字段名是 `data`（不是 `d`）：

```json
{
  "74:000340": [
    { "fill": "#366EF4", "data": "M13.2212 0C13.5243..." }
  ]
}
```

### 渐变 fill 的处理

svg-paths.json 中的 fill 可能是 CSS 渐变语法（如 `linear-gradient(...)`），这在 SVG `<path fill="">` 中无效。`render.mjs` 已自动处理：转换为 SVG 原生 `<linearGradient>` + `url(#gradId)` 引用。**精修阶段不用管。**

---

## PATH 节点作为容器背景的判断标准

DSL 中有些 PATH 节点本质上是**圆角矩形背景块**（承载渐变/毛玻璃），不是图标。判断标准：

- PATH 节点的 fill 是渐变色（`linear-gradient`）
- 节点尺寸和父容器相近（宽高接近或完全覆盖）
- 节点没有复杂路径（只是圆角矩形）

**处理方式：**
- 删除该 PATH 节点
- 在对应 div 上加 `background: linear-gradient(...)` + `border-radius`
- 如有 `backdrop-filter: blur(...)`，一并加上

**典型案例（项目实测）：**

| DSL 节点 ID | CSS 替换 |
|---|---|
| `138:046385`（集团发文蓝色背景） | `background: linear-gradient(93deg, #1E86FF 0%, #1E92FF 22%, #9BC9FF 97%)` |
| `138:046396`（白色毛玻璃内容区） | `background: linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.92) 19%, #FFF 51%)` + `backdrop-filter: blur(10px)` |
| `138:046465`（查看更多底部栏） | `background: linear-gradient(180deg, rgba(255,255,255,0.88) 0%, #F7F9FB 100%)` + `backdrop-filter: blur(10px)` + `border-radius: 10px` |

---

## mask 蒙版

DSL 中带 `"mask": "alpha"` 的节点是蒙版，不直接渲染——它裁剪其兄弟节点的显示范围。

**精修策略：**
- 蒙版节点本身**不生成 HTML 元素**（不输出到 dom-tree.json）
- 蒙版节点的父 GROUP / FRAME 加 `overflow: hidden`
- 如果蒙版形状是圆角矩形，在父容器加对应 `border-radius`
- 如果蒙版是渐变遮罩（如侧边栏氛围图），在父容器添加子 div 模拟渐变覆盖层
- 装饰性 SVG（被父容器裁剪的图标）：父容器加 `overflow: hidden`，SVG 本身保留完整尺寸和位置

**渲染层（render.mjs）自动处理：**
- 自动给 svgRef 外层 div 加 `overflow: hidden`
- 精修时不需手动处理蒙版裁剪的视觉效果，但**必须保留蒙版相关的结构信息**（父容器的 `overflow: hidden`）

---

## 全局视觉规范

| 元素 | 统一值 |
|---|---|
| 卡片圆角 | `border-radius: 16px` |
| 卡片阴影 | `box-shadow: 0 10px 30px rgba(28, 55, 94, 0.08)` |
| 按钮圆角 | `border-radius: 8px` |
| 输入框圆角 | `border-radius: 4px` |

---

## JSON 安全

精修输出 JSON 时注意：
- 中文引号 `"` `"` 必须转义为 `“` / `”`
- 所有文本内容中的双引号必须转义
- 不要在 JSON 里放注释（无效）

---

## 异常处理

MCP 工具报错时立即停止生成，向用户报告错误信息和最近一次成功的步骤产物。**不允许凭空补字段或硬编码值跳过失败的 MCP 调用。**
