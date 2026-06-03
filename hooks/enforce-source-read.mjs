#!/usr/bin/env node
// PreToolUse on Write 给 auto-ui-explorer SP（spec/path）用例：必须先读过对应源码。
// 锚点：.claude/state/auto-ui-explorer/source-read-${module}.flag
// 由 auto-ui-explorer Step 1（读源码）落盘，Step 4（写 SP 用例）前检查。
//
// 触发条件：Write 路径在 auto-ui-explorer/output/sp-* 或 路径含 "SP-" / "sp-flow"。

import path from 'node:path'
import fs from 'node:fs'
import { readStdinJson, block, pass, STATE_DIR } from './_lib.mjs'

const evt = await readStdinJson()
const toolName = evt.tool_name || evt.toolName || ''
if (!['Write', 'Edit'].includes(toolName)) pass()

const input = evt.tool_input || evt.toolInput || {}
const filePath = input.file_path || input.filePath || ''

const isSP = /auto-ui-explorer.*\/(sp|SP-|sp-flow|sp-cases)/i.test(filePath) ||
             /SP-\d+\.(json|md|mjs)$/i.test(filePath)
if (!isSP) pass()

const moduleMatch = filePath.match(/auto-ui-explorer\/output\/([^/]+)/) ||
                    filePath.match(/SP-\d+-([a-zA-Z][a-zA-Z0-9_-]+)/)
const module = moduleMatch ? moduleMatch[1] : 'default'
const flagFile = path.join(STATE_DIR, 'auto-ui-explorer', `source-read-${module}.flag`)

if (!fs.existsSync(flagFile)) {
  block(
    `禁止从 JSON 词典凭空生成 SP 用例。必须先读过对应源码。\n` +
    `修复: 读源码后 touch ${path.relative(process.cwd(), flagFile)}\n` +
    `或在 auto-ui-explorer Step 1 完成时由脚本自动 touch。`
  )
}

pass()
