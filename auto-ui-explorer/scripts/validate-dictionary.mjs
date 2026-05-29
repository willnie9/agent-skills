#!/usr/bin/env node
/**
 * validate-dictionary.mjs
 * Step 1 产物校验脚本。校验 ui-dictionary.json 是否符合 schemas/ui-dictionary.schema.json。
 *
 * 用法: node validate-dictionary.mjs <path-to-ui-dictionary.json>
 * 退出码: 0=通过  1=失败(schema不符)  2=文件不存在
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [,, dictPath] = process.argv;

if (!dictPath) {
  console.error('Usage: node validate-dictionary.mjs <path-to-ui-dictionary.json>');
  process.exit(2);
}

if (!fs.existsSync(dictPath)) {
  console.error(`❌ File not found: ${dictPath}`);
  process.exit(2);
}

const schemaPath = path.join(__dirname, '../schemas/ui-dictionary.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
const dict = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));

const errors = [];

// 检查必填字段
for (const field of schema.required) {
  if (!(field in dict)) {
    errors.push(`缺失必填字段: ${field}`);
  }
}

// 检查 routesAndFiles 非空
if (Array.isArray(dict.routesAndFiles) && dict.routesAndFiles.length === 0) {
  errors.push('routesAndFiles 为空数组，扫描没有找到任何 Vue 文件');
}

// 检查 buttons 结构
if (Array.isArray(dict.buttons)) {
  dict.buttons.forEach((btn, i) => {
    if (!btn.source) errors.push(`buttons[${i}] 缺失 source`);
    if (!btn.action) errors.push(`buttons[${i}] 缺失 action`);
    if (!btn.eventBinding) errors.push(`buttons[${i}] 缺失 eventBinding`);
  });
}

// 检查 dialogs 结构
if (Array.isArray(dict.dialogs)) {
  dict.dialogs.forEach((dlg, i) => {
    if (!dlg.source) errors.push(`dialogs[${i}] 缺失 source`);
    if (!dlg.tag) errors.push(`dialogs[${i}] 缺失 tag`);
    if (typeof dlg.isDynamicTitle !== 'boolean') errors.push(`dialogs[${i}] isDynamicTitle 不是 boolean`);
  });
}

// 检查 formInputs 结构
if (Array.isArray(dict.formInputs)) {
  dict.formInputs.forEach((input, i) => {
    if (!input.source) errors.push(`formInputs[${i}] 缺失 source`);
    if (!input.label) errors.push(`formInputs[${i}] 缺失 label`);
  });
}

// 检查 routerPushCalls 结构
if (Array.isArray(dict.routerPushCalls)) {
  dict.routerPushCalls.forEach((rpc, i) => {
    if (!rpc.source) errors.push(`routerPushCalls[${i}] 缺失 source`);
    if (!['push', 'replace'].includes(rpc.method)) errors.push(`routerPushCalls[${i}] method 不是 push/replace`);
  });
}

// 输出结果
if (errors.length === 0) {
  console.log(`✅ UI Dictionary 校验通过`);
  console.log(`   routesAndFiles: ${dict.routesAndFiles.length}`);
  console.log(`   noiseFiltered:  ${dict.noiseFilesFiltered.length}`);
  console.log(`   buttons:        ${dict.buttons.length}`);
  console.log(`   dialogs:        ${dict.dialogs.length}`);
  console.log(`   formInputs:     ${dict.formInputs.length}`);
  console.log(`   routerPush:     ${dict.routerPushCalls.length}`);
  console.log(`   formRules:      ${dict.formRules.length}`);
  process.exit(0);
} else {
  console.error(`❌ UI Dictionary 校验失败 (${errors.length} 个错误):`);
  errors.forEach(e => console.error(`   - ${e}`));
  process.exit(1);
}
