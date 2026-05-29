---
name: auto-ui-explorer
description: UI 自动化全流程 E2E 测试编排技能。基于"脚本全栈扫描 -> 大模型手工精修 -> 跨页流程编排 -> MCP单点执行"的高阶测试体系。当用户要求测试完整业务流、集成测试或传入整个模块路径时触发。
version: 6.0.0
---

# Auto UI Explorer · 全模块 E2E 测试编排大师

> 本 skill 依赖 `playwright-skill` 执行浏览器操作。所有浏览器参数从 `playwright-skill/config/playwright-skill.config.json` 读取，不写死。
> 噪音黑名单和表单组件类型从 `config/auto-ui-explorer.config.json` 读取，可按项目定制。

## 目录结构

```
.agents/skills/auto-ui-explorer/
├── SKILL.md                                       本文件
│
├── config/                                        项目适配层
│   └── auto-ui-explorer.config.json                噪音黑名单 + 点击事件模式 + 表单组件类型
│
├── schemas/                                       硬契约
│   └── ui-dictionary.schema.json                   Step 1 词典输出的 JSON Schema
│
├── scripts/                                       脚本工具
│   ├── analyze-module.mjs                          全目录递归扫盘器(读 config)
│   ├── validate-dictionary.mjs                     Step 1 产物校验(校验 schema)
│   └── validate-flow-plan.mjs                      Step 2.6 产物校验(SP 引用/覆盖率/空值拦截)
│
├── references/                                    子文档(详细规范)
│   ├── single-point-spec.md                        单点测试用例编写规范
│   ├── failure-tags.md                             失败分类标签定义
│   ├── form-data-generation.md                     表单测试数据生成规则
│   └── status-markers.md                           ★ 状态标记体系与责任归属
│
└── output/                                        ⚠️ gitignore — 运行产物
    ├── <module>-ui-dictionary.json                  Step 1 的词典
    ├── <module>-E2E-FLOW-PLAN.md                    Step 2 的剧本
    ├── <module>-API-AUDIT.md                        Step 0.9 的 API 对接审计报告
    └── <module>-E2E-REPORT.md                       Step 6 的最终测试报告
```

---

## 测试模式 (Test Mode) ★★★

用户**启动测试时必须选择模式**，或从输入关键词自动推断。模式贯穿全流程，影响 Step 0.9 / Step 4 / Step 5 / Step 6 的行为。

### 模式一：`mock` — 测试 Mock 拦截层

适用场景：后端接口尚未就绪，前端使用 `axios-mock-adapter` / `msw` 等拦截器返回模拟数据。

**核心验证目标**：
1. Mock 是否已注册并成功拦截所有 API 调用（无 404/网络错误）
2. **搜索/筛选参数是否真正传递给了 API 函数**（而非传空 `{}`）
3. **分页参数（pageNum/pageSize）是否传递**，返回的 `total` 是否与列表长度一致
4. **CRUD 操作后数据是否变更**（新增后列表条数 +1，删除后 -1）
5. Mock 返回的数据结构是否匹配 `define.ts` 中的类型定义

**关键词自动推断**：用户输入含 `mock / 模拟 / 前端自测 / 不连后端` → 自动选 `mock` 模式

### 模式二：`real-api` — 测试真实后端接口

适用场景：后端接口已就绪，前端已切换到真实 API 调用。

**核心验证目标**：
1. 所有 API 返回 200 且 `code === 200`（无 404/500/超时）
2. 响应数据结构符合 `define.ts` 类型定义
3. 搜索/筛选/分页功能端到端可用
4. CRUD 操作真实持久化（新增后刷新页面数据仍在）
5. 接口响应时间合理（无超长 loading）

**关键词自动推断**：用户输入含 `真实接口 / 联调 / 对接 / real / 后端已好` → 自动选 `real-api` 模式

### 模式选择的时机和方式

```
用户输入 → 检测关键词
  │
  ├─ 命中 mock 关键词    → testMode = "mock"，打印确认
  ├─ 命中 real-api 关键词 → testMode = "real-api"，打印确认
  └─ 未命中              → 必须询问用户选择，禁止默认跳过
```

**询问模板**：
```markdown
📋 请选择测试模式：

A. **mock 模式** — 测试 Mock 拦截层（后端未就绪，验证前端逻辑和 Mock 数据）
B. **real-api 模式** — 测试真实后端接口（后端已就绪，验证端到端功能）

请输入 A 或 B：
```

---

## Auto Mode（无确认模式）

**触发**：用户输入含任一关键词 → `全跑 / 一气呵成 / auto / yolo / 别问 / 自动测试`，或被 module-flow 委托（auto 透传）。

**行为**：
- 跳过 Step 3 检查点（不等用户确认，直接进 Step 4 执行）
- Step 2 自动决策：不问用户模块名/路由，从输入自动推断
- `validate-flow-plan.mjs` 警告不阻断（verdict=warn 也继续，落 issues 给上层处理）
- **但测试模式仍然必须明确**（从关键词推断或 auto 模式默认 `mock`）

**保留**：
- Step 0 自检失败必停（环境问题不能跳）
- `validate-dictionary.mjs` 失败必停（exit code=1/2 都停，词典不合格后面全废）
- 铁律 1-12 不变

## 入口决策

