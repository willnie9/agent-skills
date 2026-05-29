#!/usr/bin/env node
// 从 dom-tree.json 提取所有图片引用清单
//
// 用法:
//   node extract-image-names.mjs [path/to/dom-tree.json]
//   默认路径: <skill>/output/dom-tree.json (支持 MASTERGO_OUT_DIR 环境变量)
//
// 输出 JSON:
//   { count: N, images: [{ src, dataName, parentName }] }
//
// 用途:Stage C 组装 Vue 前确认所有图片是否在 imgDir 中已下载

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_OUTPUT = resolve(__dirname, '..', 'output');
const defaultOutDir = process.env.MASTERGO_OUT_DIR || SKILL_OUTPUT;
const domTreePath = process.argv[2] || join(defaultOutDir, 'dom-tree.json');
if (!existsSync(domTreePath)) {
  console.error(`❌ ${domTreePath} 不存在`);
  process.exit(2);
}

const tree = JSON.parse(readFileSync(domTreePath, 'utf-8'));

const images = [];
function walk(node, parentName = 'root') {
  if (node.tag === 'img' && node.attrs?.src) {
    images.push({
      src: node.attrs.src,
      dataName: node.attrs['data-name'] || '',
      parentName,
    });
  }
  if (node.children) {
    const currentName = node.attrs?.['data-name'] || node.tag;
    node.children.forEach(c => walk(c, currentName));
  }
}
walk(tree);

console.log(JSON.stringify({ count: images.length, images }, null, 2));

// 额外:校验所有 src 都以 @/assets/ 开头
const bad = images.filter(i => !i.src.startsWith('@/assets/'));
if (bad.length > 0) {
  console.error(`\n❌ ${bad.length} 个图片 src 不符合 @/assets/ 规范:`);
  bad.forEach(b => console.error(`  - ${b.src} (in ${b.parentName})`));
  process.exit(1);
}

process.exit(0);
