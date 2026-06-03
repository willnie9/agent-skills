#!/usr/bin/env node
// PostToolUse on Write/Edit：每个 SP 用例执行完，必须立即写 baseline.json。
// 这是 auto-ui-explorer 断点续跑的核心——baseline 漏写 → 上下文压缩后丢进度。
//
// 触发条件：Write 路径在 auto-ui-explorer/output/<module>/sp-results/SP-*.json
// 检查：同目录的 baseline.json 是否在最近 60 秒内被修改过。
// 没有 → 警告（不熔断，因为 PostToolUse 阶段已经写完了，熔断也没用）。

import path from 'node:path'
import fs from 'node:fs'
import { readStdinJson, pass } from './_lib.mjs'

const evt = await readStdinJson()
const toolName = evt.tool_name || evt.toolName || ''
if (!['Write', 'Edit'].includes(toolName)) pass()

const input = evt.tool_input || evt.toolInput || {}
const filePath = input.file_path || input.filePath || ''

const spResultMatch = filePath.match(/(.+\/auto-ui-explorer\/output\/[^/]+)\/sp-results\/SP-\d+/)
if (!spResultMatch) pass()

const moduleDir = spResultMatch[1]
const baselineFile = path.join(moduleDir, 'baseline.json')

let stale = false
try {
  const stat = fs.statSync(baselineFile)
  if ((Date.now() - stat.mtimeMs) > 60_000) stale = true
} catch {
  stale = true
}

if (stale) {
  // PostToolUse 阶段，事件已经发生，发警告但不 block
  process.stderr.write(
    `[hook warn] 写完 SP 结果但 baseline.json 未更新（>60s 或不存在）。\n` +
    `下次断点续跑会丢进度。立即更新: ${path.relative(process.cwd(), baselineFile)}\n`
  )
}

pass()