```
用户输入
  │
  ├─ "帮我集成测试一下 xxx 模块"     ──→ Step 0.5 模糊定位(grep router 找目录)
  │
  ├─ 传入模块全目录路径               ──→ 直接 Step 0 自检
  │     如 src/views/medicalCare/rehabilitation/
  │
  ├─ 传入单个 .vue 文件               ──→ 拒绝，提示"请传模块目录或说模块名"
  │
  ├─ 传入浏览器路由 + 模块目录         ──→ 最优，直接进 Step 0
  │
  ├─ "继续测 xxx 模块"               ──→ 中断恢复流程(见下方§中断恢复)
  │
  └─ "重测 xxx 模块"                 ──→ 删除旧产物，从 Step 1 全部重来
```

## 工作流 (9 个 Step)

### Step 0 · Reconnaissance（自检）

```bash
# 1. 目标目录存在
test -d <目标模块目录>
# 2. 扫描脚本完好
test -f .agents/skills/auto-ui-explorer/scripts/analyze-module.mjs
# 3. 配置文件就位
test -f .agents/skills/auto-ui-explorer/config/auto-ui-explorer.config.json
# 4. 校验脚本就位
test -f .agents/skills/auto-ui-explorer/scripts/validate-dictionary.mjs
test -f .agents/skills/auto-ui-explorer/scripts/validate-flow-plan.mjs
# 5. playwright-skill 就位
test -f .agents/skills/playwright-skill/SKILL.md
test -f .agents/skills/playwright-skill/config/playwright-skill.config.json
# 6. 读取 playwright-skill 配置拿 baseURL
cat .agents/skills/playwright-skill/config/playwright-skill.config.json | grep baseURL
# 7. 确认测试模式已选择（mock / real-api）
echo "testMode = <已选模式>"
```

任一失败即停，告诉用户具体原因。**测试模式未选择 → 必停**。

### Step 0.5 · 模糊定位（用户只给模块名时）

```bash
# 1. grep 路由文件找模块路径
grep -rn "<模块关键词>" src/router/
# → 拿到 component import 路径，推断出模块目录

# 2. 反查确认目录存在
ls src/views/<推断出的模块路径>/
```

失败 → 报"找不到模块目录，请检查模块名拼写或直接给目录路径"，停。

### Step 0.9 · API 对接审计 (API Integration Audit) ★★★ 新增

**目的**：在生成测试用例之前，先搞清楚模块的接口对接现状，避免"测了个寂寞"。

**执行流程**：

```
1. 定位 API 层文件
   ├── 搜索 src/cache/<模块>/ 目录
   ├── 找到 api.ts / define.ts / mock.ts
   └── 如果找不到 → 标记 "⚠️ 无 API 层文件，纯静态页面"

2. 审计 api.ts 中的每个函数
   对每个 export function:
   ├── 提取函数名、接口路径、入参类型
   ├── 检查入参是否为空 {} → 标记 "🔴 空参数调用"
   ├── 检查返回类型是否含 any → 标记 "🟡 弱类型"
   └── 检查是否有分页参数（pageNum/pageSize）→ 分页接口必须传

3. 审计 mock.ts（仅 mock 模式）
   ├── 检查 mock 是否已在项目入口注册（grep setupXxxMock）
   ├── 对比 api.ts 中的路径和 mock.ts 中的拦截路径 → 漏拦截 = 🔴
   ├── 检查 mock 返回的数据结构是否匹配 define.ts 类型
   └── 检查分页接口 mock 是否返回 { records/list: [], total: N } 结构

4. 审计 YApi 接口（如有 YApi MCP 可用）
   ├── 对比 YApi 分类下的接口和 api.ts 中已对接的接口
   ├── 标记未对接的 YApi 接口
   └── 检查已对接接口的入参是否匹配 YApi 定义

5. 审计 Vue 组件中的 API 调用
   ├── grep 所有 import { xxx } from '@/cache/...'
   ├── grep 所有实际调用点，检查传参是否完整
   └── 重点检查列表页的搜索/筛选参数是否传递给 API 函数
```

**产出**：`.agents/skills/auto-ui-explorer/output/<module>-API-AUDIT.md`

```markdown
# API 对接审计报告 — <模块名>

## 测试模式: mock / real-api

## API 函数审计

| # | 函数名 | 接口路径 | 入参类型 | 问题 |
|---|--------|---------|---------|------|
| 1 | getRecordList | /api/.../list | ✅ 完整 / 🔴 空 {} | 分页参数未传 |

## Mock 拦截审计（仅 mock 模式）

| # | api.ts 路径 | mock.ts 拦截 | 数据结构匹配 | 问题 |
|---|------------|-------------|-------------|------|
| 1 | /api/.../list | ✅ 已拦截 | 🔴 缺 total 字段 | ... |

## YApi 对接审计（如有）

| # | YApi 接口名 | YApi 路径 | api.ts 对接 | 问题 |
|---|-----------|---------|------------|------|

## 组件调用审计

| # | 组件文件 | 调用函数 | 传参完整性 | 问题 |
|---|---------|---------|-----------|------|
| 1 | Index.vue → FreeServiceTable | getRecordList() | 🔴 未传搜索参数 | 搜索功能无效 |

## 审计结论

- 🔴 阻断问题: N 个（必须修复才能继续测试）
- 🟡 警告问题: M 个（不影响测试但需关注）
- ✅ 正常: K 个
```

**★ Gate: Step 0.9 → Step 1**

| 审计结果 | 处理 |
|---------|------|
| 无 🔴 阻断 | 继续 Step 1 |
| 有 🔴 阻断 + mock 模式 | **报告给用户，提示需修复 api.ts/mock.ts 后重新测试**。用户可选择"跳过审计继续"但报告会标注"⚠️ 审计未通过" |
| 有 🔴 阻断 + real-api 模式 | **必停**。真实接口调用参数不完整 = 测试无意义 |

