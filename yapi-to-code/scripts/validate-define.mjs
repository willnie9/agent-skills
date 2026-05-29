#!/usr/bin/env node
// 校验 define.ts 是否符合项目规范
//
// 通用检查项(所有项目通用):
//   ❌ 含 `any` 类型
//   ❌ 用 `type` 替代 `interface`(对象类型必须 interface)
//   ❌ 字段名是 snake_case
//   ⚠️ enum 没配对 _MAP 对象
//
// 项目特定检查项(传 --response-wrappers=X,Y 才启用):
//   ❌ 响应类型未用项目主流响应壳泛型
//
// 用法:
//   node validate-define.mjs <path-to-define.ts>
//   node validate-define.mjs <path-to-define.ts> --response-wrappers=CommonResponse,CommonDataResponse
//
// 退出码: 0=通过, 1=有错, 2=参数错

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const definePath = args.find(a => !a.startsWith('--'));
const responseWrappersArg = args.find(a => a.startsWith('--response-wrappers='));
const moduleArg = args.find(a => a.startsWith('--module='));
const reportOutArg = args.find(a => a.startsWith('--report-out='));
const responseWrappers = responseWrappersArg
  ? responseWrappersArg.split('=')[1].split(',').map(s => s.trim()).filter(Boolean)
  : [];
const moduleName = moduleArg ? moduleArg.split('=')[1] : path.basename(path.dirname(definePath || '.'));

if (!definePath) {
  console.error('用法: node validate-define.mjs <path-to-define.ts> [--response-wrappers=X,Y]');
  process.exit(2);
}
if (!existsSync(definePath)) {
  console.error(`❌ 文件不存在: ${definePath}`);
  process.exit(2);
}

const code = readFileSync(definePath, 'utf-8');
const errors = [];
const warnings = [];

// 1. any
const anyMatches = code.match(/:\s*any\b/g);
if (anyMatches) errors.push(`含 ${anyMatches.length} 处 \`any\` 类型(改用 unknown 或具体类型)`);

// 2. type 替代 interface(允许泛型别名)
const typeAliases = code.matchAll(/^export type (\w+) = (.+);$/gm);
const allowedAliasPatterns = [
  /Record\b/, /Pick\b/, /Omit\b/, /Partial\b/, /Readonly\b/, /Required\b/, /Exclude\b/, /Extract\b/,
  ...responseWrappers.map(w => new RegExp(`\\b${w}\\b`)),
];
for (const m of typeAliases) {
  const [, name, value] = m;
  if (allowedAliasPatterns.some(p => p.test(value))) continue;
  if (/^\{/.test(value.trim())) {
    errors.push(`type ${name} = {...} 应改为 interface(对象类型必须 interface)`);
  }
}

// 3. snake_case 字段
const snakeFields = code.matchAll(/^\s+(\w*_\w+)[\?:]/gm);
const snakeSet = new Set();
for (const m of snakeFields) snakeSet.add(m[1]);
if (snakeSet.size > 0) {
  warnings.push(`含 ${snakeSet.size} 个 snake_case 字段: ${[...snakeSet].slice(0, 5).join(', ')}${snakeSet.size > 5 ? '...' : ''} (项目用 camelCase)`);
}

// 4. 响应类型必须用项目主流响应壳(仅当传了 --response-wrappers 才检查)
if (responseWrappers.length > 0) {
  const responseAliases = code.matchAll(/^export type (\w*Response) = (.+);$/gm);
  const wrapperRe = new RegExp(`\\b(${responseWrappers.join('|')})\\b`);
  for (const m of responseAliases) {
    const [, name, value] = m;
    if (!wrapperRe.test(value)) {
      errors.push(`${name} 没用项目主流响应壳泛型(允许: ${responseWrappers.join(' / ')})`);
    }
  }
}

// 5. enum 配对 _MAP
const enums = [...code.matchAll(/^export enum (\w+)/gm)].map(m => m[1]);
for (const e of enums) {
  const expectedMap = e.replace(/([A-Z])/g, '_$1').toUpperCase().slice(1) + '_MAP';
  if (!code.includes(expectedMap)) {
    warnings.push(`enum ${e} 没配对 ${expectedMap} 对象(项目约定 enum + Map 必须成对)`);
  }
}

// 输出
console.log(`📋 校验 ${definePath}`);
if (responseWrappers.length > 0) {
  console.log(`   响应壳约束: ${responseWrappers.join(' / ')}`);
}
console.log('');

if (errors.length > 0) {
  console.error(`❌ ${errors.length} 个错误:`);
  errors.forEach(e => console.error(`  - ${e}`));
  console.log('');
}

if (warnings.length > 0) {
  console.warn(`⚠️  ${warnings.length} 个警告:`);
  warnings.forEach(w => console.warn(`  - ${w}`));
  console.log('');
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ 校验通过');
}

// ─── 落盘 stage-report(统一 verdict + 路径) ───
const reportPath = reportOutArg
  ? reportOutArg.split('=')[1]
  : path.join('.claude/results', moduleName, 'yapi-report.json');
mkdirSync(path.dirname(reportPath), { recursive: true });
const verdict = errors.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass';
const report = {
  stage: 'B',
  skill: 'yapi-to-code',
  module: moduleName,
  timestamp: new Date().toISOString(),
  verdict,
  summary: {
    errors: errors.length,
    warnings: warnings.length,
    responseWrappers: responseWrappers.length > 0 ? responseWrappers : null,
  },
  issues: [
    ...errors.map(msg => ({ type: 'api', location: definePath, todo: msg })),
    ...warnings.map(msg => ({ type: 'api', location: definePath, todo: msg })),
  ],
  artifacts: { definePath },
};
writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
console.log(`✅ 报告落盘: ${reportPath} (verdict=${verdict})`);

process.exit(errors.length > 0 ? 1 : 0);
