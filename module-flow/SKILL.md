---
name: module-flow
description: 按任务目标编排设计出包、后端缺口分析与模块开发。用户要求多个阶段串联、完整开发、新模块、增量、迭代、重构或提供 PROJECT-TASK 时使用。明确只要设计交付包或后端方案时直接调用对应独立 skill；MasterGo 链接本身不代表授权开发。支持 auto 模式。
version: 2.3.0
---

# Module-Flow · 全流程编排器

> 本 skill 调度所有下游 skill。所有项目结构信息从 `.claude/skills/project.config.json` 读取,`<config.xxx>` 占位指向该配置。

## 7 大场景路由与人机交互协议（触发暗号 + 必问确认）

> **核心原则 1（模糊输入强制确认，严禁猜着开跑）**：只要用户**没有明确指定 `场景1~7`**、或者输入描述模糊/存在歧义（例如分不清是“新建模块 vs 老模块迭代”、“只出设计文档 vs 直接写代码”、“修 Bug vs 单独测页面”），**绝对禁止 AI 自行猜测后直接开工**！必须先调用 `AskUserQuestion` 提醒用户确认：“*我判断您可能是想执行【场景 N：xxx】，请问确认按这个场景推进吗？（或请从以下场景中选择）*”。**哪怕带了 `auto` 也必须先确认场景！**
>
> **核心原则 2（场景内必问清单）**：确认命中某场景后（除非显式附带 `auto` 暗号），仍需通过 `AskUserQuestion` 补齐缺参并确认执行范围（如是否组装 Vue、是否浏览器验证），确认后再正式执行。

### 场景暗号与触发对照表

| 场景编号 | 固定暗号 / 触发条件 | 涉及 Skill 组合 | 必触发的人机交互（缺参追问 + 范围确认） |
|---|---|---|---|
| **场景 1**<br>*(全新模块·有接口)* | 暗号：`场景1` / `#1` / `新模块`<br>或：给了 MasterGo + YApi | `module-flow` → `master-go-to-code` + `yapi-to-code` → `frontend-page-design` → `playwright-skill` | 1. 缺 MasterGo → 追问设计稿链接<br>2. 缺 YApi → 追问“补 YApi 还是改走场景 2 Mock？”<br>3. 参数齐后必问：**① 是否组装 Vue 页面？② 是否做浏览器验证？** |
| **场景 2**<br>*(全新模块·先 Mock)* | 暗号：`场景2` / `#2` / `Mock开发`<br>或：给了 MasterGo（无 YApi） | `module-flow` → *(可选)* `mastergo-subdsl-package` + `backend-gap-mock-plan` → `master-go-to-code` → `frontend-page-design` → `playwright-skill` | 1. 缺 MasterGo → 追问设计稿链接<br>2. 必问：**① 是否先出设计包/后端缺口方案？② 数据走 Mock 还是静态？③ 是否组装 Vue 及浏览器验证？** |
| **场景 3**<br>*(只出前置文档)* | 暗号：`场景3` / `#3` / `只出文档`<br>或：说“整理设计稿/后端缺口” | `mastergo-subdsl-package` / `backend-gap-mock-plan`（可单跑或串联） | 1. 必问：**① 只出设计包 / 只出后端方案 / 两个都出？② 若出设计包，截图目录在哪、细查深度几级？**（出完即停，不写代码） |
| **场景 4**<br>*(老模块迭代改造)* | 暗号：`场景4` / `#4` / `增量` / `迭代` / `重构`<br>或：指定现有模块改造 | `module-flow` → `playwright-skill`(定位) → `master-go-to-code` + *(可选)* `yapi-to-code` → `frontend-page-design` → `playwright-skill` | 1. 缺模块名 → 追问目标模块<br>2. 必问：**① 改造方式（增量加组件 / 局部迭代 / 整体重构）？② 是否有新接口？③ 改完是否跑浏览器回归？** |
| **场景 5**<br>*(纯接口/换 Mock)* | 暗号：`场景5` / `#5` / `只转接口` / `换真接口`<br>或：只给了 YApi 链接 | `yapi-to-code` + *(可选)* `backend-gap-mock-plan` + `playwright-skill` | 1. 缺 YApi → 追问 YApi 链接/项目 ID<br>2. 必问：**① 仅生成 `define.ts/api.ts`，还是对照后端方案批量替换现有 Mock？② 是否浏览器联调验真？** |
| **场景 6**<br>*(修 Bug 闭环)* | 暗号：`场景6` / `#6` / `修bug`<br>或：给了云效单号 / 报错现象 | `yunxiao-bug-fix`*(可选)* + `playwright-skill` | 1. 缺单号或问题描述 → 追问<br>2. 必问：**① 是否有云效单号（走云效拉单+回帖）还是纯本地修？② 修完是否开浏览器验真？** |
| **场景 7**<br>*(独立测试/E2E)* | 暗号：`场景7` / `#7` / `测一下` / `E2E`<br>或：只要求点检页面/回归 | `playwright-skill` / `auto-ui-explorer` | 1. 必问：**① 只用 `playwright-skill` 临时点检页面，还是用 `auto-ui-explorer` 跑模块全量/增量 E2E 回归？② 目标路由或模块名？** |