### Step 1 · 脚本全目录扫盘 (Script)

```bash
node .agents/skills/auto-ui-explorer/scripts/analyze-module.mjs <目标模块目录>
```

脚本从 `config/auto-ui-explorer.config.json` 读取噪音黑名单和组件类型配置，在扫描层即完成预过滤。

**产出**：`.agents/skills/auto-ui-explorer/output/<module>-ui-dictionary.json`

词典内容包含：
- `routesAndFiles[]` — 扫到的所有 Vue 文件完整路径
- `noiseFilesFiltered[]` — 被黑名单过滤掉的噪音组件列表
- `buttons[]` — 所有点击事件绑定（含 `@click.stop` / `@click.prevent` 等修饰符，含 source、tag、action、eventBinding）
- `dialogs[]` — 所有 `el-dialog` / `el-drawer`（含 title、isDynamicTitle、v-model）
- `formInputs[]` — 所有 `el-form-item` 内的输入控件（含 label、type、placeholder、required、optionsBinding）
- `routerPushCalls[]` — 所有 `router.push` / `router.replace` 调用（含 source、method、target）
- `formRules[]` — 从 `:rules` 绑定提取的必填字段列表

**★ Gate: Step 1 → Step 2（必须通过校验才能进入精修）**

```bash
node .agents/skills/auto-ui-explorer/scripts/validate-dictionary.mjs \
  .agents/skills/auto-ui-explorer/output/<module>-ui-dictionary.json
```

退出码非 0 → 停，报错给用户。
**检查点**（非 auto 模式）：报告扫到的文件数 / 过滤噪音数 / 按钮数 / 弹窗数 / 输入项数 / 路由跳转数 / 必填规则数，等用户确认再继续。

### Step 2 · 大模型精修编排 (LLM Refinement — 核心 6 小步)

这是本 skill 的灵魂环节。大模型**不能只看 JSON 词典**，必须**同时阅读 Vue 源码**，交叉验证并提炼出有血有肉的测试编排。

#### Step 2.1 · 交叉校验词典准确性 (JSON vs. Source)

打开 `<module>-ui-dictionary.json`，逐文件与源码交叉比对：

```
对于词典中的每个 routesAndFiles 条目:
  1. view_file 打开该 .vue 文件
  2. 核实词典中的 buttons[] 是否漏提（极端写法如 @dblclick / 动态 v-on）
  3. 核实词典中的 dialogs[] 的 title 是否正确（isDynamicTitle=true 的必须读源码补全真实标题）
  4. 核实词典中的 formInputs[] 是否类型识别正确
  5. 发现漏提 → 手动补录到词典的内存副本中
  6. 发现误提 → 标记为 _noise: true
```

**噪音过滤黑名单**：从 `config/auto-ui-explorer.config.json` 的 `noiseBlacklist` 字段读取。脚本层已预过滤（`noiseFilesFiltered[]`），Step 2.1 做二次确认。

新增基础组件时，只需在 config JSON 里加一行，无需改 SKILL.md。

**产出**：内存中的《精修词典》（补漏 + 去噪后的版本）

#### Step 2.2 · 提取路由拓扑 (Route Topology)

阅读模块对应的路由文件（如 `src/router/medicalCareRouter.ts`），建立路由拓扑图。
同时利用词典中的 `routerPushCalls[]` + 阅读源码中的 `router.push` / `router.replace` 调用，建立**页面间跳转关系**。

#### Step 2.3 · 输出单点测试清单 (Single Point Test Cases)

**单点测试定义**：对每一个独立的可交互节点（按钮/弹窗/表单），定义一个完整的最小可测单元。

对精修词典中的**每一个有效 button / dialog**，生成标准格式的单点测试用例。

用例编写规范详见 [references/single-point-spec.md](./references/single-point-spec.md)。
表单测试数据生成规则详见 [references/form-data-generation.md](./references/form-data-generation.md)。

**★ 搜索/筛选类 SP 的增强要求（结合 API 审计）**：

如果 Step 0.9 的审计报告中标记了某个列表接口"🔴 空参数调用"或"分页参数未传"，则对应的搜索/筛选 SP 必须增加以下验证步骤：

```markdown
### SP-XXX: [index.vue] 列表页搜索
- ...原有步骤...
- 额外验证（来自 API 审计）:
  - [ ] browser_console_messages() 检查是否有网络请求发出
  - [ ] 搜索后表格数据是否变化（对比搜索前后的行数）
  - [ ] 如果数据未变化 → 标记 [!][API参数未传递] 搜索参数未传给接口函数
```

**★ 分页类 SP 的增强要求**：

所有含分页的列表页，必须生成一个专门的分页验证 SP：

```markdown
### SP-XXX: [xxx.vue] 分页功能验证
- 前置条件: 在列表页，数据已加载
- 操作步骤:
  1. 记录当前底部分页显示的总条数 N
  2. 记录当前表格行数 M
  3. 验证 N >= M（总条数应大于等于当前页行数）
  4. 如果有翻页按钮且 N > pageSize，点击下一页
  5. 验证页码变化，数据刷新
- 预期结果: 分页总数与数据一致，翻页正常
- 状态: [ ]
```

#### Step 2.4 · 输出集成测试流程 (Integration Flow)

将单点测试用例**按业务语义串联**成完整的跨页面流程。每个 Flow 必须以 `browser_navigate` 重置到初始路由结尾。

