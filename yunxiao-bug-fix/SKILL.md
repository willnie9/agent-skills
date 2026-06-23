---
name: yunxiao-bug-fix
description: 处理阿里云效 Bug 的标准流程技能，覆盖搜索/确认/分析/修复/验证/回写全生命周期。用户提供云效链接、提到 bug/缺陷/工作项，或要求处理云效 bug 时触发。本 skill 依赖 playwright-skill 完成浏览器验证。
version: 3.2.0
---

# 云效 Bug 修复标准流程（SOP）

## ⭐ Auto Mode（无确认全自动模式）

**触发**：用户输入含任一关键词 → `全跑 / 一气呵成 / auto / yolo / 别问 / 自动`，或一次贴多个 bug 链接说"一起改"。

### 单 bug Auto 流程

```
用户给单链接 + auto
   ↓
Step 1 定位                (单链接,无需搜索)
   ↓
Step 2 跳过(不展示等用户)
   ↓
Step 3 抓上下文            (4 子动作必做,铁律 3/4)
   ↓
Step 4 代码定位
   ↓
Step 5 跳过出方案(直接改)
   ↓
Step 6 改代码
   ↓
Step 7 浏览器验证          (auto 强制选 C 路径)
   ↓
   ┌───────────────────────────┴──────────────────┐
   ▼                                                ▼
verdict=pass(验证通过)                       verdict=fail(验证失败)
   ↓                                                ↓
Step 8 自动回写云效:                          ⚠️ 停下来等用户确认
  ① update_work_item → 开发完成                问用户:
  ② create_work_item_comment → 评论            "验证未通过(原因: 没数据/没详情/...)
  ③ create_workitem_attachment → 截图附件       要不要仍然回写云效?
                                                A) 仍回写(我知道)
                                                B) 不回写,我自己看代码
                                                C) 重新跑验证"
   ↓                                                ↓
Step 9 落 bug-fix-report.json (verdict=pass) Step 9 落 bug-fix-report (verdict=fail/warn)
```

### 单 bug Auto 自动决策表

| 步骤 | 默认行为(等用户) | Auto 行为 |
|---|---|---|
| Step 1 定位 Bug | 列候选等用户选编号 | 单链接直接进;搜索结果按优先级取第一 |
| Step 2 展示等"开始修复" | ⚠️ 铁律 2 必停 | **跳过** |
| Step 3 抓上下文(4 子动作) | 全做 | 全做(铁律 3/4 仍生效) |
| Step 4 代码定位 | 同 | 同 |
| Step 5 出方案等"确认" | ⚠️ 铁律 5 必停 | **跳过** |
| Step 6 改代码 | 同 | 同 |
| Step 7 弹 A/B/C/D | ⚠️ 铁律 6 必停 | **强制走 C(验证+回写)** |
| Step 8 浏览器验证 | 选 A/C 跑 | 跑(必跑) |
| Step 9 回写云效 | verdict 决定 | **pass → 自动回写状态+评论+截图附件**;**fail → 停下问用户回写还是不回写** |
| Step 10 落 report | 同 | 同 |

### 多 bug Auto 流程(批处理,不是串行单 bug)

```
用户给 N 个链接 / "auto 把今天 5 个 bug 都改了"
   ↓
Phase 1: 批量改代码(N 个 bug 依次走 Step 1-6,只到改完代码不验证)
   ↓ (中间产物: 每个 bug 落 .claude/results/bug-fix-<id>/code-changed.json)
   ↓
Phase 2: 批量验证(每个 bug 用 MCP playwright 操作浏览器,按 §9.1 流程)
   for bug in bugs:
     用 MCP browser_* 走通验证步骤,落截图到 runtime/screenshots/<bug-id>.png
   ↓ (产物: .claude/skills/playwright-skill/runtime/screenshots/<bug-id>.png × N)
   ↓
Phase 3: 验证成功的统一回写云效(并行调 MCP,无 git 冲突所以可并行)
   for bug in passed:
     update_work_item({ status: '开发完成' })
     create_work_item_comment({ ... })
     create_workitem_attachment({ ... 截图 ... })
   ↓
Phase 4: 验证失败的停下问用户
   "<BUG-1>|<BUG-2>|<BUG-3> 验证未通过(原因 X),要回写吗? Y/N"
   用户决定
   ↓
最终汇总报告: ✅ 4/5 通过自动回写 / ⚠️ 1/5 待用户决定
```