> 串联规则、输入字段、已有产物复用和 Stage A 衔接见 [references/intent-routing.md](references/intent-routing.md)。明确点名独立 skill 时直接单跑；`auto` 暗号仅跳过中间阶段确认，**不跳过“意图不明/缺关键输入”的必问检查**。

### 场景行为对比

| | 1 完整(含接口) | 2 完整(无接口) | 3 增量 | 4 迭代 | 5 重构 |
|---|---|---|---|---|---|
| 建新 module 目录 | ✅ | ✅ | ❌ 用现有 | ❌ 用现有 | ❌ 用现有 |
| 加新路由 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 加新菜单 | ✅ | ✅ | ❌ | ❌ | ❌ |
| Step 0.5 e2e 定位 | ❌ | ❌ | ✅ 必跑 | ✅ 必跑 | ✅ 必跑 |
| Stage A 拉设计稿 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Stage B yapi | ✅ 必传 | ❌ | 可选(增新接口才传) | 可选(默认复用现有,接不上写默认数据) | 可选(同迭代) |
| Stage C 行为 | 新建全套 | 新建全套 mock | 加新子组件 import 到现有 Index.vue | 精准 Edit 现有 Vue 局部 | 替换 Index.vue 内容,保留路由菜单 |
| Stage A.recall | ✅ | ✅ | ✅ | ✅ | ✅ |
| Stage D smoke | ✅ | ✅ | ✅ | ✅ | ✅ |

字段缺失补全:
- pagePath / module / imgDir → 拉 DSL 根节点 + grep menu 自动推断,auto 模式不问
- 数据策略(场景 2) → auto 默认 A;非 auto 问用户
- 场景 3/4/5 → 用户**必须显式说**"xxx 模块 [增量/迭代/重构]",不准 Claude 推断

文档目标直接跳过现有 Step 1–3 和开发场景问题：

- `design-package`：委托 `mastergo-subdsl-package`，核对交付物后结束。
- `backend-plan`：委托 `backend-gap-mock-plan`，核对方案后结束。
- `design-and-backend-plan`：按序委托两者，核对方案后结束。
- 只有 `develop` 才继续原有场景、模块字段、开发计划与阶段门禁。

## Auto Mode(无确认模式)

**触发**:用户输入含任一关键词 → `全跑 / 一气呵成 / auto / yolo / 别问 / 自动`,或 PROJECT-TASK 块里写 `mode: auto`。

### 进入 / 退出 auto 模式必跑(harness hook 配套)

进入 auto 模式时**必须**先 touch flag 文件,这是给 `.claude/hooks/auto-mode-guard.mjs` 看的:

```bash
mkdir -p .claude/state
touch .claude/state/auto-mode.flag
```

flag 存在时,hook 会拦截**非白名单**的 AskUserQuestion 调用(exit 2 拒绝)。白名单只有 4 个必停点对应话题(见下表)。

跑完所有 Stage(成功 / 失败 / 用户取消)**必须**删 flag:

```bash
rm -f .claude/state/auto-mode.flag
```

未删 flag 会导致后续无关对话也被当 auto 模式。**铁律: auto 模式入口/出口都要操作 flag**。

### 自动决策表(都不问用户)

