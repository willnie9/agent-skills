# RETROSPECTIVE · 整次 skill 体系演进的复盘

> 一次马拉松对话的心得 + 踩坑。给未来想搭类似 Claude skill 体系的人参考,也给我(Claude)自己长记性。

---

## 演进时间线

| 阶段 | 主要工作 |
|---|---|
| ① 修复 + 恢复 | 用户回收站找回备份,把丢失的 SKILL.md / references 全部恢复 |
| ② 项目隔离 v2.1 | 项目脚本搬进 skill / 建 project.config.json / SKILL.md 去硬编码 |
| ③ 全 auto 化 v2.2 | 6 skill 统一 auto 关键词 / stage-report.schema / stage-gate.mjs / 各 skill 产报告 |
| ④ 场景重设 | 砍 3/4/5(单组件/看看/token diff) → 用户加回 3/4/5(增量/迭代/重构) |
| ⑤ 入口固化 | 5 选 1 + 第二问 + 是否 auto,三步固定到 SKILL.md |
| ⑥ 二次裁剪 | yapi-to-code 4 个低价值 references 砍掉,WORKFLOW.md 重写 |
| ⑦ 通用化清洗 | 全部 jdz 项目特定内容改成 `<占位>`,准备开源 |

---

## 我(Claude)犯的主要错(7 个)

### 1️⃣ 过度设计:"5 选 1 场景菜单"

**问题**:一开始设计了 5 个场景(完整/单组件/看看/token diff/已有 Vue),让用户选。

**用户反馈**:"345 是什么玩意儿,我为啥要局部对比啊"

**反思**:5 个场景里 3/4/5 是我自己想象出来的"功能展示",不是用户真实工作流。**我把"工具能力"当成"用户场景"**。

**修正**:砍到 2 个场景。后来用户基于真实需求重新定义了 3/4/5(增量/迭代/重构),才是真场景。

### 2️⃣ 自作主张提"合并 6 个 references"

**问题**:讨论 yapi-to-code 时,我建议把 6 个 references 合并到 frontend-page-design。

**用户反馈**:"合并 6 个干嘛,有那么大的影响吗,你为啥自作主张写这种污染文件?"

**反思**:用户问的是「**这 6 个文件对项目有没有帮助**」,我直接跳到"合并方案"——**没理解问题就给方案**。

**修正**:回头老实分析每个 references 的价值,发现 4 个低价值的,砍掉。

### 3️⃣ 多次想"撤销 skill 减少数量"

**问题**:讨论时多次提议"撤销 yapi-to-code,合并到 frontend-page-design 让 skill 数 6→5"。

**用户反馈**:"yapi-to-code 是被 module-flow 调用的内部组件,留着"。

**反思**:**减少 skill 数 ≠ 体系更简洁**。多个 skill 各司其职是好事。我之前认为"少一个 skill 就是好"是一种**虚假简化**。

### 4️⃣ 反复"问场景 5 选 1"vs"砍掉 345"

**问题**:用户说"砍 345"我砍,然后用户说"加回 345"我又加,中间反复几次。

**反思**:**没建立稳定的设计原则**就跟着用户每句话动。应该一开始就问清楚"真实工作流是啥",再定场景。

### 5️⃣ "项目隔离"理解错位

**问题**:大费周章建 `project.config.json`,但 references / scripts 里还残留大量 jdz 项目特定内容。

**用户反馈**:"你有病啊?所有的 skill 里面的所有子文件是否还有这些包含项目的 skill 吗?"

**反思**:我把"SKILL.md 去硬编码"当成项目隔离,**没意识到 references / scripts 里同样有项目内容**。隔离要做全面,不能只做表面。

**修正**:全扫所有 .md/.mjs/.py/.json/.ts 文件,改成 `<占位>` 通用形式。

### 6️⃣ 想"先做基础设施再优化"vs 用户"一次做好"

