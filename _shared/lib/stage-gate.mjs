#!/usr/bin/env node
// 通用 Stage Gate 检查器
// 读 stage-report.json,按 verdict 决定 exit code
//
// 用法:
//   node stage-gate.mjs --report=<path> [--accept=pass,warn] [--require-artifacts=file1,file2]
//
// 参数:
//   --report             报告文件路径(必需)
//   --accept             允许通过的 verdict 列表(默认 pass,warn)
//   --require-artifacts  必须存在的产物文件路径列表(逗号分隔)
//
// 退出码:
//   0 = 报告 verdict 在 accept 列表 + 所有产物存在
//   1 = 报告文件缺失(stage 没跑或报告没产)
//   2 = verdict 不在 accept 列表(报告产了但 stage 失败)
//   3 = 产物文件缺失
//   4 = 参数错误

import fs from 'node:fs';

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, v = 'true'] = a.slice(2).split('=');
      return [k, v];
    })
);

if (!flags.report) {
  console.error('❌ 用法: node stage-gate.mjs --report=<path> [--accept=pass,warn] [--require-artifacts=file1,file2]');
  process.exit(4);
}

// 1. 报告文件存在
if (!fs.existsSync(flags.report)) {
  console.error(`❌ 报告缺失: ${flags.report}`);
  console.error(`   上游 stage 没跑完或产物没落盘。检查 stage 是否被跳过。`);
  process.exit(1);
}

// 2. 解析报告
let report;
try {
  report = JSON.parse(fs.readFileSync(flags.report, 'utf-8'));
} catch (e) {
  console.error(`❌ 报告 JSON 解析失败: ${flags.report}`);
  console.error(`   ${e.message}`);
  process.exit(1);
}

const { stage, skill, module: mod, verdict, summary = {}, issues = [] } = report;

// 3. 检查 verdict
const accept = (flags.accept || 'pass,warn').split(',').map(s => s.trim());
if (!accept.includes(verdict)) {
  console.error(`❌ Stage [${stage}] (skill=${skill}) verdict=${verdict},不在允许列表 [${accept.join(',')}]`);
  if (issues.length > 0) {
    console.error(`   问题清单(${issues.length} 项):`);
    issues.slice(0, 5).forEach((iss, i) => {
      console.error(`     ${i + 1}. [${iss.type || '?'}] ${iss.location || ''} - ${iss.todo || ''}`);
    });
    if (issues.length > 5) console.error(`     ... 还有 ${issues.length - 5} 项,详见 ${flags.report}`);
  }
  process.exit(2);
}

// 4. 检查产物文件
if (flags['require-artifacts']) {
  const required = flags['require-artifacts'].split(',').map(s => s.trim());
  const missing = required.filter(f => !fs.existsSync(f));
  if (missing.length > 0) {
    console.error(`❌ 产物缺失:`);
    missing.forEach(f => console.error(`   - ${f}`));
    process.exit(3);
  }
}

// 5. 通过
console.log(`✅ Gate 通过: stage=${stage} skill=${skill}${mod ? ' module=' + mod : ''} verdict=${verdict}`);
if (verdict === 'warn' && issues.length > 0) {
  console.log(`   ⚠️ 有 ${issues.length} 项警告(未阻断,详见 ${flags.report})`);
}
process.exit(0);
