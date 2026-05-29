---
name: frontend-page-design
description: Vue 3 前端模块组装器。把 master-go-to-code 产出的 dom-tree.json + yapi-to-code 产出的 define.ts/api.ts 组装为完整模块(Vue SFC + 路由 + 菜单 + Hooks + 子组件),严格遵循项目 BEM/公共组件/弹窗/Mock 规范。当用户提到"新增模块"、"组装页面"、"页面整合"或被 module-flow / master-go-to-code 委托时主动触发。
version: 2.2.0
---

# Frontend-Page-Design · 模块组装器

## Auto Mode(无确认模式)

**触发**:用户输入含任一关键词 → `全跑 / 一气呵成 / auto / yolo / 别问 / 自动`,或被 module-flow / master-go-to-code 委托(auto 透传)。

**行为**:
- 跳过 Step 2 文件清单预览(不弹"将创建 N 个,确认?")
- Step 9 `vue-tsc` 失败不阻断(verdict=warn 也继续,落 issues)
- `scan-perm-todos.mjs` 扫到占位 → 写进 stage-c-report.json 不阻断
- `stage-c-finalize.mjs` 跑完产出 `stage-c-report.json`(stage-gate 用)

**保留**:
- 文件冲突时仍弹三选(覆盖/重命名/跳过)
- 铁律 1-8 不变

> 本 skill 读取 `.claude/skills/project.config.json` 获取项目结构/约定/参考页,以下 `<config.xxx>` 占位指向该配置。Step 0 同时做"现场探测兜底"。

## 决策树

```
mode 参数(由 module-flow 传入)
  │
  ├─ "new" (默认,场景 1/2)        → 新建全套:Step 1-9
  ├─ "incremental" (场景 3 增量)   → 跳 Step 7-8(路由/菜单),Step 4 改"加新子组件 + 在现有 Index.vue 加 import"
  ├─ "iterate" (场景 4 迭代)       → 跳 Step 3-4,只精准 Edit 现有 Vue 局部
  └─ "refactor" (场景 5 重构)      → 跳 Step 7-8,Step 4 改"替换现有 Index.vue 内容"(保留文件路径)

数据来源
  │
  ├─ 有 define.ts + api.ts(来自 yapi-to-code 或现有) → Step 6 集成真接口
  ├─ 仅 dom-tree.json,无 API                       → Step 6 用静态数据填充
  ├─ dataStrategy=mock                             → 生成 mock.ts
  └─ mode=iterate/refactor + 现有 api.ts 存在      → 默认复用,字段对得上接,接不上写默认数据
```

## 5 种模式的行为差异

| | new (1/2) | incremental (3) | iterate (4) | refactor (5) |
|---|---|---|---|---|
| Step 3 建目录 | 建 `<viewsDir>/<module>/` | 跳过(用现有) | 跳过 | 跳过 |
| Step 4 主页面 | 新建 Index.vue | 加新子组件 + 改现有 Index.vue 加 import | 精准 Edit 现有 Vue 局部 | 替换 Index.vue 内容(保留路径) |
| Step 5 子组件 | 按需建 | 主要工作在这里 | 看需要改的是否子组件 | 重写所有子组件 |
| Step 6 API | 用 yapi-to-code 新建 | yapi 新建(如果有新接口) | 默认复用现有,字段对不上写默认数据 | 同 iterate |
| Step 7 路由 | 新建 + 注册 3 处 | ❌ 跳过 | ❌ 跳过 | ❌ 跳过 |
| Step 8 菜单 | +1 项 | ❌ 跳过 | ❌ 跳过 | ❌ 跳过 |
| Step 9 验证 | 全部 | 全部 | 全部 | 全部 |

## yapi 复用规则(mode=iterate/refactor)

```
检测现有 <config.cacheDir>/<currentModule>/api.ts 存在吗?
  │
  ├─ 不存在 → 写默认数据 + // TODO: 对接接口
  │
  └─ 存在 → 读 define.ts,分析字段:
      │
      ├─ DSL 新设计稿里的字段名/类型 vs api.ts 现有字段
      │     │
      │     ├─ 全对得上 → 默认复用,直接 import 用
      │     ├─ 部分对不上 → 优先用现有,字段缺的写默认数据,产 issues.md
      │     └─ 完全对不上 → 用默认数据,警告"现有 api.ts 跟新设计稿字段不匹配,需要后端同步"
```

用户也可以主动说"用新的 yapi 接口"覆盖现有(传 apiLinks),走 yapi-to-code 重新生成。

## 工作流(9 个 Step)