### Auto 防漏执行机制

每个关键节点产小报告 + gate 检查,**机制层面保证不漏步**:

| 节点 | 产物 | Gate 检查 |
|---|---|---|
| Step 6 改完代码 | `.claude/results/bug-fix-<id>/code-changed.json` (含 git diff stat) | diff 非空(空 = 没改成) → 报错停 |
| Step 8 验证完 | `.claude/skills/playwright-skill/runtime/screenshots/<bug-id>.png` 存在 + Claude 口头汇报"通过/失败" | 通过 → pass;失败 → fail |
| Step 9 回写完 | `.claude/results/bug-fix-<id>/yunxiao-updated.json` (含 MCP 返回值) | MCP 调用 ok |
| Step 10 结束 | `.claude/results/bug-fix-<id>.json` | 最终汇总,见统一 stage-report 格式 |

Claude 想跳步 = 产物缺 = 下一节点 gate 报错 = 流程停。

### Auto 模式必备前提

1. playwright-skill 在(否则无法自动验证 → 退化到选 D 仅保留代码 + 报告给用户)
2. MCP playwright 工具(`mcp__playwright__browser_*`)可调用
3. dev server 在跑(否则浏览器进不去 → 验证必 fail)

### Auto 失败时的"安全网"

- **验证 fail** → 不自动回写云效,**停下问用户**"是否仍回写 / 不回写 / 重跑";代码保留不动
- **云效 update 失败** → 重试 1 次,仍失败 → 报告;代码已改保留
- **截图附件上传失败** → 记 warning,不影响主流程(状态和评论已上)
- **任何环节抛异常** → bug-fix-report.json (verdict=fail) + stack trace

铁律 2/5/6 在 Auto 模式下**被显式跳过**(规则升级:`auto=true` 时不适用),其它铁律(1/3/4/7/8)保持。

---

## 0. 本 Skill 的定位与依赖

本 skill 是**业务主流程**。把"从云效拉 bug → 定位代码 → 修改 → 浏览器验证 → 回写云效"这条链写死成可复用的 SOP。

### 依赖关系

```
用户
  │
  ▼
yunxiao-bug-fix（本 skill，业务 SOP）
  ├─→ 云效 MCP（mcp_aliyun_yunxiao_*）   拉/写 bug 数据
  └─→ playwright-skill                    浏览器验证（见 .claude/skills/playwright-skill/SKILL.md 第 7 节契约）
```

### 运行前提（step 0）

执行任何步骤前先自检：

1. **云效 MCP 是否可用**：调用 `mcp_aliyun_yunxiao_get_current_organization_info()`，拿到 `organizationId` 和 `userId`。失败则立刻告知用户"云效 MCP 未配置，请先配置 `mcp_aliyun_yunxiao`"并停止流程。
2. **playwright-skill 是否存在**：当用户可能选择"浏览器验证"时，检查 `.claude/skills/playwright-skill/SKILL.md` 是否存在；不存在时在后续第 6 步提示用户"浏览器验证能力缺失，跳过该选项"。

---

## 1. 铁律（读到必须执行）

1. **所有 ID 动态获取**：`organizationId` / `projectId` / `userId` / `statusId` 全部动态查询，**绝不硬编码**。
2. **拿到 Bug 信息必须先展示给用户**（步骤 3），**禁止**直接开始修复。
3. **用户确认后，步骤 4 的四个子动作（详情/评论/附件列表/下载截图）必须全部执行**，不得跳过。
4. **截图附件必须 `curl` 下载到本地查看**，即使文字描述已清晰。
5. **改代码前先给方案让用户过目**（步骤 5.1），用户同意后再改文件（步骤 5.2）。
6. **修复后必须展示 A/B/C/D 四选项**让用户选，禁止自动回写云效。
7. **更新云效前先读当前工作项**，只更新要改的字段，避免覆盖。
8. **状态 ID 更新失败时自动查 `get_work_item_workflow` 重试**，不要凭记忆用常量。

---

## 2. 全流程总览

