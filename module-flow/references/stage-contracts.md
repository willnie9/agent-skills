# Stage 输入/输出契约

> 本文件被 [SKILL.md](../SKILL.md) Step 4 引用。明确各 Stage 的输入参数、产出结构、失败模式。

## Stage A — master-go-to-code

### 输入契约

```ts
{
  fileId: string,            // 从 uiLink 解析,纯数字
  layerId: string,           // 格式 "数字:6位hex"
  imgDir: string,            // 绝对路径或项目图片资源别名
  pagePath?: string,         // 用于 imgDir 推断
  styleScope?: "content-only" | "full-page" | string,
  screenshot?: string,
}
```

### 产出契约

```ts
{
  files: {
    "<outDir>/dom-tree.json": dom-tree.v1.json,
    "<outDir>/svg-paths.json": svg-paths.v1.json,
    "<outDir>/preview.html": HTML,
    "<imgDir>/*.png": Image,
  },
  size: { domTreeBytes: number, imageCount: number, svgPathCount: number },
  warnings: string[],
}
```

产出必须通过:
```bash
node .claude/skills/master-go-to-code/scripts/validate-dom-tree.mjs   # outDir 默认 .claude/skills/master-go-to-code/output,可用 MASTERGO_OUT_DIR 覆盖
```

### 失败模式

| 错误 | 处理 |
|---|---|
| MCP 401 (Token 失效) | 立即停,告诉用户检查 MCP 配置文件的 token |
| 画板太大(>200KB) | 提示用户启用"按区块请求"方案(见 mastergo-rules.md) |
| 图片下载超时 | 重试 3 次后停止,报告失败的图片 |
| preview.html 不一致 | 用户在检查点说"不对" → 回 Step 2 重新精修 |

## Stage B — yapi-to-code

### 输入契约

```ts
{
  apiLinks: Array<{ projectId: string, apiId: string } | string>,
  module: string,           // camelCase
  showPreview?: boolean,    // 复杂接口必传 true
  dataStrategy?: "auto" | "mock" | "api",
}
```

### 产出契约

```ts
{
  files: {
    "<接口目录>/<module>/define.ts": string,
    "<接口目录>/<module>/api.ts": string,
    "<接口目录>/<module>/mock.ts"?: string,
  },
  summary: {
    interfaceCount: number,
    enumCount: number,
    functionCount: number,
    conflictsResolved: string[],
  }
}
```

`<接口目录>` = yapi-to-code Step 0 探测到的项目接口目录约定。

### 失败模式

| 错误 | 处理 |
|---|---|
| YApi 401/403 | 立即停,提示检查 token |
| 接口找不到 | 用 yapi_search_apis 模糊搜确认,搜不到问用户 |
| 响应类型全 unknown | 让用户补 YApi 文档,或临时让用户提供样例 JSON |
| define.ts 已存在同名 interface | 给用户三选(覆盖/重命名/跳过),不静默覆盖 |

## Stage C — frontend-page-design

### 输入契约

```ts
{
  domTreePath: string,         // <outDir>/dom-tree.json,默认 .claude/skills/master-go-to-code/output/dom-tree.json
  svgPathsPath: string,
  pagePath: string,
  module: string,
  imgDir: string,
  targetPath?: string,
  styleRules?: string,
  dataStrategy?: "auto" | "mock" | "api",
  apiModule?: string,          // 若有 Stage B 产出
  vueRequirements?: string,
}
```

### 产出契约

```ts
{
  files: {
    new: string[],               // 新建文件列表
    modified: string[],          // 项目路由/菜单同步处
  },
  placeholders: Array<{
    type: "permission" | "icon" | "mock",
    location: string,
    todo: string,
  }>,
  verifyUrl: string,             // 用户访问验证的 URL,按项目路由模式拼
}
```

### 失败模式

| 错误 | 处理 |
|---|---|
| `vue-tsc` 类型错 | 简单 import 错误自动修;复杂错误报告给用户 |
| 路由命名冲突(常量重名) | 让用户选重命名 |
| 权限码占位选择困难 | 默认用项目兜底常量 + TODO(perm) |

## Stage D — playwright-skill

### 输入契约

```ts
{
  module: string,
  pagePath: string,                // 模块菜单路径,如 /#/customerManage
  mainAction?: string,             // "新增" / "新建" 等(smoke 时点的主按钮文字)
  tableSelector?: string,          // 按项目 UI 库定,如 ".el-table" / ".ant-table-row"
}
```

### 产出契约

```ts
{
  passed: boolean,                 // Claude MCP 操作完汇报的结论
  screenshots: string[],           // .claude/skills/playwright-skill/runtime/screenshots/<module>-smoke-*.png
  errorSummary?: string,           // 失败原因(看到了什么 vs 期望什么)
}
```

### 执行流程(MCP-first,v8)

不再生成 spec / 跑 test runner。Claude 在对话里走:

1. 读 `.claude/skills/playwright-skill/config/playwright-skill.config.json` 拿 baseURL / loginUrlPatterns / 登录配置
2. `mcp__playwright__browser_navigate(baseURL + pagePath)`
3. `mcp__playwright__browser_snapshot()`:
   - URL 命中 `loginUrlPatterns` → 按 playwright-skill SKILL.md §3.3 登录子流程
   - 否则 → 已登录,直接进入操作
4. 按 smoke 模板点主操作:
   - `browser_click` mainAction(如有)→ 看新增弹窗是否打开
   - `browser_snapshot` 验证表格容器(`tableSelector`)存在
5. 关键节点 `browser_take_screenshot({ filename: "runtime/screenshots/<module>-smoke-<step>.png" })`
6. 一句话汇报通过/失败,落 `.claude/results/<module>/stage-d-report.json`

### 失败模式(警告不打断)

| 错误 | 处理 |
|---|---|
| 登录态过期 | snapshot 回到登录页 → 重走 SKILL.md §3.3 登录,然后继续 |
| dev server 没起 | 提示用户先启动 dev server,但不重跑 |
| smoke 断言失败 | 截图保存,**继续给 git 建议**(铁律 4) |
| 配置文件缺失 | 立即停,这是 skill 体系错误,要先 cp example |
