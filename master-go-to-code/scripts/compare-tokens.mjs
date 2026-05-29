#!/usr/bin/env node
/**
 * 语义级对比 dom-tree.json (DSL 真值) vs Vue 文件 SCSS (代码实现)
 *
 * 用法:
 *   node compare-tokens.mjs <dom-tree.json> <vue-file1.vue> [vue-file2.vue ...]
 *
 * 提取的 token 类别:
 *   1. 颜色 #xxx / rgba(...)
 *   2. 字号 Npx
 *   3. 圆角 border-radius Npx
 *   4. 间距 gap/padding/margin Npx
 *   5. 边框 border 1px solid #xxx
 *   6. 字体 font-family
 *   7. 尺寸 width/height Npx
 *
 * 输出:
 *   - DSL token 清单
 *   - SCSS token 清单
 *   - DSL 有 / SCSS 没 (漏写)
 *   - SCSS 有 / DSL 没 (凭印象写的)
 *   - 语义相似度数字
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const positional = args.filter(a => !a.startsWith('--'));
const flags = Object.fromEntries(
  args.filter(a => a.startsWith('--')).map(a => {
    const [k, v = 'true'] = a.slice(2).split('=');
    return [k, v];
  })
);

if (positional.length < 2) {
  console.error('用法: node compare-tokens.mjs <dom-tree.json> <vue-file.vue> [...] [--module=<name>] [--report-out=<path>]');
  process.exit(1);
}

const [domTreePath, ...vueFiles] = positional;
const moduleName = flags.module || 'unknown';

// ─── 1. 提取 DSL token ───
const tree = JSON.parse(fs.readFileSync(domTreePath, 'utf-8'));

const dsl = {
  colors: new Set(),
  fontSizes: new Set(),
  fontFamilies: new Set(),
  borderRadii: new Set(),
  gaps: new Set(),
  paddings: new Set(),
  borders: new Set(),
  widths: new Set(),
  heights: new Set(),
};

function normalizeColor(c) {
  if (!c) return null;
  let s = String(c).trim().toLowerCase();
  if (s.startsWith('#')) {
    // 短色码归一化: #fff → #ffffff, #f00 → #ff0000
    if (s.length === 4) s = '#' + [...s.slice(1)].map((c) => c + c).join('');
    if (s.length === 5) s = '#' + [...s.slice(1)].map((c) => c + c).join(''); // 含 alpha
    return s;
  }
  if (s.startsWith('rgba') || s.startsWith('rgb')) return s.replace(/\s+/g, '');
  return null;
}

// 字体 family 归一化: 把不同 variant(Medium/Regular/Bold) 归并到同 family
function normalizeFontFamily(f) {
  if (!f) return null;
  const s = String(f).trim().replace(/['"]/g, '');
  if (/^pingfang.?sc/i.test(s)) return 'PingFang SC';
  if (/^alibaba.?puhui/i.test(s)) return 'Alibaba PuHuiTi';
  if (/^source.?han.?sans/i.test(s)) return 'Source Han Sans';
  if (/^microsoft.?yahei/i.test(s)) return 'Microsoft YaHei';
  if (/^noto/i.test(s)) return 'Noto Sans';
  return s;
}

function walkDsl(node) {
  const st = node.style || {};
  const norm = (v) => (v ? String(v).trim() : '');

  // 颜色: background / color / 边框颜色
  for (const k of ['background', 'color', 'background-color']) {
    const c = normalizeColor(st[k]);
    if (c) dsl.colors.add(c);
  }
  // 字号
  if (st['font-size']) dsl.fontSizes.add(norm(st['font-size']));
  // 字体
  if (st['font-family']) {
    const fam = normalizeFontFamily(norm(st['font-family']).split(',')[0]);
    if (fam) dsl.fontFamilies.add(fam);
  }
  // 圆角
  if (st['border-radius']) {
    const v = norm(st['border-radius']);
    // 拆出独立 N px (border-radius 可能 "8px 8px 0 0")
    v.split(/\s+/).forEach((x) => {
      if (/^\d+px$/.test(x) && x !== '0px') dsl.borderRadii.add(x);
    });
  }
  // 间距
  if (st['gap']) dsl.gaps.add(norm(st['gap']));
  if (st['padding']) {
    const v = norm(st['padding']);
    v.split(/\s+/).forEach((x) => {
      if (/^\d+px$/.test(x) && x !== '0px') dsl.paddings.add(x);
    });
  }
  // 边框
  if (st['border']) {
    const v = norm(st['border']);
    // 提取颜色
    const m = v.match(/#[0-9a-fA-F]{3,6}|rgba?\([^)]+\)/);
    if (m) dsl.colors.add(normalizeColor(m[0]));
    // 提取 border 描述
    const simplified = v.replace(/\s+/g, ' ');
    dsl.borders.add(simplified);
  }
  // 尺寸(只收 < 200 的小尺寸,大尺寸是布局容器不关心)
  if (st.width && /^\d+px$/.test(st.width)) {
    const n = parseInt(st.width);
    if (n < 300) dsl.widths.add(st.width);
  }
  if (st.height && /^\d+px$/.test(st.height)) {
    const n = parseInt(st.height);
    if (n < 100) dsl.heights.add(st.height);
  }

  for (const c of node.children || []) {
    if (typeof c === 'object') walkDsl(c);
  }
}
walkDsl(tree);

// ─── 2. 提取 SCSS token ───
const scss = {
  colors: new Set(),
  fontSizes: new Set(),
  fontFamilies: new Set(),
  borderRadii: new Set(),
  gaps: new Set(),
  paddings: new Set(),
  borders: new Set(),
  widths: new Set(),
  heights: new Set(),
};

for (const vp of vueFiles) {
  if (!fs.existsSync(vp)) {
    console.error(`⚠️  文件不存在: ${vp}`);
    continue;
  }
  const text = fs.readFileSync(vp, 'utf-8');
  // 抓 <style ...>...</style> 块(可能多个)
  const styleBlocks = [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
  const css = styleBlocks.join('\n');

  // 颜色 #xxx (归一化短码)
  [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].forEach((m) => {
    const c = normalizeColor(m[0]);
    if (c) scss.colors.add(c);
  });
  // rgba/rgb
  [...css.matchAll(/rgba?\([^)]+\)/g)].forEach((m) => scss.colors.add(m[0].replace(/\s+/g, '').toLowerCase()));

  // 字号 font-size: Npx
  [...css.matchAll(/font-size:\s*(\d+px)/g)].forEach((m) => scss.fontSizes.add(m[1]));

  // 字体(归一化, 提取所有 family,不只第一个)
  [...css.matchAll(/font-family:\s*([^;]+);/g)].forEach((m) => {
    // 拆分多个 family,逐个归一化
    m[1].split(',').forEach((part) => {
      const fam = normalizeFontFamily(part);
      if (fam && !/inherit|^var|^sans-serif$/.test(fam)) scss.fontFamilies.add(fam);
    });
  });

  // 圆角
  [...css.matchAll(/border-radius:\s*([^;]+);/g)].forEach((m) => {
    m[1].split(/\s+/).forEach((x) => {
      if (/^\d+px$/.test(x) && x !== '0px') scss.borderRadii.add(x);
    });
  });

  // 间距 gap
  [...css.matchAll(/[^-]gap:\s*(\d+px)/g)].forEach((m) => scss.gaps.add(m[1]));

  // padding
  [...css.matchAll(/padding(?:-\w+)?:\s*([^;]+);/g)].forEach((m) => {
    m[1].split(/\s+/).forEach((x) => {
      if (/^\d+px$/.test(x) && x !== '0px') scss.paddings.add(x);
    });
  });

  // border
  [...css.matchAll(/border(?:-\w+)?:\s*(\d+px\s+\w+\s+[#a-z(][\w(),.\s/]+);/gi)].forEach((m) => {
    scss.borders.add(m[1].replace(/\s+/g, ' '));
  });

  // 尺寸 width/height
  [...css.matchAll(/(?:^|\s)width:\s*(\d+px)/gm)].forEach((m) => {
    const n = parseInt(m[1]);
    if (n < 300) scss.widths.add(m[1]);
  });
  [...css.matchAll(/(?:^|\s)height:\s*(\d+px)/gm)].forEach((m) => {
    const n = parseInt(m[1]);
    if (n < 100) scss.heights.add(m[1]);
  });
}

// ─── 3. 对比 + 报告(分类 + 频次) ───
// 统计 DSL 每个 token 的使用频次(越频繁越关键)
const dslFreq = {
  colors: new Map(),
  fontSizes: new Map(),
  fontFamilies: new Map(),
  borderRadii: new Map(),
};

function countFreq(node) {
  const st = node.style || {};
  for (const k of ['background', 'color', 'background-color']) {
    const c = normalizeColor(st[k]);
    if (c) dslFreq.colors.set(c, (dslFreq.colors.get(c) || 0) + 1);
  }
  if (st['font-size']) {
    const v = String(st['font-size']).trim();
    dslFreq.fontSizes.set(v, (dslFreq.fontSizes.get(v) || 0) + 1);
  }
  if (st['font-family']) {
    const fam = normalizeFontFamily(String(st['font-family']).split(',')[0]);
    if (fam) dslFreq.fontFamilies.set(fam, (dslFreq.fontFamilies.get(fam) || 0) + 1);
  }
  if (st['border-radius']) {
    String(st['border-radius']).split(/\s+/).forEach((x) => {
      if (/^\d+px$/.test(x) && x !== '0px') {
        dslFreq.borderRadii.set(x, (dslFreq.borderRadii.get(x) || 0) + 1);
      }
    });
  }
  for (const c of node.children || []) {
    if (typeof c === 'object') countFreq(c);
  }
}
countFreq(tree);

function diff(label, dslSet, scssSet, freqMap = null, freqThreshold = 0) {
  const dslArr = [...dslSet].sort();
  const scssArr = [...scssSet].sort();

  // 用频次过滤"关键 token"
  const dslImportant = freqMap
    ? dslArr.filter((x) => (freqMap.get(x) || 0) >= freqThreshold)
    : dslArr;

  const dslOnly = dslImportant.filter((x) => !scssSet.has(x));
  const scssOnly = scssArr.filter((x) => !dslSet.has(x));
  const both = dslImportant.filter((x) => scssSet.has(x));

  console.log(`\n━━━ ${label} ━━━`);
  if (freqMap) {
    const top = [...freqMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    console.log(`  DSL 高频 token:`);
    top.forEach(([t, n]) => {
      const inScss = scssSet.has(t) ? '✅' : '❌';
      console.log(`    ${inScss} ${t.padEnd(28)} (DSL 用 ${n} 次)`);
    });
  } else {
    console.log(`  DSL: ${dslArr.join(', ') || '(空)'}`);
    console.log(`  SCSS: ${scssArr.join(', ') || '(空)'}`);
  }
  if (dslOnly.length) {
    console.log(`  🔴 关键漏写: ${dslOnly.join(', ')}`);
  }
  if (scssOnly.length) {
    console.log(`  🟡 凭印象写: ${scssOnly.join(', ')}`);
  }
  if (!dslOnly.length && !scssOnly.length && both.length) {
    console.log(`  ✅ 关键 token 完全对齐 (${both.length} 项)`);
  }

  return { dslOnly: dslOnly.length, scssOnly: scssOnly.length, both: both.length };
}

console.log(`📄 dom-tree: ${domTreePath}`);
console.log(`📄 Vue 文件 (${vueFiles.length}):`);
vueFiles.forEach((v) => console.log(`   • ${v}`));

// 关键 token: 频次 >= 阈值 才算"必须实现"
const results = [];
results.push({ name: '颜色', ...diff('颜色 (>=3 次为关键)', dsl.colors, scss.colors, dslFreq.colors, 3) });
results.push({ name: '字号', ...diff('字号 (全量)', dsl.fontSizes, scss.fontSizes, dslFreq.fontSizes, 1) });
results.push({ name: '字体', ...diff('字体 family (全量)', dsl.fontFamilies, scss.fontFamilies, dslFreq.fontFamilies, 1) });
results.push({ name: '圆角', ...diff('圆角 (>=3 次)', dsl.borderRadii, scss.borderRadii, dslFreq.borderRadii, 3) });

// gap/padding/border 不算"关键 token",只列差异给人参考
console.log(`\n━━━ gap/padding (参考,不计入关键诊断) ━━━`);
console.log(`  DSL gap: ${[...dsl.gaps].sort().join(', ')}`);
console.log(`  SCSS gap: ${[...scss.gaps].sort().join(', ')}`);
console.log(`  DSL padding: ${[...dsl.paddings].sort().join(', ')}`);
console.log(`  SCSS padding: ${[...scss.paddings].sort().join(', ')}`);

// ─── 4. 综合诊断 ───
console.log(`\n━━━ 诊断结论 ━━━`);
const totalIssues = results.reduce((s, r) => s + r.dslOnly + r.scssOnly, 0);
const keyMissing = results.reduce((s, r) => s + r.dslOnly, 0);
const byImpression = results.reduce((s, r) => s + r.scssOnly, 0);
console.log(`  关键 token 漏写: ${keyMissing} 项`);
console.log(`  凭印象 token:    ${byImpression} 项`);
console.log(`  问题总数:        ${totalIssues}`);

// ─── 5. 落盘产物锚点(统一 stage-report 格式,默认 .claude/results/<module>/) ───
const reportPath = flags['report-out'] || path.join('.claude/results', moduleName, 'token-diff-report.json');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
const verdict = totalIssues === 0 ? 'pass' : totalIssues <= 3 ? 'warn' : 'fail';
const issues = results.flatMap(r => [
  ...(r.dslOnlyList || []).map(v => ({ type: 'style', location: `${r.name}`, todo: `DSL 有 ${v} 但 SCSS 没用上,补到对应 Vue 文件` })),
  ...(r.scssOnlyList || []).map(v => ({ type: 'style', location: `${r.name}`, todo: `SCSS 用了 ${v} 但 DSL 没有,改回 DSL 真值或加注释说明` })),
]);
const report = {
  stage: 'A.recall',
  skill: 'master-go-to-code',
  module: moduleName,
  timestamp: new Date().toISOString(),
  verdict,
  summary: { keyMissing, byImpression, totalIssues, vueFilesCount: vueFiles.length },
  issues,
  artifacts: {
    domTreePath,
    vueFiles,
  },
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
console.log(`  ✅ 报告落盘: ${reportPath} (verdict=${verdict})`);

if (totalIssues === 0) {
  console.log(`\n✅ 收敛: 关键 token 全部对齐 DSL`);
  process.exit(0);
} else if (totalIssues <= 3) {
  console.log(`\n⚠️  接近收敛 (剩 ${totalIssues} 项),建议人工判断这些是否真要补`);
  process.exit(0);
} else {
  console.log(`\n❌ 还有 ${totalIssues} 项关键差异,按 🔴/🟡 改 SCSS 再跑`);
  process.exit(2);
}