| 字段 | 自动决策规则 |
|---|---|
| 场景 | 有 yapi 信息 → 场景 1;没 yapi → 场景 2 默认数据策略 A(全 mock) |
| `module` | 从 DSL 根节点 name 推 camelCase |
| `pagePath` | grep `<config.menuFile>` 找最近同类父级,组成"父级 / 当前" |
| `imgDir` | `<config.imgDirBase>/<pagePath 父级 kebab>/<module>` |
| YApi 接口选择 | 给了 `yapiProjectId` → `yapi_search_apis` 模糊搜 → 取分数 ≥ 7 的全要;给了 `apiLinks` → 直接用 |
| 数据策略(场景 2) | 默认 A(全 mock) |
| Step 2-4 检查点 | 全部跳过,推断完直接进 Stage A |
| Stage D smoke 失败 | 不阻断(本来就是) |
| `compare-tokens` DSL diff | 跑 + 报告,**不阻断** |
| `vue-tsc` 报错 | 报告 + 落「待人工修复清单」,**不阻断** |

### 必停点(auto 模式也得停)

1. **MCP 不可用** → 环境问题,直接告知用户停
2. **Git 工作区不干净** → 提示用户先 commit/stash,可加 `--dirty-ok` 显式跳过
3. **场景 1 但 YApi 完全没给** → 接口必须有,问用户:补 YApi / 改走场景 2 mock / 取消
4. **精修后 `validate-dom-tree.mjs` 退出码非 0** → 数据源错,后面全错,停

### 输入示例

```
# 最简
mastergo.com/file/xxx?layer_id=yyy yapi=28 auto

# 自然语言
按这个设计稿做 <myModule> 模块,yapi 项目 <projectId>,自己挑接口,别问我直接跑
https://mastergo.com/file/xxx?layer_id=yyy

# PROJECT-TASK 块
---PROJECT-TASK---
uiLink: https://mastergo.com/file/xxx?layer_id=yyy
yapiProjectId: 28
mode: auto
---
```

### 跑完后

不论成功失败都给一份汇报:
- ✅ 已跑完的 Stage + 产物清单
- ⚠️ 未阻断但有警告的项(vue-tsc / DSL diff / Stage D failure)
- 📝 待人工处理清单(TODO(perm) / TODO(icon) / mock 开关 等)
- 📋 git add/commit 建议(不自动 commit)

## 工作流(5 个 Step)

### Step 0 · Reconnaissance(自检)

先完成目标分流。独立出包只检查 MasterGo MCP 和实际输入；独立后端分析只检查需求与项目代码。不要为文档任务要求 YApi、浏览器、开发服务器或完整开发配置。开发任务只检查计划中需要的 skill / MCP。

```bash
# 1. 项目配置就位
test -f .claude/skills/project.config.json
# 2. 下游 skill 齐全
test -f .claude/skills/master-go-to-code/SKILL.md
test -f .claude/skills/yapi-to-code/SKILL.md
test -f .claude/skills/frontend-page-design/SKILL.md
test -f .claude/skills/playwright-skill/SKILL.md
# 3. 按 stages 验证对应 MCP 可用
#    stages 含 A → mastergo MCP
#    stages 含 B → yapi MCP
# 4. 选择对应前置步骤时，再检查出包 / 后端分析 skill
#    prepareDesignPackage=true → mastergo-subdsl-package/SKILL.md
#    analyzeBackendGaps=true → backend-gap-mock-plan/SKILL.md
# 5. Git 状态干净(强烈建议先开新分支)
git status --short
```

### Step 1 · 入口三问(固定顺序,逐个问)

#### 1.1 第一问:选场景

已确认要开发、但场景尚不明确时，按以下模板补场景；仅出包、仅方案、目标已明确或输入完整时跳过：

```
🎨 收到 https://mastergo.com/file/xxx?layer_id=yyy

要做哪种? (回数字 1-5)

  1) 🆕 完整新模块(含接口)        — 接下来要给 YApi
  2) 📄 完整新模块(无接口)        — 数据走 mock 或静态
  3) ➕ 增量(现有模块加东西)       — 接下来要给"模块名"(+ 可选 YApi)
  4) 🔧 迭代(改现有模块一部分)     — 接下来要给"模块名"(+ 可选 YApi)
  5) ♻️ 重构(重写现有模块)         — 接下来要给"模块名" + YApi
```

只补缺失的信息，用户已明确的场景不重复询问。

#### 1.2 第二问:根据场景补必要信息

