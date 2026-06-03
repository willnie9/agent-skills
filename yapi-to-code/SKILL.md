---
name: yapi-to-code
description: 从 YApi 接口文档生成前端 TypeScript 代码的接口对接流水线。给定 YApi URL(或一组 URL),产出符合项目规范的接口模块文件(types/api/mock)。当用户提到"YApi"、"接口对接"、"生成 API 代码"或贴出 YApi 链接时主动触发。
version: 2.2.0
---

# YApi-to-Code · 接口对接流水线

## Auto Mode(无确认模式)

**触发**:用户输入含任一关键词 → `全跑 / 一气呵成 / auto / yolo / 别问 / 自动`,或被 module-flow 委托(auto 透传)。

**行为**:
- 跳过 Step 3 类型映射预览(强制 `showPreview: false`,复杂接口也直接写)
- 智能发现接口(Step 1.1)自动选分数 ≥ 7 的全要,不弹候选清单
- `validate-define.mjs` 失败不阻断(verdict=warn 也继续,落 issues 给上层处理)

**保留**:
- 文件冲突时仍弹三选(覆盖/重命名/跳过) —— 这是数据安全,不能默认覆盖
- 铁律 1-5 不变

> 本 skill 读取 `.claude/skills/project.config.json` 获取项目接口目录/响应壳/HTTP 客户端约定。`<config.xxx>` 占位指向该配置;Step 0 同时做"现场探测兜底"。

## 决策树

```
输入形态
  │
  ├─ 单个/多个 YApi URL                  → Step 1.0 直接解析 projectId+apiId
  ├─ 自然语言("xxx 模块的接口")          → Step 1.1 调 yapi_search_apis 模糊搜
  └─ 仅给项目名                          → Step 1.2 调 yapi_list_projects 列接口让用户选

产出形态
  │
  ├─ 简单接口(< 5字段,无嵌套,无枚举)    → 直接写文件
  ├─ 复杂接口(嵌套≥2/含数组对象/含枚举) → Step 3 给用户预览类型映射后再写
  └─ 多接口批量(CRUD 5 件套)             → 按"查询→新增→修改→删除→详情"排序写
```

## 工作流

### Step 0 · Reconnaissance(自检 + 探测项目风格)

执行任何步骤前先自检:

1. **YApi MCP 可用**:调一次 `mcp__yapi-auto-mcp__yapi_list_projects` 验证。失败立刻告知用户"YApi MCP 未配置"并停止。

2. **读项目配置**:`config.conventions.responseWrappers` / `httpClient` / `httpClientFile` / `commonTypesFile`,以及 `config.structure.cacheDir`(接口目录)。

3. **配置缺字段时回退到 grep 探测**:
   ```bash
   # 项目主流响应壳
   grep -rEho "[A-Z][A-Za-z]*Response<" <config.structure.cacheDir>/ | sort | uniq -c | sort -rn | head -5
   # 项目 HTTP 客户端调用方式
   cat <config.conventions.httpClientFile> | head -20
   ```
   关注:函数签名、请求体位置、是否强制类型断言、错误返回值。

把探测到的"项目主流响应壳 + HTTP 客户端调用方式 + 接口目录约定"记下,后续 Step 2/4 直接沿用。

### Step 1 · 拉接口定义

**三种入口分支**:

#### Step 1.0 — 精确路径(已知 projectId + apiId)

```javascript
mcp__yapi-auto-mcp__yapi_get_api_desc({ projectId, apiId })
```

返回字段速查:`method` / `path` / `req_params` / `req_query` / `req_body_other` / `res_body` / `req_body_is_json_schema`。

批量场景:并行调,按业务语义排序(查询/新增/修改/删除/详情)。

#### Step 1.1 — 智能发现(只给 projectId + 模块语义)

适用:被 module-flow 调度时,只拿到模块语义和 YApi 项目 ID,**自动找出该模块需要的接口**。

```javascript
// 1. 从模块语义提关键词组(中英文 + camelCase + kebab-case + 拆词)
const keywords = [semantic, moduleSlug, kebab, ...semantic.split(/\s+/)];

// 2. 并行搜每个关键词
const candidates = await Promise.all(
  keywords.map((kw) =>
    mcp__yapi-auto-mcp__yapi_search_apis({
      projectKeyword: String(projectId),
      nameKeyword: kw,
      limit: 10,
    })
  )
);

// 3. 去重 + 评分 + 给用户候选清单
```

#### Step 1.2 — 项目浏览(只给项目名)

```javascript
mcp__yapi-auto-mcp__yapi_list_projects()
mcp__yapi-auto-mcp__yapi_get_categories({ projectId })
// 用户在分类树里挑
```

### Step 2 · 推导 TypeScript 类型

核心要点(Claude 自己按这些原则推):
- 禁止 `any`(用 `unknown` 兜底未知字段)
- 对象用 `interface` 不用 `type`(除了泛型别名如 `XxxListResponse = <响应壳泛型>`)
- 字段描述含 `0-启用 1-停用` 关键词时,自动产 enum + `XXX_STATUS_MAP: Record<XxxStatus, string>`
- 命名 PascalCase(interface/enum/type) / camelCase(字段) / UPPER_SNAKE(常量)
- **响应壳沿用 `config.conventions.responseWrappers` 或 Step 0 探测结果**,禁止凭空造

### Step 3 · 类型映射预览(复杂场景必做)