```
Step 0  检测环境（MCP + playwright-skill）
Step 1  定位 Bug           → 链接解析 或 搜索
Step 2  展示并确认         ⚠️ 铁律 2
Step 3  抓取全部上下文     ⚠️ 铁律 3/4（4 个子动作）
Step 4  代码定位
Step 5  方案确认 → 修改代码 ⚠️ 铁律 5
Step 6  展示 A/B/C/D 选项  ⚠️ 铁律 6
Step 7  按选项执行（验证 / 回写云效 / 两者都做 / 都不做）
Step 8  结束记录
```

后续每一步的标题都带编号，不再出现 2.5 / 5.5 这种插位号。

---

## 3. Step 1 — 定位 Bug

**工具**：`mcp_aliyun_yunxiao_search_workitems`

### 3.0 URL 形态识别(决定单 bug 还是多 bug)

云效 URL 格式:
```
https://devops.aliyun.com/projex/project/<projectId>/bug#viewIdentifier=<viewId>[&openWorkitemIdentifier=<workitemId>]
```

判断规则:

| URL 形态 | 含义 | 行动 |
|---|---|---|
| 有 `openWorkitemIdentifier=xxx` | **单 bug** | xxx 直接当 workItemId,进 Step 2 |
| 只有 `viewIdentifier=yyy` | **多 bug 视图**(自定义筛选) | viewId 拿不到 bug 列表(MCP 不支持),退化到 search_workitems 取近似(见 3.0.1) |
| 用户消息一次贴多个含 `openWorkitemIdentifier` 的 URL | **多 bug** | 每个 URL 提一个 workItemId,组成 bugIds[] 走多 bug 流程 |

提取代码:

```javascript
function parseYunxiaoUrls(message) {
  const urls = message.match(/https:\/\/devops\.aliyun\.com\/projex\/project\/[^\s]+/g) || [];
  const bugIds = [];
  let viewId = null;
  for (const url of urls) {
    const openMatch = url.match(/openWorkitemIdentifier=([a-f0-9]+)/);
    const viewMatch = url.match(/viewIdentifier=([a-f0-9]+)/);
    if (openMatch) bugIds.push(openMatch[1]);
    else if (viewMatch) viewId = viewMatch[1];  // 只在没具体 bug 时用
  }
  return { bugIds: [...new Set(bugIds)], viewId };
}
// bugIds.length === 1 → 单 bug 流程
// bugIds.length >= 2  → 多 bug 流程
// bugIds.length === 0 + viewId → 多 bug 视图(走 3.0.1 兜底)
// 都没有 → 走 3.2 自然语言搜索
```

### 3.0.1 多 bug 视图兜底(viewId 但拿不到 bug 列表时)

云效 MCP 不支持 `searchByViewId`,退化到普通搜索取近似:

```javascript
mcp_aliyun_yunxiao_search_workitems({
  organizationId,
  spaceId: projectId,        // 从 URL /project/<projectId>/ 提取
  category: 'Bug',
  assignedTo: 'self',        // 假设用户视图通常是"我的"
  statusStage: '1,2',        // 未关闭的
  includeDetails: true,
})
// 拿到 list 后让用户确认这是不是他要的
// auto 模式 → 默认全跑;非 auto → 列表让用户挑
```

### 3.1 分支判断

| 用户输入 | 行动 |
|---|---|
| 1 个含 openWorkitemIdentifier 的 URL | 单 bug → 直接 Step 2 |
| ≥ 2 个含 openWorkitemIdentifier 的 URL | 多 bug → 走多 bug 流程(auto=批处理) |
| 只有 viewIdentifier 的 URL | 多 bug 视图 → 走 3.0.1 兜底搜索 |
| 模糊描述("我的 bug"、"待确认的") | 用 3.2 查询参数搜索 |
| 历史 <BUG-ID> 编号(老格式) | 兼容支持,当 workItemId 处理 |

### 3.2 自然语言 → 查询参数

| 用户说 | 参数 |
|---|---|
| "我的 bug" | `assignedTo: "self"` |
| "待确认的 bug" | `statusStage: "1"` |
| "进行中的 bug" | `statusStage: "2"` |
| "高优先级 bug" | `orderBy: "priority", sort: "desc"` |
| "最近创建的" | `orderBy: "gmtCreate", sort: "desc"` |
| "关于登录的 bug" | `subjectDescription: "登录"` |

### 3.3 必填 & 推荐参数

