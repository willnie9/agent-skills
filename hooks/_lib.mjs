// 公用工具：从 stdin 读 hook 事件 JSON、判断 auto-mode flag、读 schema、按规则放行/拦截。
// 设计原则：所有 hook 默认放行（exit 0）、规则不匹配也放行；只有命中拦截规则才 exit 2。
// 这样即使 hook 写错了也不会卡住正常工作流。

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

// 优先用 Claude Code 注入的 CLAUDE_PROJECT_DIR；没有就回退到脚本自身所在目录的祖先（.claude 的父级）。
// 不能依赖 cwd，因为 hook 触发时 cwd 可能在子目录。
function resolveProjectRoot() {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR
  const here = path.dirname(fileURLToPath(import.meta.url))   // .claude/hooks
  return path.resolve(here, '..', '..')                        // 项目根
}

export const PROJECT_ROOT = resolveProjectRoot()
export const SKILLS_ROOT = path.join(PROJECT_ROOT, '.claude', 'skills')
export const STATE_DIR = path.join(PROJECT_ROOT, '.claude', 'state')
export const RESULTS_ROOT = path.join(PROJECT_ROOT, '.claude', 'results')

export async function readStdinJson() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf-8').trim()
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return { _rawStdin: raw } }
}

export function autoModeOn() {
  return fs.existsSync(path.join(STATE_DIR, 'auto-mode.flag'))
}

export function block(reason) {
  process.stderr.write(`[hook block] ${reason}\n`)
  process.exit(2)
}

export function pass() {
  process.exit(0)
}

export function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) } catch { return null }
}

export function fileExists(p) {
  try { return fs.statSync(p).isFile() } catch { return false }
}
