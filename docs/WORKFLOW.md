# Skills 全流程指南

> 7 个场景的步骤表格。每个场景标注:**触发输入 / 关键步骤 / 产物 / 验证 / 失败处理 / 是否支持 auto**。
>
> 配套阅读:[GLOSSARY.md](./GLOSSARY.md) 看英文名含义、[STATUS.md](./STATUS.md) 看版本和统一报告格式。

---

## 场景速查决策树

```
你的输入                                  → 走的场景
──────────────────────────────────────────────────────
mastergo URL + yapi 信息                  → 场景 1 完整新模块(含接口)
mastergo URL,没 yapi                      → 场景 2 完整新模块(无接口)
mastergo URL + "xxx 增量"                  → 场景 3 增量
mastergo URL + "xxx 迭代"                  → 场景 4 迭代
mastergo URL + "xxx 重构"                  → 场景 5 重构
云效链接 / "修 bug"                        → 场景 6 云效 Bug
"跑一遍测试" / "E2E" / "全量回归"          → 场景 7 E2E 回归
```

---

## 场景 1 · 完整新模块(含接口)

**触发**:用户贴 mastergo URL + yapi URL/projectId,默认走完整模块流水线

| Step | 干啥 | 产物 | 验证 | 失败处理 |
|---|---|---|---|---|
| 1.1 | 选场景(回数字 1) | — | — | — |
| 1.2 | 第二问:补 yapi(URL 或 projectId) | — | — | yapi 完全没给 → 退化到场景 2 |
| 1.3 | 第三问:是否 auto | — | — | — |
| Step 0 | 自检 MCP/Git/skills | — | git status 干净 | 不干净 → 提示用户 commit,可 --dirty-ok 跳 |
| Step 2 | 拉 DSL 顶层推 module/pagePath/imgDir | — | DSL 顶层可读 | MCP 失败 → 停 |
| Step 3 | 展示执行计划等用户确认(auto 跳) | — | — | — |
| Stage A | master-go-to-code 拉资源 + 精修 dom-tree.json | `.claude/results/<m>/stage-a-report.json` + `<outDir>/dom-tree.json` | validate-dom-tree.mjs 退出码 0 | schema 错 → 停 |
| Gate A→C | stage-gate 检查 stage-a-report + dom-tree 存在 | — | verdict=pass | 缺产物 → 停 |
| Stage B | yapi-to-code 拉接口推 TS 写文件 | `<cacheDir>/<m>/{define,api}.ts` + `.claude/results/<m>/yapi-report.json` | validate-define 退出码 0 | warn 不阻断,fail 停 |
| Gate A&B→C | stage-gate 同时检查 A 和 B | — | 两份 verdict 都 ≥ warn | 缺任一 → 停 |
| Stage C | frontend-page-design 组装 Vue(mode=new) | `<viewsDir>/<m>/Index.vue` + 子组件 + 路由 3 处 + 菜单 +1 + `.claude/results/<m>/stage-c-report.json` | vue-tsc 0 error(auto 不阻断) | 文件冲突仍三选 |
| Gate C→A.recall | stage-gate 检查 stage-c-report + Index.vue 存在 | — | verdict=pass/warn | 缺 → 停 |
| Stage A.recall | compare-tokens.mjs 跑 DSL diff | `.claude/results/<m>/token-diff-report.json` | 7 类 token 对比 | 关键漏写 auto 尝试修,修不了写 issues |
| Gate A.recall→D | stage-gate 检查 token-diff-report | — | verdict ≥ warn | 缺 → 停 |
| Stage D | MCP 浏览器 smoke(playwright-skill v8 + MCP browser_*) | `.claude/results/<m>/stage-d-report.json` + `.claude/skills/playwright-skill/runtime/screenshots/<m>-smoke-*.png` | Claude 汇报通过 | 失败警告不打断(铁律 4) |
| 总汇报 | report-generator.mjs 出清单 + git 建议 | 控制台报告 | — | 不自动 commit |

**Auto 模式**:跳过 1.3 之后所有"等用户确认"检查点,Gate 自动跑,Stage D 失败不阻断,自动给汇总报告。

---

## 场景 2 · 完整新模块(无接口)

**触发**:用户贴 mastergo URL,**没**贴 yapi

