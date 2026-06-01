# Master-Go-to-Code 常见踩坑

> 真实项目踩过的坑速查。每条都含「症状 → 原因 → 修复」三段。本文件被 [SKILL.md](../SKILL.md) 引用。

## 资源相关

### 图片显示 404 / 路径不对
**症状**：Vue 编译通过,但浏览器加载图片 404
**原因**：用了 CDN 链接、相对路径或 `output/images/`
**修复**：所有图片 src 必须 `@/assets/<imgDir>/文件名.png`,通过 Vite alias 解析

### 图片下载到一半失败
**症状**：`fetch-and-parse.mjs` 中途报错
**原因**：MasterGo CDN 临时限速 / 大画板图片多
**修复**：重跑脚本,已下载的会自动跳过(断点续传)

## DSL 解析相关

### 精修上下文撑爆
**症状**：`mcp__getDsl` 一次返回 >100KB,精修阶段 token 不够
**原因**：画板太大,完整 DSL 太长
**修复**：按区块分次请求,见 dom-tree-spec.md 的「分区块策略」

### svgRef 找不到对应数据
**症状**：dom-tree.json 中 `data-name: "svgRef:xxx"` 但 svg-paths.json 没这个 key
**原因**：精修时用了语义名(如 `svgRef:工作台图标`)而不是 DSL 节点 ID
**修复**：所有 svgRef 必须用 `数字:6位hex` 格式,与 svg-paths.json key 一一对应。运行 `node scripts/validate-dom-tree.mjs` 自动检测

### dom-tree.json 解析失败:中文引号未转义(高频)
**症状**:写完 dom-tree.json 后 `JSON.parse()` 报 `Unexpected token` 或类似错
**原因**:AI 精修时,文本内容含中文双引号 `""` / 单引号 `''` 没转义,破坏了 JSON 字符串
**修复**:
- 精修产出 dom-tree.json 时,文本字段里的中文引号统一用 unicode 转义:
  - `"` → `“`、`"` → `”`
  - `'` → `‘`、`'` → `’`
- 写完后**强制自检**:`node -e "JSON.parse(require('fs').readFileSync('.claude/skills/master-go-to-code/output/dom-tree.json','utf-8'))"`
- 解析失败立刻修,不要带病往下走
**教训**:AI 生成 JSON 时,文本内容里的特殊字符必须检查转义。Step 2 自检命令是兜底,但精修阶段就该避免

### svg path 字段名是 `data` 不是 `d`(渲染时坑)
**症状**:浏览器控制台报 `<path> attribute d: Expected moveto path command ('M' or 'm'), "undefined"`
**原因**:svg-paths.json 里 path data 的字段名是 `data`,但渲染脚本读了 `p.d` → `undefined`
**修复**:渲染时用 `p.data || p.d || ''` 兼容两种字段名(render.mjs 已处理)
**教训**:写渲染脚本前先看一眼实际数据结构,不要凭假设

### 兄弟节点被错误合并
**症状**：preview 看着两个卡片粘在一起,实际设计稿是独立的
**原因**：精修时把 DSL 平级的 FRAME 塞进了同一个新 div
**修复**：DSL 同级节点必须保持平级,除非 DSL 原本就有共同父节点

## 视觉相关

### 渐变背景渲染为黑色
**症状**：preview.html 中渐变区块显示纯黑
**原因**：把 fill 是渐变色(`linear-gradient(...)`)的 PATH 节点用了 svgRef
**修复**：渐变色 PATH 删除,父 div 直接 `background: linear-gradient(...)`,见 dsl-css-mapping.md 第「PATH 节点作为容器背景」段

### 蒙版裁剪后内容消失
**症状**：装饰图标被裁掉了
**原因**：精修时把 `mask: "alpha"` 节点当真实元素生成了
**修复**：蒙版节点不生成 HTML,父容器加 `overflow: hidden` + 对应 `border-radius`

### TEXT 节点截断
**症状**：文字被裁掉一半
**原因**：给 TEXT 节点设了 `width` / `height`
**修复**：TEXT 节点不设宽高,让文字自然撑开(`textMode: "multi-line"` 时才限宽)

## MCP 相关

### `mcp__getDsl` 401
**症状**：MCP 调用返回 401 Unauthorized
**原因**：`.env` 的 `MASTERGO_TOKEN` 失效或未设置
**修复**：检查项目根 `.mcp.json` 的 `--token=` 参数,重新登录拿新 token

### `mcp__getDsl` 返回空 DSL
**症状**：DSL 结构正常但 children 为空
**原因**：`layerId` 错了,或该 layer 已被设计师删除
**修复**：在 MasterGo 浏览器里打开 URL 确认 layer 存在,重新拿 layerId

### 用户给的 layerId 是子组件而不是整页(高频踩坑)
**症状**:拿到 DSL 但内容很小(几十行),只是一个 Tab/按钮/输入框等子组件
**原因**:用户在 MasterGo 分享链接时,选中的是页面里的一个子元素而不是顶层 Frame
**判断标准**:
- 拿到的 DSL 总宽度 < 400px 或高度 < 100px → 多半是子组件
- 根节点 type 是 `INSTANCE` 且 `name` 含"组件/按钮/输入框" → 多半是子组件
- 根节点没有 children 或 children < 5 个 → 多半是单一组件

