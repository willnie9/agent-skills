#!/usr/bin/env node
// PreToolUse on Write / Edit：粗转 dom-tree 未完成 → 不允许写"精修.json"。
// 锚点：master-go-to-code 产物目录下 .workflow-phase 文件内容。
//   - "rough-needed"（默认 / 缺）→ 必须先跑 fetch-and-parse.mjs
//   - "preview-needed"            → 已粗转，可以精修
//   - "refining" / "done"         → 放行
// 适用范围：路径包含 master-go-to-code 输出目录 且文件名含 "dom-tree" / "精修"。

import path from 'node:path'
import fs from 'node:fs'
import { readStdinJson, block, pass } from './_lib.mjs'

const evt = await readStdinJson()
const toolName = evt.tool_name || evt.toolName || ''
if (!['Write', 'Edit', 'NotebookEdit', 'MultiEdit'].includes(toolName)) pass()

const input = evt.tool_input || evt.toolInput || {}
const filePath = input.file_path || input.filePath || ''

const looksLikeRefine = /dom-tree|精修|refined/i.test(filePath)
const inMastergoOutput = /master-go-to-code\/output|\/output\/dom-tree/i.test(filePath)
if (!looksLikeRefine || !inMastergoOutput) pass()

const outDir = filePath.split('/output/')[0] + '/output'
const phaseFile = path.join(outDir, '.workflow-phase')

let phase = 'rough-needed'
try { phase = fs.readFileSync(phaseFile, 'utf-8').trim() } catch {}

if (phase === 'rough-needed') {
  block(
    `粗转未完成，不允许直接写精修产物。\n` +
    `请先跑: node .claude/skills/master-go-to-code/scripts/fetch-and-parse.mjs <fileId> <layerId> <imgDir>\n` +
    `phase 文件: ${phaseFile} (当前=${phase})`
  )
}

pass()