| 场景 | 第二问 |
|---|---|
| 1 | "YApi 怎么给? ① 贴 URL ② 给项目 ID + 模块语义我自己搜" |
| 2 | "数据策略:A) 全 mock / D) 静态写死? (默认 A)" |
| 3 | "现有模块名是? (如有新接口也贴 YApi,可选)" |
| 4 | "现有模块名是? (如接口字段变了贴 YApi,可选,默认复用现有 api.ts)" |
| 5 | "现有模块名是? + YApi 地址(必传)" |

#### 1.3 第三问:是否 Auto

```
🤖 是否 auto 模式?

  A) 是,无确认全自动跑
  B) 否,每个 Stage 检查点都问我

说明 auto 模式:
  • 跳过所有"等用户确认"检查点(Stage A 报告/Stage C 文件清单/Stage D smoke 失败等)
  • 关键决策自动选(场景 2 数据策略 A,场景 3/4 接口默认复用,场景 5 接口换新)
  • 但 4 个"必停点"仍会停下问你:
    - MCP 不可用 / dev server 没跑
    - Git 工作区不干净(可加 --dirty-ok 跳过)
    - 场景 3/4/5 e2e 定位失败
    - 精修 validate-dom-tree fail
  • 跑完一次性给汇总报告:Stage 状态 + 待人工清单 + git 建议
  • 失败的步骤会落 issues.md 给你回头看
```

#### 1.4 用户回完三问后

```
解析输入为 task-input.schema.json 结构对象
URL 解析可用 node .claude/skills/_shared/lib/parse-urls.mjs <type> <url>
```

完整字段定义见 [references/task-template.md](./references/task-template.md)。

**如果用户输入一开始就够明确**(比如同时给了 mastergo+yapi+auto+模块名),**跳过对应的问,直接进 Step 1.5 / Step 2**。

### Step 1.5 · e2e 定位(仅场景 3/4/5 必跑)

**目的**:精确找到用户说的 `targetModule` 在代码里的位置,并验证菜单可进入。

```bash
# 1. grep 菜单文件找 targetModule
grep -n "$targetModule" <config.structure.menuFile>
# → 拿到 path: 比如 <route-path>

# 2. grep 路由文件反查 Vue 文件
grep -rn "$path" <config.structure.routerDir>/
# → 拿到 component import: 比如 '<viewsDir>/<existingModule>/Index.vue'

# 3. playwright 探索模式验证菜单真的能进(用 MCP)
#    mcp__playwright__browser_navigate(url = '<dev-server-url>$path')
#    mcp__playwright__browser_snapshot()  // 看是否在登录页,是则按 playwright-skill SKILL.md §3.3 登录
#    mcp__playwright__browser_take_screenshot({ filename: 'runtime/screenshots/locate-${module}-current.png' })
#    截图落 .claude/skills/playwright-skill/runtime/screenshots/locate-${module}-current.png
```

**产出**(成功):
```json
{
  "targetModule": "<现有模块>",
  "moduleSlug": "customerList",
  "currentViewDir": "src/views<route-path>/",
  "currentIndexVue": "src/views<route-path>/Index.vue",
  "currentApiDir": "<cacheDir>/<existingModule>/",
  "routePath": "<route-path>",
  "currentScreenshot": ".claude/skills/playwright-skill/runtime/screenshots/locate-customerList-current.png"
}
```

**失败处理**(任一失败立即停):
- grep 菜单找不到 `targetModule` → 报"菜单里没找到 'xxx',请检查模块名拼写"
- 路由文件找不到组件 → 报"找到菜单但找不到对应 Vue 文件"
- MCP 浏览器进不去(404/未登录/dev server 没跑) → 报"页面无法打开,检查 dev server / 登录态"

**不试图修复定位失败**,直接告知用户,等用户提供更准确的模块名。

### Step 2 · 字段最终补全 + 推断

经过 Step 1 三问 + Step 1.5(若 3/4/5)e2e 定位后,绝大多数字段已确定。剩余字段:

- `module` / `pagePath` / `imgDir` → 拉 DSL 根节点 + grep menu **自动推断**(场景 1/2)
- `pagePath` / `imgDir` 对场景 3/4/5 → 从 Step 1.5 e2e 定位结果直接拿(`currentViewDir`)
- 数据策略详细说明见 [references/data-strategy-options.md](./references/data-strategy-options.md)

### Step 3 · 展示执行计划

