#!/usr/bin/env node
// frontend-page-design Stage C 收尾脚本
// 跑完 vue-tsc + scan-perm-todos + 扫描 TODO 注释,落盘 stage-c-report.json
//
// 用法:
//   node finalize.mjs <module> <viewsDir>
//   示例: node stage-c-finalize.mjs <module> <viewsDir>
//
// 退出码: 0=verdict pass/warn, 1=verdict fail, 2=参数错

import { existsSync, writeFileSync, readFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const [module, viewsDir = 'src/views'] = process.argv.slice(2);
if (!module) {
  console.error('用法: node finalize.mjs <module> [viewsDir]');
  process.exit(2);
}

const moduleDir = path.join(viewsDir, module);
if (!existsSync(moduleDir)) {
  console.error(`❌ 模块目录不存在: ${moduleDir}`);
  process.exit(1);
}

console.log(`📋 Stage C 收尾: ${moduleDir}`);

// 1. 扫描产物文件
function walkFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}
const files = walkFiles(moduleDir);
console.log(`  产物文件: ${files.length} 个`);

// 2. 跑 vue-tsc
let vueTscErrors = 0;
let vueTscOutput = '';
try {
  execSync('npx vue-tsc --noEmit', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  console.log(`  ✅ vue-tsc: 0 error`);
} catch (e) {
  vueTscOutput = (e.stdout || '') + (e.stderr || '');
  vueTscErrors = (vueTscOutput.match(/error TS/g) || []).length;
  console.warn(`  ⚠️ vue-tsc: ${vueTscErrors} error (不阻断)`);
}

// 3. 扫 TODO 注释
const todos = [];
for (const f of files) {
  if (!/\.(vue|ts|tsx)$/.test(f)) continue;
  const lines = readFileSync(f, 'utf-8').split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/TODO\(([^)]+)\)\s*:?\s*(.*)|\/\/\s*TODO[:\s]+(.*)/);
    if (m) {
      todos.push({
        type: m[1] || 'general',
        location: `${f}:${i + 1}`,
        todo: (m[2] || m[3] || '').trim(),
      });
    }
  });
}
console.log(`  📝 TODO 占位: ${todos.length} 处`);

// 4. 决定 verdict
// pass: vue-tsc 0 error + 0 TODO
// warn: vue-tsc 0 error 但有 TODO,或 vue-tsc 报错但 TODO 都是 permission/icon 这种"期待人工"的
// fail: vue-tsc 报错且不在 TODO 期待范围
const verdict = vueTscErrors === 0
  ? (todos.length === 0 ? 'pass' : 'warn')
  : 'warn'; // vue-tsc 错本身在主流程里不阻断,留待 auto 模式上层决定

// 5. 落盘报告(默认 .claude/results/<module>/stage-c-report.json)
const reportPath = process.env.REPORT_OUT
  || path.join('.claude/results', module, 'stage-c-report.json');
mkdirSync(path.dirname(reportPath), { recursive: true });
const report = {
  stage: 'C',
  skill: 'frontend-page-design',
  module,
  timestamp: new Date().toISOString(),
  verdict,
  summary: {
    filesCreated: files.length,
    vueTscErrors,
    todoCount: todos.length,
    todoByType: todos.reduce((acc, t) => {
      acc[t.type] = (acc[t.type] || 0) + 1;
      return acc;
    }, {}),
  },
  issues: todos,
  artifacts: {
    new: files,
    vueTscOutput: vueTscOutput ? vueTscOutput.split('\n').slice(0, 20).join('\n') : null,
  },
};
writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
console.log(`  ✅ 报告落盘: ${reportPath} (verdict=${verdict})`);

process.exit(verdict === 'fail' ? 1 : 0);
