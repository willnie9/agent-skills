#!/usr/bin/env node
// 校验 master-go-to-code Step 2 产出的 dom-tree.json 和 svg-paths.json
// 用法: node scripts/validate-dom-tree.mjs [outputDir]
// 默认 outputDir: <skill>/output;支持 MASTERGO_OUT_DIR 环境变量
// 退出码: 0=通过, 1=schema 不符, 2=文件缺失

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(__dirname, '..');
const SKILL_OUTPUT = resolve(SKILL_DIR, 'output');

const outputDir = process.argv[2] || process.env.MASTERGO_OUT_DIR || SKILL_OUTPUT;
const domTreePath = resolve(outputDir, 'dom-tree.json');
const svgPathsPath = resolve(outputDir, 'svg-paths.json');

function fail(code, msg) {
  console.error(`❌ ${msg}`);
  process.exit(code);
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}

// 1. 文件存在性
if (!existsSync(domTreePath)) fail(2, `dom-tree.json 不存在: ${domTreePath}`);
if (!existsSync(svgPathsPath)) fail(2, `svg-paths.json 不存在: ${svgPathsPath}`);
ok(`文件存在: ${domTreePath}, ${svgPathsPath}`);

// 2. JSON 可解析
let domTree, svgPaths;
try {
  domTree = JSON.parse(readFileSync(domTreePath, 'utf-8'));
  svgPaths = JSON.parse(readFileSync(svgPathsPath, 'utf-8'));
} catch (e) {
  fail(1, `JSON 解析失败: ${e.message}`);
}
ok('JSON 可解析');

// 3. dom-tree 必备字段
function validateNode(node, path = 'root') {
  if (!node.tag) return `${path}: 缺 tag`;
  if (!['div', 'span', 'img', 'svg', 'path'].includes(node.tag)) {
    return `${path}: tag 非法值 "${node.tag}"`;
  }
  if (!node.attrs) return `${path}: 缺 attrs`;
  // img src 必须用 @/assets/
  if (node.tag === 'img' && node.attrs.src && !node.attrs.src.startsWith('@/assets/')) {
    return `${path}: img src 必须以 @/assets/ 开头,当前: "${node.attrs.src}"`;
  }
  // svgRef 必须用节点 ID 格式 (支持 INSTANCE 嵌套: 父id/子id/孙id)
  // 兼容两种写法: attrs.svgRef 或 attrs['data-name'].startsWith('svgRef:')
  let svgRefVal = null;
  if (node.attrs.svgRef) svgRefVal = node.attrs.svgRef;
  else if (node.attrs['data-name']?.startsWith('svgRef:')) svgRefVal = node.attrs['data-name'].slice(7);
  if (svgRefVal) {
    // DSL 节点 ID: 数字:hex,可用 / 拼接 INSTANCE 嵌套路径
    if (!/^[0-9]+:[0-9a-fA-F]+(\/[0-9]+:[0-9a-fA-F]+)*$/.test(svgRefVal)) {
      return `${path}: svgRef 必须用 DSL 节点 ID 格式(如 138:046264 或 79:67262/69:56514/59:78936),当前: "${svgRefVal}"`;
    }
    if (!svgPaths[svgRefVal]) {
      return `${path}: svgRef "${svgRefVal}" 在 svg-paths.json 中找不到对应数据`;
    }
  }
  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      const err = validateNode(node.children[i], `${path}.children[${i}]`);
      if (err) return err;
    }
  }
  return null;
}

const treeErr = validateNode(domTree);
if (treeErr) fail(1, `dom-tree.json 校验失败: ${treeErr}`);
ok('dom-tree.json 结构合法');

// 4. svg-paths 节点 ID 格式
for (const key of Object.keys(svgPaths)) {
  if (!/^[0-9]+:[0-9a-fA-F]+(\/[0-9]+:[0-9a-fA-F]+)*$/.test(key)) {
    fail(1, `svg-paths.json key "${key}" 不是合法 DSL 节点 ID(应为 数字:hex,可用 / 拼接 INSTANCE 嵌套路径)`);
  }
  const paths = svgPaths[key];
  if (!Array.isArray(paths)) fail(1, `svg-paths["${key}"] 应为数组`);
  for (const p of paths) {
    if (!p.data) fail(1, `svg-paths["${key}"] 缺 data 字段`);
  }
}
ok(`svg-paths.json 含 ${Object.keys(svgPaths).length} 个节点`);

// 5. 反向引用检查:svg-paths 中的 key 是否都在 dom-tree 里被引用
const referenced = new Set();
function collectRefs(node) {
  if (node.attrs?.svgRef) {
    referenced.add(node.attrs.svgRef);
  } else if (node.attrs?.['data-name']?.startsWith('svgRef:')) {
    referenced.add(node.attrs['data-name'].slice(7));
  }
  if (node.children) node.children.forEach(collectRefs);
}
collectRefs(domTree);

const unused = Object.keys(svgPaths).filter(k => !referenced.has(k));
if (unused.length > 0) {
  console.warn(`⚠️  svg-paths.json 含 ${unused.length} 个未被引用的节点: ${unused.slice(0, 5).join(', ')}${unused.length > 5 ? '...' : ''}`);
}

ok(`所有校验通过 (引用 ${referenced.size}/${Object.keys(svgPaths).length} 个 SVG)`);
process.exit(0);