**★ CRUD 数据变更验证（必须包含）**：

每个包含"新增"操作的 Flow，在新增完成后必须增加以下验证步骤：

```markdown
N. [数据变更验证] 新增完成后:
   a. browser_snapshot() 获取当前列表
   b. 记录新增后的表格行数 M2
   c. 对比新增前的行数 M1，验证 M2 > M1（或新增的数据出现在列表中）
   d. 验证底部分页总条数是否同步更新
   e. 如果 M2 == M1 → 标记 [!][数据变更未生效] 新增后列表未刷新
```

#### Step 2.5 · 自检流程 (Self Review)

大模型必须自审：
1. 精修词典中**所有非噪音的 button/dialog** 是否都已被编入至少一个 SP 用例？
2. 路由拓扑中的**所有页面**是否都被至少一个 Flow 覆盖？
3. 每个含 `el-form` 的弹窗，是否都有**空值拦截测试（Fuzzing）**？
4. 每个 Flow 的最后一步是否有**重置到初始路由**？
5. **★ 新增**：所有列表页是否都有**分页验证 SP**？
6. **★ 新增**：所有含搜索的页面是否都有**搜索参数传递验证**？
7. **★ 新增**：所有含 CRUD 的 Flow 是否都有**数据变更验证步骤**？

缺失 → 补充，直到自检通过。

#### Step 2.6 · 落盘产出

将精修结果写入 `.agents/skills/auto-ui-explorer/output/<module>-E2E-FLOW-PLAN.md`。

**★ FLOW-PLAN 头部必须包含测试模式声明**：

```markdown
# E2E 测试编排 — <模块名>

> 测试模式: **mock** / **real-api**
> API 审计: ✅ 通过 / ⚠️ N 个问题（详见 <module>-API-AUDIT.md）
```

**★ Gate: Step 2 → Step 3（必须通过校验才能展示/执行）**

```bash
node .agents/skills/auto-ui-explorer/scripts/validate-flow-plan.mjs \
  .agents/skills/auto-ui-explorer/output/<module>-E2E-FLOW-PLAN.md \
  --dict=.agents/skills/auto-ui-explorer/output/<module>-ui-dictionary.json
```

| 退出码 | 含义 | 处理 |
|--------|------|------|
| 0 | 全部通过 | 继续 |
| 1 | 有警告（如 SP 未被引用、弹窗未覆盖） | 非 auto → 报告给用户决定；auto → 继续但落 issues |
| 2 | 严重错误（缺 SP / 缺 Flow / 无空值拦截） | **必停**，修正后重新校验 |

### Step 3 · 检查点（展示剧本等用户确认）

```markdown
📋 E2E 测试编排完成

测试模式: mock / real-api
API 审计: ✅ 通过 / ⚠️ N 个问题
扫描文件: N 个
过滤噪音组件: M 个
生成单点用例: P 个 (SP-001 ~ SP-0XX)
  - 含搜索验证 SP: X 个
  - 含分页验证 SP: Y 个
  - 含数据变更验证: Z 个
编排集成流程: Q 条 (Flow-001 ~ Flow-0XX)
覆盖弹窗空值拦截: R 个
词典校验: ✅ 通过
剧本校验: ✅ 通过 / ⚠️ N 个警告

剧本已落盘: .agents/skills/auto-ui-explorer/output/<module>-E2E-FLOW-PLAN.md
API审计报告: .agents/skills/auto-ui-explorer/output/<module>-API-AUDIT.md

确认无误后，将启动 Playwright MCP 逐点执行。是否开始？
```

**auto 模式跳过此步**，直接进 Step 4。

### Step 4 · 单点执行 (Playwright MCP Execution) ★ 大幅强化

接到用户确认后，按照 `E2E_FLOW_PLAN.md` 中的 **Flow 顺序**逐一推进。

#### 4.1 执行前初始化 ★★★

**在执行第一个 SP 之前**，必须完成以下初始化：

```
1. browser_navigate(baseURL + 初始路由)
2. browser_snapshot() → 确认登录态正常
3. 如果是列表页:
   a. 等待表格渲染完成（检查 snapshot 中是否有表格行）
   b. 记录初始状态:
      - 初始表格行数 = M0
      - 初始分页总条数 = T0（从分页组件读取）
   c. 将 M0 和 T0 记录到执行上下文中，供后续验证使用
4. browser_console_messages() → 清空/记录初始控制台
```

**自检证据**：必须在 E2E-FLOW-PLAN.md 头部或执行日志中记录：
```markdown
## 执行初始化
- 初始表格行数: M0 = <数字>
- 初始分页总条数: T0 = <数字>
- 登录态: ✅
- 初始化时间: <时间戳>
```

#### 4.2 单点执行标准流程

对于 Flow 中引用的每一个 SP 用例，执行如下标准操作序列：

