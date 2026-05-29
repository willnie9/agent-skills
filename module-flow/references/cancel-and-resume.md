# 取消与回退机制

> 本文件被 [SKILL.md](../SKILL.md) 引用。

## 核心原则

- **已落盘产物保留**,用户改主意还能继续
- **不自动删任何文件**,删除前必须用户确认
- **回退最多回到当前 Stage 内部**,不退到上一 Stage(避免擦掉上游产物)

## 场景 1:用户在检查点说"算了 / 取消"

立即停止后续 Stage,报告当前状态:

```markdown
⏸️ 流程已暂停

已完成的 Stage:
• Stage A ✅ → dom-tree.json + 8 张图片(保留在磁盘)
• Stage B ⏸️ → 未启动

产物位置:
• .claude/skills/master-go-to-code/output/dom-tree.json
• src/assets/images/<imgDir>/<myModule>/

下次想继续:
• 说"继续 <myModule>"或重新贴任务指令
• 我可以从 Stage B 接着跑(读已有 dom-tree.json)

想丢弃产物:
• 说"清理 <myModule> 的中间产物"
• 我会删除 .claude/skills/master-go-to-code/output/ 下的 dom-tree.json 和图片(不删 src/assets/images/,那是项目资源)
```

## 场景 2:用户说"这步不对,重做"

**只回退到当前 Stage 内部重试,不退到上一 Stage**:

| 当前位置 | 重做范围 |
|---|---|
| Stage A 内 preview 检查不通过 | 回 Step 2 精修(可让用户提供截图辅助) |
| Stage B 类型映射不对 | 回 Step 3 重新推导(让用户指出哪个字段错) |
| Stage C 文件清单不对 | 回 Step 2 重新规划 |

## 场景 3:用户要"回到上一 Stage 重做"

例如:Stage C 跑完发现 dom-tree 有问题想回 A。

```markdown
你要回到 Stage A 重做,这会:
• 丢弃当前 Stage C 已产出文件 (5 个新文件 + 3 个修改的)
• Stage B 产出保留(没改)
• Stage A 重新跑,覆盖 dom-tree.json

确认丢弃 Stage C 产物?
• "是" → 删除 Stage C 文件,回 Stage A
• "否" → 不删,新跑一次 Stage A 覆盖 dom-tree(但 Stage C 已用旧 dom-tree 生成的代码不会自动更新)
```

## 场景 4:下次"继续 <module>"

自动检测已有产物,跳过已完成的 Stage:

```bash
# 检查 Stage A 产物
test -f .claude/skills/master-go-to-code/output/dom-tree.json
# 检查 Stage B 产物
test -f src/cache/<module>/define.ts
# 检查 Stage C 产物
test -f src/views/<module>/Index.vue
```

报告给用户:

```markdown
🔍 检测到 <myModule> 已完成:
• Stage A ✅(dom-tree.json 在,2 小时前生成)
• Stage B ✅(define.ts + api.ts 在)
• Stage C ✅(Index.vue + 路由都已注册)
• Stage D ⏸️(未跑过 e2e)

继续从 Stage D 开始吗?
还是想重跑某个 Stage(说"重跑 A" / "重跑 B" / "全部重跑")?
```

## 场景 5:中途用户改了需求

例如:跑完 Stage A,用户说"页面标题改成 XX"。

```markdown
这个改动属于:
• Stage A 后续(改 dom-tree.json 的文本)→ 回 Stage A Step 2 改 dom-tree.json
• 还是 Stage C 后续(改 Vue 模板的文本)→ 等 Stage C 跑完后用普通编辑修改

如果是小文本改动,我建议:不回退,Stage C 跑完后我直接 sed 改 Index.vue。
如果是大结构变化(整个页面布局变),建议回 Stage A 重新跑。

你想怎么处理?
```

## 不允许的操作

- ❌ 用户没说删,自动删除任何文件
- ❌ 跨 Stage 回退时不告知用户会丢什么
- ❌ 跳过 Stage 检测,默认全部重跑(浪费时间)
- ❌ "继续 <module>" 时不验证已有产物是否完整,直接接续(可能基于错产物继续)