```markdown
📋 执行计划

模块名:<module>
菜单路径:<pagePath>
数据策略:A/B/C/D 或 inherit
执行阶段:A → B → C → D(默认)

Stage A — master-go-to-code(设计稿 → dom-tree.json)
Stage B — yapi-to-code(接口 → define.ts + api.ts)
Stage C — frontend-page-design(组装 Vue 模块 + 路由 + 菜单)
Stage A.recall — master-go-to-code Step 5(DSL diff,必产 token-diff-report.json)
Stage D — playwright-skill(MCP 浏览器 smoke 验证,前置自检 token-diff-report.json)

预计文件:N 新建 + M 修改
预计耗时:8-15 分钟(含检查点)

确认开始? "确认" / "调整:..."
```

### Step 4 · 依次执行 Stage(用 stage-gate.mjs 把关每个切换点)

对于 `develop`，只有按目标分流选择了可选前置步骤时，才在 Stage A 前执行它们（不计入 A/B/C/D）。设计包路径、选定场景链接、交互原文和后端方案再传给下游；Stage A 仍必须产出并校验 `dom-tree.json` / `svg-paths.json`，再执行原有 gate。文档目标已在开发场景之前交付并结束。

各 Stage 的输入/产出契约见 [references/stage-contracts.md](./references/stage-contracts.md)。
统一报告格式见 [_shared/schemas/stage-report.schema.json](../_shared/schemas/stage-report.schema.json)。
所有 stage report 落盘到 `.claude/results/<module>/<stage>.json`(不污染源码目录)。

```
Stage A 委托 master-go-to-code
  → 末尾产 .claude/results/<module>/stage-a-report.json
  → 产 <outDir>/dom-tree.json + svg-paths.json + <imgDir>/*

Stage B 委托 yapi-to-code (可与 A 并行)
  → 跑 validate-define.mjs --module=<module>
  → 产 .claude/results/<module>/yapi-report.json
  → 产 <config.cacheDir>/<module>/{define,api[,mock]}.ts

★ Gate A&B→C(Stage C 开始前必查 A 和 B 两个 report)
  # 检查 A
  node .claude/skills/_shared/lib/stage-gate.mjs \
    --report=.claude/results/<module>/stage-a-report.json \
    --require-artifacts=<outDir>/dom-tree.json
  # 检查 B(若 stages 含 B)
  node .claude/skills/_shared/lib/stage-gate.mjs \
    --report=.claude/results/<module>/yapi-report.json \
    --accept=pass,warn
  失败 → 报告缺失的那个,停

Stage C 委托 frontend-page-design
  → 把 Stage A/B 产出传给它
  → 末尾跑 stage-c-finalize.mjs --module=<module>
  → 产 .claude/results/<module>/stage-c-report.json
  → 产 <config.viewsDir>/<module>/* + 项目路由/菜单注册

★ Gate C→A.recall
  node .claude/skills/_shared/lib/stage-gate.mjs \
    --report=.claude/results/<module>/stage-c-report.json \
    --accept=pass,warn \
    --require-artifacts=<config.viewsDir>/<module>/Index.vue
  失败 → 报"Stage C 漏跑",停

★ Stage A.recall 回到 master-go-to-code Step 5
  → 跑 compare-tokens.mjs --module=<module>
  → 产 .claude/results/<module>/token-diff-report.json
  → 关键漏写自动尝试修;修不动写入 issues

★ Gate A.recall→D
  node .claude/skills/_shared/lib/stage-gate.mjs \
    --report=.claude/results/<module>/token-diff-report.json \
    --accept=pass,warn
  失败 → 报"Stage A.recall 漏跑或 token diff fail",停

Stage D 委托 playwright-skill (默认开启,v8 起 MCP-first)
  → 读 .claude/skills/playwright-skill/config/playwright-skill.config.json 拿 baseURL / 登录配置
  → 用 MCP playwright 工具按 smoke 步骤操作:
      a. browser_navigate(baseURL + 模块路径)
      b. browser_snapshot 判断是否登录页,是则按 playwright-skill SKILL.md §3.3 登录
      c. 按模块设计点主操作(列表筛选/新增按钮/打开详情等)
      d. 关键节点 browser_take_screenshot({ filename: "runtime/screenshots/<module>-smoke-<step>.png" })
      e. 操作完一句话汇报:通过 / 失败(给截图路径 + 看到 vs 期望)
  → 产 .claude/results/<module>/stage-d-report.json (按汇报结果手动落盘) + runtime/screenshots/<module>-smoke-*.png
  → Stage D verdict=fail 不阻断(铁律 4),记进最终报告
```