```
对于每个 SP-XXX:
  1. browser_navigate(baseURL + SP的前置路由)（如果不在正确页面）
  2. browser_snapshot() → 确认在正确页面（检查 URL / 关键文本）
  3. 如果 SP 包含表单:
     a. 先执行空值提交测试（Fuzzing）:
        - 直接 browser_click 提交按钮
        - browser_snapshot() 检查红字校验
        - browser_take_screenshot(filename="runtime/screenshots/<module>-SP-XXX-fuzz.png")
     b. 再按测试数据表逐字段注入:
        - el-input → browser_type(ref, value)
        - el-select/CommonSelect → browser_click 展开 → browser_click 选项
        - el-radio → browser_click 目标 radio
        - el-date-picker → browser_click → 选日期
     c. browser_click 提交按钮
     d. browser_snapshot() 验证弹窗关闭或页面变化
  4. browser_take_screenshot(filename="runtime/screenshots/<module>-SP-XXX-done.png")
  5. 更新 E2E_FLOW_PLAN.md（状态标记规范详见 [references/status-markers.md](./references/status-markers.md)）:
     - 功能完全正常 → `[x]`
     - 前端正确但无数据 → `[x][前端正常·无数据]`
     - 前端代码 Bug → `[!][前端问题]` 或具体标签如 `[!][API参数未传递]`
     - 后端接口问题 → `[!][后端问题]` 或 `[!][接口问题]`
     - Mock 实现不完整 → `[!][Mock问题]` 或 `[!][Mock数据未变更]`
     - 行为存疑 → `[?][待确认]`
     - 被前置步骤阻断 → `[SKIP]`
```

#### 4.3 搜索/筛选 SP 的增强执行 ★★★

搜索类 SP 执行时，必须额外做以下验证：

```
对于搜索/筛选类 SP:
  1. 搜索前:
     a. browser_snapshot() → 记录搜索前表格行数 M_before
  2. 填入搜索条件 + 点击搜索
  3. 搜索后:
     a. browser_snapshot() → 记录搜索后表格行数 M_after
     b. 对比 M_before vs M_after:
        - M_after < M_before → ✅ 搜索有过滤效果
        - M_after == M_before 且搜索条件不为空:
          ├─ mock 模式 → 标记 [?][待确认] Mock 未实现搜索过滤逻辑
          └─ real-api 模式 → 标记 [!][搜索无效] 后端未按参数过滤
     c. browser_console_messages() → 检查是否有 API 请求发出
  4. 点击重置:
     a. browser_snapshot() → 确认筛选条件已清空
     b. 记录重置后行数 M_reset，验证 M_reset >= M_after
```

#### 4.4 分页 SP 的增强执行 ★★★

```
对于分页验证 SP:
  1. browser_snapshot() → 读取分页组件:
     a. 当前页码 P
     b. 总条数 T
     c. 每页条数 S
     d. 表格实际行数 M
  2. 验证逻辑一致性:
     a. T >= M（总条数 >= 当前页行数）
     b. 如果 T > S → 应该有多页，验证翻页按钮可点击
     c. 如果 T <= S → 只有一页，翻页按钮应禁用
  3. 翻页测试（如果有多页）:
     a. 点击下一页
     b. browser_snapshot() → 验证页码变为 P+1，数据刷新
     c. 点击返回上一页 → 验证数据恢复
  4. 失败标记:
     - T == 0 但表格有数据 → [!][分页总数错误] total 未正确返回
     - 翻页后数据不变 → [!][分页功能无效]
```

#### 4.5 CRUD 数据变更 SP 的增强执行 ★★★

```
对于新增/删除/编辑操作:
  1. 操作前:
     a. 记录列表行数 M_before
     b. 记录分页总条数 T_before
  2. 执行新增/删除/编辑操作
  3. 操作后:
     a. 如果需要返回列表页 → browser_navigate
     b. browser_snapshot() → 记录:
        - 列表行数 M_after
        - 分页总条数 T_after
     c. 验证:
        ├─ 新增: M_after > M_before 或 T_after > T_before
        ├─ 删除: M_after < M_before 或 T_after < T_before
        └─ 编辑: 目标行数据已变化
     d. 如果数据未变化:
        ├─ mock 模式 → [!][Mock数据未变更] Mock 拦截器未正确模拟 CRUD
        └─ real-api 模式 → [!][接口问题] 后端操作未生效或列表未刷新
```

**失败分类标签**：详见 [references/failure-tags.md](./references/failure-tags.md)。

| 标签 | 含义 |
|------|------|
| `[!][数据问题]` | 表格为空/选项为空，Mock 数据不足导致流程走不通 |
| `[!][接口问题]` | 接口 404/500，后端未对接 |
| `[!][元素定位失败]` | snapshot 中找不到目标按钮/输入框 |
| `[!][校验不符预期]` | 红字没出现/出现了不该出现的错误 |
| `[!][路由跳转失败]` | 点击后未跳转到预期页面 |
| `[!][API参数未传递]` | ★ 新增：搜索/筛选参数未传给接口函数 |
| `[!][分页总数错误]` | ★ 新增：分页 total 与实际数据不一致 |
| `[!][Mock数据未变更]` | ★ 新增：CRUD 操作后 Mock 层数据未变化 |
| `[!][搜索无效]` | ★ 新增：搜索后数据未过滤 |
| `[!][分页功能无效]` | ★ 新增：翻页后数据未刷新 |
| `[?][待确认]` | 不确定是 bug 还是正常行为，需要人工判定 |

### Step 5 · 集成流程串联验证

单点全部执行完毕后，按 Flow 的顺序做一轮**完整串联**：
- 从 Flow 的第一步开始，**不刷新页面**地连续执行
- 验证跨页面的**数据传递**是否正确（如新增后列表是否多了一条）
- 验证**状态残留**是否影响后续步骤

**★ 串联验证必须包含的数据一致性检查**：

```
串联结束后，回到列表初始页面:
  1. browser_snapshot() → 记录最终状态:
     - 最终表格行数 M_final
     - 最终分页总条数 T_final
  2. 与 Step 4.1 记录的初始状态对比:
     - 如果本次 Flow 包含新增操作 → M_final 应 > M0
     - 如果本次 Flow 包含删除操作 → M_final 应 < M0
     - 如果只有查看/编辑操作 → M_final 应 == M0
  3. 不一致 → 标记具体原因
```

