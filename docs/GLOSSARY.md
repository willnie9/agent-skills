# GLOSSARY · 目录与文件中英文含义对照

> 给所有 skill / 脚本 / references / schemas 标英文名 + 中文含义,让任何开发者都能秒懂结构。

## 顶层

| 英文名 | 中文含义 | 作用 |
|---|---|---|
| `.claude/skills/` | Claude 技能目录 | 所有 skill 的根目录,Claude 启动时自动加载 |
| `README.md` | 体系说明 | 给开发者看的「这套 skill 是什么、怎么用」 |
| `STATUS.md` | 状态总览 | 版本矩阵 / 工具脚本清单 / 改进历史 |
| `WORKFLOW.md` | 流程指南 | 6 个场景的详尽步骤(用 jdz 项目作演示) |
| `GLOSSARY.md` | 术语表(本文件) | 中英文含义对照 |
| `RETROSPECTIVE.md` | 复盘/心得 | 整个 skill 体系演进的得失 + 踩坑 |
| `project.config.json` | 项目级共享配置 | 各 skill 读这份了解项目结构(viewsDir/cacheDir/HTTP 客户端等) |
| `schemas/project-config.schema.json` | 项目配置 schema | 约束 project.config.json 的字段格式 |

## skill 名(6 个)

| 英文名 | 拆解 | 中文含义 | 触发关键词 |
|---|---|---|---|
| `module-flow` | module(模块) + flow(流程) | **模块全流程编排器** | PROJECT-TASK / "全流程自动化" / mastergo+yapi |
| `master-go-to-code` | MasterGo(设计稿工具) → code | **MasterGo 设计稿转代码** | mastergo URL / "设计稿" / "还原 UI" |
| `yapi-to-code` | YApi(接口管理工具) → code | **YApi 接口转代码** | YApi URL / "接口对接" |
| `frontend-page-design` | frontend + page + design | **前端页面组装器** | "新增模块" / "组装页面" |
| `playwright-skill` | Playwright(MCP 浏览器适配层) | **MCP 浏览器操作配置中心** | "看看 xxx 页面" / "打开 xxx 截个图" |
| `yunxiao-bug-fix` | 云效 + bug fix | **云效 Bug 修复 SOP** | 云效链接 / "修 bug" |

## _shared/ — 跨 skill 共享层

### lib/ (4 个工具脚本)

| 英文文件名 | 拆解 | 中文含义 |
|---|---|---|
| `parse-urls.mjs` | parse + URLs | 解析 URL(mastergo / yapi / 云效) |
| `preflight.mjs` | preflight(起飞前检查) | 通用环境自检(MCP/文件/env) |
| `stage-validator.mjs` | stage(阶段) + validator | 通用 JSON Schema 校验器 |
| `stage-gate.mjs` | stage + gate(门禁) | 通用 Stage 切换门禁(读 report 看 verdict) |
| `report-generator.mjs` | report + generator | 产物清单 + git 建议生成 |

### schemas/ (3 个 JSON Schema)

| 英文文件名 | 中文含义 |
|---|---|
| `common-response.schema.json` | 通用响应壳 schema(项目 API 返回结构约束) |
| `module-code.schema.json` | 模块权限编码 schema |
| `stage-report.schema.json` | Stage 报告统一格式 schema(verdict / summary / issues) |

## module-flow/

| 英文名 | 中文含义 |
|---|---|
| `SKILL.md` | 总调度入口(5 个场景决策树 + auto 模式) |
| `references/task-template.md` | 任务指令格式(PROJECT-TASK 块) |
| `references/stage-contracts.md` | 各 Stage 输入/输出契约 |
| `references/data-strategy-options.md` | 数据策略 4 选项(A 全 mock / D 静态等) |
| `references/error-recovery.md` | 错误恢复策略 |
| `references/cancel-and-resume.md` | 取消与恢复机制 |
| `references/common-pitfalls.md` | 踩坑清单 |
| `schemas/task-input.schema.json` | PROJECT-TASK 任务指令 schema |
| `scripts/check-resume-state.mjs` | 检测产物决定恢复点(continue 模式用) |

## master-go-to-code/

| 英文名 | 中文含义 |
|---|---|
| `SKILL.md` | 视觉还原流水线(2 个 Step + 委托) |
| `package.json` + `node_modules/` | skill 自带依赖(sharp/pixelmatch/pngjs) |
| `references/dom-tree-spec.md` | dom-tree.v1.json 输出格式规范 |
| `references/dsl-css-mapping.md` | DSL 属性 → CSS 翻译表 |
| `references/imgdir-mapping.md` | imgDir 路径推断规则 |
| `references/svg-to-png.md` | SVG → PNG 转换能力说明 |
| `references/common-pitfalls.md` | 踩坑清单 |
| `schemas/dom-tree-v1.schema.json` | dom-tree.json 结构约束 |
| `schemas/svg-paths.schema.json` | svg-paths.json 结构约束 |
| `scripts/fetch-and-parse.mjs` | 从 MasterGo 拉 DSL + 下载图片 + SVG→PNG |
| `scripts/render.mjs` | 渲染 preview.html(故障诊断工具) |
| `scripts/validate-dom-tree.mjs` | 校验 dom-tree.json 结构 |
| `scripts/extract-image-names.mjs` | 提取图片清单 + 校验 @/assets 规范 |
| `scripts/compare-tokens.mjs` | DSL ↔ SCSS 语义级 token diff |
| `scripts/compare-pixel.mjs` | 像素级对比(可选,默认不集成) |
| `scripts/refine-dom-tree.py` | 备用机械提取(AI 精修失败回退) |
| `scripts/seed-test-data.mjs` | 接口批量造测试数据(独立工具) |

