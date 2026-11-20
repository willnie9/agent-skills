#!/usr/bin/env node
/**
 * Package a saved MasterGo outer DSL and an image directory.
 *
 * The caller must fetch DSL through mcp__getDsl first.
 *
 * Usage:
 * node package-subdsl.mjs \
 *   --dsl /path/outer-dsl.json \
 *   --images /path/download \
 *   --out /path/output \
 *   --source-link "https://mastergo.com/goto/..." \
 *   [--audit-depth 3]
 */
import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const dslPath = required("--dsl");
const outDir = required("--out");
const imageDir = args["--images"];
const sourceLink = args["--source-link"] || "";
const auditDepth = parseAuditDepth(args["--audit-depth"]);

const wrapper = readJson(dslPath);
const dsl = wrapper.dsl || wrapper;
const outer = dsl.nodes?.[0];
if (!outer?.id) throw new Error("DSL does not contain nodes[0] as the outer node");

const source = {
  fileId: query(sourceLink, "file"),
  pageId: query(sourceLink, "page_id"),
  sourceOuterLayerId: outer.id,
  sourceOuterName: outer.name || "",
  sourceOuterLink: sourceLink,
};

resetGeneratedOutput(outDir);
mkdir(path.join(outDir, "source"));
mkdir(path.join(outDir, "dsl"));
mkdir(path.join(outDir, "images"));
writeJson(path.join(outDir, "source", "outer-dsl.json"), dsl);
writeJson(path.join(outDir, "source", "outer-dsl-wrapper.json"), wrapper);

const usedKeys = new Set();
const directScenes = (outer.children || []).filter(
  (node) => ["FRAME", "INSTANCE", "GROUP"].includes(node.type)
    && !isDecoration(node)
    && !isInteraction(node)
    && !isStructuralHeader(node),
);
const interactionNodes = topLevelInteractions(outer);
const imageNameHints = imageHints(imageDir);
const items = directScenes.map((node) => {
  const semantic = semanticName(node, usedKeys, false, imageNameHints);
  const file = `dsl/${semantic.key}.json`;
  writeJson(path.join(outDir, file), childDsl(node));
  return {
    key: semantic.key,
    title: semantic.title,
    kind: semantic.kind,
    selectedLayerId: node.id,
    selectedLayerLink: childLink(node.id),
    sourceOuterLayerId: outer.id,
    dsl: file,
    image: null,
    imageMapping: { status: "unmatched", confidence: "unmatched", evidence: [] },
    text: extractText(node),
    visualSummary: buildVisualSummary(node, semantic.title, []),
    interactions: [],
  };
});

for (const node of interactionNodes.filter((item) => item.id !== outer.id)) {
  const semantic = semanticName(node, usedKeys, true);
  const file = `dsl/${semantic.key}.json`;
  writeJson(path.join(outDir, file), childDsl(node));
  const variant = behaviorVariant(node, items);
  if (variant) {
    items.push({
      key: semantic.key,
      title: variant.title,
      kind: "行为变体",
      selectedLayerId: node.id,
      selectedLayerLink: childLink(node.id),
      sourceOuterLayerId: outer.id,
      dsl: "",
      interactionDsl: file,
      image: null,
      imageMapping: variant.reuseOf
        ? {
          status: "reused",
          confidence: "high",
          reusedFrom: variant.reuseOf.sceneKey,
          evidence: [`复用基础场景：${variant.reuseOf.sceneKey}`],
        }
        : {
          status: "unmatched",
          confidence: "unmatched",
          evidence: ["未找到可确认复用的基础场景"],
        },
      reuseOf: variant.reuseOf,
      text: extractText(node),
      visualSummary: null,
      interactions: [],
    });
    continue;
  }
  const parent = nearestScene(node, directScenes);
  const target = parent && distance(node, parent) < 900
    ? items.find((item) => item.selectedLayerId === parent.id)
    : null;
  const interaction = {
    key: semantic.key,
    title: semantic.title,
    selectedLayerId: node.id,
    selectedLayerLink: childLink(node.id),
    dsl: file,
    text: extractText(node),
  };
  if (target) target.interactions.push(interaction);
  else items.push({
    ...interaction,
    kind: "交互说明",
    sourceOuterLayerId: outer.id,
    image: null,
    imageMapping: { status: "unmatched", confidence: "unmatched", evidence: [] },
    interactions: [],
    visualSummary: null,
  });
}