| Step | 干啥 | 产物 | 验证 | 失败处理 |
|---|---|---|---|---|
| 1.1 | 选场景(回数字 2) | — | — | — |
| 1.2 | 数据策略:A 全 mock / D 静态写死 | — | — | auto 默认 A |
| 1.3 | 是否 auto | — | — | — |
| Step 0 | 自检 | — | — | 同场景 1 |
| Step 2 | 推 module/pagePath/imgDir | — | — | 同场景 1 |
| Step 3 | 展示计划 | — | — | — |
| Stage A | 同场景 1 | 同 | 同 | 同 |
| Gate A→C | stage-gate 检查(仅 A,跳 B) | — | — | — |
| ~~Stage B~~ | **跳过** | — | — | — |
| Stage C | frontend-page-design(mode=new + dataStrategy=A/D) | Vue 模块 + mock.ts(策略 A) 或 静态数据(策略 D) | — | — |
| Gate C→A.recall | 同场景 1 | — | — | — |
| Stage A.recall | 同场景 1 | — | — | — |
| Gate A.recall→D | 同场景 1 | — | — | — |
| Stage D | 同场景 1 | — | — | — |
| 总汇报 | 加 mock 开关说明 / 接口待对接清单 | — | — | — |

**Auto 模式**:数据策略默认 A,其它同场景 1。

---

## 场景 3 · 增量(现有模块加东西)

**触发**:用户贴 mastergo URL + "xxx 模块 增量"(必须显式说)

| Step | 干啥 | 产物 | 验证 | 失败处理 |
|---|---|---|---|---|
| 1.1 | 选场景(回数字 3) | — | — | — |
| 1.2 | 第二问:现有模块名 + 可选 yapi | — | — | 模块名没给 → 必问 |
| 1.3 | 是否 auto | — | — | — |
| Step 0 | 自检 | — | — | — |
| **Step 1.5** | **e2e 定位**:grep menu + grep router 反查现有 Vue + MCP `browser_navigate`/`browser_take_screenshot` 进页面截图 | currentViewDir / currentIndexVue / currentScreenshot | 菜单可点 + 页面可进 | **定位失败立即停**:"菜单/路由/页面三者任一找不到" |
| Stage A | 同场景 1(拉新设计稿) | dom-tree.json | — | — |
| Gate A→C | 同 | — | — | — |
| Stage B | **可选**:用户给新 yapi 才跑 | yapi-report.json | — | 没给跳过 |
| Stage C | frontend-page-design(mode=**incremental**) | 加新子组件 + 改现有 Index.vue 加 import(**不动路由菜单**) | vue-tsc | 同 |
| Gate C→A.recall | 同 | — | — | — |
| Stage A.recall | DSL diff 现有 Vue + 新子组件 | token-diff-report.json | — | — |
| Gate A.recall→D | 同 | — | — | — |
| Stage D | smoke 验证现有页面仍正常 + 新功能可见 | stage-d-report.json | — | — |
| 总汇报 | "在 xxx 模块加了 N 个文件,改了 N 处" | — | — | — |

**Auto 模式**:跳确认,e2e 定位失败必停。

---

## 场景 4 · 迭代(现有模块改一部分)

**触发**:用户贴 mastergo URL + "xxx 模块 迭代"

| Step | 干啥 | 产物 | 验证 | 失败处理 |
|---|---|---|---|---|
| 1.1 | 选场景 4 | — | — | — |
| 1.2 | 现有模块名 + 可选 yapi | — | — | 模块名必给 |
| 1.3 | auto? | — | — | — |
| Step 0 | 自检 | — | — | — |
| **Step 1.5** | **e2e 定位** | 同场景 3 | 同 | 同 |
| Stage A | 拉新设计稿 | dom-tree.json | — | — |
| Gate A→C | 同 | — | — | — |
| Stage B | **yapi 复用现有 api.ts**(读现有 define.ts) | 复用判定:接通/字段缺/全错 | — | 字段对不上 → 用默认数据 + 警告 |
| Gate A&B→C | 同 | — | — | — |
| Stage C | frontend-page-design(mode=**iterate**) | **精准 Edit 现有 Vue 局部**(不全替换) | vue-tsc | 同 |
| Gate C→A.recall | 同 | — | — | — |
| Stage A.recall | DSL diff | token-diff-report.json | — | — |
| Gate A.recall→D | 同 | — | — | — |
| Stage D | smoke + 视觉对比(currentScreenshot vs 新截图) | stage-d-report.json | — | — |
| 总汇报 | "改了 N 处 / yapi 复用 vs 默认数据" | — | — | — |

