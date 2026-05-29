#!/usr/bin/env node
/**
 * 从 MasterGo API 获取 DSL，提取 SVG path 数据 + 下载图片 + SVG 转 PNG
 * 不生成 dsl-structure.json，精修由 AI 通过 MCP 直接完成
 *
 * 用法: node .claude/skills/master-go-to-code/scripts/fetch-and-parse.mjs <fileId> <layerId> [imgDir]
 * 示例: node .claude/skills/master-go-to-code/scripts/fetch-and-parse.mjs 186833490539904 74:000304
 * 示例: node .claude/skills/master-go-to-code/scripts/fetch-and-parse.mjs 186833490539904 74:000304 src/assets/images/home
 *
 * 依赖：skill 自带 node_modules (sharp/pixelmatch/pngjs)
 *       首次使用前在 skill 目录跑 npm install:
 *       cd .claude/skills/master-go-to-code && npm install
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const flags = args.filter(a => a.startsWith('--'));
const params = args.filter(a => !a.startsWith('--'));

if (params.length < 2) {
  console.log('用法: node fetch-and-parse.mjs <fileId> <layerId> [imgDir] [--keep-svg] [--icon-names=<json-file>]');
  console.log('  imgDir       : 图片下载目录(可选,例如 src/assets/images/<模块>。skill output 内部始终保留预览副本)');
  console.log('  --keep-svg   : 保留 SVG 不转 PNG(默认会转 PNG,2x 图 + 项目子目录副本)');
  console.log('  --icon-names : SVG 图标命名映射文件,见 references/svg-to-png.md');
  console.log('  示例: node fetch-and-parse.mjs 186833490539904 74:000304');
  console.log('  示例: node fetch-and-parse.mjs 186833490539904 74:000304 src/assets/images/home');
  console.log('  示例: node fetch-and-parse.mjs 186833490539904 74:000304 src/assets/images/home --icon-names=icon-names.json');
  console.log('  产物默认: <skill>/output/  (MASTERGO_OUT_DIR 可覆盖)');
  process.exit(0);
}

const fileId = params[0];
const layerId = params[1];
const imgDirArg = params[2] || null; // 可选:图片下载到指定目录
// 默认转换 SVG 为 PNG;加 --keep-svg 关掉
const svgToPng = !flags.includes('--keep-svg');
// 产物输出目录:默认 skill 自身下的 output/(跨项目复用,产物不污染项目)
// 可通过环境变量 MASTERGO_OUT_DIR 覆盖
const SKILL_OUTPUT = path.resolve(__dirname, '..', 'output');
const outDir = process.env.MASTERGO_OUT_DIR || SKILL_OUTPUT;

// 可选: --icon-names=<json-file> 传入 SVG 文件命名映射
// JSON 结构: { "idToNameMap": { "<nodeId>": "<英文名>" }, "nameMap": { "<中文名>": "<英文名>" } }
const iconNamesArg = flags.find(f => f.startsWith('--icon-names='));
const iconNamesFile = iconNamesArg ? iconNamesArg.split('=')[1] : null;

// ── 读取 token ──
const findEnvPath = () => {
  // 从脚本位置向上找 .env(skill 自带的 scripts → master-go-to-code → skills → .claude → 项目根)
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const p = path.join(dir, '.env');
    if (fs.existsSync(p)) return p;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
};

const token = (() => {
  if (process.env.MASTERGO_TOKEN) return process.env.MASTERGO_TOKEN;
  const envPath = findEnvPath();
  if (!envPath) return null;
  try {
    const envFile = fs.readFileSync(envPath, 'utf-8');
    const m = envFile.match(/MASTERGO_TOKEN=(.+)/);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
})();

if (!token) {
  console.error('❌ 缺少 MASTERGO_TOKEN(已尝试向上查找 .env 文件)');
  process.exit(1);
}

// ── Fetch DSL ──
console.log(`📡 获取 DSL: fileId=${fileId}, layerId=${layerId}`);
const url = `https://mastergo.com/mcp/dsl?fileId=${fileId}&layerId=${encodeURIComponent(layerId)}`;
const resp = await fetch(url, { headers: { 'X-MG-UserAccessToken': token } });

if (!resp.ok) {
  console.error(`❌ API 失败: ${resp.status}`);
  process.exit(1);
}

const raw = await resp.json();
const styles = raw.styles || {};
const rootNode = (raw.nodes || [])[0];
if (!rootNode) {
  console.error('❌ 无节点数据');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

// ── 清旧产物(防跨模块污染),仅清当前 outDir 下脚本会产的固定名 ──
// 保留:README.md / node_modules / 用户手动放的别的文件
// component-cache.json 保留(跨运行复用,key 含 fileId 不会污染)
const stalePaths = [
  'dom-tree.json',
  'svg-paths.json',
  'preview.html',
  'images',
  'svg-as-png',
  'chunks',
  'chunks-refined',
];
for (const name of stalePaths) {
  const p = path.join(outDir, name);
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
  }
}

// dsl.json 推迟到 walk() 跑完后落盘(因为要精简掉 SVG path data)
const dslFile = path.join(outDir, 'dsl.json');
if (fs.existsSync(dslFile)) fs.rmSync(dslFile, { force: true });

// ── 解析 paint token ──
function resolvePaint(ref) {
  if (!ref) return null;
  const s = styles[ref];
  if (!s) return ref;
  const v = s.value;
  if (Array.isArray(v)) {
    if (v[0] && typeof v[0] === 'object' && v[0].url) return v[0];
    return v[0] || null;
  }
  return v || null;
}

// ── 提取 SVG paths + 收集图片 URL ──
const svgGroups = {}; // 按 FRAME 分组的 SVG paths
const imageUrls = []; // { nodeId, url }

function walk(node, depth = 0, currentGroup = null, parentGroup = null) {
  const indent = '  '.repeat(depth);
  
  // 调试信息：显示节点类型和 ID
  if (node.type === 'PATH' || node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'INSTANCE') {
    console.log(`${indent}[${node.type}] ${node.id} ${node.name || ''}`);
  }

  let groupInfo = currentGroup;
  let newParentGroup = parentGroup;

  // 如果是包含 PATH 的 FRAME / INSTANCE，创建新的分组
  // (INSTANCE 在 MasterGo 是组件实例,常见于菜单图标——和 FRAME 一样可作为图标容器)
  if ((node.type === 'FRAME' || node.type === 'INSTANCE') && node.name && node.children) {
    const hasDirectPath = node.children.some(c => c.type === 'PATH');
    const hasNestedPath = node.children.some(c => c.children && c.children.some(cc => cc.type === 'PATH'));

    // 只有当容器直接包含 PATH 时才创建分组,如果 PATH 在更深层(如 GROUP 内),则不创建
    if (hasDirectPath && !hasNestedPath) {
      groupInfo = { id: node.id, name: node.name, paths: [], frameLayout: node.layoutStyle };
      svgGroups[node.id] = groupInfo;
    }
  }
  
  // 如果是包含 PATH 的 GROUP，创建分组（优先级高于外层 FRAME）
  if (node.type === 'GROUP' && node.children) {
    const hasDirectPath = node.children.some(c => c.type === 'PATH');
    if (hasDirectPath) {
      // 使用 GROUP 的尺寸，而不是外层 FRAME 的尺寸
      groupInfo = { id: node.id, name: node.name, paths: [], frameLayout: node.layoutStyle };
      svgGroups[node.id] = groupInfo;
      newParentGroup = node; // 记录这个 GROUP 作为父节点
    }
  }
  
  // SVG path → 添加到当前分组
  if (node.path && Array.isArray(node.path)) {
    const resolvedPaths = node.path.map((p) => {
      const resolved = { ...p };
      // 解析 fill token
      if (p.fill && styles[p.fill]) {
        const v = styles[p.fill].value;
        resolved.fill = Array.isArray(v) ? (v[0] || p.fill) : (v || p.fill);
      }
      // 保存 PATH 节点的布局信息（相对于父容器的位置）
      if (node.layoutStyle) {
        resolved.layoutStyle = node.layoutStyle;
      }
      return resolved;
    });
    
    if (groupInfo) {
      groupInfo.paths.push(...resolvedPaths);
      console.log(`${indent}  ✓ 添加到分组 ${groupInfo.name}: ${node.id} (${resolvedPaths.length} 个路径)`);
    } else {
      // 没有分组的独立 PATH，单独处理
      svgGroups[node.id] = { id: node.id, name: node.name || 'icon', paths: resolvedPaths };
      console.log(`${indent}  ✓ 独立 PATH: ${node.id} (${resolvedPaths.length} 个路径)`);
    }
  }

  // 图片 URL
  if (node.fill) {
    const bg = resolvePaint(node.fill);
    if (bg && typeof bg === 'object' && bg.url) {
      imageUrls.push({ nodeId: node.id, url: bg.url });
      console.log(`${indent}  ✓ 提取图片: ${node.id}`);
    }
  }

  // 递归处理所有子节点
  if (node.children && Array.isArray(node.children)) {
    node.children.forEach((c) => walk(c, depth + 1, groupInfo, newParentGroup));
  }
}

console.log('\n🔍 递归遍历节点树...\n');
walk(rootNode);
console.log('');

// ── 保存 SVG paths（向后兼容格式）──
const svgCount = Object.keys(svgGroups).length;
if (svgCount > 0) {
  const svgFile = path.join(outDir, 'svg-paths.json');
  // 保存时转换为旧格式：{ nodeId: [paths] }
  const svgPathsData = {};
  for (const [id, group] of Object.entries(svgGroups)) {
    svgPathsData[id] = group.paths;
  }
  fs.writeFileSync(svgFile, JSON.stringify(svgPathsData, null, 2), 'utf-8');
  console.log(`✅ SVG: ${svgFile} (${svgCount} 个图标)`);
}

// ── 落盘精简版 dsl.json(供 Claude Step 2 精修读取) ──
// 策略:SVG path data 已经在 svg-paths.json + svg-icons/*.png 里,
//      原始 dsl.json 里的 path.data/geometry 等字段是冗余噪声,精修时占 context 还可能干扰判断。
//      → 通过节点 ID 判断哪些容器/PATH 已经被处理,剥掉冗余字段,加 _svgRef 标记。
//      → 视觉精度零损失:容器 layoutStyle/effects 全保留,内部细节走 svg-paths.json / PNG 引用。
const svgGroupIds = new Set(Object.keys(svgGroups));

// ── INSTANCE 字段补全(MasterGo MCP API 返回缺陷修复)──
// 同一个 componentId 的多个 INSTANCE 在 API 返回里字段深浅不一致:
// 第一次出现的 instance 含完整字段(borderRadius / flexContainerInfo / padding 等),
// 后续 instance 只返回最简版,且 dsl.components 数组通常为空(MCP 不下发组件定义)。
// → 扫描所有 instance,按 componentId 取字段并集作为该组件的"组件级默认",
//    然后回填给字段缺失的 instance。
// 不回填的字段:实例独有(id / name / layoutStyle / children / componentInfo / componentId)。
const COMPONENT_INHERIT_FIELDS = [
  'borderRadius',
  'flexContainerInfo',
  'fill',
  'strokeColor',
  'strokeType',
  'strokeAlign',
  'strokeWidth',
  'effect',
  'opacity',
];

function collectComponentDefaults(node, defaults) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'INSTANCE' && node.componentId) {
    const cid = node.componentId;
    const def = defaults[cid] || (defaults[cid] = {});
    for (const f of COMPONENT_INHERIT_FIELDS) {
      if (def[f] === undefined && node[f] !== undefined) {
        def[f] = node[f];
      }
    }
  }
  if (Array.isArray(node.children)) {
    node.children.forEach(c => collectComponentDefaults(c, defaults));
  }
}

function fillInstanceDefaults(node, defaults) {
  if (!node || typeof node !== 'object') return node;
  if (node.type === 'INSTANCE' && node.componentId && defaults[node.componentId]) {
    const def = defaults[node.componentId];
    for (const f of COMPONENT_INHERIT_FIELDS) {
      if (node[f] === undefined && def[f] !== undefined) {
        node[f] = def[f];
      }
    }
  }
  if (Array.isArray(node.children)) {
    node.children.forEach(c => fillInstanceDefaults(c, defaults));
  }
  return node;
}

const componentDefaults = {};
collectComponentDefaults(rootNode, componentDefaults);

// ── 把所有 componentId 全部用 layerId=cid 单独拉一遍,确保字段最全 ──
// 策略:不区分图标/按钮,不做白名单,所有 componentId 都拉。
// 数据完整性优先,token/请求数后续靠缓存(component-cache.json)优化。
const allComponentIds = Object.keys(componentDefaults);
if (allComponentIds.length > 0) {
  console.log(`📡 ${allComponentIds.length} 个 componentId,逐一拉取组件定义以保字段完整...`);

  // 缓存:跨 fetch 运行复用,同 fileId+componentId 命中跳过
  const cacheFile = path.join(outDir, 'component-cache.json');
  let cache = {};
  try {
    if (fs.existsSync(cacheFile)) {
      cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    }
  } catch { cache = {}; }

  let fromCache = 0;
  let fetched = 0;
  let recovered = 0;

  for (const cid of allComponentIds) {
    const cacheKey = `${fileId}:${cid}`;
    const cached = cache[cacheKey];
    let cDef = null;
    if (cached) {
      cDef = cached;
      fromCache++;
    } else {
      const cUrl = `https://mastergo.com/mcp/dsl?fileId=${fileId}&layerId=${encodeURIComponent(cid)}`;
      try {
        const cResp = await fetch(cUrl, { headers: { 'X-MG-UserAccessToken': token } });
        if (!cResp.ok) {
          console.warn(`   ⚠️ ${cid}: ${cResp.status}`);
          continue;
        }
        const cRaw = await cResp.json();
        const cRoot = (cRaw.nodes || [])[0];
        if (!cRoot) continue;
        cDef = {};
        for (const f of COMPONENT_INHERIT_FIELDS) {
          if (cRoot[f] !== undefined) cDef[f] = cRoot[f];
        }
        cache[cacheKey] = cDef;
        fetched++;
      } catch (e) {
        console.warn(`   ⚠️ ${cid}: ${e.message}`);
        continue;
      }
    }

    // 合并到 componentDefaults:实例并集结果有的优先(更接近真实使用),组件级补缺失
    const def = componentDefaults[cid];
    let any = false;
    for (const f of COMPONENT_INHERIT_FIELDS) {
      if (def[f] === undefined && cDef[f] !== undefined) {
        def[f] = cDef[f];
        any = true;
      }
    }
    if (any) recovered++;
  }

  // 落盘缓存
  try {
    fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (e) {
    console.warn(`   ⚠️ 缓存写入失败: ${e.message}`);
  }

  console.log(`   ✅ 缓存命中 ${fromCache} / 网络拉取 ${fetched} / 字段补全 ${recovered}`);
}

fillInstanceDefaults(rootNode, componentDefaults);
const filledCount = Object.keys(componentDefaults).length;
if (filledCount > 0) {
  console.log(`🔧 INSTANCE 字段补全: 处理 ${filledCount} 个 componentId`);
}

function slimDsl(node) {
  if (!node || typeof node !== 'object') return node;

  // 是 SVG 容器(被 walk 收集进 svgGroups 的 FRAME / GROUP)
  if (node.id && svgGroupIds.has(node.id)) {
    const nonSvgChildren = (node.children || []).filter(
      c => c.type !== 'PATH' && c.type !== 'VECTOR'
    );
    if (nonSvgChildren.length === 0) {
      // 纯 SVG 容器 → 清 children + 加引用标记
      const { children, ...rest } = node;
      return { ...rest, _svgRef: node.id };
    } else {
      // 混合容器(图标 + 文字等) → 保留 children 递归处理,顺便加 _svgRef 标记
      return {
        ...node,
        _svgRef: node.id,
        children: node.children.map(slimDsl),
      };
    }
  }

  // PATH / VECTOR 节点 → 删 data / geometry 字段(留 id/type/name/layoutStyle/fills/strokes/effects)
  if (node.type === 'PATH' || node.type === 'VECTOR') {
    const { data, fillGeometry, strokeGeometry, geometry, ...rest } = node;
    return rest;
  }

  // 其他节点递归 children
  if (Array.isArray(node.children)) {
    return { ...node, children: node.children.map(slimDsl) };
  }
  return node;
}

const slimmedDsl = slimDsl(raw);
fs.writeFileSync(dslFile, JSON.stringify(slimmedDsl, null, 2), 'utf-8');
const rawSize = JSON.stringify(raw).length;
const slimSize = JSON.stringify(slimmedDsl).length;
const saved = ((1 - slimSize / rawSize) * 100).toFixed(1);
console.log(`✅ DSL(精简版): ${dslFile}  [${(rawSize/1024).toFixed(1)}KB → ${(slimSize/1024).toFixed(1)}KB,省 ${saved}%]`);

// ── 下载图片 ──
if (imageUrls.length > 0) {
  // 图片下载到两个地方：
  // 1. 始终下载到 output/images/（供 render.mjs 预览用）
  // 2. 如果指定了 imgDir，同时下载到目标目录（供 Vue 组件直接引用）
  const outputImgDir = path.join(outDir, 'images');
  fs.mkdirSync(outputImgDir, { recursive: true });
  
  const targetImgDir = imgDirArg || null;
  if (targetImgDir) {
    fs.mkdirSync(targetImgDir, { recursive: true });
    console.log(`📥 下载 ${imageUrls.length} 张图片 → ${outputImgDir} + ${targetImgDir}`);
  } else {
    console.log(`📥 下载 ${imageUrls.length} 张图片 → ${outputImgDir}`);
  }

  for (const { url } of imageUrls) {
    const filename = url.split('/').pop() || 'unknown.png';
    const outputPath = path.join(outputImgDir, filename);
    const targetPath = targetImgDir ? path.join(targetImgDir, filename) : null;
    
    // 如果两个目标都已存在，跳过
    const outputExists = fs.existsSync(outputPath);
    const targetExists = targetPath ? fs.existsSync(targetPath) : true;
    if (outputExists && targetExists) continue;
    
    try {
      const r = await fetch(url);
      if (!r.ok) {
        console.warn(`   ⚠️ 失败: ${filename} (${r.status})`);
        continue;
      }
      const buf = Buffer.from(await r.arrayBuffer());
      if (!outputExists) fs.writeFileSync(outputPath, buf);
      if (targetPath && !targetExists) fs.writeFileSync(targetPath, buf);
    } catch (e) {
      console.warn(`   ⚠️ 异常: ${filename} (${e.message})`);
    }
  }
  console.log(`✅ 图片下载完成`);
  if (targetImgDir) {
    console.log(`   项目目录: ${targetImgDir}`);
  }
}

// ── SVG 转 PNG ──
if (svgToPng && svgCount > 0) {
  console.log(`\n🎨 开始转换 SVG → PNG...`);
  
  // 动态导入 sharp（skill 自带 node_modules，与 package.json 同层于 scripts/ 上一级）
  let sharp;
  try {
    const sharpPath = path.join(__dirname, '..', 'node_modules', 'sharp', 'lib', 'index.js');
    if (!fs.existsSync(sharpPath)) {
      throw new Error('sharp 未安装');
    }
    sharp = (await import(sharpPath)).default;
  } catch (e) {
    console.error('❌ 缺少 sharp 库，请在 skill 目录安装：');
    console.error('   cd .claude/skills/master-go-to-code && npm install');
    process.exit(1);
  }
  
  const outputSvgPngDir = path.join(outDir, 'svg-as-png');
  // 清空并重新创建目录
  if (fs.existsSync(outputSvgPngDir)) {
    fs.rmSync(outputSvgPngDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outputSvgPngDir, { recursive: true });
  
  const targetSvgPngDir = imgDirArg ? path.join(imgDirArg, 'svg-icons') : null;
  if (targetSvgPngDir) {
    // 清空并重新创建目标目录
    if (fs.existsSync(targetSvgPngDir)) {
      fs.rmSync(targetSvgPngDir, { recursive: true, force: true });
    }
    fs.mkdirSync(targetSvgPngDir, { recursive: true });
  }
  
  let convertedCount = 0;
  const usedFilenames = new Map(); // 记录已使用的文件名及其计数

  // 中文/节点ID 到英文文件名的映射
  // 优先从 --icon-names=<json-file> 加载,缺省用内置示例(可能跟项目无关,建议传 --icon-names)
  let idToNameMap = {};
  let nameMap = {};
  if (iconNamesFile && fs.existsSync(iconNamesFile)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(iconNamesFile, 'utf-8'));
      idToNameMap = cfg.idToNameMap || {};
      nameMap = cfg.nameMap || {};
      console.log(`📋 加载图标命名: ${iconNamesFile} (idToName ${Object.keys(idToNameMap).length} 条 / name ${Object.keys(nameMap).length} 条)`);
    } catch (e) {
      console.warn(`⚠️  读 --icon-names 失败: ${e.message},使用默认命名(节点 ID)`);
    }
  }
  
  // 生成有意义的文件名
  function generateFilename(groupId, groupName) {
    // 优先使用 ID 映射
    if (idToNameMap[groupId]) {
      return sanitizeFilename(idToNameMap[groupId]);
    }
    // 其次使用名称映射
    if (groupName && nameMap[groupName]) {
      return sanitizeFilename(nameMap[groupName]);
    }
    // 最后用原名(去空格转小写)
    return sanitizeFilename(groupName ? groupName.replace(/\s+/g, '-').toLowerCase() : 'icon');
  }

  // 文件名安全化:替换 / \ : * ? " < > | 等文件系统不允许的字符为 -
  function sanitizeFilename(name) {
    return String(name).replace(/[\/\\:*?"<>|]/g, '-');
  }
  
  for (const [groupId, group] of Object.entries(svgGroups)) {
    const paths = group.paths;
    const groupName = group.name;
    
    try {
      // 计算所有 PATH 的边界框（使用 PATH 自己的尺寸和位置）
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      paths.forEach(p => {
        if (p.layoutStyle) {
          const { relativeX = 0, relativeY = 0, width = 0, height = 0 } = p.layoutStyle;
          minX = Math.min(minX, relativeX);
          minY = Math.min(minY, relativeY);
          maxX = Math.max(maxX, relativeX + width);
          maxY = Math.max(maxY, relativeY + height);
        }
      });
      
      // 如果没有 layoutStyle，回退到解析 path data
      if (minX === Infinity) {
        const bounds = calculateSvgBounds(paths);
        if (!bounds) {
          console.warn(`   ⚠️ 跳过 ${groupName}: 无法计算边界`);
          continue;
        }
        minX = bounds.minX;
        minY = bounds.minY;
        maxX = bounds.maxX;
        maxY = bounds.maxY;
      }
      
      const width = Math.ceil(maxX - minX);
      const height = Math.ceil(maxY - minY);
      
      // 生成完整的 SVG 字符串
      const defs = [];
      const pathElements = paths.map((p, idx) => {
        let fill = p.fill || '#000000';
        const d = p.data || p.d || '';
        
        // 计算 transform（使用相对于边界框的位置）
        let transform = '';
        if (p.layoutStyle && p.layoutStyle.relativeX !== undefined && p.layoutStyle.relativeY !== undefined) {
          const offsetX = p.layoutStyle.relativeX - minX;
          const offsetY = p.layoutStyle.relativeY - minY;
          transform = `transform="translate(${offsetX}, ${offsetY})"`;
        }
        
        // 处理 linear-gradient
        if (typeof fill === 'string' && fill.includes('linear-gradient')) {
          const gradId = `grad-${groupId.replace(/:/g, '-')}-${idx}`;
          
          // 解析渐变：linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.1) 108%)
          const match = fill.match(/linear-gradient\((\d+)deg,\s*(.+)\)/);
          if (match) {
            const angle = parseInt(match[1]);
            const stops = match[2].split(/,\s*(?=rgba|rgb|#)/);
            
            // 180deg = 垂直向下 (x1=0, y1=0, x2=0, y2=1)
            let x1 = 0, y1 = 0, x2 = 0, y2 = 1;
            if (angle === 0) { x1 = 0; y1 = 1; x2 = 0; y2 = 0; } // 向上
            else if (angle === 90) { x1 = 0; y1 = 0; x2 = 1; y2 = 0; } // 向右
            else if (angle === 180) { x1 = 0; y1 = 0; x2 = 0; y2 = 1; } // 向下
            else if (angle === 270) { x1 = 1; y1 = 0; x2 = 0; y2 = 0; } // 向左
            
            const stopElements = stops.map(stop => {
              const stopMatch = stop.match(/(rgba?\([^)]+\)|#[0-9a-fA-F]+)\s+(\d+)%/);
              if (stopMatch) {
                const color = stopMatch[1];
                const offset = stopMatch[2];
                return `<stop offset="${offset}%" stop-color="${color}" />`;
              }
              return '';
            }).filter(Boolean).join('\n        ');
            
            defs.push(`<linearGradient id="${gradId}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
        ${stopElements}
      </linearGradient>`);
            
            fill = `url(#${gradId})`;
          }
        }
        
        return `<path d="${d}" fill="${fill}" ${transform}/>`;
      }).join('\n    ');
      
      const defsBlock = defs.length > 0 ? `\n  <defs>\n    ${defs.join('\n    ')}\n  </defs>` : '';
      
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${defsBlock}
    ${pathElements}
  </svg>`;
      
      // 转换为 PNG（使用 sharp）
      let baseName = generateFilename(groupId, groupName);
      
      // 处理重名：如果文件名已存在，添加序号
      if (usedFilenames.has(baseName)) {
        const count = usedFilenames.get(baseName) + 1;
        usedFilenames.set(baseName, count);
        baseName = `${baseName}-${count}`;
      } else {
        usedFilenames.set(baseName, 1);
      }
      
      const filename = `${baseName}.png`;
      const outputPath = path.join(outputSvgPngDir, filename);
      const targetPath = targetSvgPngDir ? path.join(targetSvgPngDir, filename) : null;
      
      // 生成 2 倍图，最大宽度 400px
      const scale = 2;
      const maxWidth = 400;
      const targetWidth = Math.min(width * scale, maxWidth);
      
      const pngBuffer = await sharp(Buffer.from(svgContent))
        .resize(targetWidth, null, {
          fit: 'inside',
          withoutEnlargement: false
        })
        .png()
        .toBuffer();
      
      fs.writeFileSync(outputPath, pngBuffer);
      if (targetPath) {
        fs.writeFileSync(targetPath, pngBuffer);
      }
      
      convertedCount++;
      console.log(`   ✓ ${groupName} → ${filename} (${width}x${height} → ${targetWidth}px)`);
    } catch (e) {
      console.warn(`   ⚠️ 转换失败 ${groupName}: ${e.message}`);
    }
  }
  
  console.log(`✅ SVG → PNG 完成: ${convertedCount}/${svgCount} 个`);
  if (targetSvgPngDir) {
    console.log(`   项目目录: ${targetSvgPngDir}`);
  }
}

console.log(`\n完成。SVG: ${svgCount} 个图标, 图片: ${imageUrls.length} 张${svgToPng ? `, SVG→PNG: ${Object.keys(svgGroups).length} 个` : ''}`);

// ── 落盘 stage-a-report.json(统一 stage-report 格式) ──
const moduleArg = flags.find(f => f.startsWith('--module='));
const moduleName = moduleArg
  ? moduleArg.split('=')[1]
  : (imgDirArg ? path.basename(imgDirArg) : 'unknown');
const reportOutArg = flags.find(f => f.startsWith('--report-out='));
const reportPath = reportOutArg
  ? reportOutArg.split('=')[1]
  : path.join('.claude/results', moduleName, 'stage-a-report.json');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
const stageAReport = {
  stage: 'A',
  skill: 'master-go-to-code',
  module: moduleName,
  timestamp: new Date().toISOString(),
  verdict: 'pass',  // 拉资源到这里没失败就是 pass(失败会更早 exit)
  summary: {
    svgCount,
    imageCount: imageUrls.length,
    svgToPngCount: svgToPng ? Object.keys(svgGroups).length : 0,
    outDir,
    imgDir: imgDirArg,
  },
  issues: [],
  artifacts: {
    new: [
      path.join(outDir, 'dsl.json'),
      ...(svgCount > 0 ? [path.join(outDir, 'svg-paths.json')] : []),
    ],
  },
};
fs.writeFileSync(reportPath, JSON.stringify(stageAReport, null, 2), 'utf-8');
console.log(`✅ Stage A 报告: ${reportPath} (verdict=pass)`);

// ── 辅助函数:计算 SVG 路径的边界框 ──
function calculateSvgBounds(paths) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  for (const p of paths) {
    const d = p.data || p.d || '';
    // 简单解析：提取所有数字对（x, y 坐标）
    const coords = d.match(/[-+]?[0-9]*\.?[0-9]+/g);
    if (!coords || coords.length < 2) continue;
    
    for (let i = 0; i < coords.length - 1; i += 2) {
      const x = parseFloat(coords[i]);
      const y = parseFloat(coords[i + 1]);
      if (!isNaN(x) && !isNaN(y)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  
  if (minX === Infinity) return null;
  
  // 添加一点 padding
  const padding = 2;
  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding
  };
}
