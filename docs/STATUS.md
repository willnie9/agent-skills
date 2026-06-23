# Skill 体系状态总览

> 一页快速了解 7 个 skill 的版本/依赖/触发方式/最近变更。详细文档见各自 `SKILL.md`。

**最后更新**:2026-06-03(v1.1.0 真 hook 落盘 + 区分硬/软约束)
**当前活跃流水线**:module-flow → A → B → C → A.recall(DSL diff) → D,每个 Stage 切换有 stage-gate.mjs 把关
**支持 5 个场景**:1 完整新模块(含接口) / 2 完整新模块(无接口) / 3 增量 / 4 迭代 / 5 重构 (3/4/5 跑 e2e 定位现有模块)

---

## Auto Mode 支持矩阵

所有 skill 统一支持 auto 关键词(`auto / yolo / 全跑 / 一气呵成 / 别问 / 自动`):

| Skill | auto 行为 | 必停点 |
|---|---|---|
| `module-flow` | 跳所有 Step 2-4 确认,3 个 stage-gate 自动跑;场景 3/4/5 跑 Step 1.5 e2e 定位 | MCP / Git / YApi 完全没给(场景 1) / 精修错 / e2e 定位失败(场景 3/4/5) |
| `master-go-to-code` | 跳"等用户继续"检查点,compare-tokens fail 不阻断 | validate-dom-tree fail |
| `yapi-to-code` | 跳类型映射预览,validate-define warn 不阻断 | 文件冲突仍三选 |
| `frontend-page-design` | 跳文件清单预览,vue-tsc/scan-perm 不阻断 | 文件冲突仍三选 |
| `playwright-skill` | MCP 浏览器操作,无 spec 无 runner | 配置文件缺失 / dev server 未起 |
| `auto-ui-explorer` | 跳"确认扫描范围",diff-baseline 自动跑,baseline 自动更新 | baseline 校验 fail / validate-dictionary fail |
| `yunxiao-bug-fix` | 跳 Step 2/5/6,自动选 C(验证+回写) | 验证 fail → 不回写 |

---

## 统一 Stage Report 格式

所有 skill 跑完落盘 stage-report.json,符合 `_shared/schemas/stage-report.schema.json`:

```json
{
  "stage": "A.recall",
  "skill": "master-go-to-code",
  "module": "<myModule>",
  "timestamp": "2026-05-15T...",
  "verdict": "pass" | "warn" | "fail",
  "summary": { /* skill 特定 */ },
  "issues": [ /* 待人工 */ ],
  "artifacts": { "new": [...], "modified": [...] }
}
```

**所有报告统一落盘到 `.claude/results/<module>/<stage>.json`**(不污染源码目录)。module-flow 的 stage-gate 通过 verdict 决定继续/阻断。

| Stage | 报告位置 | 产 by |
|---|---|---|
| A | `.claude/results/<module>/stage-a-report.json` | master-go-to-code fetch-and-parse.mjs |
| B | `.claude/results/<module>/yapi-report.json` | yapi-to-code validate-define.mjs |
| C | `.claude/results/<module>/stage-c-report.json` | frontend-page-design stage-c-finalize.mjs |
| A.recall | `.claude/results/<module>/token-diff-report.json` | master-go-to-code compare-tokens.mjs |
| D | `.claude/results/<module>/stage-d-report.json`(同时落 `.claude/skills/playwright-skill/runtime/screenshots/<module>-smoke-*.png`) | Claude MCP 操作 + 手动落盘报告 |
| bug-fix | `.claude/results/bug-fix-<id>.json` | yunxiao-bug-fix Step 9 |

---

## 版本矩阵

| Skill | 版本 | 角色 | references | schemas | scripts |
|-------|------|------|--|---|---|
| [module-flow](./module-flow/SKILL.md) | v2.2.0 | 总调度·编排器 | 6 | 1 | 2 ✅ |
| [master-go-to-code](./master-go-to-code/SKILL.md) | v2.3.0 | 视觉还原引擎 | 5 | 2 | 7 ✅ + Python 1 |
| [yapi-to-code](./yapi-to-code/SKILL.md) | v2.2.0 | 接口生成引擎 | 6 | — | 1 ✅ |
| [frontend-page-design](./frontend-page-design/SKILL.md) | v2.2.0 | 页面组装引擎 | 7 | — | 2 ✅ |
| [auto-ui-explorer](./auto-ui-explorer/SKILL.md) | v7.1.0 | E2E 测试编排引擎 | 5 | 3 | 4 ✅ |
| [playwright-skill](./playwright-skill/SKILL.md) | v8.0.0 | MCP 浏览器适配层 | — | 1 (config-schema) | 仅 config + SKILL.md |
| [yunxiao-bug-fix](./yunxiao-bug-fix/SKILL.md) | v3.2.0 | 云效 Bug SOP | — | — | config/yunxiao-comment.md |
| **_shared** | — | 跨 skill 共享层 | — | 3 | 5 ✅ |
| **顶层** | — | 项目配置 + 总流程 | — | 1 (project-config) | — |