可恢复执行:用户说"继续 <module>" 时,先跑 `node .claude/skills/module-flow/scripts/check-resume-state.mjs <module>` 决定从哪个 Stage 起跑。

错误恢复策略详见 [references/error-recovery.md](./references/error-recovery.md)。**Stage A/B/C 失败立即停;Stage D 失败警告不打断**(铁律 3/4)。

### Step 5 · 产出清单 + Git 建议

产物清单可由 `node .claude/skills/_shared/lib/report-generator.mjs <module> --new-files=... --modified-files=...` 自动生成。

```markdown
✅ 全流程完成

新建文件:N 个
修改文件:M 个
中间产物:<outDir>/*(可选清理)
已知占位:TODO(perm): / TODO(icon): / <mock-switch>

Stage D 验证:✅ 通过 或 ⚠️ 失败但已记录(失败时仍给提交建议)

Git 建议:
git add <文件列表>
git commit -m "feat(<module>): ..."
(不自动提交)
```

## 铁律(7 条)

1. **每个 Stage 之间是检查点**,禁止从 A 一气跑到 D。
2. **不重复下游 skill 的工作**,本 skill 只做"解析 + 调度 + 衔接"。
3. **Stage A/B/C 任一失败立即停**,跳过会雪崩。
4. **Stage D 失败警告但不打断**,默认开启,失败把日志摆出来继续给 git 建议。
5. **缺关键字段必问用户**,禁止脑补。
6. **完成后给清单 + 建议,不自动 commit / push**。
7. **没给 apiLink 时主动弹 A/B/C/D 4 选项**,不要默认走 mock。

## 取消与回退机制

用户在检查点说"算了/取消" → 保留已落盘产物不回滚,报告当前 Stage,告诉用户怎么继续。
用户说"重做" → 只回退当前 Stage 内部,不退到上一 Stage。
下次"继续 <module>" → 自动检测已有产物,跳过已完成的 Stage。

详见 [references/cancel-and-resume.md](./references/cancel-and-resume.md)。

## Common Pitfalls

详见 [references/common-pitfalls.md](./references/common-pitfalls.md)。最高频:

- Stage A 卡精修 → 画板太大,启用 mastergo-rules.md 的"分区块请求"
- Stage B 没生成 enum → YApi 描述里没 `0-x,1-y` 关键词,需要让后端补
- Stage C `vue-tsc` 报错 → 多半是响应壳字段访问写错(看 yapi-to-code Step 0 探测结果)
- Stage D flow 失败 → 检查 dev server 是否启动 / mock 开关是否设

## 上下游契约

**输入**(用户消息或 PROJECT-TASK 块,符合 schemas/task-input.schema.json):
- 见上方 schema 文件

**输出**(写给用户):
```ts
{
  module: string,
  stages: { stage: "A"|"B"|"C"|"D", status: "ok"|"failed"|"skipped", duration: number }[],
  files: { new: string[], modified: string[] },
  placeholders: Array<{ type: "permission"|"icon"|"mock", location: string, todo: string }>,
  gitSuggestion: { addCommand: string, commitMessage: string },
}
```

## Changelog

### v2.3.0 (2026-11-20)
- 新增独立设计出包、后端方案和二者串联的目标分流，不再因 MasterGo 链接强制进入开发。
- 按需委托 `mastergo-subdsl-package` / `backend-gap-mock-plan`，支持现有设计包和方案复用。
- 明确设计交付包与 Stage A 代码生成产物的边界，保留原有阶段门禁。

### v2.2.0 (2026-05-15)
- 新增 **Auto Mode**:关键词 `auto / yolo / 全跑 / 别问` 触发无确认模式
- auto 模式自动决策 module/pagePath/imgDir + 模糊搜接口,跳过所有检查点
- 保留 4 个必停点(MCP/Git/YApi 缺/精修错)

### v2.1.0 (2026-05-15)
- 全面去硬编码,产物路径改读 `.claude/skills/project.config.json`
- Step 1 引入 _shared/lib/parse-urls.mjs
- Step 4 引入 check-resume-state.mjs 可恢复执行
- Step 5 引入 _shared/lib/report-generator.mjs

### v2.0.0 (2026-05-13)
- 大厂风格重构:SKILL.md 压缩 72%,拆 references/
- 新增 schemas/task-input.schema.json(任务指令硬契约)

### v1.0.0 (2026-05-13)
- 初版
