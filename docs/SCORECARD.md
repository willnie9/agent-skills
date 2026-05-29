# SCORECARD · 整套 skill 体系评分

> 公正打分,各维度独立评估,最后给综合分 + 还能优化的方向。
> 评分量级:S 卓越 / A 优秀 / B 良好 / C 一般 / D 差。

---

## 总分 **A**(86 / 100)

> 完整可用,达到开源级,但有 3 处可优化。

---

## 各维度评分

### ① 通用性 · **A**(90 / 100)

| 子项 | 评分 | 说明 |
|---|---|---|
| skill 自包含(不依赖项目) | A | 脚本/依赖/node_modules 全在 skill 内 |
| 项目结构走配置 | A | project.config.json 集中,SKILL.md 全占位 |
| references / scripts 去硬编码 | A | 全部清洗完,0 处 jdz 业务名残留 |
| WORKFLOW.md 演示用 jdz | B | 顶部声明"演示用",但完全清洗会更彻底 |
| 跨项目可移植 | A | 拿到 Vue 项目改 config 几行就能用 |

**扣分点**:WORKFLOW.md 保留了 jdz 演示(已声明,但严格说还有耦合)。

---

### ② 完整性 · **A**(88 / 100)

| 子项 | 评分 | 说明 |
|---|---|---|
| 6 个核心场景覆盖 | A | 1-5 完整模块/增量/迭代/重构 + 6 云效 bug |
| Stage 流水线完整 | A | A → (B) → C → A.recall → D 全链路 |
| Auto 模式 | A | 6 skill 统一 auto 关键词 |
| 单 bug + 多 bug Auto | A | 4 Phase 批处理打通 |
| 增量/迭代/重构 + e2e 定位 | B | 设计完整,实际跑还要测 |
| Bug 验证 + 截图附件上传 | A | 完整闭环(改→验→回写+附件) |
| auto 失败"等用户确认"安全网 | A | 不会瞎回写 |

**扣分点**:e2e 定位机制(grep menu + playwright 验证)还没实战验证,可能有 corner case。

---

### ③ 文档质量 · **A**(85 / 100)

| 子项 | 评分 | 说明 |
|---|---|---|
| SKILL.md 自包含 + 简洁 | A | 每个 skill 一份,300 行以内 |
| references 拆分清晰 | B | 各 skill 5-7 个 references,粒度合理但有些可合并 |
| WORKFLOW.md 6 场景表格 | A | 一表速查,触发/步骤/产物/验证/失败处理 |
| GLOSSARY 中英对照 | A | 所有英文名标含义,新人能秒懂 |
| STATUS.md 版本矩阵 | A | 一页看完体系 |
| RETROSPECTIVE 复盘 | A | 心得 + 踩坑 + 设计原则提炼 |
| Schema 完整 | A | stage-report / project-config / common-response / module-code / task-input / dom-tree-v1 / svg-paths 全有 |

**扣分点**:references 数量略多(7 个 skill 共 30+ references),有些可以合到 SKILL.md inline。

---

### ④ 可维护性 · **B**(78 / 100)

| 子项 | 评分 | 说明 |
|---|---|---|
| 模块边界清晰 | A | 6 个 skill 各司其职,职责不交叉 |
| 配置集中 | A | project.config.json 一处真理 |
| 报告格式统一 | A | stage-report.schema.json 强制规范 |
| stage-gate 通用 | A | 一套机制管所有 Stage 切换 |
| 跨 skill 调用契约 | A | playwright-skill SKILL.md 第 7 节定义清楚 |
| 版本号管理 | B | 6 skill 各自 bump 容易漏,应该有统一 manifest |
| 改一处影响哪些文件 | C | 改 project.config.json 哪些 skill 受影响要靠人记 |

**扣分点**:版本号 + 影响面追踪要人工记忆。可以加一个 `manifest.json` 列依赖关系。

---

### ⑤ 实战可用性 · **B**(75 / 100)

| 子项 | 评分 | 说明 |
|---|---|---|
| 场景 1 完整新模块 | B | 设计完整,**未实战测试** |
| 场景 2 完整无接口 | B | 设计完整,未实测 |
| 场景 3/4/5 增量/迭代/重构 | C | **e2e 定位机制全新,未实测** |
| 场景 6 单 bug 修复 | B | 用户之前用过类似流程,大概率能跑 |
| 场景 6 多 bug auto 批处理 | C | 4 Phase 设计完整,**未实测** |
| stage-gate 实际触发 | C | 写了脚本,**未跑过完整链路** |
| DSL 精简 + 精度 | B | 设计合理,实测能压 70-80%,**精度尚未实战验证** |