## 工具脚本

### 主流程脚本(17 个,默认集成)

| 脚本 | 用途 | 调用时机 |
|------|------|---------|
| `_shared/lib/parse-urls.mjs` | 解析 mastergo / yapi / 云效 URL | module-flow Step 1 输入解析 |
| `_shared/lib/preflight.mjs` | 通用环境自检(MCP / 文件 / env) | 所有 skill Step 0 自检 |
| `_shared/lib/stage-validator.mjs` | 通用 JSON Schema 校验器 | Step 0 校验上游产物 |
| `_shared/lib/stage-gate.mjs` ⭐新 | 通用 stage gate(读 report,按 verdict 决定继续/阻断) | module-flow 3 个 Stage 切换点 |
| `_shared/lib/report-generator.mjs` | 产物清单 + git 建议生成 | module-flow Step 5 |
| `master-go-to-code/scripts/fetch-and-parse.mjs` | 从 MasterGo 拉 DSL + 下载图片 + SVG→PNG | Stage A Step 1 |
| `master-go-to-code/scripts/render.mjs` | dom-tree.json → preview.html(可选调试) | 故障诊断 |
| `master-go-to-code/scripts/validate-dom-tree.mjs` | 校验 dom-tree.json + svg-paths.json | Stage A Step 2(铁律 4) |
| `master-go-to-code/scripts/extract-image-names.mjs` | 提取图片清单 + 校验 @/assets | Stage A Step 4 委托前 |
| `master-go-to-code/scripts/compare-tokens.mjs` | DSL ↔ SCSS 语义级 token 对比,产 token-diff-report.json | Stage A.recall(铁律 5) |
| `master-go-to-code/scripts/refine-dom-tree.py` | 备用机械提取(AI 精修失败回退) | 故障兜底 |
| `master-go-to-code/scripts/seed-test-data.mjs` | 接口批量造数据(独立工具) | 联调辅助 |
| `yapi-to-code/scripts/validate-define.mjs` | 校验 define.ts + 产 yapi-report.json | Stage B Step 4 |
| `frontend-page-design/scripts/scan-perm-todos.mjs` | 扫描 TODO(perm) 占位 | 后端分配权限后批量替换前 |
| `frontend-page-design/scripts/stage-c-finalize.mjs` ⭐新 | Stage C 收尾,跑 vue-tsc + 扫 TODO,产 stage-c-report.json | Stage C Step 9 |
| `module-flow/scripts/check-resume-state.mjs` | 检测产物决定恢复点 | "继续 <module>" |

### 备选脚本(默认不集成)

| 脚本 | 用途 | 为什么备选 |
|------|------|---------|
| `master-go-to-code/scripts/compare-pixel.mjs` | 像素级对比 baseline.png vs actual.png | 当前识图能力只能到 ~50% 还原度,信号噪声大,实际场景走 compare-tokens.mjs 语义级 DSL diff 就够。要用时手动装 `pixelmatch pngjs`(已声明为 optionalDependencies) |

---

## 依赖关系图

```
                       module-flow (v2.2.0)
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
master-go-to-code      yapi-to-code      frontend-page-design
   (v2.3.0)             (v2.2.0)            (v2.2.0)
        │                   │                   │
        │  通过 JSON Schema  │                   │
        │  硬契约校验产物    │                   │
        └───┬───────────────┘                   │
            ▼                                   │
   _shared/schemas/                             │
   _shared/lib/stage-validator.mjs              │
            │                                   │
            └───────────────────────────────────┘
                            │
                            ▼
                  playwright-skill (v8.0.0)
                  (Stage D MCP 浏览器验证)

auto-ui-explorer (v7.1.0)
   E2E 测试编排，依赖 playwright-skill
   Step 0 用 diff-baseline.mjs 做增量判断

yunxiao-bug-fix (v3.2.0) ───┐
   独立业务线                 │
   Step 7 可委托 playwright-skill(MCP 浏览器操作)─┘
```