### Step 6 · 产出测试报告

落盘到 `.agents/skills/auto-ui-explorer/output/<module>-E2E-REPORT.md`。

包含：

```markdown
# E2E 测试报告 — <模块名>

## 测试概况

| 项目 | 值 |
|-----|-----|
| 测试模式 | mock / real-api |
| 测试时间 | <时间> |
| API 审计 | ✅ / ⚠️ N 个问题 |
| 总 SP 数 | N |
| ✅ 通过 | X |
| ❌ 失败 | Y |
| ❓ 待确认 | Z |
| 页面覆盖 | M/N |
| 按钮覆盖 | M/N |
| 弹窗覆盖 | M/N |

## 单点结果明细

| SP编号 | 功能描述 | 状态 | 标签 | 截图 | 备注 |
|--------|---------|------|------|------|------|

## 集成流程结果

| Flow编号 | 描述 | 结果 | 数据一致性 |
|---------|------|------|-----------|

## 问题汇总

### 🔴 阻断问题
### 🟡 非阻断问题
### 🟢 已通过

## 截图清单
```

### Step 7 · 完成自检 (Completion Self-Check) ★★★ 新增

**所有 Step 执行完毕后，必须做最终自检**：

```
完成自检清单（必须逐项确认）:
  ☐ Step 0.9 API 审计报告已落盘
  ☐ Step 1 词典已生成并通过校验
  ☐ Step 2 剧本已生成并通过校验
  ☐ Step 4 所有 SP 都已执行（无遗漏 [ ] 状态）
  ☐ Step 4 所有截图已保存
  ☐ Step 5 集成串联已执行
  ☐ Step 6 测试报告已落盘到 output/<module>-E2E-REPORT.md
  ☐ 搜索/重置功能已验证（如有）
  ☐ 分页功能已验证（如有）
  ☐ CRUD 数据变更已验证（如有）
  ☐ E2E-FLOW-PLAN.md 中无残留 [ ] 标记（全部为 [x] 或 [!] 或 [?]）
```

**任一项未完成 → 禁止向用户报告"测试完成"**。

---

## 强制约束 (Hooks) ★ 大幅强化

以下约束由 SKILL.md 定义，大模型在执行本 skill 时**必须自觉遵守**，违反等于严重违规。

| # | 时机 | 约束名 | 拦截内容 |
|---|------|--------|---------| 
| H1 | 入口 | `enforce-test-mode` | **必须在 Step 0 之前确认测试模式（mock/real-api）**。未确认 → 禁止往下走。auto 模式默认 mock，但必须在产出中声明。 |
| H2 | Step 0.9 → Step 1 | `gate-api-audit` | **必须完成 API 对接审计**。real-api 模式有 🔴 阻断 → 禁止继续。mock 模式有 🔴 → 警告但可继续。 |
| H3 | Step 1 → Step 2 | `gate-dictionary` | 必须跑 `validate-dictionary.mjs`，退出码非 0 → **禁止进入 Step 2** |
| H4 | Step 2 执行中 | `enforce-source-read` | 大模型在 Step 2.1 中**必须 `view_file` 打开至少 3 个源码文件**。如果直接跳到 2.3 输出 SP 而没读过任何源码 → 严重违规，必须回退重做 |
| H5 | Step 2 执行中 | `enforce-noise-filter` | 大模型输出的 SP 用例中**不得出现** `config.noiseBlacklist` 中的任何组件名。出现 → 删除该 SP 并重新编号 |
| H6 | Step 2.5 执行中 | `enforce-pagination-sp` | **所有含分页的列表页必须有对应的分页验证 SP**。没有 → 必须补充 |
| H7 | Step 2.5 执行中 | `enforce-search-sp` | **所有含搜索框的页面必须有搜索参数验证 SP**。没有 → 必须补充 |
| H8 | Step 2.5 执行中 | `enforce-crud-mutation` | **所有含 CRUD 的 Flow 必须有数据变更验证步骤**。没有 → 必须补充 |
| H9 | Step 2.6 → Step 3 | `gate-flow-plan` | 必须跑 `validate-flow-plan.mjs`，退出码=2 → **禁止进入 Step 3**，必须修正 |
| H10 | Step 4 执行前 | `enforce-init-state` | **必须记录初始状态（表格行数、分页总条数）**。没有初始状态记录就开始测 → 严重违规 |
| H11 | Step 4 执行中 | `enforce-screenshot` | 每个 SP 执行完毕**必须调用 `browser_take_screenshot`**。没截图就标 `[x]` → 严重违规 |
| H12 | Step 4 执行中 | `enforce-reset` | 每个 Flow 执行完毕**必须调用 `browser_navigate` 重置到初始路由**。漏重置 → 后续 Flow 结果不可信 |
| H13 | Step 4 → Step 5 | `gate-all-sp-done` | **E2E-FLOW-PLAN.md 中不得有残留 `[ ]` 状态的 SP**。有 → 禁止进入 Step 5，必须执行完或标 `[!]`/`[SKIP]` |
| H14 | Step 5 → Step 6 | `gate-integration` | **集成串联验证必须执行**。跳过 Step 5 直接写报告 → 严重违规 |
| H15 | Step 6 → 完成 | `gate-completion` | **Step 7 完成自检必须全部通过**。有未勾选项 → 禁止宣称"测试完成" |

---

## 铁律 (12 条) ★ 新增 4 条