**Auto 模式**:同场景 3。

---

## 场景 5 · 重构(整个重写现有模块)

**触发**:用户贴 mastergo URL + "xxx 模块 重构" + **必传 yapi**

| Step | 干啥 | 产物 | 验证 | 失败处理 |
|---|---|---|---|---|
| 1.1 | 选场景 5 | — | — | — |
| 1.2 | 现有模块名 + **必传** yapi | — | — | yapi 没给 → 必问 |
| 1.3 | auto? | — | — | — |
| Step 0 | 自检 | — | — | — |
| **Step 1.5** | **e2e 定位** | 同 | 同 | 同 |
| Stage A | 拉新设计稿 | dom-tree.json | — | — |
| Gate A→C | 同 | — | — | — |
| Stage B | yapi-to-code 新生成(覆盖现有 api.ts) | 新 define.ts/api.ts + 旧文件 .bak 备份 | validate-define | 同 |
| Gate A&B→C | 同 | — | — | — |
| Stage C | frontend-page-design(mode=**refactor**) | **替换 Index.vue 内容**,保留文件路径 / 保留路由 / 保留菜单 | vue-tsc | 同 |
| Gate C→A.recall | 同 | — | — | — |
| Stage A.recall | DSL diff | token-diff-report.json | — | — |
| Gate A.recall→D | 同 | — | — | — |
| Stage D | smoke + 对比 currentScreenshot 看是否符合预期重写 | stage-d-report.json | — | — |
| 总汇报 | "重写了 xxx 模块,保留路由/菜单,接口换成新的" | — | — | — |

**Auto 模式**:同场景 3。

---

## 场景 6 · 云效 Bug 修复

**触发**:用户贴云效链接(2 种 URL 形态) / 自然语言"修 bug" / 多 bug 一起改

### 6a · URL 形态识别

| URL 形态 | 含义 | 处理 |
|---|---|---|
| 有 `openWorkitemIdentifier=xxx` | 单 bug | xxx 当 workItemId,进 Step 2 |
| 只有 `viewIdentifier=yyy` | 多 bug 视图 | search_workitems 兜底拉列表 |
| ≥ 2 个含 `openWorkitemIdentifier` 的 URL | 多 bug | 组成 bugIds[] 走多 bug 流程 |
| 模糊描述("我的 bug"/"待确认的") | 模糊搜索 | search_workitems 按参数搜 |

### 6b · 单 bug 流程(10 步)

| Step | 干啥 | 产物 | 验证 | 失败处理 |
|---|---|---|---|---|
| 0 | 自检 MCP + playwright-skill 是否存在 | — | MCP 可调 | MCP 失败 → 停;playwright 缺 → 隐藏 A/C 选项 |
| 1 | 定位 Bug(URL 解析 或 search_workitems) | bug 列表 / 单 bug 信息 | — | — |
| 2 | 展示 bug 详情等用户确认("开始修复") | — | — | auto 跳过 |
| 3 | 抓上下文 4 子动作:详情/评论/附件/curl 下载截图 | /tmp/bug-<id>-*.png | 4 子动作全做(铁律 3/4) | 子动作任一失败立即停 |
| 4 | 代码定位:grep 关键词/模块速查/git log | 文件路径 + 行号 | — | 都失败 → 问用户给线索 |
| 5 | 出修复方案让用户过目 → 改代码(Edit) | git diff 非空 | code-changed.json verdict=pass | diff 为空 → 报"没改成"停;auto 跳确认 |
| 6 | 弹 A/B/C/D 让用户选 | — | — | auto 强制选 C |
| 7 | 选 A/C 用 MCP 浏览器验证(按 playwright-skill SKILL.md §3) | `.claude/skills/playwright-skill/runtime/screenshots/<bug-id>-verify*.png` + Claude 汇报通过/失败 | 汇报结果 | verdict=fail → auto 停下问用户 |
| 8 | 选 B/C + verdict=pass → 回写云效:① update_work_item ② create_work_item_comment ③ create_workitem_attachment(传截图) | 云效状态变 + 评论 + 附件 | MCP 返回 200 | update 失败重试 1 次,附件失败记 warning |
| 9 | 结束 + 落 `.claude/results/bug-fix-<id>.json` 报告 | bug-fix 报告 | — | — |
| 10 | 简短汇报"<BUG-ID> 已修复/验证通过/云效已更新" | 控制台 | — | — |