满足任一条件时,先 inline 展示推导结果让用户确认(auto 模式跳过):
- 嵌套对象深度 ≥ 2
- 含数组的对象元素
- 识别出 enum
- 一次性生成 ≥ 3 个接口

展示格式:列出 interface 树 + enum 定义 + 响应壳泛型,让用户能扫一眼判断对不对。

### Step 4 · 写入文件

**★ 写入策略（防止 Write 工具超长内容失败）**：

批量接口（≥5 个）时 define.ts 可能超 200 行。必须按以下策略：
- **≤ 250 行**：一次 Write 写入
- **> 250 行**：拆分写入 — 先 Write define.ts（interface + enum），再单独 Write api.ts，再单独 Write mock.ts。每个文件独立不超 250 行。
- **单个 define.ts 超 250 行**：按业务分组拆为 `define.ts`（主类型）+ `define-enums.ts`（枚举+MAP），api.ts 统一 re-export。

**绝对禁止**：一次 Write 超过 300 行。

落盘目录 = `<config.structure.cacheDir>/<module>/`,文件名按 `config.conventions.interfaceFileNaming`:

```
<config.structure.cacheDir>/<module>/
├── define.ts    ← 所有 interface / enum / type / Map
├── api.ts       ← 函数式导出,编号注释 // 1. // 2. ...
└── mock.ts      ← 仅在 dataStrategy=mock 或后端未就绪时
```

文件模板见 [references/api-templates.md](./references/api-templates.md)。
**mock.ts**:用 axios-mock-adapter / msw 等项目主流 mock 工具,具体写法由 Claude 按项目现有 mock 风格 inline 生成。

**文件冲突处理**:已有同名 interface/函数 → 给用户三选(覆盖/重命名/跳过),禁止静默覆盖。

**写完后跑校验**:
```bash
node .claude/skills/yapi-to-code/scripts/validate-define.mjs \
  <config.structure.cacheDir>/<module>/define.ts \
  --response-wrappers=<config.conventions.responseWrappers join ','>
```

### Step 5 · 报告产出

```markdown
✅ <config.structure.cacheDir>/<module>/
   • define.ts:+N interface / +M enum / +K MAP
   • api.ts:+N 函数(编号 1-N)

下一步:
- 集成到页面: import { queryXxxPage } from '<config.structure.cacheDir>/<module>/api'
- 类型校验: npx vue-tsc --noEmit
- 被 frontend-page-design 接力组装(module-flow 调度时自动)
```

**额外产出**:一次性生成 ≥ 3 个接口时,Claude inline 给一份接口对接清单(字段对应/变更/新增)给用户看,不落盘成文件。

## 铁律(5 条)

1. **响应壳沿用配置**:以 `config.conventions.responseWrappers` 或 Step 0 探测结果为准,**禁止凭空创造**新响应类型。
2. **HTTP 调用沿用 `config.conventions.httpClient`**,包括返回类型断言习惯(项目实际返回 `Promise<unknown>` 必须强制断言)。
3. **禁止 `any`** + **禁止 `type` 替代 `interface`**(项目 CLAUDE.md 全局禁令)。
4. **枚举字段自动产 enum + MAP**:`XxxStatus` enum + `XXX_STATUS_MAP: Record<XxxStatus, string>`。
5. **复杂接口先预览**:5 个字段以下/无嵌套/无 enum 可直接写,否则展示给用户确认。

## Common Pitfalls

详见 [references/common-pitfalls.md](./references/common-pitfalls.md)。最高频:

- 响应壳字段名错(如用 `.result` 访问 `.data` 类响应壳) → 必看配置或 Step 0 探测结果
- 漏断言导致编译失败(项目 HTTP 客户端常返回 `Promise<unknown>`)
- `req_body_other` 是字符串不是对象 → 需要 `JSON.parse` 后再推导
- YApi 描述含枚举但漏识别 → 检查关键词 `0-x,1-y` / `0:x 1:y` / `(1-x 2-y)`

## 上下游契约

**输入**:
```ts
{
  // 三选一(优先级 1 > 2 > 3):
  apiLinks?: Array<{ projectId: string, apiId: string } | string>,  // 1. 精确接口
  discoverFrom?: {                                                    // 2. 模糊发现
    projectId: string,
    moduleSemantic: string,
    moduleSlug?: string,
  },
  projectName?: string,       // 3. 项目浏览,最后兜底

  module: string,             // 输出模块名 camelCase
  showPreview?: boolean,      // 复杂接口必传 true
}
```

**输出**:
```ts
{
  files: {
    "<config.cacheDir>/<module>/define.ts": string,
    "<config.cacheDir>/<module>/api.ts": string,
    "<config.cacheDir>/<module>/mock.ts"?: string,  // 仅 dataStrategy=mock 时
  },
  summary: {
    interfaceCount: number,
    enumCount: number,
    functionCount: number,
    conflictsResolved: string[],
  }
}
```

## Changelog

### v2.1.0 (2026-05-15)
- 项目结构全面去硬编码,改读 `.claude/skills/project.config.json`
- Step 4 加入 validate-define.mjs 校验
- Step 1 拆为 1.0/1.1/1.2 三种入口

### v2.0.0 (2026-05-13)
- 大厂风格重构:SKILL.md 压缩 80%,拆 references/

### v1.0.0 (2026-05-13)
- 初版