```json
{
  "organizationId": "<step0 获取>",
  "spaceId": "<projectId>",
  "category": "Bug",
  "statusStage": "1,2",        // 默认排除已关闭，减少返回量
  "includeDetails": true        // 避免 N+1 查询
}
```

> **推荐**：始终带 `includeDetails: true`、`statusStage: "1,2"`。大数据量时分页（`page` / `perPage`，`perPage` 上限 200）。

### 3.4 完整参数速查

| 参数 | 类型 | 说明 |
|---|---|---|
| `statusStage` | string | 1=未开始，2=进行中，3=已关闭 |
| `includeDetails` | boolean | 直接返回描述，强烈建议 `true` |
| `assignedTo` | string | `"self"` 或 userId |
| `orderBy` | string | `priority` / `gmtCreate` |
| `sort` | string | `desc` / `asc` |
| `status` | string | 状态 ID（逗号分隔），建议不填，用 `statusStage` |
| `subject` | string | 标题模糊搜索 |
| `subjectDescription` | string | 标题或描述模糊搜索 |
| `page` / `perPage` | number | 分页 |

---

## 4. Step 2 — 展示并等待用户确认

**⚠️ 铁律 2：拿到 Bug 信息后必须先给用户看，禁止直接进入修复。**

### 4.1 搜索结果（列表）

```markdown
## 🐛 你的待处理 Bug（共 X 个）

### <BUG-1>|<BUG-2>|<BUG-3> — [标题]
**优先级：** 高 | **状态：** 待确认 | **指派给：** 张三

**描述：** [完整内容]

**截图：** [链接]（如有）

---

### <BUG-1>|<BUG-2>|<BUG-3> — [另一个标题]
...

---

**请选择要修复的 Bug：** 回复编号（如 "<BUG-1>|<BUG-2>|<BUG-3>"）开始修复。
```

### 4.2 直接链接（单个）

```markdown
## 🐛 Bug 详情

**ID:** <BUG-1>|<BUG-2>|<BUG-3>  **标题:** xxx
**状态:** 待确认  **优先级:** 高  **严重程度:** S2
**指派给:** 张三  **创建者:** 李四  **验证者:** 王五

**问题描述：**
[完整内容]

**截图：** [链接]（如有）
**评论：**（如有）
- **李四** (2026-05-10)：xxx

---

**是否开始修复？**
- "开始修复" / "确认" → 进入下一步
- "取消" → 停止
```

### 4.3 用户回复处理

| 用户说 | 行动 |
|---|---|
| "开始修复" / "确认" / 编号 | 进 Step 3 |
| "先看详情" | 展开更多信息，继续等待 |
| "取消" / "不修复" | 流程结束 |

---

## 5. Step 3 — 抓取全部上下文

**⚠️ 铁律 3/4：以下 4 个子动作必须全部执行，禁止跳过。**

### 5.1 工作项详情

```javascript
mcp_aliyun_yunxiao_get_work_item({ organizationId, workItemId })
```

### 5.2 评论列表

```javascript
mcp_aliyun_yunxiao_list_work_item_comments({ organizationId, workItemId })
```

评论常包含协调、补充、讨论 —— 即使看起来与代码无关也必须读。

### 5.3 附件列表

```javascript
mcp_aliyun_yunxiao_list_workitem_attachments({ organizationId, workItemId })
```

### 5.4 下载并查看每一张截图

```javascript
// 拿临时下载链接
const { downloadUrl } = await mcp_aliyun_yunxiao_get_workitem_file({
  organizationId, workitemId, id
})
// 必须 curl 下载到本地再查看
// curl -sL "<downloadUrl>" -o /tmp/bug-<id>-<n>.png
```

> ❗ 附件 URL 不能直接在浏览器打开（有签名时效），必须 `curl` 本地化。
> ❗ 只要有截图就必须看，不能因为"描述足够清晰"就跳过。
> ❗ 没有附件则记录 "无附件" 后继续。

---

## 6. Step 4 — 代码定位

按优先级依次尝试：

1. **关键词搜索**：用 Bug 标题/描述里的名词、报错文案 `grep`。
2. **路径推断**：根据功能模块对照 `CLAUDE.md` 里的模块速查表。
3. **Git 历史**：`git log -S "关键字"` / `git log --all -- <路径>`。
4. **问用户**：以上都失败则请求用户提供线索。