---

## 目录结构

```
.claude/skills/
├── README.md
├── STATUS.md                            ← 本文件
├── WORKFLOW.md                          ← 7 场景全流程详尽指南
├── project.config.json                  ← 项目级共享配置(各 skill 读)
├── schemas/
│   └── project-config.schema.json
│
├── _shared/                             ← 跨 skill 共享层
│   ├── schemas/
│   │   ├── stage-report.schema.json
│   │   ├── common-response.schema.json
│   │   └── module-code.schema.json
│   └── lib/
│       ├── parse-urls.mjs
│       ├── preflight.mjs
│       ├── stage-validator.mjs
│       ├── stage-gate.mjs
│       └── report-generator.mjs
│
├── module-flow/
│   ├── SKILL.md
│   ├── references/(6 个)
│   ├── schemas/task-input.schema.json
│   └── scripts/
│       └── check-resume-state.mjs
│
├── master-go-to-code/
│   ├── SKILL.md
│   ├── package.json + node_modules/     ← skill 自带 sharp/pixelmatch/pngjs
│   ├── references/(5 个)
│   ├── schemas/(2 个)
│   └── scripts/(7 个 mjs + 1 py)
│
├── yapi-to-code/
│   ├── SKILL.md
│   ├── references/(6 个)
│   └── scripts/validate-define.mjs
│
├── frontend-page-design/
│   ├── SKILL.md
│   ├── references/(7 个)
│   └── scripts/scan-perm-todos.mjs
│
├── playwright-skill/
│   ├── SKILL.md
│   ├── config/(MCP 配置 + 凭证 + schema)
│   └── runtime/screenshots/(MCP 截图,gitignore)
│
└── yunxiao-bug-fix/
    ├── SKILL.md
    └── config/yunxiao-comment.md        ← 评论模板可自定义
```

---

## 触发关键词速查

| Skill | 自动触发关键词 | 手动调用 |
|-------|--------------|---------|
| module-flow | `---PROJECT-TASK---` / "全流程自动化" / "一条龙生成新模块" / 同时给 mastergo + yapi URL / 含 "xxx 增量/迭代/重构" + mastergo URL | `/module-flow` |
| master-go-to-code | `mastergo.com/file/...` / "设计稿" / "MasterGo" / "还原 UI" | `/master-go-to-code` |
| yapi-to-code | YApi 链接 / "接口对接" / "生成 API 代码" / "YApi" | `/yapi-to-code` |
| frontend-page-design | "新增模块" / "组装页面" / "页面整合" | `/frontend-page-design` |
| playwright-skill | "看看 xxx 页面" / "打开 xxx 看看" / "截个图" / "验证 UI" | `/playwright-skill` |
| auto-ui-explorer | "跑一遍测试" / "全量回归" / "E2E" / "帮我测一下 xxx 模块" | `/auto-ui-explorer` |
| yunxiao-bug-fix | 云效链接 / "修 bug" / "处理 <BUG-ID>" | `/yunxiao-bug-fix` |

---

## 关键改进

### v2.3.0(2026-05-21)playwright-skill MCP-first 瘦身

1. **playwright-skill 升 v8.0.0**:砍掉 `flows/` `playwright.config.ts` `package.json` `node_modules` `run.cjs` `lib/auth-*` `lib/nav` `lib/helpers` 等 test runner 框架
2. **不再写 spec 文件**:浏览器操作一律走 MCP `browser_*` 工具,Claude 边看 snapshot 边操作
3. **上游契约改为「MCP 操作 + 口头汇报」**:`yunxiao-bug-fix` Step 7 / `module-flow` Stage D 不再跑 `npx playwright test --grep=...`,改为读 config + MCP 操作 + 截图汇报
4. **删 `module-flow/scripts/generate-smoke-flow.mjs`**:smoke 不再靠生成 spec
5. **配置 schema 同步精简**:去掉 `maxAgeHours` `envUsername/Password` `interactivePrompt` `devServerCheckPorts`(MCP 不需要)
6. **截图统一落 `runtime/screenshots/`**:不再用 `runtime/test-results/<spec>/`

