# SVG → PNG 转换能力（默认开启）

> 本文件被 [SKILL.md](../SKILL.md) Step 1 引用。`fetch-and-parse.mjs` **默认**把提取出的 SVG 图标转成 PNG(2x 图)。

## 为什么默认转 PNG

实战发现项目里 SVG 直接使用经常翻车:
- 复杂渐变在某些浏览器渲染异常
- 部分组件库/UI 框架不支持直接吃 SVG
- PDF 导出 / 邮件附件 / 静态海报场景必须 PNG
- 设计稿里的"图标"实际是位图风格(带阴影/纹理),PNG 表现更接近设计

所以**默认就转**,跟"加参数才转"相比省心。

## 用法

```bash
# 默认: 下载图片 + 提取 SVG path + SVG → PNG (2x 图)
node .claude/skills/master-go-to-code/scripts/fetch-and-parse.mjs <fileId> <layerId> [imgDir]

# 选项: 项目要保留 SVG(轻量/缩放无损),加 --keep-svg 关闭 PNG 转换
node .claude/skills/master-go-to-code/scripts/fetch-and-parse.mjs <fileId> <layerId> [imgDir] --keep-svg
```

依赖 `sharp` —— 已在 skill 自带 `node_modules` 里,首次使用前如果没装:
```bash
cd .claude/skills/master-go-to-code && npm install
```

**产物**(默认转 PNG 时):
- `<outDir>/svg-as-png/*.png` — 预览用副本
- `<imgDir>/svg-icons/*.png` — 项目目录副本(如传了 imgDir)

**产物**(`--keep-svg` 时):**不产**上面两个目录,只产 `svg-paths.json` 给 dom-tree 用 svgRef 引用。

## 输出规格

- **2 倍图**(@2x,适合高清屏幕)
- **最大宽度 400px**(再大会按比例缩)
- 命名:**节点 ID** 或 **语义名映射**(见下)

## 文件命名

默认用节点 ID:`716:278075` → `716-278075.png`

如需有意义的英文文件名(`user-mgmt.png` / `dashboard.png` 等),传 `--icon-names=<json-file>`:

```bash
node .claude/skills/master-go-to-code/scripts/fetch-and-parse.mjs <fileId> <layerId> <imgDir> \
  --icon-names=path/to/icon-names.json
```

`icon-names.json` 结构:

```json
{
  "idToNameMap": {
    "716:294400": "user-mgmt",
    "716:294330": "dashboard",
    "660:288064": "order-center"
  },
  "nameMap": {
    "导航": "nav",
    "用户管理": "user-mgmt",
    "数据看板": "dashboard",
    "订单中心": "order-center"
  }
}
```

匹配优先级:`idToNameMap` > `nameMap` > 节点 ID(`数字-hex` 格式)。

> **本文件不预设具体映射**——映射是项目特定的(业务术语 → 英文文件名),由 Claude 在跑 skill 时根据当前模块的设计稿语义构造,或者用户提供。

## 实现要点(参考)

脚本内部:
1. 把同一 FRAME / GROUP 下的多个 PATH 合并成一个 SVG
2. 计算边界框(用 `layoutStyle.relativeX/Y/width/height`,降级到 path data 数字提取)
3. 把 `linear-gradient(...)` 转成 SVG `<linearGradient>` 定义(CSS 渐变 SVG 不认)
4. 用 `sharp` 把 SVG buffer 转 PNG(2x,resize to max 400px)
5. 重名时自动加 `-2 / -3` 后缀

## 注意事项

- sharp 是 skill 自带依赖(`master-go-to-code/node_modules/sharp`),不污染项目
- 如果某个 SVG path 数据不完整,会跳过并 warning,不会停脚本
- 卸载 sharp:删 `.claude/skills/master-go-to-code/node_modules` 整个目录

## 已知坑

- **SVG 渐变 fill 在某些场景渲染成黑色** — fetch-and-parse 已处理(CSS 渐变 → SVG `<linearGradient>`),见 [common-pitfalls.md](./common-pitfalls.md) "渐变背景渲染黑色"
- **path data 字段名 `data` 不是 `d`** — 渲染时要兼容 `p.data || p.d`