if (imageDir) pairImages(items, directScenes, imageDir);
hydrateReuseReferences(items);
for (const item of items) {
  if (!item.visualSummary || !item.selectedLayerId) continue;
  const node = directScenes.find((scene) => scene.id === item.selectedLayerId);
  if (node) item.visualSummary = buildVisualSummary(node, item.title, item.interactions);
}

const audit = auditDepth >= 3 ? writeAuditArtifacts(directScenes, items, auditDepth) : null;
const manifest = {
  ...source,
  outerDsl: "source/outer-dsl.json",
  items,
  ...(audit ? { audit } : {}),
};
writeJson(path.join(outDir, "manifest.json"), manifest);
fs.writeFileSync(path.join(outDir, "ai-page-context.md"), renderMarkdown(manifest));
validate(outDir);

console.log(JSON.stringify({
  outDir,
  items: items.length,
  matchedImages: items.filter((item) => item.image).length,
}, null, 2));

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) continue;
    const value = argv[index + 1];
    result[key] = value && !value.startsWith("--") ? value : true;
    if (result[key] !== true) index += 1;
  }
  return result;
}

function required(key) {
  if (!args[key] || args[key] === true) throw new Error(`Missing ${key}`);
  return args[key];
}

function parseAuditDepth(value) {
  if (value === undefined || value === true) return 2;
  const depth = Number(value);
  if (!Number.isInteger(depth) || depth < 2) {
    throw new Error("--audit-depth must be an integer greater than or equal to 2");
  }
  return depth;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function mkdir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function resetGeneratedOutput(directory) {
  for (const relative of ["source", "dsl", "images", "audit", "manifest.json", "ai-page-context.md"]) {
    const target = path.join(directory, relative);
    if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
  }
}

function writeAuditArtifacts(scenes, sceneItems, maxDepth) {
  const auditDir = path.join(outDir, "audit");
  const records = [];
  const sceneById = new Map(sceneItems.map((item) => [item.selectedLayerId, item]));
  for (const scene of scenes) {
    const sceneItem = sceneById.get(scene.id);
    if (!sceneItem) continue;
    walkAuditNodes(scene, sceneItem, 2, maxDepth, records);
  }
  const manifest = {
    sourceOuterLayerId: outer.id,
    maxDepth,
    entries: records,
  };
  writeJson(path.join(auditDir, "manifest.json"), manifest);
  return {
    maxDepth,
    manifest: "audit/manifest.json",
    entryCount: records.length,
  };
}

function walkAuditNodes(parent, sceneItem, parentLevel, maxDepth, records) {
  const level = parentLevel + 1;
  if (level > maxDepth) return;
  let ordinal = 0;
  for (const node of parent.children || []) {
    if (isAuditNode(node)) {
      ordinal += 1;
      const file = `audit/level-${level}/${sceneItem.key}/${String(ordinal).padStart(2, "0")}-${slug(node.name || node.type)}-${node.id.replace(/[^\\p{Letter}\\p{Number}]+/gu, "-")}.json`;
      const payload = {
        ...childDsl(node),
        auditLevel: level,
        parentSceneKey: sceneItem.key,
        parentSceneLayerId: sceneItem.selectedLayerId,
        parentLayerId: parent.id,
      };
      const target = path.join(outDir, file);
      mkdir(path.dirname(target));
      writeJson(target, payload);
      records.push({
        auditLevel: level,
        parentSceneKey: sceneItem.key,
        parentSceneLayerId: sceneItem.selectedLayerId,
        parentLayerId: parent.id,
        selectedLayerId: node.id,
        selectedLayerLink: childLink(node.id),
        dsl: file,
        nodeType: node.type,
        nodeName: node.name || "",
      });
    }
    walkAuditNodes(node, sceneItem, level, maxDepth, records);
  }
}

function isAuditNode(node) {
  return ["FRAME", "INSTANCE", "GROUP"].includes(node?.type)
    && !isDecoration(node)
    && !isInteraction(node)
    && !isStructuralHeader(node);
}

function query(url, key) {
  try {
    return new URL(url).searchParams.get(key) || "";
  } catch {
    return "";
  }
}

function childLink(layerId) {
  if (!sourceLink) return "";
  const url = new URL(sourceLink);
  url.searchParams.set("layer_id", layerId);
  return url.toString();
}

function childDsl(node) {
  return {
    ...source,
    selectedLayerId: node.id,
    selectedLayerLink: childLink(node.id),
    extractedNodeIds: [node.id],
    nodes: [node],
    styles: dsl.styles || {},
    components: dsl.components || [],
  };
}

function flatten(node, result = []) {
  if (!node || typeof node !== "object") return result;
  result.push(node);
  for (const child of node.children || []) flatten(child, result);
  return result;
}

function topLevelInteractions(root) {
  const result = [];
  function visit(node, insideInteraction = false) {
    if (!node || typeof node !== "object") return;
    const interaction = isInteraction(node);
    if (interaction && !insideInteraction) result.push(node);
    for (const child of node.children || []) visit(child, insideInteraction || interaction);
  }
  for (const child of root.children || []) visit(child);
  return result;
}

function extractText(node) {
  const texts = [];
  function visit(item) {
    if (!item || typeof item !== "object") return;
    if (Array.isArray(item.text)) {
      texts.push(item.text.map((part) => part.text || "").join(""));
    }
    for (const child of item.children || []) visit(child);
  }
  visit(node);
  return texts.filter(Boolean).join("\n");
}

function buildVisualSummary(node, title, interactions = []) {
  const texts = collectTextLeaves(node)
    .map((value) => value.trim())
    .filter(Boolean);
  const unique = [...new Set(texts)];
  const fields = unique.filter((value) =>
    /名称|位置|类型|时间|日期|状态|标签|功率|账号|手机号|电话|地址|备注|描述|密码|编号/.test(value)
    && value.length <= 30
    && !/请输入|请选择|确定要|提示|如|功能|即可|使用|完成|快速|分别|多个/.test(value),
  );
  const actions = unique.filter((value) =>
    /^(搜索|重置|新增|新建|创建|保存|确定|取消|删除|编辑|启用|禁用|配置|导入|导出|关闭|提交|查询|返回)/.test(value)
    && value.length <= 30,
  );
  const columns = unique.filter((value) =>
    /名称|位置|类型|状态|标签|时间|操作|编号|地址/.test(value)
    && value.length <= 24
    && !/新增|请输入|请选择|确定要|如|功能|即可|使用|完成|快速|分别|多个|\+/.test(value),
  );
  const states = unique.filter((value) =>
    /暂未设置|暂无|空|启用中|已禁用|必巡|选巡|成功|失败/.test(value)
    && value.length <= 40,
  );
  return {
    title: cleanVisualTitle(title, unique),
    fields: limitUnique(fields, 12),
    actions: limitUnique(actions, 12),
    columns: limitUnique(columns, 12),
    states: limitUnique(states, 8),
    relatedInteractions: interactions.map((item) => item.title).filter(Boolean),
  };
}

function collectTextLeaves(node, result = []) {
  if (!node || typeof node !== "object") return result;
  if (Array.isArray(node.text)) {
    const value = node.text.map((part) => part.text || "").join("").trim();
    if (value) result.push(value);
  }
  for (const child of node.children || []) collectTextLeaves(child, result);
  return result;
}

function limitUnique(values, limit) {
  return [...new Set(values)].slice(0, limit);
}

function cleanVisualTitle(title, texts) {
  if (/评估管理|新建客户|容器\s*\d+/.test(title)) {
    const candidate = texts.find((value) => /巡逻点位|巡逻方案|巡逻记录|巡逻工作概览/.test(value));
    if (candidate) return candidate;
  }
  return title;
}

function isDecoration(node) {
  return /连接线|箭头|编号|line|arrow/i.test(node.name || "");
}

function isInteraction(node) {
  return /交互说明|配置说明/.test(`${node.name || ""} ${extractText(node)}`);
}

function isStructuralHeader(node) {
  const text = extractText(node).replace(/\s+/g, "");
  return node.type === "FRAME"
    && /^Frame\s*\d+$/i.test(node.name || "")
    && text.length <= 20
    && !(node.children || []).some((child) => ["FRAME", "INSTANCE", "GROUP"].includes(child.type));
}

function behaviorVariant(node, baseItems) {
  const title = firstLine(extractText(node));
  if (!/^(编辑|修改|查看)/.test(title)) return null;
  const objectKey = behaviorObject(title);
  if (!objectKey) return { title, reuseOf: null };
  const target = baseItems.find((item) => {
    const targetObject = behaviorObject(item.title);
    return targetObject === objectKey && /^(新增|新建|创建|配置)/.test(displayTitle(item.title));
  }) || baseItems.find((item) => {
    const targetObject = behaviorObject(item.title);
    return targetObject === objectKey && /新增|新建|创建|配置/.test(item.title);
  });
  return {
    title,
    reuseOf: target ? reusePayload(target) : null,
  };
}

function firstLine(value) {
  return (value || "").split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
}

function displayTitle(value) {
  return String(value || "").replace(/^交互-/, "").trim();
}

function behaviorObject(value) {
  let title = displayTitle(value)
    .replace(/二次确认|弹窗|页面|空状态|说明/g, "")
    .replace(/^(新增|新建|创建|配置|编辑|修改|查看)/, "")
    .replace(/安保|消防/g, "")
    .trim();
  title = title.replace(/巡逻班次.*/, "巡逻班次")
    .replace(/巡逻时段.*/, "巡逻时段")
    .replace(/巡逻点位.*/, "巡逻点位");
  if (/巡逻班次|班次/.test(title)) return "巡逻班次";
  if (/巡逻时段|时段/.test(title)) return "巡逻时段";
  if (/巡逻点位|点位/.test(title)) return "巡逻点位";
  return title || "";
}

function reusePayload(target) {
  return {
    sceneKey: target.key,
    title: target.title,
    selectedLayerId: target.selectedLayerId,
    selectedLayerLink: target.selectedLayerLink,
    dsl: target.dsl,
    image: target.image,
  };
}

function hydrateReuseReferences(allItems) {
  for (const item of allItems) {
    if (!item.reuseOf?.sceneKey) continue;
    const target = allItems.find((candidate) => candidate.key === item.reuseOf.sceneKey);
    if (!target) continue;
    item.reuseOf = reusePayload(target);
    item.image = target.image;
    if (target.image) {
      item.imageMapping = {
        status: "reused",
        confidence: "high",
        reusedFrom: target.key,
        originalFile: target.imageMapping?.originalFile,
        evidence: [`复用基础场景图片：${target.key}`],
      };
    }
  }
}

function nearestScene(node, scenes) {
  const x = node.layoutStyle?.relativeX || 0;
  const y = node.layoutStyle?.relativeY || 0;
  return scenes.reduce((best, scene) => {
    if (!best) return scene;
    const bestDistance = distance(node, best);
    return distance(node, scene) < bestDistance ? scene : best;
  }, null);
}

function distance(first, second) {
  return Math.abs((first.layoutStyle?.relativeX || 0) - (second.layoutStyle?.relativeX || 0))
    + Math.abs((first.layoutStyle?.relativeY || 0) - (second.layoutStyle?.relativeY || 0));
}

function semanticName(node, used, interaction = false, hints = []) {
  const raw = `${node.name || ""} ${extractText(node)}`.replace(/\s+/g, " ");
  let title = raw.slice(0, 80) || `${node.type}-${node.id}`;
  const moduleTitle = moduleTitleFromHints(hints);
  if (!interaction && moduleTitle && isMainCanvas(node)) title = moduleTitle;
  const rules = [
    [/巡逻点位.*点位名称.*巡逻类型.*搜索.*重置.*新增巡逻点位/, "巡逻点位"],
    [/(^|\s)新增巡逻点位(\s|$)/, "新增巡逻点位"],
    [/(^|\s)巡逻点位(\s|$)/, "巡逻点位"],
    [/(^|\s)打卡功率设置(\s|$)/, "打卡功率设置"],
    [/暂未设置巡逻方案/, "巡逻方案-未设置巡逻方案空状态"],
    [/巡逻方案.*暂未设置/, "巡逻方案-已选班次但配置为空"],
    [/配置巡逻点位/, "配置巡逻点位"],
    [/编辑.*巡逻时段/, "编辑巡逻时段"],
    [/新增巡逻时段/, "新增巡逻时段"],
    [/编辑.*巡逻班次/, "编辑巡逻班次"],
    [/新增.*巡逻班次/, "新增巡逻班次"],
    [/删除巡逻班次/, "删除巡逻班次二次确认"],
    [/禁用巡逻班次/, "禁用巡逻班次二次确认"],
    [/启用巡逻班次/, "启用巡逻班次二次确认"],
    [/删除巡逻时段/, "删除巡逻时段二次确认"],
    [/取消选择巡逻点位/, "取消选择巡逻点位二次确认"],
  ];
  for (const [pattern, value] of rules) {
    if (!interaction && moduleTitle && isMainCanvas(node)) break;
    if (pattern.test(raw)) {
      title = value;
      break;
    }
  }
  if (hints.some((hint) => hint.includes("巡逻点位")) && /评估管理/.test(title)) title = "巡逻点位";
  if (interaction) title = `交互-${title === raw.slice(0, 80) ? (extractText(node).split("\n")[0] || "说明") : title}`;
  const base = slug(title);
  let key = base;
  let suffix = 2;
  while (used.has(key)) key = `${base}-${suffix++}`;
  used.add(key);
  return {
    title,
    key,
    kind: interaction ? "交互说明" : node.type === "INSTANCE" ? "组件/弹窗" : "页面/弹窗",
  };
}

function imageHints(directory) {
  if (!directory) return [];
  try {
    return fs.readdirSync(directory).filter((name) => /\.(png|jpg|jpeg|webp)$/i.test(name));
  } catch {
    return [];
  }
}

function moduleTitleFromHints(hints) {
  const names = hints.map((name) => name.replace(/@\dx/gi, "").replace(/\.[^.]+$/, ""));
  const candidates = ["巡逻工作概览", "巡逻概览", "巡逻点位", "巡逻方案", "巡逻记录"];
  const found = candidates.find((candidate) => names.some((name) => name === candidate));
  return found === "巡逻概览" ? "巡逻工作概览" : found || "";
}

function isMainCanvas(node) {
  const width = Math.round(node.layoutStyle?.width || 0);
  const height = Math.round(node.layoutStyle?.height || 0);
  return width >= 1000 && height >= 700;
}

function slug(value) {
  return value.toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/g, "") || "scene";
}