1. **Step 2 必须读源码**：只读 JSON 词典不读源码 = 严重违规。词典只是线索，源码才是真相。
2. **噪音过滤绝对执行**：`CustomTable` / `CommonSelect` 等基础组件出现在测试节点中 = 严重违规。黑名单从 config 读取。
3. **单点必须含表单数据**：凡涉及表单的 SP 用例，必须从源码提取字段类型并生成测试数据表（规则见 [references/form-data-generation.md](./references/form-data-generation.md)），绝不允许"随便填一下"。
4. **空值拦截必测**：每个含 `el-form` + 必填规则的弹窗，必须先做一次空提交截图，再做合规提交。
5. **打勾闭环必出证**：`[x]` 必须有截图佐证，`[!]` 必须有失败分类标签（见 [references/failure-tags.md](./references/failure-tags.md)）。未完成标记前绝不宣称测试结束。
6. **隔离与重置铁律**：每个 Flow 执行完毕必须 `browser_navigate` 回初始路由。
7. **失败不掩盖**：接口 404、数据为空等问题如实标记，绝不跳过或假装通过。
8. **Gate 不可跳**：`validate-dictionary.mjs` 和 `validate-flow-plan.mjs` 的校验是硬卡点，退出码非 0 时禁止往下走。auto 模式下 dictionary 校验仍然必停。
9. **★ 搜索必须验证参数传递**：搜索/筛选功能不是"点了按钮没报错就算通过"。必须验证 API 调用时参数是否真正传递，搜索后数据是否实际过滤。未验证 → 严重违规。
10. **★ 分页必须验证数据一致性**：分页组件的 `total` 必须与实际数据量一致，翻页必须导致数据刷新。未验证 → 严重违规。
11. **★ CRUD 必须验证数据变更**：新增/删除/编辑操作后，列表数据必须发生对应变化。只验证"提交成功弹窗关闭"而不验证数据变更 → 严重违规。
12. **★ 测试模式必须声明**：所有测试产出（E2E-FLOW-PLAN.md / API-AUDIT.md / E2E-REPORT.md）头部必须声明测试模式。未声明 → 产出无效。

---

## 中断恢复机制

用户在任意 Step 说"先停"或对话中断：
- 已有的 `<module>-E2E-FLOW-PLAN.md` 保留，不删不回滚
- 下次用户说"继续测 xxx 模块"时：
  1. 检查 `output/<module>-E2E-FLOW-PLAN.md` 是否存在
  2. 存在 → 扫描已有的 `[x]` / `[!]` 标记，从第一个 `[ ]` 继续
  3. 不存在 → 从 Step 1 重新开始
- 用户说"重测 xxx 模块" → 删除旧产物，从 Step 1 全部重来

## 反模式 (❌)

- ❌ 不读源码直接从 JSON 词典生成 SP 用例（铁律 1 + hook `enforce-source-read`）
- ❌ 把 `CustomTable` / `CommonSelect` 等基础组件编入 SP 测试节点
- ❌ SP 用例中的表单字段没有测试数据表，只写"填入数据"
- ❌ 跳过 `validate-dictionary.mjs` / `validate-flow-plan.mjs` 校验直接执行
- ❌ 执行 SP 后不截图就打 `[x]`
- ❌ Flow 执行完不重置路由就测下一个 Flow
- ❌ 接口 404 / 数据为空时标 `[x]` 而非 `[!][接口问题]` / `[!][数据问题]`
- ❌ 在 skill 目录里创建 `node_modules` / `package.json` / `playwright.config.ts`（走 MCP，不走 test runner）
- ❌ 截图写到项目源码目录（用 `playwright-skill/runtime/screenshots/`）
- ❌ **★ 搜索类 SP 只验证"点了没报错"而不验证数据是否过滤**
- ❌ **★ 分页类 SP 不验证 total 一致性和翻页效果**
- ❌ **★ CRUD 后不验证列表数据变更就标通过**
- ❌ **★ 不做 API 审计就开始生成测试用例**
- ❌ **★ 不记录初始状态（行数/总条数）就开始执行测试**
- ❌ **★ 不声明测试模式就开始测试**
- ❌ **★ 跳过 Step 5 集成串联直接写报告**

## Common Pitfalls

- **词典漏提 @click.stop**：v4.1+ 脚本已支持 `@click.stop` / `@click.prevent` / `@click.native` / `v-on:click`（从 config 读取模式列表）。但仍可能漏提极端写法，Step 2.1 的源码交叉校验兜底。
- **动态 :title 弹窗**：词典会标记 `isDynamicTitle: true`，Step 2.1 必须读源码补全真实标题（如 `isEdit ? '编辑' : '新增'`）。
- **下拉选项来自接口**：词典会标记 `optionsBinding` 字段。如果绑定的变量不是硬编码数组，SP 用例应标注 `[数据依赖接口]`。
- **MCP snapshot 太大**：弹窗内嵌大表格时 snapshot 会很长，用 `browser_snapshot({ target: <dialog-ref> })` 局部抓。
- **登录态过期**：长时间测试中登录态可能失效，按 playwright-skill §3.4 自动重登。
- **validate-flow-plan 报 SP 未引用**：通常是条件依赖型 SP（如"必须先有数据才能编辑"），在 Flow 中标注前置条件即可。
- **★ mock 模式下搜索不过滤是预期行为**：许多 mock 拦截器不实现条件过滤，只返回固定数据。此时搜索 SP 应标记 `[?][待确认] Mock 未实现搜索过滤` 而非 `[!]`。但**必须验证 API 函数是否传了参数**——如果连参数都没传，那是前端代码 bug，应标 `[!][API参数未传递]`。
- **★ mock 模式下 CRUD 后数据不变可能是 mock 未实现**：如果 mock.ts 的 create 拦截器只返回 `{ data: true }` 而没有在内存中追加数据，则列表不会变。应标记 `[?][待确认] Mock 未实现数据持久化` 并在报告中建议改进 mock 实现。