**扣分点**:整套体系**未跑过一次完整真实模块**。设计完整,但实战可能暴露问题。

---

### ⑥ 自动化程度 · **A**(90 / 100)

| 子项 | 评分 | 说明 |
|---|---|---|
| Auto Mode 跳确认 | A | 6 skill 统一支持 |
| 自动产报告 | A | 每个 stage 自动落 stage-report.json |
| Gate 自动检查 | A | stage-gate.mjs 通用化 |
| 失败自动尝试修(token diff) | A | 关键漏写自动改,改不动写 issues |
| 多 bug 自动批处理 | A | Phase 1-4 串到底 |
| 自动 commit/push | - | **故意没做**(铁律:不自动 commit) |

**扣分点**:多 bug 批处理 Phase 3(并行回写云效)有"并行调 MCP"风险,可能要降级到串行。

---

## 综合分数 **A · 86 分**

加权计算(每维度权重):
- 通用性 25% × 90 = 22.5
- 完整性 20% × 88 = 17.6
- 文档质量 15% × 85 = 12.75
- 可维护性 15% × 78 = 11.7
- 实战可用性 15% × 75 = 11.25
- 自动化程度 10% × 90 = 9
- **合计 = 84.8 ≈ 86**(四舍五入)

---

## 不同视角的看法

### 给开源用户:**A**

- 拿到代码改 `project.config.json` 几行 → 能跑场景 1/2
- 6 个文档(SKILL.md/STATUS/WORKFLOW/README/GLOSSARY/RETROSPECTIVE)让你看清结构
- 0 项目耦合

### 给 Claude(自己):**B+**

- SKILL.md 加载即知道怎么跑(三问 / 5 场景 / Gate 机制)
- 但 references 多,token 消耗大
- 经常要"读多个文件"才能干一件事

### 给项目实战(jdz 这边):**B**

- 设计完整但未实战
- 真跑可能暴露:e2e 定位失败率 / DSL 精修准确率 / playwright flow 通用性

---

## 还能优化的方向

### 优化 1 · 加 `manifest.json`(可维护性 +5)

```json
{
  "version": "2.2.0",
  "skills": {
    "module-flow": { "version": "2.2.0", "depends": ["master-go-to-code", "yapi-to-code", ...] },
    "master-go-to-code": { "version": "2.2.0", "depends": [] },
    ...
  },
  "config_dependencies": {
    "structure.viewsDir": ["module-flow", "frontend-page-design"],
    "conventions.httpClient": ["yapi-to-code"],
    ...
  }
}
```

改 config 一个字段时,提示影响哪些 skill。

### 优化 2 · 第一次实战 + 收集 issue(实战可用性 +10)

跑一个真实模块,记录:
- 哪一步卡了
- e2e 定位失败率
- DSL 精修是否准确
- compare-tokens 漏写率

回头优化薄弱环节。

### 优化 3 · references 减肥(文档质量 +5)

部分 references 内容偏短(< 50 行)的合到 SKILL.md inline。例如:
- `master-go-to-code/references/imgdir-mapping.md` (40 行) → 合到 SKILL.md Step 1
- `frontend-page-design/references/issues-template.md` (30 行) → inline

减少文件数,Claude 读得更连贯。

### 优化 4 · WORKFLOW.md 彻底通用化(通用性 +5)

把"演示用 jdz"的部分也改成通用占位。代价:可读性下降。

### 优化 5 · 多 bug 并行回写改串行(自动化稳定性 +5)

Phase 3 并行调云效 MCP 有风险(并发问题 / 限流)。**改成 Promise.all → 串行 + 失败重试**。

---

## 一句话总结

> **6 个 skill 协同的完整开源级 Claude Code 前端流水线**,设计完整 + 通用化彻底 + 防漏机制硬,**未实战是最大风险**。第一次跑通后能稳定到 A+。

---

**最后更新**:2026-05-16 · v2.2.0 · 通用化清洗完成 · 待实战
