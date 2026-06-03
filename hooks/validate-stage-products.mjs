#!/usr/bin/env node
// PreToolUse 拦截 SubagentStop / Stop：在 Stage 切换前，检查上游产物 stage-report.json verdict。
// 实际触发点是 PreToolUse on Task（委托下游 skill 时）—— 拿 task description 推断本次要进的 stage，
// 然后查上一个 stage 的 report 是否落盘 + verdict 是否 pass/warn。
//
// 这是 module-flow Stage A→B→C→A.recall→D 切换的硬门禁。
//
// 简化策略：只查 .claude/results/<module>/ 目录下"上一阶段"的 report 是否存在 + verdict。
// 缺失或 verdict=fail → block。
// 推断模块名靠 prompt 里的关键词，推断不出来就放行（保守）。

import path from 'node:path'
import fs from 'node:fs'
import { readStdinJson, readJson, block, pass, RESULTS_ROOT } from './_lib.mjs'

const evt = await readStdinJson()
const toolName = evt.tool_name || evt.toolName || ''
if (toolName !== 'Task') pass()

const input = evt.tool_input || evt.toolInput || {}
const desc = (input.description || '') + ' ' + (input.prompt || '')

// 推断本次进入哪个 stage（看 task 描述里的关键词）
const stageMap = [
  { stage: 'B', re: /yapi-to-code|yapi.*生成|stage.?b/i, prev: 'A', prevReport: 'stage-a-report.json' },
  { stage: 'C', re: /frontend-page-design|组装|stage.?c/i, prev: 'A+B', prevReport: 'stage-a-report.json' },
  { stage: 'A.recall', re: /compare-tokens|token.?diff|recall/i, prev: 'C', prevReport: 'stage-c-report.json' },
  { stage: 'D', re: /playwright|smoke|stage.?d/i, prev: 'A.recall', prevReport: 'token-diff-report.json' },
]

const hit = stageMap.find(s => s.re.test(desc))
if (!hit) pass()

// 推断模块名：找 .claude/results/ 下最新的目录
let module = null
const moduleHint = desc.match(/module[=:\s"]+([a-zA-Z][a-zA-Z0-9_-]+)/i)
if (moduleHint) module = moduleHint[1]
else {
  try {
    const dirs = fs.readdirSync(RESULTS_ROOT, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => ({ name: d.name, mtime: fs.statSync(path.join(RESULTS_ROOT, d.name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
    if (dirs.length) module = dirs[0].name
  } catch {}
}

if (!module) pass()  // 推断不出模块名，保守放行

const reportPath = path.join(RESULTS_ROOT, module, hit.prevReport)
const report = readJson(reportPath)

if (!report) {
  block(
    `Stage ${hit.stage} 启动前，必须先跑 Stage ${hit.prev}。\n` +
    `缺少产物锚点: ${path.relative(process.cwd(), reportPath)}\n` +
    `修复: 回去跑 Stage ${hit.prev}，确保 ${hit.prevReport} 落盘。`
  )
}

if (report.verdict === 'fail') {
  block(
    `Stage ${hit.prev} verdict=fail，禁止进 Stage ${hit.stage}。\n` +
    `报告: ${path.relative(process.cwd(), reportPath)}\n` +
    `issues 摘要: ${JSON.stringify(report.issues?.slice(0, 3) || [])}`
  )
}

pass()