### v2.2.0(2026-05-15)全 auto 化 + 统一 stage-report

1. **7 个 skill 统一支持 auto 关键词**(yolo / 全跑 / 一气呵成 / 别问):全部 frontmatter 升 2.2.0 / 3.2.0 / 6.0.0
2. **统一 stage-report.schema.json**:所有 skill 产报告统一 verdict (`pass/warn/fail`) 格式
3. **报告路径统一到 `.claude/results/<module>/`**:不再污染源码目录(`src/cache/...` / `src/views/...`)
4. **抽 `_shared/lib/stage-gate.mjs`**:通用 gate 检查器,module-flow 在 Stage 切换点用它把关
5. **新增 `frontend-page-design/scripts/stage-c-finalize.mjs`**:Stage C 收尾,统一产 stage-c-report.json
6. **`fetch-and-parse.mjs` 末尾产 stage-a-report.json**:Stage A 完成有正式产物锚点
7. **`playwright runner` 末尾产 stage-d-report.json**:Stage D 完成有正式产物锚点
8. **关键防漏**:Stage A.recall (compare-tokens) 升级到产物锚点,机制层面无法跳过
9. **yunxiao-bug-fix auto 化**:
   - URL 形态识别(单 bug vs 多 bug vs 视图)
   - 批量改 bug 链路:Phase 1 全改 → Phase 2 批量验证 → Phase 3 统一回写云效
   - 验证失败 → 停下问用户确认,不默认回写
   - 回写时上传 playwright 截图作为云效附件
10. **Gate 同时检查 A 和 B**:Stage B 漏跑不会被忽略

### v2.1.0(2026-05-15)项目隔离 / 配置化

1. **skill 自包含**:`fetch-and-parse.mjs` / `render.mjs` / `seed-test-data.mjs` 从项目 `scripts/mastergo/` 搬到 `.claude/skills/master-go-to-code/scripts/`
2. **npm 依赖自带**:`sharp` / `pixelmatch` / `pngjs` 放 skill 自己的 `node_modules/`,首次 `cd .claude/skills/master-go-to-code && npm install`
3. **项目结构配置化**:新增 `.claude/skills/project.config.json` + JSON Schema,各 SKILL.md 不再写死 `src/cache/` `src/views/` `useMenu.ts` 等
4. **评论模板搬入 skill**:yunxiao-bug-fix 评论模板从 `.agents/config/` 搬到 `.claude/skills/yunxiao-bug-fix/config/`
5. **去 .agents 依赖**:yunxiao-bug-fix 4 处 `.agents/skills/playwright-skill/` 改 `.claude/skills/playwright-skill/`
6. **产物路径环境变量**:`MASTERGO_OUT_DIR` 可覆盖默认 `.claude/skills/master-go-to-code/output`(skill 内部产物目录,跨项目复用 skill 时不污染项目根)

### v2.0.0(2026-05-13)大厂风格重构

1. **大厂风格压缩**:平均 SKILL.md 行数 ↓ 70%,可读性大幅提升
2. **硬契约校验**:5 个 JSON Schema + validate 脚本,中间产物机器可校验
3. **_shared 共享层**:CommonResponse 等通用 schema 一处定义,所有 skill 引用
4. **上下游契约段**:每个 skill 末尾明示输入/输出 schema
5. **Common Pitfalls**:每个 skill 单独的踩坑速查,从实战中迭代

---

## 历史决策日志

- **2026-05-13 初版**:6 个 skill 协同,引入 module-flow 总调度
- **2026-05-13 优化 P0-P2**:12 项优化(响应壳/imgDir/MODULE_CODE/CHANGELOG/STATUS 等)
- **2026-05-13 v2.0.0 大厂风格重构**:压缩主 SKILL.md 70%,硬 schema 化,_shared 共享层
- **2026-05-13 B 阶段工程化**:补 11 个工具脚本,边界重复消除,流水线全程可机器校验
- **2026-05-13 模式启动**:全局 settings 加 `bypassPermissions`,免反复确认
- **2026-05-15 v2.2.0 全 auto 化**:6 个 skill 统一支持 auto 关键词,统一 stage-report 格式,抽 stage-gate.mjs 通用检查器
- **2026-05-15 v2.1.0 项目隔离**:skill 完全自包含,不依赖项目脚本,项目结构改读 project.config.json
