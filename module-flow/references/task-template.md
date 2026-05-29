# 任务指令格式（PROJECT-TASK）

> 本文件被 [SKILL.md](./SKILL.md) Step 1 引用。定义 `---PROJECT-TASK---` 任务指令块的完整字段、格式约定、解析规则。

## 标准格式

```
---PROJECT-TASK---
pagePath: <父级菜单> / <目标菜单>
module: <myModule>
uiLink: https://mastergo.com/file/186833490539904?layer_id=138:046264
screenshot: （选填，拖入截图分析模块结构）
apiLink: |（选填，多个接口用换行分隔）
  https://<your-yapi-host>/project/28/interface/api/66
  https://<your-yapi-host>/project/28/interface/api/67
prototypeDoc: |（选填，多行需求文档）
  需要支持按部门筛选客户...
styleScope: content-only
styleRules: ref:<existingPage>
dataStrategy: auto
vueRequirements: （选填，额外 Vue 代码要求）
targetPath: （选填，留空 module-flow 读 routers.ts 推断）
imgDir: （选填，留空按 pagePath 自动推断）
stages: A,B,C
verifyFlow: customer-list-v2-smoke
notes: （选填，备注）
---END---
```

## 字段表

### 必填字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `pagePath` | 字符串 | 菜单层级路径，用 ` / ` 分隔（首尾空格可有可无）|
| `module` | kebab-case 字符串 | 模块名,决定项目视图目录和接口目录下的子目录名 |

### URL 字段

| 字段 | 必填条件 | 说明 |
|---|---|---|
| `uiLink` | Stage A 启用时必填 | MasterGo URL，必须含 `?layer_id=xxx` |
| `apiLink` | Stage B 启用时必填 | YApi URL；多个时用 `\|` 标记多行，每行一个 |

### 内容字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `screenshot` | ❌ | 用户拖入页面截图（精修阶段辅助判断模块结构）|
| `prototypeDoc` | ❌ | 多行需求文档内容，用 `\|` 标记 |

### 行为控制字段

| 字段 | 默认值 | 可选值 |
|---|---|---|
| `styleScope` | `content-only` | `content-only`（默认，跳过 layout 框架）/ `full-page` / `custom: 描述` |
| `styleRules` | 空（默认行为）| `ref:页面名`（如 `ref:<existingPage>`）参考已有页面风格 |
| `dataStrategy` | `auto` | `auto`（有 apiLink 对接接口，无则 mock）/ `mock` / `api` |
| `vueRequirements` | 空 | 额外 Vue 代码要求（覆盖默认规范的部分）|

### 路径字段

| 字段 | 默认行为 |
|---|---|
| `targetPath` | 留空时 module-flow 探测项目路由入口文件,按 `pagePath` 匹配 |
| `imgDir` | 留空时按 `pagePath` 自动推断(见 master-go-to-code 的 imgDir 推断规则)|

### 调度字段

| 字段 | 默认值 | 说明 |
|---|---|---|
| `stages` | `A,B,C,D` | 要执行的 Stage 列表，逗号分隔。默认含 D（浏览器验证）。可写 `A,B,C` 跳过验证，或 `A` 仅视觉还原 |
| `verifyFlow` | `<module>-smoke` | Stage D 的 flow 名，留空自动用 module 名拼 |

### 元信息字段

| 字段 | 说明 |
|---|---|
| `notes` | 备注，会随最终产出清单一起报告 |

---

## 字段解析规则

### pagePath

- 用 ` / ` 分隔（前后空格可有可无）
- 第一段 = 一级菜单
- 中间段 = 二级菜单
- 最后一段 = 当前页

中文 → 英文映射(推断 imgDir 时用):**不在 skill 里写死,以项目现有目录命名为准**。Claude 在 imgDir 推断阶段:

1. `ls -d <项目图片根目录>/*/` 查现有一级目录命名
2. 选语义最贴近的复用
3. 实在没有 → 中文翻译为 camelCase 英文(如"风控管理" → `riskControl`)
4. 把推断结果给用户确认

### module

- 严格 camelCase（不能用 kebab-case 或 PascalCase）
- 不能包含中文 / 空格 / 特殊字符
- 建议格式：`<语义>` 或 `<语义><场景>`（如 `customerList` / `contractApprove`）

