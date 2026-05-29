#!/usr/bin/env node
/**
 * validate-flow-plan.mjs
 * Step 2.6 产物校验脚本。校验 E2E-FLOW-PLAN.md 的完整性和正确性。
 *
 * 用法: node validate-flow-plan.mjs <path-to-E2E-FLOW-PLAN.md> [--dict=<path-to-ui-dictionary.json>]
 * 退出码: 0=通过  1=有警告但可继续  2=严重错误(缺 SP/Flow/覆盖不足)
 */
import fs from 'fs';

const args = process.argv.slice(2);
const planPath = args.find(a => !a.startsWith('--'));
const dictArg = args.find(a => a.startsWith('--dict='));
const dictPath = dictArg ? dictArg.split('=')[1] : null;

if (!planPath) {
  console.error('Usage: node validate-flow-plan.mjs <E2E-FLOW-PLAN.md> [--dict=<ui-dictionary.json>]');
  process.exit(2);
}

if (!fs.existsSync(planPath)) {
  console.error(`❌ File not found: ${planPath}`);
  process.exit(2);
}

const content = fs.readFileSync(planPath, 'utf-8');
const errors = [];
const warnings = [];

// ── 1. 提取所有 SP 编号 ──
const spRegex = /### (SP-\d+)/g;
const spIds = [];
let m;
while ((m = spRegex.exec(content)) !== null) {
  spIds.push(m[1]);
}

if (spIds.length === 0) {
  errors.push('未找到任何 SP 用例（格式应为 ### SP-001: ...）');
}

// ── 2. 提取所有 Flow ──
const flowRegex = /### (Flow-\d+)/g;
const flowIds = [];
while ((m = flowRegex.exec(content)) !== null) {
  flowIds.push(m[1]);
}

if (flowIds.length === 0) {
  errors.push('未找到任何 Flow 集成流程（格式应为 ### Flow-001: ...）');
}

// ── 3. 检查 Flow 中引用的 SP 编号是否都存在 ──
const spRefRegex = /执行 (SP-\d+)/g;
const referencedSPs = new Set();
while ((m = spRefRegex.exec(content)) !== null) {
  referencedSPs.add(m[1]);
  if (!spIds.includes(m[1])) {
    errors.push(`Flow 引用了不存在的 ${m[1]}`);
  }
}

// ── 4. 检查是否有 SP 没被任何 Flow 引用 ──
const unreferencedSPs = spIds.filter(sp => !referencedSPs.has(sp));
if (unreferencedSPs.length > 0) {
  warnings.push(`以下 SP 未被任何 Flow 引用: ${unreferencedSPs.join(', ')}`);
}

// ── 5. 检查每个 Flow 末尾是否有重置 ──
const flowBlocks = content.split(/### Flow-\d+/).slice(1);
flowBlocks.forEach((block, i) => {
  if (!block.includes('browser_navigate') && !block.includes('重置')) {
    warnings.push(`Flow-${String(i + 1).padStart(3, '0')} 末尾没有 browser_navigate 重置到初始路由`);
  }
});

// ── 6. 检查是否有空值拦截测试 ──
const fuzzCount = (content.match(/空值拦截|空值提交|Fuzzing|先不填任何字段/g) || []).length;
if (fuzzCount === 0) {
  errors.push('未找到任何空值拦截测试（含表单的弹窗必须有空提交截图）');
}

// ── 7. 检查覆盖率自检章节 ──
if (!content.includes('覆盖率自检')) {
  warnings.push('缺少"覆盖率自检"章节');
}

// ── 8. 检查路由拓扑章节 ──
if (!content.includes('路由拓扑')) {
  warnings.push('缺少"路由拓扑"章节');
}

// ── 9. 如果提供了词典，交叉校验页面覆盖率 ──
if (dictPath && fs.existsSync(dictPath)) {
  const dict = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));
  // 提取词典中的主页面文件（index.vue）
  const mainPages = dict.routesAndFiles.filter(f => f.endsWith('index.vue'));
  mainPages.forEach(page => {
    const basename = page.split('/').slice(-2).join('/');
    if (!content.includes(basename.replace('/index.vue', '')) && !content.includes(basename)) {
      warnings.push(`词典中的页面 ${basename} 未在 Flow Plan 中出现`);
    }
  });

  // 检查弹窗覆盖
  const dialogTitles = dict.dialogs.map(d => d.title).filter(t => t !== 'Dynamic Title');
  const uncoveredDialogs = dialogTitles.filter(t => !content.includes(t));
  if (uncoveredDialogs.length > 0) {
    warnings.push(`以下弹窗标题未在 Flow Plan 中提及: ${uncoveredDialogs.join(', ')}`);
  }
}

// ── 输出 ──
console.log(`\n📋 Flow Plan 校验报告`);
console.log(`   SP 用例数:  ${spIds.length}`);
console.log(`   Flow 流程数: ${flowIds.length}`);
console.log(`   空值拦截数:  ${fuzzCount}`);
console.log(`   被 Flow 引用的 SP: ${referencedSPs.size}/${spIds.length}`);

if (errors.length > 0) {
  console.error(`\n❌ 严重错误 (${errors.length}):`);
  errors.forEach(e => console.error(`   🔴 ${e}`));
}

if (warnings.length > 0) {
  console.warn(`\n⚠️ 警告 (${warnings.length}):`);
  warnings.forEach(w => console.warn(`   🟡 ${w}`));
}

if (errors.length === 0 && warnings.length === 0) {
  console.log(`\n✅ Flow Plan 校验全部通过`);
}

process.exit(errors.length > 0 ? 2 : warnings.length > 0 ? 1 : 0);