function pairImages(items, scenes, directory) {
  const images = fs.readdirSync(directory)
    .filter((name) => /\.(png|jpg|jpeg|webp)$/i.test(name))
    .map((name) => {
      const file = path.join(directory, name);
      const dimensions = pngDimensions(file);
      return { name, file, ...dimensions };
    });
  const remaining = new Set(images.map((image) => image.name));
  for (const item of items) {
    const node = scenes.find((scene) => scene.id === item.selectedLayerId);
    if (!node) continue;
    const candidates = images.filter((image) => remaining.has(image.name));
    const match = bestImage(node, item, candidates);
    if (!match) continue;
    const extension = path.extname(match.name).toLowerCase() || ".png";
    const target = `${item.key}${extension}`;
    fs.copyFileSync(match.file, path.join(outDir, "images", target));
    remaining.delete(match.name);
    item.image = `images/${target}`;
    item.imageMapping = {
      status: match.confidence === "high" ? "matched" : "candidate",
      confidence: match.confidence,
      originalFile: match.name,
      evidence: match.evidence,
    };
  }
  if (remaining.size) {
    items.push({
      key: "待确认图片映射",
      title: "待确认图片映射",
      kind: "待确认",
      selectedLayerId: null,
      selectedLayerLink: "",
      sourceOuterLayerId: outer.id,
      dsl: "",
      image: null,
      imageMapping: {
        status: "unmatched",
        confidence: "unmatched",
        evidence: [...remaining].map((name) => `未能可靠匹配：${name}`),
      },
      text: "",
      interactions: [],
    });
  }
}