找到后简述"我认为问题在 `path/to/file:123` 附近，原因是 ..."，进入 Step 5。

---

## 7. Step 5 — 方案确认 → 修改代码

**⚠️ 铁律 5：先讲方案让用户过目，再动手改文件。**

### 7.1 先出方案（不改文件）

```markdown
**涉及文件：** `<viewsDir>/<module>/Index.vue:123`

**问题代码：**
\```ts
// 现状
if (status === 1) { ... }
\```

**问题分析：**
[逻辑错误/边界条件/样式问题等]

**修复方案：**
| 文件 | 问题 | 方案 | 手动验证 |
|---|---|---|---|
| Index.vue | 状态判断漏了 2 | 改成 `[1,2].includes(status)` | 1. 打开列表页 2. 筛选进行中 3. 应显示 N 条 |

**修复类型：** ✅ 纯前端 / ⚠️ 需要后端配合

---

**是否按此方案修改？** "确认" / "调整方案：..."
```

### 7.2 用户确认后执行改动

用户同意才用 Edit/Write 真实修改文件。修改完成后进入 Step 6。

---

## 8. Step 6 — 展示 A/B/C/D 选项

**⚠️ 铁律 6：修改完代码必须立即弹出以下四选项，不得用其它格式替代。**

```markdown
---

✅ 代码已修复，请选下一步：

  **A. 🧪 浏览器验证** → 通过 playwright-skill 跑 flow 验证
  **B. 💬 直接回写云效** → 跳过验证，更新状态 + 评论
  **C. 🚀 验证 + 回写云效** → 先验证，通过后自动回写
  **D. 📝 仅保留代码** → 不验证也不回写
```

### 用户回复兜底

- 回复"确认" / 模糊同意 → 视同 B
- 回复"取消" / 不同意 → 视同 D
- 若 step 0 发现 playwright-skill 缺失 → 隐藏 A/C，只给 B/D

---

## 9. Step 7 — 按选项执行

### 9.1 选项 A:仅浏览器验证

调用 playwright-skill(遵守其 SKILL.md §5「给上游 skill 的契约」):

1. 读 `.claude/skills/playwright-skill/config/playwright-skill.config.json` 拿 baseURL / 登录配置
2. 用 MCP playwright 工具(`mcp__playwright__browser_*`)按下面顺序跑:
   - `browser_navigate(baseURL + 受影响页面路径)`
   - `browser_snapshot()` 看是否在登录页(命中 `loginUrlPatterns`)
     - 是 → 按 SKILL.md §3.3 登录子流程操作:读 `credentials.local.json` → `browser_type` 账号密码 → `browser_click` 提交 → 处理 `orgSelectDialog` → `browser_wait_for(successCheck.text)`
     - 否 → 已登录,跳过
   - 按修复点设计的操作步骤:`browser_click` / `browser_type` / `browser_fill_form` ...
   - 关键节点 `browser_take_screenshot({ filename: "runtime/screenshots/<bug-id-lower>-verify.png" })`
   - `browser_snapshot()` 拿最终 DOM,核对修复点的 DOM/文案是否符合预期
3. 操作完用一句话汇报:**通过 / 失败**(失败时给截图路径 + 看到了什么 vs 期望什么)

**验证完成后必须展示结果 + 追问是否回写云效**（不得静默结束）：

```markdown
🧪 浏览器验证：[✅ 通过 / ❌ 失败]

[验证详情 / 失败截图路径(.claude/skills/playwright-skill/runtime/screenshots/<bug-id>-verify.png) / 错误摘要]

是否回写云效？
- "确认" → 更新为"开发完成" + 添加评论
- "不更新" → 只保留代码修改
- "需要调整" → 重新改代码
```

### 9.2 选项 B：直接回写云效

进入 Step 8（回写）。

### 9.3 选项 C：验证 + 回写云效

1. 执行 9.1 的验证
2. 通过 → 自动进入 Step 8
3. 失败 → 报告结果并等待用户指示（此时退化为选项 A 的追问流程）

### 9.4 选项 D：仅保留代码

向用户确认"代码已修改但未回写云效"，流程结束。

---

## 10. Step 8 — 回写云效

**⚠️ 铁律 7/8。**

### 10.1 更新工作项状态

