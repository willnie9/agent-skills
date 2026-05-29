#!/usr/bin/env node
/**
 * iterate.mjs — master-go-to-code 闭环 (merge + render 部分)
 *
 * 用途: 一次性跑 merge → render, 截图必须 AI 用 mcp playwright 自己做并保存到
 *      output/screenshots/latest.png (Stop hook 校验)
 *
 * 用法: node .claude/skills/master-go-to-code/scripts/iterate.mjs
 *
 * 副作用: 仅做 merge + render, 不清 .needs-rebuild (截图后由 Stop hook 检查清掉)
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(__dirname, '..');
const OUT_DIR = process.env.MASTERGO_OUT_DIR || path.join(SKILL_DIR, 'output');

function run(cmd, label) {
  console.log(`\n▶ ${label}`);
  console.log(`  $ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

run(
  `python3 ${path.join(SKILL_DIR, 'scripts/merge-refined.py')}`,
  'Step 1/2: merge chunks → dom-tree.json'
);

run(
  `node ${path.join(SKILL_DIR, 'scripts/render.mjs')}`,
  'Step 2/2: render dom-tree → preview.html'
);

console.log(`\n✨ merge + render 完成。`);
console.log(`下一步 (必须): 用 mcp playwright 截图 file://${OUT_DIR}/preview.html`);
console.log(`              保存到 ${OUT_DIR}/screenshots/latest.png`);
console.log(`              然后 Read 该截图,看图判断问题。`);

// 渲染完成 → 解锁精修阶段
const phaseFile = path.join(OUT_DIR, '.workflow-phase');
fs.writeFileSync(phaseFile, 'refine');
console.log(`\n🔓 workflow-phase → refine (可以按需精修具体 chunk 了)`);