function bestImage(node, item, images) {
  const width = Math.round(node.layoutStyle?.width || 0);
  const height = Math.round(node.layoutStyle?.height || 0);
  const scored = images.map((image) => {
    let score = 0;
    const evidence = [];
    if (width && height && image.width === width && image.height === height) {
      score += 100;
      evidence.push("图片尺寸与 DSL 节点尺寸一致");
    }
    if (width && height && image.width === width * 3 && image.height === height * 3) {
      score += 100;
      evidence.push("图片尺寸与 DSL 节点尺寸按 @3x 导出倍率一致");
    }
    const semanticImageName = image.name.replace(/@\dx/gi, "").replace(/\.[^.]+$/, "");
    if (semanticImageName && item.title.includes(semanticImageName)) {
      score += 80;
      evidence.push("图片文件名与场景语义一致");
    }
    if (/确认/.test(item.title) && image.width === 420 && image.height === 196) {
      score += 30;
      evidence.push("符合二次确认弹窗尺寸");
    }
    if (/页面|状态/.test(item.kind) && image.width >= 1000 && image.height >= 700) {
      score += 20;
      evidence.push("符合页面状态图尺寸");
    }
    return { ...image, score, evidence };
  }).sort((first, second) => second.score - first.score);
  const best = scored[0];
  if (!best || best.score < 30) return null;
  return { ...best, confidence: best.score >= 100 ? "high" : "low" };
}