```javascript
// 1) 先读当前工作项
const workItem = await mcp_aliyun_yunxiao_get_work_item({ organizationId, workItemId })

// 2) 查 workflow 拿真实状态 ID（不要用常量）
const workflow = await mcp_aliyun_yunxiao_get_work_item_workflow({ organizationId, workItemId })
const targetStatusId = workflow.find(s => s.name === '开发完成')?.id

// 3) 只更新需要变的字段
await mcp_aliyun_yunxiao_update_work_item({
  organizationId,
  workItemId,
  updateWorkItemFields: { status: targetStatusId }
})
```

**失败兜底**：若 `update_work_item` 因状态 ID 无效失败，重新拉 workflow、匹配名称、重试一次。

### 10.2 状态名参考（仅用于理解含义，不要直接用 ID）

| 状态名 | 常见含义 | stage |
|---|---|---|
| 待确认 | 新建未确认 | 1 |
| 待处理 | 已确认待处理 | 1 |
| 进行中 | 修复中 | 2 |
| 开发完成 | 修复完成待测 | 2 |
| 测试中 | 测试环节 | 2 |
| 已修复 / 已关闭 | 完结 | 3 |

### 10.3 添加修复评论

```javascript
mcp_aliyun_yunxiao_create_work_item_comment({
  organizationId,
  workItemId,
  content: renderComment({ ... })  // 见 10.4
})
```

### 10.3.1 上传验证截图作为云效附件(必做)

回写状态后,把 MCP 浏览器验证产出的截图作为附件上传到云效 bug,让验证者直接看修复效果:

```javascript
import { readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

// 验证截图位置(MCP 操作时落在 skill 内部 runtime/screenshots/)
const screenshotsDir = `.claude/skills/playwright-skill/runtime/screenshots`;
if (existsSync(screenshotsDir)) {
  const screenshots = readdirSync(screenshotsDir)
    .filter(f => /\.png$/i.test(f) && f.toLowerCase().includes(bugId.toLowerCase()))
    .slice(0, 5);  // 最多 5 张,避免污染

  for (const f of screenshots) {
    await mcp_aliyun_yunxiao_create_workitem_attachment({
      organizationId,
      workItemId,
      filePath: path.resolve(screenshotsDir, f),
    });
  }
  console.log(`✅ 已上传 ${screenshots.length} 张验证截图`);
}
```

**触发时机**:
- 默认模式:选 A 或 C(用户选了验证)且验证通过时
- Auto 模式:验证通过时**必上传**(给验证者看到具体修复效果)
- 验证未跑(选 B/D)或验证失败:**不上传**

### 10.4 评论模板（可配置 + harness 强校验）

> ⚠️ **PreToolUse hook 硬卡**:`mcp__aliyun-yunxiao__create_work_item_comment` 调用前会跑 `.claude/hooks/validate-yunxiao-comment.mjs`,不符合 schema 直接 block。
> 规则源: `.claude/skills/yunxiao-bug-fix/config/yunxiao-comment.schema.json`(改规则只动这份,不动 hook)。
> 紧急简评论:`content` 第一行写 `[skip-template]` 可绕过校验。

模板**结构**固定，**文案**可配置。从 `.claude/skills/yunxiao-bug-fix/config/yunxiao-comment.md` 读取（自带默认模板，按需改）：

```markdown
✅ 已修复 | ⏱️ 修复时间：YYYY-MM-DD HH:mm
❗ 感谢 @{验证者姓名} 精准报 Bug，已定位并修复

**⬇️ 验证步骤**
1. [操作步骤1]
2. [操作步骤2]
3. [预期结果]

**⚠️ 问题原因**
[根因：代码逻辑 / 样式 / 数据流]

**⚡ 修复方案**
- [修复点1]
- [修复点2]

**➡️ 涉及文件**
`path/to/file1.vue`
`path/to/file2.ts`
```

**字段来源**：
- `{验证者姓名}` ← `workItem.verifier.name`
- `{修复时间}` ← 当前本地时间
- 其余 ← Step 5 分析结果 + Step 6 修改后的文件列表

**格式要求**：
- 各章节间保留一个空行，章节标题与内容间不留
- emoji 限用：✅❌⚠️✔️✖️➡️⬅️⬆️⬇️ℹ️❗❓⭐⚡♻️⏱️
- 验证步骤用有序列表，修复方案用 `-`
- 文件路径用反引号包裹