### Step 0 · Reconnaissance(自检 + 探测项目风格)

```bash
# 1. 读项目配置(优先)
CONF=.claude/skills/project.config.json
test -f "$CONF" && CONF_READY=1 || CONF_READY=0

# 2. 输入产物齐全
test -f <outDir>/dom-tree.json        # outDir 默认 .claude/skills/master-go-to-code/output(可用 MASTERGO_OUT_DIR 覆盖)
# 如果 dataStrategy=api 还要:
test -f <config.structure.cacheDir>/<module>/<config.conventions.interfaceFileNaming.types>

# 3. 项目骨架探测(配置缺字段时回退到 grep)
test -f <config.conventions.commonTypesFile>    # 主流类型定义
test -f <config.conventions.httpClientFile>      # HTTP 客户端入口
for f in <config.structure.routerFiles>; do test -f "$f"; done
test -f <config.structure.menuFile>

# 4. 跑 dom-tree.json 校验
node .claude/skills/master-go-to-code/scripts/validate-dom-tree.mjs <outDir>
```

任一失败即停。

### Step 1 · 读参考页(选风格)

按业务领域从 `<config.referencePages>` 选参考页:

| 业务场景 | 配置字段 |
|---|---|
| 标准 CRUD 列表 | `config.referencePages.crudList` |
| 详情抽屉 | `config.referencePages.detailDrawer` |
| 表单弹窗 | `config.referencePages.formDialog` |

任务指令 `styleRules: ref:<现有页面路径>` 时按用户指定路径读。

完整风格抽取规则见 [references/component-catalog.md](./references/component-catalog.md)(本 skill 不预设组件名,所有清单从配置或 Step 1 探测得来)。

### Step 2 · 给用户文件清单预览

```markdown
**将为模块 `<module>` 创建以下文件:**

新建(N 个):
- <config.structure.viewsDir>/<module>/Index.vue
- <config.structure.viewsDir>/<module>/components/<组件名>.vue
- <config.structure.routerDir>/<module>Router.ts
- ...

修改(N 个):
- <config.structure.routerFiles[0]>(+1 个常量)
- <config.structure.routerFiles[1]>(+1 import + 加入数组)
- <config.structure.menuFile>(+1 个菜单项)

**确认开始?** "确认" / "调整:..."
```

### Step 3 · 创建目录

```bash
mkdir -p <config.structure.viewsDir>/<module>/components
# <config.structure.cacheDir>/<module>/ 若 yapi-to-code 已建则跳过
```

### Step 4 · 生成 Index.vue(主页面)

dom-tree.json → Vue SFC,严格按:
- 模板结构、Script 分块、Style 嵌套:[references/code-style.md](./references/code-style.md)
- 主页面骨架(筛选区 + 表格区两段式):[references/page-templates.md](./references/page-templates.md)
- 公共组件清单 = `config.commonComponents`(项目封装) → 不要裸用 Element Plus
- 全局 class = `config.commonComponents.buttonClasses` 等 → 看项目现有风格

### Step 5 · 生成子组件

按需创建(命名风格沿用 Step 1 参考页):
- 弹窗(新增/编辑)— 严格按 code-style.md 弹窗规范
- 详情抽屉
- 状态标签(基于 define.ts 的 enum + MAP)

模板见 [references/page-templates.md](./references/page-templates.md)。

### Step 6 · 集成 API

- 有 `define.ts + api.ts` → 直接 `import { queryXxxPage } from '<config.structure.cacheDir>/<module>/api'`
- 响应字段访问方式 = `config.conventions.responseWrappers` 主流响应壳约定(不要凭印象用 `.data` 或 `.result`)
- 无 API → 用 `const tableData = ref([{ /* static */ }])` + `// TODO: 对接接口`
- `dataStrategy: mock` → 委托 yapi-to-code 的 mock.ts 模板

### Step 7 · 注册路由(项目路由文件全部同步)

详见 [references/routing-patterns.md](./references/routing-patterns.md)。`config.structure.routerFiles` 列的所有路由相关文件全部必改:

```
<config.structure.routerModuleFilePattern>   ← 新建(替换 <module> 占位)
config.structure.routerFiles[*]              ← 每个文件按其角色加常量/import/加入数组
```

`MODULE_CODE` / 权限码占位规则严格按 [references/module-code-policy.md](./references/module-code-policy.md)(本 skill 不预设权限码常量名,以 Step 1 探测的参考页为准)。

### Step 8 · 挂菜单(如需)