### 6c · 多 bug Auto 批处理(4 Phase)

| Phase | 干啥 | 产物 |
|---|---|---|
| Phase 1 | 批量改代码:N 个 bug 各走 Step 1-6(只改不验证不回写) | 每个 bug 各产 code-changed.json |
| Phase 2 | 批量验证:每个 bug 用 MCP `browser_*` 工具按 playwright-skill SKILL.md §3 操作并截图 | 各 bug 在 `.claude/skills/playwright-skill/runtime/screenshots/<bug-id>-verify-*.png` 下产截图 |
| Phase 3 | 验证 pass 的统一回写云效(并行调 MCP):状态+评论+截图附件 | 各 yunxiao-updated.json |
| Phase 4 | 验证 fail 的停下问用户:"BUG-X 验证未通过(原因),回写吗?" | 用户决定 |

**最终汇总**:`✅ 4/5 通过自动回写 / ⚠️ 1/5 待用户决定`

### 6d · 安全网(4 道)

| 安全网 | 触发 | 行为 |
|---|---|---|
| 验证 fail | Claude MCP 操作汇报失败 | **停下问用户**,不默认回写,代码保留不动 |
| 云效 update 失败 | MCP 错 | 重试 1 次,仍失败报告,代码不动 |
| 截图附件上传失败 | MCP 错 | 记 warning,不影响主流程 |
| 任何环节抛异常 | crash | bug-fix-report.json verdict=fail + stack trace |

---

## 场景 7 · 全模块 E2E 回归测试

**触发**:用户要求"跑一遍测试" / "全量回归" / "E2E" / "帮我测一下 xxx 模块"

| Step | 干啥 | 产物 | 验证 | 失败处理 |
|---|---|---|---|---|
| 0 | 自检:playwright-skill 配置 + auto-ui-explorer 配置 | — | 配置文件存在 | 缺失 → 停,提示用户配置 |
| 0.7 | diff-baseline.mjs:对比上次 baseline,确定增量范围 | 增量页面列表 | — | baseline 不存在 → 全量扫描 |
| 1 | analyze-module.mjs:全目录递归扫描,生成 UI 词典 | ui-dictionary.json | validate-dictionary.mjs | 校验 fail → 停 |
| 2 | 手工精修:AI 逐个页面确认交互元素(去噪音、补遗漏) | 精修后的词典 | — | — |
| 2.6 | validate-flow-plan.mjs:校验 SP 引用 / 覆盖率 / 空值 | flow-plan | 校验 pass | fail → 停,报告缺失引用 |
| 3 | MCP 浏览器执行:逐页面/逐流程用 playwright-skill 操作 | 截图 + 执行结果 | 截图可见 + 无报错 | 单页失败 → warn,继续下一页 |
| 4 | 更新 baseline.json + experience.json | baseline + experience | — | — |
| 5 | 汇报:通过/失败/跳过 的页面数 + 截图汇总 | 控制台 | — | — |

**Auto 模式**:跳 Step 2 确认、Step 4 自动更新 baseline、diff-baseline 自动跑。

---

## 5 个铁律(跨场景共用)

| # | 铁律 | 适用 |
|---|---|---|
| 1 | Stage A→B→C 任一失败立即停 | 场景 1-5 |
| 2 | Stage D 失败警告不打断 | 场景 1-5 |
| 3 | 缺关键字段必问(yapi/模块名) | 场景 1/3/4/5 |
| 4 | Stage A.recall(token diff)必跑 + 产 token-diff-report.json | 场景 1-5 |
| 5 | 完成不自动 commit/push,只给建议 | 全场景 |

---

## 配套阅读

- 各 skill 内部细节 → 各 `<skill>/SKILL.md`
- 文件英文名 → [GLOSSARY.md](./GLOSSARY.md)
- 版本矩阵 + 工具脚本清单 → [STATUS.md](./STATUS.md)
- 整体设计反思 → [DESIGN-DECISIONS.md](./DESIGN-DECISIONS.md)
