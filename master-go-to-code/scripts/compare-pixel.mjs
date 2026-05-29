#!/usr/bin/env node
// ⚠️ 可选脚本(默认不集成进 SKILL.md 主流程)
// 用途: 像素级对比 baseline.png vs actual.png
// 现状: 识图能力只能到 ~50% 还原度,信号噪声大,默认不用 —— 走 compare-tokens.mjs 语义级 DSL diff 就够
// 启用: cd .claude/skills/master-go-to-code && npm install pixelmatch pngjs
// 用法: node compare-pixel.mjs <baseline.png> <actual.png> [--threshold=0.1] [--target=95]

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('用法: node compare-pixel.mjs <baseline.png> <actual.png> [--threshold=0.1] [--target=95]');
  process.exit(1);
}

const [baselinePath, actualPath] = args;
const opts = Object.fromEntries(
  args.filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);
const threshold = parseFloat(opts.threshold ?? '0.1');
const target = parseFloat(opts.target ?? '95');

if (!fs.existsSync(baselinePath)) {
  console.error(`❌ baseline 不存在: ${baselinePath}`);
  process.exit(1);
}
if (!fs.existsSync(actualPath)) {
  console.error(`❌ actual 不存在: ${actualPath}`);
  process.exit(1);
}

const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
const actual = PNG.sync.read(fs.readFileSync(actualPath));

console.log(`📐 baseline: ${baseline.width}×${baseline.height}`);
console.log(`📐 actual:   ${actual.width}×${actual.height}`);

// 尺寸不一致 → 裁剪到公共最小尺寸
const W = Math.min(baseline.width, actual.width);
const H = Math.min(baseline.height, actual.height);
if (baseline.width !== actual.width || baseline.height !== actual.height) {
  console.log(`⚠️  尺寸不一致,裁剪到 ${W}×${H} 对比`);
}

// 裁剪辅助函数
function crop(png, w, h) {
  if (png.width === w && png.height === h) return png;
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (png.width * y + x) << 2;
      const dstIdx = (w * y + x) << 2;
      out.data[dstIdx] = png.data[srcIdx];
      out.data[dstIdx + 1] = png.data[srcIdx + 1];
      out.data[dstIdx + 2] = png.data[srcIdx + 2];
      out.data[dstIdx + 3] = png.data[srcIdx + 3];
    }
  }
  return out;
}

const b = crop(baseline, W, H);
const a = crop(actual, W, H);

const diff = new PNG({ width: W, height: H });
const diffPixels = pixelmatch(b.data, a.data, diff.data, W, H, {
  threshold,            // 0-1, 单像素颜色匹配容差
  includeAA: false,     // 忽略抗锯齿差异
  diffColor: [255, 0, 0],
  alpha: 0.3,
});

const total = W * H;
const similarity = (1 - diffPixels / total) * 100;

const diffPath = path.join(path.dirname(actualPath), 'pixel-diff.png');
fs.writeFileSync(diffPath, PNG.sync.write(diff));

console.log('\n━━━ 对比结果 ━━━');
console.log(`总像素:    ${total.toLocaleString()}`);
console.log(`差异像素:  ${diffPixels.toLocaleString()}`);
console.log(`相似度:    ${similarity.toFixed(2)}%`);
console.log(`阈值:      ${target}%`);
console.log(`diff 图:   ${diffPath}`);

if (similarity >= target) {
  console.log(`✅ 通过 (${similarity.toFixed(2)}% >= ${target}%)`);
  process.exit(0);
} else if (similarity >= target - 10) {
  console.log(`⚠️  警告 (${similarity.toFixed(2)}% < ${target}%, 但接近)`);
  process.exit(0);
} else {
  console.log(`❌ 失败 (${similarity.toFixed(2)}% << ${target}%)`);
  process.exit(2);
}
