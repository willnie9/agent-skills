#!/usr/bin/env node
// PreToolUse on AskUserQuestion / ExitPlanMode：auto 模式下拦截非白名单的交互。
//
// 白名单（对应 module-flow SKILL.md 的 4 个必停点）：
//   - MCP 不可用
//   - Git 工作区不干净
//   - 关键输入缺失（YApi 完全没给 / 模块名拼错）
//   - schema 校验 fail（精修错 / e2e 定位失败）
//
// 触发条件：auto-mode.flag 存在 + 工具名 == AskUserQuestion / ExitPlanMode + 问题不在白名单。

import { readStdinJson, autoModeOn, block, pass } from './_lib.mjs'

const WHITELIST_PATTERNS = [
  /MCP.*(不可用|不存在|缺失|未配置)/i,
  /git.*(不干净|未提交|dirty)/i,
  /YApi.*(完全没给|缺失|未提供)/i,
  /(模块名|module).*?(拼写|不存在|找不到)/i,
  /(schema|精修|validate).*?(fail|失败|错误)/i,
  /(dev server|开发服务器|3000).*?(未启动|没起|connection)/i,
  /(e2e|页面).*?(无法打开|进不去|404|未登录)/i,
]

function flatten(input) {
  const out = []
  if (typeof input === 'string') out.push(input)
  if (Array.isArray(input)) input.forEach(x => out.push(...flatten(x)))
  if (input && typeof input === 'object') {
    for (const v of Object.values(input)) out.push(...flatten(v))
  }
  return out
}

const evt = await readStdinJson()
if (!autoModeOn()) pass()

const toolName = evt.tool_name || evt.toolName || ''
if (toolName !== 'AskUserQuestion' && toolName !== 'ExitPlanMode') pass()

const inputBlob = evt.tool_input || evt.toolInput || {}
const text = flatten(inputBlob).join(' ')

if (WHITELIST_PATTERNS.some(re => re.test(text))) pass()

block(
  `auto 模式不允许问问题。如果是必停点（MCP/git/输入缺失/schema fail/dev server/e2e 定位失败），` +
  `把对应关键词写进 question 文本即可放行。\n` +
  `当前问题文本片段: ${text.slice(0, 200)}`
)
