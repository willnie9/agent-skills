#!/usr/bin/env node
// PreToolUse on mcp__aliyun-yunxiao__create_work_item_comment：
// 用 yunxiao-bug-fix/config/yunxiao-comment.schema.json 卡评论字段。
// 不符合 schema → exit 2，AI 必须修正后重发。

import path from 'node:path'
import { readStdinJson, readJson, block, pass, SKILLS_ROOT } from './_lib.mjs'

const evt = await readStdinJson()
const toolName = evt.tool_name || evt.toolName || ''
if (toolName !== 'mcp__aliyun-yunxiao__create_work_item_comment') pass()

const schemaPath = path.join(SKILLS_ROOT, 'yunxiao-bug-fix', 'config', 'yunxiao-comment.schema.json')
const schema = readJson(schemaPath)
if (!schema) pass()

const input = evt.tool_input || evt.toolInput || {}
const content = (input.content || '').trim()

if (!content) block('云效评论 content 不能为空')

// 评论模板必须包含的关键章节（从 schema.required.sections 提取，没有就退化为约定项）
const required = schema?.required_sections || ['修复说明', '验证情况']
const missing = required.filter(k => !content.includes(k))

if (missing.length) {
  block(
    `云效评论缺必需章节: ${missing.join(', ')}\n` +
    `规则源: ${path.relative(process.cwd(), schemaPath)}\n` +
    `修正后重新调用 create_work_item_comment。`
  )
}

pass()