## 上下游契约

**输入**（来自用户或 module-flow）:
```ts
{
  targetModuleDir: string,       // 模块全目录路径
  targetRoute?: string,          // 浏览器初始路由（可选，会自动从 router 推断）
  testMode: 'mock' | 'real-api', // ★ 测试模式（必填）
  auto?: boolean,                // 是否 auto 模式
  yapiCatUrl?: string,           // ★ YApi 分类 URL（可选，用于 API 审计）
}
```

**输出**（交给用户）:
```ts
{
  dictionaryPath: string,        // <module>-ui-dictionary.json（符合 schemas/ui-dictionary.schema.json）
  flowPlanPath: string,          // <module>-E2E-FLOW-PLAN.md（带 [x]/[!]/[?] 标记）
  apiAuditPath: string,          // ★ <module>-API-AUDIT.md（API 对接审计报告）
  reportPath: string,            // <module>-E2E-REPORT.md（最终测试报告）
  testMode: 'mock' | 'real-api', // ★ 实际使用的测试模式
  validation: {
    apiAudit: 'pass' | 'warn' | 'fail',  // ★ API 审计结果
    dictionary: 'pass' | 'fail',
    flowPlan: 'pass' | 'warn' | 'fail',
  },
  summary: {
    totalSP: number,
    passed: number,
    failed: number,
    uncertain: number,
    coverage: {
      pages: string,             // "5/5"
      buttons: string,           // "12/14"
      dialogs: string,           // "6/6"
    },
    dataIntegrity: {             // ★ 数据完整性验证
      searchValidated: boolean,
      paginationValidated: boolean,
      crudMutationValidated: boolean,
    }
  }
}
```

## Changelog

### v1.0.0 (2026-05-29)
- **★ 新增测试模式选择**：`mock` / `real-api` 两种模式，入口必选，贯穿全流程
- **★ 新增 Step 0.9 API 对接审计**：在生成测试用例前审计接口对接现状（参数完整性、Mock 拦截覆盖、YApi 对接率）
- **★ 新增 Step 7 完成自检**：所有 Step 完成后必须逐项确认，禁止虚报"测试完成"
- **★ Step 4 大幅强化**：
  - 4.1 执行前初始化（记录初始行数/分页总条数）
  - 4.3 搜索/筛选增强执行（验证参数传递 + 数据过滤效果）
  - 4.4 分页增强执行（验证 total 一致性 + 翻页效果）
  - 4.5 CRUD 数据变更增强执行（新增/删除后验证列表变化）
- **★ 新增 5 个失败标签**：`[!][API参数未传递]` / `[!][分页总数错误]` / `[!][Mock数据未变更]` / `[!][搜索无效]` / `[!][分页功能无效]`
- **★ Hooks 从 6 条扩展到 15 条**：新增 `enforce-test-mode` / `gate-api-audit` / `enforce-pagination-sp` / `enforce-search-sp` / `enforce-crud-mutation` / `enforce-init-state` / `gate-all-sp-done` / `gate-integration` / `gate-completion`
- **★ 铁律从 8 条扩展到 12 条**：新增搜索参数验证 / 分页一致性 / CRUD 变更验证 / 测试模式声明
- **★ 反模式新增 7 条**
- 上下游契约新增 `testMode` / `yapiCatUrl` 输入字段和 `apiAuditPath` / `dataIntegrity` 输出字段

### v1.0.0 (2026-05-29)
- 新增 **Auto Mode**：关键词触发无确认模式，跳 Step 3 检查点
- 新增 `schemas/ui-dictionary.schema.json` — 词典输出硬契约
- 新增 `scripts/validate-dictionary.mjs` — Step 1 产物校验（退出码 0/1/2）
- 新增 `scripts/validate-flow-plan.mjs` — Step 2.6 产物校验（SP 引用/覆盖率/空值拦截）
- 新增 **★ Gate 卡点机制**：Step 1→2 必须通过词典校验，Step 2→3 必须通过剧本校验
- 新增 **强制约束 (Hooks)** 章节：6 条执行时约束（enforce-source-read / enforce-noise-filter / enforce-screenshot / enforce-reset / gate-dictionary / gate-flow-plan）
- 新增 **反模式 (❌)** 章节：9 条禁止行为
- 铁律从 7 条扩展到 8 条（新增"Gate 不可跳"）
- 上下游契约新增 `auto` 输入字段和 `validation` 输出字段

### v1.0.0 (2026-05-29)
- 新增 `config/auto-ui-explorer.config.json` 配置化噪音黑名单和组件类型
- 新增 `references/` 子文档
- `analyze-module.mjs` 升级：支持修饰符/路由/规则/选项提取
- 新增中断恢复机制

### v1.0.0 (2026-05-29)
- 彻底重构 Step 2：JSON + 源码交叉校验六小步精修流程
- 新增失败分类标签体系
- 新增 Step 6 标准化测试报告模板

### v1.0.0 (2026-05-29)
- 确立四步编排法，脚本升级为目录级扫盘

### v1.0.0 (2026-05-29)
- 初版