function pngDimensions(file) {
  try {
    const buffer = fs.readFileSync(file);
    if (buffer.readUInt32BE(0) === 0x89504e47) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
  } catch {}
  return { width: 0, height: 0 };
}

function renderMarkdown(manifest) {
  const lines = [
    "# AI 页面生成上下文",
    "",
    `- 来源外层链接：${manifest.sourceOuterLink}`,
    `- sourceOuterLayerId：${manifest.sourceOuterLayerId}`,
    `- 外层 DSL：${manifest.outerDsl}`,
    "",
    "## 场景",
  ];
  for (const [index, item] of manifest.items.entries()) {
    lines.push(
      "",
      `### ${index + 1}. ${item.title}`,
      "",
      `- selectedLayerId：${item.selectedLayerId || ""}`,
      `- selectedLayerLink：${item.selectedLayerLink || ""}`,
      `- sourceOuterLayerId：${item.sourceOuterLayerId}`,
      `- DSL：${item.dsl || item.interactionDsl || ""}`,
      `- 图片：${item.image || "未自动匹配"}`,
      `- 图片映射：${item.imageMapping.status} (${item.imageMapping.confidence})`,
    );
    if (item.interactionDsl) lines.push(`- 交互 DSL：${item.interactionDsl}`);
    if (item.reuseOf) {
      lines.push(
        `- 复用场景：${item.reuseOf.title}`,
        `- 复用 selectedLayerId：${item.reuseOf.selectedLayerId}`,
        `- 复用链接：${item.reuseOf.selectedLayerLink}`,
        `- 复用 DSL：${item.reuseOf.dsl || ""}`,
        `- 复用图片：${item.reuseOf.image || "未自动匹配"}`,
      );
    }
    if (item.imageMapping.originalFile) lines.push(`- 原始图片：${item.imageMapping.originalFile}`);
    if (item.imageMapping.evidence?.length) lines.push(`- 匹配证据：${item.imageMapping.evidence.join("；")}`);
    if (item.visualSummary) {
      lines.push("", "#### 画面关键元素");
      if (item.visualSummary.title) lines.push(`- 页面/弹窗标题：${item.visualSummary.title}`);
      if (item.visualSummary.fields?.length) lines.push(`- 输入字段：${item.visualSummary.fields.join("、")}`);
      if (item.visualSummary.actions?.length) lines.push(`- 主要操作：${item.visualSummary.actions.join("、")}`);
      if (item.visualSummary.columns?.length) lines.push(`- 表格字段：${item.visualSummary.columns.join("、")}`);
      if (item.visualSummary.states?.length) lines.push(`- 关键状态：${item.visualSummary.states.join("、")}`);
      if (item.visualSummary.relatedInteractions?.length) {
        lines.push(`- 关联交互：${item.visualSummary.relatedInteractions.join("、")}`);
      }
    } else if (item.text) {
      lines.push("", "#### 原文", "", "```text", item.text, "```");
    }
    for (const interaction of item.interactions || []) {
      lines.push(
        "",
        "#### 关联交互说明",
        "",
        `- selectedLayerId：${interaction.selectedLayerId}`,
        `- selectedLayerLink：${interaction.selectedLayerLink}`,
        `- DSL：${interaction.dsl}`,
        "",
        "```text",
        interaction.text,
        "```",
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

function validate(directory) {
  for (const file of fs.readdirSync(path.join(directory, "dsl")).filter((name) => name.endsWith(".json"))) {
    const payload = readJson(path.join(directory, "dsl", file));
    if (payload.selectedLayerId !== payload.nodes?.[0]?.id) {
      throw new Error(`${file}: selectedLayerId does not equal nodes[0].id`);
    }
  }
  const auditManifest = path.join(directory, "audit", "manifest.json");
  if (!fs.existsSync(auditManifest)) return;
  const audit = readJson(auditManifest);
  for (const entry of audit.entries || []) {
    const payload = readJson(path.join(directory, entry.dsl));
    if (payload.selectedLayerId !== payload.nodes?.[0]?.id) {
      throw new Error(`${entry.dsl}: selectedLayerId does not equal nodes[0].id`);
    }
    if (payload.auditLevel !== entry.auditLevel || payload.parentSceneKey !== entry.parentSceneKey) {
      throw new Error(`${entry.dsl}: audit metadata does not match audit manifest`);
    }
  }
}
