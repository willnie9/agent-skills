#!/usr/bin/env node
// PreToolUse on mcp__aliyun-yunxiao__create_work_item_comment:
// 读取 yunxiao-bug-fix/config/yunxiao-comment.schema.json 的 rules 数组,
// 逐条执行校验规则。任一失败 → exit 2 block。
// 改规则只动 schema 文件,不需要动本 hook。

import path from 'node:path'
import { readStdinJson, readJson, block, pass, SKILLS_ROOT } from './_lib.mjs'

const evt = await readStdinJson()
const toolName = evt.tool_name || evt.toolName || ''
if (toolName !== 'mcp__aliyun-yunxiao__create_work_item_comment') pass()

const schemaPath = path.join(SKILLS_ROOT, 'yunxiao-bug-fix', 'config', 'yunxiao-comment.schema.json')
const schema = readJson(schemaPath)
if (!schema) pass()  // schema 读不到就放行，hook 写错不卡正常工作流

const input = evt.tool_input || evt.toolInput || {}
const content = (input.content || '').trim()

if (!content) block('云效评论 content 不能为空')

// 逃生口：首行含 skipMarker 则跳过全部校验（临时发简评论用）
const skipMarker = schema.skipMarker || '[skip-template]'
if (content.split('\n')[0].includes(skipMarker)) pass()

const rules = Array.isArray(schema.rules) ? schema.rules : []
const failures = []

for (const rule of rules) {
  const result = checkRule(rule, content)
  if (!result.ok) {
    failures.push(`[${rule.id}] ${rule.name}: ${rule.hint || result.reason}`)
  }
}

if (failures.length) {
  block(
    `云效评论校验失败 (${failures.length} 条规则不通过):\n` +
    failures.map(f => `  • ${f}`).join('\n') + '\n\n' +
    `规则源: ${path.relative(process.cwd(), schemaPath)}\n` +
    `修正后重新调用 create_work_item_comment。`
  )
}

pass()

// ─── 规则执行器 ──────────────────────────────────────────────────────────────

function checkRule(rule, content) {
  switch (rule.type) {
    case 'firstLineRegex': {
      const firstLine = content.split('\n')[0] || ''
      const re = new RegExp(rule.regex, 'u')
      if (!re.test(firstLine)) {
        return { ok: false, reason: `首行格式不符，当前: "${firstLine.slice(0, 80)}"` }
      }
      return { ok: true }
    }

    case 'headerSequence': {
      const headers = rule.headers || []
      let pos = 0
      for (const header of headers) {
        const idx = content.indexOf(header, pos)
        if (idx === -1) {
          return { ok: false, reason: `缺少章节标题或顺序错误: "${header}"` }
        }
        pos = idx + header.length
      }
      return { ok: true }
    }

    case 'sectionMustHavePattern': {
      const sec = extractSection(content, rule.section)
      if (sec === null) return { ok: false, reason: `找不到章节: "${rule.section}"` }
      const re = new RegExp(rule.atLeastOneMatch, 'mu')
      if (!re.test(sec)) {
        return { ok: false, reason: `章节 "${rule.section}" 内没有符合要求的行` }
      }
      return { ok: true }
    }

    case 'sectionEachLineMatch': {
      const sec = extractSection(content, rule.section)
      if (sec === null) return { ok: false, reason: `找不到章节: "${rule.section}"` }
      const re = new RegExp(rule.linePattern, 'u')
      const badLines = sec.split('\n').filter(l => l.trim() && !re.test(l))
      if (badLines.length) {
        return { ok: false, reason: `章节 "${rule.section}" 有行格式不符: "${badLines[0].slice(0, 60)}"` }
      }
      return { ok: true }
    }

    case 'noBlacklistEmoji': {
      const whitelist = new Set(rule.whitelistEmojis || [])
      // 用 Intl.Segmenter 按字素簇切分，筛出 emoji 字符
      const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })
      const bad = []
      for (const { segment } of segmenter.segment(content)) {
        const cp = segment.codePointAt(0)
        // emoji 范围：>= 0x2300 且不是普通标点/空白
        if (cp && cp >= 0x2300 && !whitelist.has(segment)) {
          if (!bad.includes(segment)) bad.push(segment)
        }
      }
      if (bad.length) {
        return { ok: false, reason: `包含白名单外的 emoji: ${bad.join(' ')}` }
      }
      return { ok: true }
    }

    default:
      return { ok: true }  // 未知规则类型，保守放行
  }
}

// 提取从 sectionHeader 到下一个 **...**  章节标题（或文末）之间的内容
function extractSection(content, sectionHeader) {
  const start = content.indexOf(sectionHeader)
  if (start === -1) return null
  const afterHeader = start + sectionHeader.length

  // 找下一个加粗章节标题（** 开头，不含当前这个）
  const nextRe = /\*\*[^*\n]+\*\*/g
  nextRe.lastIndex = afterHeader
  let end = content.length
  let m
  while ((m = nextRe.exec(content)) !== null) {
    if (m.index > afterHeader) { end = m.index; break }
  }
  return content.slice(afterHeader, end).trim()
}
