# Hooks · harness 层硬约束

> 本目录是配套的 Claude Code hooks。**这些是真 hook**——通过 `settings.json` 注册到 harness 层,违反规则的工具调用会被 exit 2 拦截,不依赖大模型自觉。
>
> 仓库里的 SKILL.md 还保留了大量「铁律 N 条」「H1-H16 软约束」——那些是文档级约束,靠大模型读到后自觉遵守。本目录是其中**最致命的违反点**对应的真硬实现。

## 安装

把 6 个 `.mjs` 复制到你的项目根 `.claude/hooks/`,把 `settings.sample.json` 合并到 `.claude/settings.json` 即可:

```bash
# 在你的项目根目录
mkdir -p .claude/hooks
cp /path/to/skills-open-source/hooks/*.mjs .claude/hooks/
cp /path/to/skills-open-source/settings.sample.json .claude/settings.json
chmod +x .claude/hooks/*.mjs
```

下次启动 Claude Code 进入项目时自动生效。

## 6 个真 hook

| 文件 | 类型 | 触发 | 拦什么 |
|---|---|---|---|
| `auto-mode-guard.mjs` | PreToolUse | AskUserQuestion / ExitPlanMode | auto 模式下问非白名单问题(白名单关键词:MCP/git/输入缺失/schema fail/dev server/e2e 定位失败) |
| `validate-yunxiao-comment.mjs` | PreToolUse | `mcp__aliyun-yunxiao__create_work_item_comment` | 执行 `yunxiao-comment.schema.json` 中全部 rules（首行格式/章节顺序/列表结构/emoji 白名单），任一不通过 → block |
| `enforce-rough-first.mjs` | PreToolUse | Write/Edit/MultiEdit | 粗转 chunks 未完成时不允许写精修 dom-tree |
| `enforce-source-read.mjs` | PreToolUse | Write/Edit | 没读源码就写 SP 用例(auto-ui-explorer 专属,查 source-read flag 文件) |
| `validate-stage-products.mjs` | PreToolUse | Task | Stage 切换前查上一阶段 stage-report.json verdict |
| `enforce-baseline-persist.mjs` | PostToolUse | Write/Edit | SP 结果写完但 baseline.json 60s 内未更新 → 警告 |

## 取舍标准

不是所有铁律都该上 hook。我的取舍:

- **AI 天然倾向违反 + 失败级联严重** → 上真 hook(本目录 6 个)
- **AI 一般能自觉做到 / 错了也不致命** → SKILL.md 软约束就够

举例:
- "auto 模式不要问问题" → AI 训练让它倾向澄清,prompt 求没用 → 必须真 hook
- "命名用 BEM 规范" → AI 完全做得到 → 软约束就够
- "云效评论必须含修复说明" → AI 经常省略,但发出去就回不来了 → 必须真 hook

## 公用工具 `_lib.mjs`

所有 hook 共用:

- 从 stdin 读 hook 事件 JSON
- 路径解析:优先 `CLAUDE_PROJECT_DIR` 环境变量,兜底 `import.meta.url`(防 cwd 在子目录时找不到 `.claude/`)
- 默认放行(exit 0):规则不匹配、读 schema 失败、推断不出模块名 → 都放行,hook 写错也不会卡正常工作流
- `block(reason)`:exit 2 + stderr 写原因

## 自检

```bash
cd .claude/hooks
# 1. 语法
for f in *.mjs; do node --check "$f" && echo "$f OK"; done

# 2. auto-mode-guard 实测(应该 exit=2)
mkdir -p ../state && touch ../state/auto-mode.flag
echo '{"tool_name":"AskUserQuestion","tool_input":{"questions":[{"question":"通用问题"}]}}' | \
  CLAUDE_PROJECT_DIR=$(cd ../.. && pwd) node auto-mode-guard.mjs
echo "exit=$?"  # 期望 2
rm -f ../state/auto-mode.flag
```