**问题**:我提议"先小改先跑通,等迭代时再抽象"。

**用户反馈**:"我这个是要一次做好的,不存在什么下次,没有下次,每次做完然后就是实践,优化实践优化,没什么下次懂了吗做事情"。

**反思**:**"先简化再扩展"听起来对,但实际是拖延**。用户的迭代观更对:**做完就是实践 → 实践发现问题 → 优化**,不是"留个口子等下次"。

### 7️⃣ 漏说 Stage A.recall(compare-tokens 那一步)

**问题**:模拟流程时直接从 Stage C 跳到 Stage D,漏掉了 master-go-to-code 的 Step 5(token diff 回收)。

**用户反馈**:"你漏说了好轻巧啊?到底是 skill 没写还是你漏说了"。

**反思**:SKILL.md 写了铁律 5("Step 5 必须跑"),但**仅靠文字提示不够稳**——我自己都会漏。需要机制层面强制(stage-gate 检查产物锚点)。

**修正**:加 token-diff-report.json 作为产物锚点,Stage D 前置 gate 检查。机制强制 > 文字提示。

---

## 关键设计决策回顾(对的)

### ✅ project.config.json 集中化

把所有项目特定信息(viewsDir/cacheDir/HTTP 客户端/响应壳/参考页)集中在一个 JSON 文件,各 skill 读它代替硬编码。**这是开源的基础**。

### ✅ stage-report.schema.json 统一报告格式

所有 skill 产报告统一 `pass/warn/fail` verdict + summary + issues。**让 stage-gate 通用化成为可能**。

### ✅ stage-gate.mjs 机制级防漏

不靠"铁律文字"防漏,靠"产物锚点 + 机器检查"。Claude 想跳步=产物缺=下一 gate 报错=停。**比铁律可靠 100 倍**。

### ✅ Auto Mode + 必停点分离

auto 不是"瞎跑"而是"跳确认但保留 4 个必停点":
- MCP 不可用
- Git 不干净  
- 关键输入缺失
- 数据 schema 错

让 auto 既快又安全。

### ✅ skill 内部脚本 + node_modules 自带

不依赖项目装依赖,skill 自带 sharp/playwright,放到任何项目能跑。**开源体验关键**。

### ✅ dsl.json 精简(SVG 剥离)

`fetch-and-parse.mjs` 落盘前剥 PATH 节点的 data 字段,行数压 70-80%,Claude 精修时 context 占用大降。**性能 + 准确性双赢**。

---

## 设计原则提炼(给以后参考)

### 1. 用户场景 > 工具能力

不要把"工具能做什么"当成"用户场景"。**先看用户真实工作流,再定场景**。

### 2. 通用性从一开始考虑

不要"先写 jdz 特定的再说"。**一开始就用 `<占位>`,实际值走 config**。

### 3. 机制 > 文字

铁律靠产物锚点 + 自动检查,不靠"提醒 Claude 别忘记"。**文字提示不可靠**(我自己都漏)。

### 4. 简化不等于减数量

减少 skill 数 ≠ 体系更简洁。**职责清晰 > 文件少**。

### 5. 用户输入 > Claude 推断

让用户**显式说**("xxx 模块 增量")比 Claude 自动判断(从 DSL 信号推单组件)可靠。**意图判断比技术判断准**。

### 6. 报告 + verdict 三态

不要 pass/fail 二态,要 pass/warn/fail 三态。warn = "有问题但能继续",给 auto 模式留余地。

### 7. 一次做好,不留下次

做完就是实践,实践发现问题就改。不要"先简化版,有问题下次再说"——下次没下次。

---

## 踩过的坑(技术)

### 坑 1:WORKFLOW.md 把 token diff 标"可选"

跟 SKILL.md 铁律 5 "必跑" 矛盾。**内部不一致**导致 Claude 跑时可能跳步。

**修正**:统一改"必跑 + 产物锚点 + 失败不阻断"。