## yapi-to-code/

| 英文名 | 中文含义 |
|---|---|
| `SKILL.md` | 接口生成流水线(被 module-flow Stage B 调用) |
| `references/api-templates.md` | define.ts / api.ts 文件模板 |
| `references/common-pitfalls.md` | 踩坑清单 |
| `scripts/validate-define.mjs` | 校验 define.ts(无 any / 用 interface / camelCase) |

## frontend-page-design/

| 英文名 | 中文含义 |
|---|---|
| `SKILL.md` | 模块组装器(5 种 mode:new/incremental/iterate/refactor + 子组件) |
| `references/code-style.md` | 项目代码风格规范(template/script/style) |
| `references/page-templates.md` | 页面模板代码(筛选区/表格区) |
| `references/component-catalog.md` | 公共组件清单 + 全局 class |
| `references/routing-patterns.md` | 路由多处同步注册模板 |
| `references/module-code-policy.md` | 权限码占位规则 |
| `references/issues-template.md` | 争议点报告模板 |
| `references/common-pitfalls.md` | 踩坑清单 |
| `scripts/scan-perm-todos.mjs` | 扫描 TODO(perm) 占位 |
| `scripts/stage-c-finalize.mjs` | Stage C 收尾(跑 vue-tsc + 扫 TODO + 产报告) |

## playwright-skill/

| 英文名 | 中文含义 |
|---|---|
| `SKILL.md` | MCP 浏览器操作 playbook(项目适配 + 登录子流程 + 上游契约) |
| `config/playwright-skill.config.json` | baseURL / 登录 selector / 路由模式(实际生效,gitignore) |
| `config/playwright-skill.config.example.json` | 上述的提交版示例 |
| `config/playwright-skill.config.schema.json` | 配置合同(JSON Schema) |
| `config/credentials.local.json` | 凭证 `{username, password}`(0600,gitignore) |
| `runtime/screenshots/` | MCP 截图落盘目录(gitignore) |

## yunxiao-bug-fix/

| 英文名 | 中文含义 |
|---|---|
| `SKILL.md` | 云效 Bug 9 步 SOP(URL 识别单/多 bug + auto 4 Phase 批处理) |
| `config/yunxiao-comment.md` | 回写云效的评论模板(用户可自定义) |

## 关键英文术语

| 术语 | 含义 |
|---|---|
| **stage** | 流水线阶段(A 设计稿 / B 接口 / C 组装 / D 验证 / A.recall 回收) |
| **stage-gate** | Stage 之间的门禁,检查上一 stage 产物是否合规 |
| **stage-report** | 每个 stage 跑完产的报告,含 verdict(pass/warn/fail) |
| **verdict** | 报告结论(pass=过 / warn=警告但继续 / fail=失败) |
| **auto mode** | 无确认全自动模式,跳过所有"等用户确认"检查点 |
| **dom-tree** | 精修后的 DSL 树(给 frontend-page-design 用) |
| **token diff** | DSL ↔ SCSS 语义级对比(颜色/字号/圆角/字体/间距等 token) |
| **smoke** | 烟雾测试(简单 flow 验证页面能打开 + 关键元素可见) |
| **flow** | playwright 测试流程文件(`.flow.ts`) |
| **e2e** | end-to-end 端到端测试 |
| **PROJECT-TASK** | 任务指令格式(贴在用户消息里的结构化任务) |
| **mock** | 模拟接口数据(后端未就绪时用) |
| **schema** | JSON Schema,机器可读的数据结构约束 |
| **incremental / iterate / refactor** | 增量 / 迭代 / 重构(场景 3/4/5 对应的 mode) |
| **MCP** | Model Context Protocol(给 Claude 提供能力的协议) |
| **outDir** | mastergo 产物输出目录(默认 `.claude/skills/master-go-to-code/output`,可被环境变量 `MASTERGO_OUT_DIR` 覆盖) |
| **imgDir** | 图片资源目录(默认 `src/assets/images/<module>`) |
| **svgRef** | dom-tree 节点引用 svg-paths.json 的 key(DSL 节点 ID) |
| **DSL** | Domain Specific Language(MasterGo 设计稿数据格式) |
| **SVG path data** | SVG 路径数据(`<path d="M0 0...">` 的 d 属性) |
| **SOP** | Standard Operating Procedure(标准操作流程,云效 bug 修复用) |
| **upstream / downstream** | 上游(被调) / 下游(委托执行) |