### uiLink 解析

```
URL: https://mastergo.com/file/<fileId>?layer_id=<layerId>
       ↓
fileId: 数字字符串（如 186833490539904）
layerId: <数字>:<6位编码>（如 138:046264）
```

### apiLink 解析（多个）

```
apiLink: |
  https://<your-yapi-host>/project/28/interface/api/66
  https://<your-yapi-host>/project/28/interface/api/67
  https://<your-yapi-host>/project/28/interface/api/68
```

每行解析为 `{ projectId, apiId }` 对，由 yapi-to-code 并行处理。

### stages 解析

| 输入 | 含义 |
|---|---|
| `A` | 只跑 master-go-to-code（视觉还原） |
| `B` | 只跑 yapi-to-code（接口生成） |
| `A,B` | 视觉还原 + 接口生成（不组装页面） |
| `A,B,C` | 完整模块，但跳过浏览器验证 |
| `A,B,C,D` | 完整模块 + 浏览器验证（**默认**）|
| `B,C` | 跳过视觉（用户已有 dom-tree.json）|
| `C` | 只跑组装（用户已有 dom-tree.json + define.ts/api.ts）|
| `A,C` | 跳过接口（纯静态 mock 模式）|
| `A,C,D` | 纯静态 mock + 验证 |

---

## 字段省略时的回退策略

| 缺失字段 | 处理 |
|---|---|
| `pagePath` | **必问用户**，无法回退 |
| `module` | 从 pagePath 末段转 camelCase + 让用户确认 |
| `uiLink` | 询问用户：是 stages B/C 模式（无视觉）还是要补 URL |
| `apiLink` | 询问用户：是否设 `dataStrategy: mock` 跳过接口对接 |
| 其他 | 用默认值，并在执行计划里告知 |

---

## 自然语言转任务指令（示例）

输入：
```
用 mastergo 链接 https://mastergo.com/file/186833490539904?layer_id=138:046264
做 <myModule> 模块（<父级菜单>/<目标菜单>），对接 yapi 链接
https://<your-yapi-host>/project/28/interface/api/66，复用<existingPage>风格，
完成后跑 e2e 验证
```

解析为：
```yaml
pagePath: <父级菜单> / <目标菜单>V2
module: <myModule>
uiLink: https://mastergo.com/file/186833490539904?layer_id=138:046264
apiLink: https://<your-yapi-host>/project/28/interface/api/66
styleRules: ref:<existingPage>
stages: A,B,C,D
verifyFlow: customer-list-v2-smoke
```

---

## 示例任务指令

### 示例 1：完整新模块（最常见）

```
---PROJECT-TASK---
pagePath: <父级菜单> / <目标菜单>
module: <myModule>
uiLink: https://mastergo.com/file/186833490539904?layer_id=200:001234
apiLink: |
  https://<your-yapi-host>/project/28/interface/api/120
  https://<your-yapi-host>/project/28/interface/api/121
  https://<your-yapi-host>/project/28/interface/api/122
styleScope: content-only
styleRules: ref:<existingPage>
dataStrategy: auto
stages: A,B,C,D
verifyFlow: lead-pool-smoke
notes: 这个模块复用<existingPage>的表格风格，但筛选条件多了"线索来源"和"创建时间区间"。
---END---
```

### 示例 2：仅视觉还原（无接口）

```
---PROJECT-TASK---
pagePath: 首页 / 工作台
module: workbench
uiLink: https://mastergo.com/file/186833490539904?layer_id=138:046264
styleScope: full-page
dataStrategy: mock
stages: A,C
notes: 工作台只是展示静态卡片，无 API。
---END---
```

### 示例 3：仅接口生成（已有 UI）

```
---PROJECT-TASK---
module: contractApprove
apiLink: |
  https://<your-yapi-host>/project/28/interface/api/300
  https://<your-yapi-host>/project/28/interface/api/301
stages: B
notes: 现有的合同审批页面要新增 2 个接口对接，UI 不动。
---END---
```

### 示例 4：仅组装（已有产出）

```
---PROJECT-TASK---
pagePath: <父级菜单> / <目标菜单>
module: dietService
stages: C
notes: dom-tree.json 和 define.ts 已经在另一个分支生成好，现在只需要组装到这个分支。
---END---
```