修改 `<config.structure.menuFile>` 增加一个菜单项。完整模板 + 占位规则(`TODO(perm)` / `TODO(icon)` 注释、临时绕过权限的方式)详见 [references/module-code-policy.md](./references/module-code-policy.md)。

简而言之:权限码用 `config.permission.moduleCodeStrategy` 策略(默认 borrow 借用相近模块) + 借现有图标 + `TODO` 注释,等后端分配 + 设计出图后替换。

### Step 9 · 验证 + 引导测试

```bash
node .claude/skills/frontend-page-design/scripts/stage-c-finalize.mjs <module> <config.structure.viewsDir>
# → 跑 vue-tsc + 扫 TODO + 落盘 stage-c-report.json (统一 verdict 格式)
```

引导用户测试:
- 访问 `<dev-server-url>/<module-route>`(URL 按 `config.conventions.routerMode` 拼,hash 模式带 `#/`)
- 列出已知占位(`TODO(perm):` 的权限码、SvgIcon、Mock 开关)

**额外产出**:如果对接过程中有**待用户/后端确认**的问题(字段不一致 / 上下文依赖不明 / 控件类型需调整等),产出 `<config.structure.viewsDir>/<module>/issues.md` 显式列出。模板见 [references/issues-template.md](./references/issues-template.md)。

没有争议点就不产 issues.md,**不要硬凑**。

## 铁律(8 条)

1. **公共组件优先**:能用项目封装(`config.commonComponents` 或 Step 1 探测得来)就不要裸用 Element Plus / 原生标签。
2. **响应字段访问方式沿用项目主流**:看 `config.conventions.responseWrappers` 或 yapi-to-code Step 0 探测结果,不要凭印象。
3. **项目路由文件全部同步**:`config.structure.routerFiles` 列了几处就同步几处,漏一处会 404。
4. **权限码 / MODULE_CODE 不能凭空造**:借用相近模块或 `config.permission` 兜底,加 `TODO(perm):` 注释。
5. **按钮 / 输入框等用项目全局 class**(`config.commonComponents.buttonClasses`),不要裸用 Element Plus 默认样式。
6. **弹窗样式不加 scoped**:用 `<module>-dialog-wrapper`(`config.commonComponents.dialogWrapperPattern`)命名空间隔离,见 code-style.md 弹窗规范。
7. **`<style scoped lang="scss">` 内禁用 `&` 父元素继承**:必须 class 全称(code-style.md 第 8 条)。
8. **改代码前先出方案**:≥ 3 文件 / 含子组件 / 含弹窗的变更必须 Step 2 预览,禁止直接动手。

## Common Pitfalls

详见 [references/common-pitfalls.md](./references/common-pitfalls.md)。最高频:

- 响应字段访问错(如响应壳是 `.data` 用了 `.result`)→ 看 `config.conventions.responseWrappers` 或 yapi-to-code Step 0 探测结果
- 路由 404 → 路由入口文件漏加 import 或 default 数组
- 菜单不显示 → 权限码占位不在用户权限范围(用项目兜底常量或加临时绕过)
- 弹窗按钮样式不对 → 必须用项目全局按钮 class,不是 Element Plus 默认

## 上下游契约

**输入**(来自用户或 module-flow):
```ts
{
  domTreePath: string,         // <outDir>/dom-tree.json
  svgPathsPath: string,
  pagePath: string,            // 显示用菜单路径,如 "<父级> / <当前>"
  module: string,              // camelCase
  imgDir: string,
  targetPath?: string,         // 留空时本 skill 读项目路由配置推断
  styleRules?: string,         // ref:<现有页面路径> 指定参考风格
  dataStrategy?: "auto" | "mock" | "api",
  apiModule?: string,          // 若有 yapi-to-code 产出,指向 <config.cacheDir>/<apiModule>
  vueRequirements?: string,
}
```

**输出**:
```ts
{
  files: {
    new: string[],               // 新建文件列表
    modified: string[],          // 修改文件列表(路由/菜单 同步处)
  },
  placeholders: Array<{          // 待人工/后端处理的占位
    type: "permission" | "icon" | "mock",
    location: string,
    todo: string,
  }>,
  verifyUrl: string,             // 用户访问验证的 URL
}
```

## Changelog

### v1.0.0 (2026-05-15)
- 项目结构全面去硬编码,改读 `.claude/skills/project.config.json`
- Step 9 加入 scan-perm-todos.mjs 扫描占位

### v1.0.0 (2026-05-13)
- 工程化规范重构:SKILL.md 压缩 70%,拆 references/

### v1.0.0 (2026-05-13)
- 初版
