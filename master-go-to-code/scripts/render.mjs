#!/usr/bin/env node
/**
 * ⚠️ 可选调试工具(非主流程)
 * 用途: dom-tree.json + svg-paths.json + images/ → preview.html
 *
 * 为啥不在主流程: AI 识图准确率 ~50%,设计稿像素级精度机器达不到。
 *                 主流程靠 validate-dom-tree(schema) + compare-tokens(DSL diff) 保证质量。
 *                 preview.html 仅作为 compare-tokens 报关键漏写时,人工诊断"哪里渲染错了"的工具。
 *
 * 用法: node .claude/skills/master-go-to-code/scripts/render.mjs [outDir]
 * 输出: <MASTERGO_OUT_DIR 或 outDir 参数 或 <skill>/output>/preview.html
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_OUTPUT = path.resolve(__dirname, '..', 'output');
// 产物目录:env > 命令行参数 > skill output
const outDir = process.env.MASTERGO_OUT_DIR || process.argv[2] || SKILL_OUTPUT;
const tree = JSON.parse(fs.readFileSync(path.join(outDir, 'dom-tree.json'), 'utf8'));

// svg-paths.json 可能不存在（没有 SVG 的页面）
let svgPaths = {};
const svgFile = path.join(outDir, 'svg-paths.json');
if (fs.existsSync(svgFile)) {
  svgPaths = JSON.parse(fs.readFileSync(svgFile, 'utf8'));
}

// 默认模式检测: svg-as-png/ 存在 → 图标已转 PNG,不注入 SVG
const isDefaultMode = fs.existsSync(path.join(outDir, 'svg-as-png'));

// 图片本地化映射：CDN URL → 本地相对路径
const imgDir = path.join(outDir, 'images');
const localImages = {};
if (fs.existsSync(imgDir)) {
  for (const f of fs.readdirSync(imgDir)) {
    // key = 文件名（CDN URL 的最后一段）
    localImages[f] = `images/${f}`;
  }
}

const svgAsPngDir = path.join(outDir, 'svg-as-png');
if (fs.existsSync(svgAsPngDir)) {
  for (const f of fs.readdirSync(svgAsPngDir)) {
    localImages[f] = `svg-as-png/${f}`;
  }
}

function localizeImgSrc(src) {
  if (!src) return src;
  const filename = src.split('/').pop();
  return localImages[filename] || src;
}

function escAttr(v) {
  return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function styleToStr(style) {
  if (!style || typeof style !== 'object') return '';
  return Object.entries(style).map(([k, v]) => {
    // preview 用系统字体,避免自定义字体未安装导致中文乱码
    if (k === 'font-family') {
      v = "'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', sans-serif";
    }
    return `${k}: ${v}`;
  }).join('; ');
}

/**
 * 解析 CSS linear-gradient 为 SVG <linearGradient>
 * 输入: "linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 108%)"
 * 返回: { id, def } 或 null
 */