**修复**:**MasterGo MCP 不支持"按子节点反查父节点"**——只能传精确 layerId 拿子树,不能盲猜往上找。当前可选:
1. 让用户在 MasterGo 框选整页**最外层 Frame**(画板边界那一个),"复制链接"重新分享
2. 让用户在 MasterGo 右键选中页面 → "复制 ID",直接告诉你 layerId
3. 如果用户真的只要这个子组件(如"做一个 Tab 切换组件"),按当前 layerId 继续,但产出会很小(单个 Vue 组件而不是完整模块)

**踩坑实例**:
- URL `prototyping/.../page_id=1:1282&layer_id=629:345167`
- page_id 不能当 layerId 用(返回空)
- 629:345167 实际是"某 Tab 切换头",不是完整页面
- 解决:让用户复制整页 Frame 的 ID

## 工作流相关

### preview.html 跟设计稿不一致
**症状**：视觉差距明显
**原因**：精修阶段漏了节点 / 把不该删的节点删了
**修复**：回 Step 2 重新精修,不要去改 preview 的 CSS。dom-tree.json 是精修产物,preview 是它的渲染,改 preview 不会反向修正 dom-tree

### Vue 代码图片显示不出来
**症状**：编译通过,浏览器空白
**原因**：`imgDir` 不在 `vite.config.ts` 的 alias 范围
**修复**：确认 `vite.config.ts` 的 `resolve.alias` 含 `@/assets`(项目应有);如缺则加上

### dom-tree.json 没落盘就转 Vue
**症状**：精修结果没了,排错无依据
**原因**：违反铁律 2(精修必须落盘)
**修复**：精修完成必须写 `<skill>/output/dom-tree.json`(默认 `.claude/skills/master-go-to-code/output/dom-tree.json`),禁止只放内存里

## 精修相关

### 默认模式下用了 svgRef 导致图标不渲染（高频）
**症状**：preview.html 中下拉箭头、菜单图标不显示或显示为空白
**原因**：`fetch-and-parse.mjs` 默认已把 SVG 转 PNG（`svg-as-png/` + `svg-icons/`），但精修时错误地用了 `attrs.svgRef` 引用 SVG path 数据，而不是用 `<img>` 引用已生成的 PNG
**修复**：检查 `<outDir>/svg-as-png/` 目录是否存在。存在 → 默认模式，**必须用 `{ tag: "img", attrs: { src: "@/assets/<imgDir>/svg-icons/<文件名>.png" } }`**。`svgRef` 仅在 `--keep-svg` 模式使用
**教训**：SKILL.md 和 dom-tree-spec.md 已更新为明确规则。精修前先看 `svg-as-png/` 目录

### 表格列/行缺少 border 导致没有网格线
**症状**：表格渲染出来像纯文字列表，列与列、行与行之间没有分隔线
**原因**：精修时只关注了背景色和字体，忘了加 `border-right`（列分隔）和 `border-bottom`（行分隔）
**修复**：所有表头单元格加 `border-bottom` + `border-right`，所有数据行单元格加 `border-bottom` + `border-right`。边框色从 DSL `strokeColor` token 取（常见 `#DEE6F7`）
**教训**：dom-tree-spec.md 已新增「表格布局」章节。精修 checklist 已加「表格是否有边框」

### `_deleted` 节点缺少 tag/attrs/style 被 hook 拦截
**症状**：写 `{ "_deleted": true, "reason": "xxx" }` 后 PostToolUse hook 报错 "缺 tag / 缺 attrs / 缺 style"
**原因**：hook 校验所有 refined chunk 必须有 tag/attrs/style 三件套，`_deleted` 节点也不例外
**修复**：`_deleted` 节点写成 `{ "_deleted": true, "reason": "...", "tag": "div", "attrs": {}, "style": {} }`
**教训**：dom-tree-spec.md 已新增「_deleted 节点格式」章节

### 筛选区/卡片高度塌陷导致元素重叠
**症状**：筛选区第二行与下方按钮区域视觉重叠
**原因**：筛选区容器没设 `min-height`，flex 内容在某些渲染条件下没撑开到 DSL 设计的高度
**修复**：DSL 有固定 `height` 的 flex 容器，精修时用 `min-height: <值>px` 而不是 `height`，防止内容塌陷
**教训**：dom-tree-spec.md 已新增「容器高度处理」章节

### 表格列文字截断（如"产生费用（元）"显示不全）
**症状**：表格某列的表头文字被省略号截断
**原因**：列宽用了 `flex: 1` 但没设 `min-width`，当列数多时分到的宽度不够显示完整文字
**修复**：数据列用 `flex: 1 1 0; min-width: <DSL宽度>px`，保证最小宽度不小于设计稿值
**教训**：dom-tree-spec.md「表格布局」章节已包含列宽策略

---

发现新坑?在末尾追加一条,格式不变。每月或每次大版本时,把高频项升级为 SKILL.md 的铁律。