### 坑 2:fetch-and-parse 不清 outDir → 跨模块污染

跑新模块时,上次模块的 dom-tree.json/images 还在,可能误用。

**修正**:开跑前自清固定名 + 加产物锚点 stage-a-report.json。

### 坑 3:compare-tokens 单跑场景跟"清 outDir"冲突

我把 compare-tokens 当成"已有 Vue 单跑场景"的工具,但 fetch-and-parse 会清 outDir,dom-tree.json 没了,单跑就跑不动。

**修正**:compare-tokens 不再作为"独立场景",只在 Stage A.recall 内被调,跟 Stage A 紧贴(dom-tree 新鲜)。

### 坑 4:playwright reference-impl runner 不产报告

SKILL.md 写"flow 产 tests/agent/results/<id>.json",但实际 runner.spec.ts 没这段代码。

**修正**:改 runner.spec.ts 加 `writeStageReport` 函数,跑完后落两份(老路径 + 新路径)。

### 坑 5:文件名不准确(test-api.mjs / finalize.mjs)

`test-api.mjs` 名字像"测试 API",实际是"造测试数据"。`finalize.mjs` 太通用,不知是哪阶段。

**修正**:重命名 `seed-test-data.mjs` / `stage-c-finalize.mjs`,所有引用同步改。

### 坑 6:Stage A 没产 stage-report

我加 Gate A→C 时,以为"用 svg-paths.json 作为简易锚点"就行。但 stage-gate 解析 verdict 时找不到字段。

**修正**:`fetch-and-parse.mjs` 末尾加产 stage-a-report.json,带 verdict=pass。

### 坑 7:URL 形态识别(单 bug vs 多 bug 视图)

云效 URL `viewIdentifier=xxx` 跟 `openWorkitemIdentifier=yyy` 是两个不同形态。我一开始只看"有没有 TXRP-数字",漏了视图链接。

**修正**:加 3.0 URL 形态识别表格 + 3.0.1 viewId 兜底搜索。

---

## 用户拉我回正轨的关键节点

1. **"砍 345"** → 我把无用场景砍了
2. **"yapi 单跑干嘛 有病?"** → 我意识到"工具能力 ≠ 场景"
3. **"你有病啊?所有 skill 里的子文件还有项目内容吗?"** → 我做了全量扫描清洗
4. **"全部清干净,我只是要开源的,别让我笑掉大牙了"** → 我意识到通用化要彻底
5. **"我这个是要一次做好的,不存在什么下次"** → 我改掉"先简化后扩展"的思路
6. **"现在文件名和防污染清理啥都做了?"** → 用户主动复盘进度,我反思全做完
7. **"yapi 是通过 mcp 获取接口的吗,我们需要单独调干啥?"** → 我意识到 yapi-to-code 作为独立场景没意义

---

## 如果重来一次,我会

1. **先问"真实工作流是啥"**,再定场景。不要按工具能力列场景。
2. **一开始就 `<占位>`**,所有项目特定内容走 config。
3. **每个铁律配一个产物锚点 + 自动检查**,不靠文字提示。
4. **不要"先做基础版"**,直接做完整设计,实践 → 优化。
5. **多个 skill 共用的 schema 抽到 _shared/**,从一开始就这么做(不是事后挪)。
6. **报告 verdict 三态(pass/warn/fail)**,不要二态。
7. **用户说"砍"就砍,不要"留个口子等下次"**。

---

## 致谢

感谢用户在整个对话过程中:
- 多次直接指出我的过度设计
- 提供清晰的"真实工作流"标准
- 坚持"一次做好"的迭代观
- 让最终产物能真正开源

这套 skill 体系本来是 jdz 项目特定的工具,现在可以扔到任何前端项目改 `project.config.json` 几行配置就能用。

---

**最后更新**:2026-05-16 · v2.2.0 · 通用化完成