---

## 11. Step 9 — 结束记录

- 跑相关单元测试 / 类型检查确认没回归
- 确认云效状态已更新（回读 `get_work_item` 验证）
- 确认评论已写入
- **落盘 bug-fix-report.json**（统一 stage-report 格式,供 auto 模式上层汇总）:

  ```javascript
  // 写到 .claude/results/bug-fix-<bug-id>.json
  const report = {
    stage: 'bug-fix',
    skill: 'yunxiao-bug-fix',
    module: bugId,  // 如 '<BUG-1>|<BUG-2>|<BUG-3>'
    timestamp: new Date().toISOString(),
    verdict: verifyPassed && yunxiaoUpdated ? 'pass'
            : verifyPassed ? 'warn'  // 验证过但没回写(选 D)
            : 'fail',  // 验证失败
    summary: {
      bugId,
      filesChanged: [...],
      verifyPassed,        // bool: MCP 操作 + Claude 汇报通过
      yunxiaoUpdated,
      verifyScreenshot,    // 路径: runtime/screenshots/<bug-id>-verify.png
    },
    issues: [],  // 失败时填错误清单
    artifacts: {
      modifiedFiles: [...],
      verifyArtifactsDir: '.claude/skills/playwright-skill/runtime/screenshots/',
      yunxiaoCommentUrl: '...',
    },
  };
  ```

- 向用户简短汇报："<BUG-1>|<BUG-2>|<BUG-3> 已修复、验证通过、云效已更新为开发完成"

---

## 12. 铁律速查卡（再强调一次，贴在工作区）

| # | 铁律 | 对应步骤 |
|---|---|---|
| 1 | 所有 ID 动态获取 | 全流程 |
| 2 | 拿到 Bug 先展示等确认 | Step 2 |
| 3 | 四个上下文动作全做 | Step 3 |
| 4 | 截图必 curl 下载 | Step 3.4 |
| 5 | 改代码前先出方案 | Step 5.1 |
| 6 | 修复后必展示 A/B/C/D | Step 6 |
| 7 | 更新前先读再写 | Step 8.1 |
| 8 | 状态 ID 失败走 workflow 重试 | Step 8.1 |

---

## 13. 反模式（❌ 明确禁止）

- ❌ 硬编码 organizationId / projectId / userId / statusId
- ❌ 拿到 Bug 不展示就开改
- ❌ 跳过步骤 3 的任何子动作（特别是截图）
- ❌ 通过 URL 直接看截图不 `curl`
- ❌ 改代码前不出方案
- ❌ 修完代码自动回写云效
- ❌ 用"确认 / 需要调整 / 仅更新代码"代替 A/B/C/D
- ❌ 浏览器验证结束不追问"是否回写云效"就停
- ❌ 直接覆盖整个工作项字段

---

## 14. 涉及工具清单

**云效 MCP（前缀 `mcp_aliyun_yunxiao_`）**
- `get_current_organization_info`
- `search_projects` / `search_workitems`
- `get_work_item` / `update_work_item`
- `list_work_item_comments` / `create_work_item_comment`
- `list_workitem_attachments` / `get_workitem_file`
- `get_work_item_workflow`

**被调用 skill**
- `playwright-skill`(见 `.claude/skills/playwright-skill/SKILL.md` §5「给上游 skill 的契约」)— v8 起改为 MCP 浏览器操作,不再跑 spec

**本地工具**
- `curl`（下载截图附件）
- `grep` / `git log`（Step 4 代码定位）

---

## Changelog

- **v3.2.0(2026-05-15)** — Auto 化 + 批量 bug 链路
  - URL 形态识别（单 bug vs 多 bug vs 视图）
  - 批量改 bug：Phase 1 全改 → Phase 2 批量验证 → Phase 3 统一回写云效
  - 验证失败停下问用户,不默认回写;回写时上传 playwright 截图作为云效附件
- **v3.1.0(2026-05-15)** — 项目隔离
  - 评论模板从 `.agents/config/` 搬到 `.claude/skills/yunxiao-bug-fix/config/`,去 .agents 依赖
- **v3.0.0(2026-05-13)** — 大厂风格重构
  - 全生命周期 SOP,委托 playwright-skill 做浏览器验证