let gradCounter = 0;
function parseCssGradient(cssGrad) {
  const m = cssGrad.match(/^linear-gradient\(([^,]+),\s*(.+)\)$/);
  if (!m) return null;
  const angle = parseFloat(m[1]) || 0;
  // CSS 角度 → SVG 坐标: 180deg = top→bottom (x1=0,y1=0,x2=0,y2=1)
  const rad = ((angle - 90) * Math.PI) / 180;
  const x2 = (Math.cos(rad) * 0.5 + 0.5).toFixed(2);
  const y2 = (Math.sin(rad) * 0.5 + 0.5).toFixed(2);
  const x1 = (1 - x2).toFixed(2);
  const y1 = (1 - y2).toFixed(2);

  // 解析 stops: "rgba(...) 0%, rgba(...) 108%"
  const stopsStr = m[2];
  const stops = [];
  const stopRe = /(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s+([\d.]+%)/g;
  let sm;
  while ((sm = stopRe.exec(stopsStr)) !== null) {
    stops.push({ color: sm[1], offset: sm[2] });
  }
  if (stops.length === 0) return null;

  const id = `grad${++gradCounter}`;
  const stopTags = stops.map(s => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join('');
  const def = `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopTags}</linearGradient>`;
  return { id, def };
}

/**
 * 将 svg-paths.json 中的 path 数据渲染为 <svg> HTML
 * pathData 是数组: [{ data, fill, windingRule }, ...]
 */
function renderSvgFromPaths(pathData, width, height) {
  const w = parseInt(width) || 24;
  const h = parseInt(height) || 24;
  const defs = [];
  const paths = pathData.map(p => {
    let fill = p.fill || '#333';
    const d = p.data || p.d || '';
    const rule = p.windingRule === 'EVENODD' ? ' fill-rule="evenodd"' : '';

    // 渐变 fill → SVG linearGradient
    if (fill.includes('linear-gradient')) {
      const grad = parseCssGradient(fill);
      if (grad) {
        defs.push(grad.def);
        fill = `url(#${grad.id})`;
      }
    }

    return `<path d="${escAttr(d)}" fill="${fill}"${rule}/>`;
  }).join('');
  const defsBlock = defs.length > 0 ? `<defs>${defs.join('')}</defs>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${defsBlock}${paths}</svg>`;
}

function renderNode(node, indent = 2) {
  const pad = ' '.repeat(indent);
  const tag = node.tag || 'div';
  const attrs = { ...(node.attrs || {}) };
  const style = { ...(node.style || {}) };

  // ── svgRef 处理 ──
  // 默认模式(svg-as-png/ 存在): 图标已转 PNG,跳过 SVG 注入,渲染为空占位 div
  // --keep-svg 模式: 注入内联 SVG
  let refKey = null;
  if (attrs.svgRef) refKey = attrs.svgRef;
  else if ((attrs['data-name'] || '').startsWith('svgRef:')) refKey = attrs['data-name'].slice(7);
  if (refKey) {
    if (isDefaultMode) {
      // 默认模式: 不注入 SVG,渲染为空 div(PNG 应在 img 标签里)
      const divStyle = styleToStr(style);
      return `${pad}<div data-name="icon-placeholder"${divStyle ? ` style="${divStyle}"` : ''}></div>`;
    }
    const pathData = svgPaths[refKey];
    if (pathData && Array.isArray(pathData)) {
      const w = style.width || '24px';
      const h = style.height || '24px';
      const svgHtml = renderSvgFromPaths(pathData, w, h);
      style['overflow'] = 'hidden';
      const divStyle = styleToStr(style);
      return `${pad}<div${divStyle ? ` style="${divStyle}"` : ''}>${svgHtml}</div>`;
    }
  }

  // ── img 标签:本地化图片路径 ──
  if (tag === 'img' && attrs.src) {
    attrs.src = localizeImgSrc(attrs.src);
  }

  // ── 构建属性字符串(剔除非 HTML 标准属性,只保留 src 等) ──
  const parts = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'style' || k === 'svgRef') continue;
    parts.push(`${k}="${escAttr(v)}"`);
  }
  const styleStr = styleToStr(style);
  if (styleStr) parts.push(`style="${styleStr}"`);
  const attrStr = parts.join(' ');
  const open = attrStr ? `<${tag} ${attrStr}>` : `<${tag}>`;

  // ── 自闭合 img ──
  if (tag === 'img') {
    return `${pad}${attrStr ? `<img ${attrStr} />` : '<img />'}`;
  }

  // ── 文本节点 ──
  if (node.text != null) {
    return `${pad}${open}${node.text}</${tag}>`;
  }

  // ── 子节点 ──
  const children = node.children || [];
  if (children.length === 0) {
    return `${pad}${open}</${tag}>`;
  }
  const inner = children.map(c => renderNode(c, indent + 2)).join('\n');
  return `${pad}${open}\n${inner}\n${pad}</${tag}>`;
}

// ── 扫描 dom-tree 中用到的字体 ──
const usedFonts = new Set();
function collectFonts(n) {
  const ff = n.style?.['font-family'];
  if (ff) {
    // 提取第一个字体名(去掉 fallback)
    const primary = ff.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
    if (primary) usedFonts.add(primary);
  }
  (n.children || []).forEach(collectFonts);
}
collectFonts(tree);

// 字体 → 本地系统字体映射(CDN woff2 缺 CJK 子集会乱码,用 local() 更可靠)
const fontLocalMap = {
  'PingFang SC': ['PingFang SC', 'Microsoft YaHei', 'SimHei'],
  'PingFangSC-Regular': ['PingFang SC', 'Microsoft YaHei', 'SimHei'],
  'AlibabaPuHuiTi': ['PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', 'SimHei'],
  'Inter': ['Inter', '-apple-system', 'BlinkMacSystemFont'],
  'Roboto': ['Roboto', '-apple-system', 'BlinkMacSystemFont'],
  'Arial': null, // 系统自带
};

// 生成 @font-face: 自定义字体名 → local() 系统字体
let fontLinks = '';
let fontFaces = '';
for (const font of usedFonts) {
  const locals = fontLocalMap[font];
  if (locals === null || locals === undefined) continue;
  const srcList = locals.map(l => `local('${l}')`).join(', ');
  fontFaces += `\n    @font-face { font-family: '${font}'; src: ${srcList}; }`;
}

// ── 生成 HTML ──
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>设计稿预览</title>${fontLinks}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { display: flex; justify-content: center; background: #f0f0f0; padding: 20px; }
    img { display: block; }${fontFaces}
  </style>
</head>
<body>
${renderNode(tree)}
</body>
</html>`;

const outFile = path.join(outDir, 'preview.html');
fs.writeFileSync(outFile, html, 'utf8');

// 统计(兼容 data-name='svgRef:xxx' 和 attrs.svgRef 两种写法)
const svgRefCount = (() => {
  let count = 0;
  function walk(n) {
    const dn = n.attrs?.['data-name'] || '';
    const sr = n.attrs?.svgRef;
    if (sr && svgPaths[sr]) count++;
    else if (dn.startsWith('svgRef:')) {
      const key = dn.replace('svgRef:', '');
      if (svgPaths[key]) count++;
    }
    (n.children || []).forEach(walk);
  }
  walk(tree);
  return count;
})();

console.log(`✅ ${outFile} 已生成`);
console.log(`   SVG 注入: ${svgRefCount} 个`);
console.log(`   字体加载: ${usedFonts.size} 个 (${[...usedFonts].join(', ')})`);
console.log(`   图片本地化: ${Object.keys(localImages).length} 张`);

