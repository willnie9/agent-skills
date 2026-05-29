import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [, , entryPath] = process.argv;

if (!entryPath) {
  console.error('Usage: node analyze-module.mjs <path-to-vue-directory-or-file>');
  process.exit(1);
}

// ── 读取配置 ──
const configPath = path.join(__dirname, '../config/auto-ui-explorer.config.json');
let config = {
  noiseBlacklist: [],
  clickEventPatterns: ['@click'],
  formComponentTypes: ['el-input', 'el-select', 'CommonSelect', 'el-radio-group', 'el-checkbox', 'el-date-picker']
};
if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  console.log(`[Config] Loaded from ${configPath}`);
} else {
  console.warn(`[Config] Not found at ${configPath}, using defaults`);
}

// ── 噪音黑名单预处理 ──
const isNoise = (filePath) => {
  const basename = path.basename(filePath);
  return config.noiseBlacklist.some(noise => basename.includes(noise.replace('.vue', '')));
};

// ── 工具函数 ──
const resolveAlias = (importPath, currentDir) => {
  if (importPath.startsWith('@/')) {
    return path.resolve(process.cwd(), 'src', importPath.slice(2));
  } else if (importPath.startsWith('.')) {
    return path.resolve(currentDir, importPath);
  }
  return null;
};

const getAttr = (block, attr) => {
  const match = block.match(new RegExp(`${attr}="([^"]+)"`));
  return match ? match[1] : null;
};

const getBindAttr = (block, attr) => {
  const match = block.match(new RegExp(`:${attr}="([^"]+)"`));
  return match ? match[1] : null;
};

// ── 全局收集器 ──
const visitedFiles = new Set();
const matrix = {
  entry: entryPath,
  config: configPath,
  routesAndFiles: [],
  noiseFilesFiltered: [],
  buttons: [],
  dialogs: [],
  formInputs: [],
  routerPushCalls: [],
  formRules: []
};

// ── 分析单个 Vue 文件 ──
const analyzeVueFile = (filePath) => {
  if (visitedFiles.has(filePath)) return;
  visitedFiles.add(filePath);

  if (!fs.existsSync(filePath)) {
    console.warn(`[Warn] File not found: ${filePath}`);
    return;
  }

  // 噪音过滤
  if (isNoise(filePath)) {
    console.log(`[Noise] Filtered: ${filePath}`);
    matrix.noiseFilesFiltered.push(filePath);
    return;
  }

  console.log(`[Scan] ${filePath}`);
  matrix.routesAndFiles.push(filePath);

  const content = fs.readFileSync(filePath, 'utf-8');
  const currentDir = path.dirname(filePath);
  const relativeToSrc = path.relative(path.resolve(process.cwd(), 'src'), filePath);

  // ── 1. 通用点击事件提取（支持修饰符） ──
  const clickPatterns = config.clickEventPatterns.map(p =>
    p.replace('.', '\\.')
  ).join('|');
  const clickRegex = new RegExp(`<([a-zA-Z0-9-]+)[^>]*((?:${clickPatterns})(?:\\.[a-z]+)*="([^"]+)")[^>]*>`, 'g');
  let clickMatch;
  while ((clickMatch = clickRegex.exec(content)) !== null) {
    const tag = clickMatch[1];
    const eventBinding = clickMatch[2];
    const action = clickMatch[3];
    const fullTag = clickMatch[0];
    const type = getAttr(fullTag, 'type') || 'default';

    matrix.buttons.push({
      source: relativeToSrc,
      tag,
      type,
      action,
      eventBinding: eventBinding.split('=')[0],
    });
  }

  // ── 2. 弹窗和抽屉 ──
  const dialogRegex = /<(el-dialog|el-drawer)[^>]*>/g;
  let dialogMatch;
  while ((dialogMatch = dialogRegex.exec(content)) !== null) {
    const fullTag = dialogMatch[0];
    const title = getAttr(fullTag, 'title') || getBindAttr(fullTag, 'title') || 'Dynamic Title';
    const isDynamic = !!getBindAttr(fullTag, 'title');
    matrix.dialogs.push({
      source: relativeToSrc,
      tag: dialogMatch[1],
      title,
      isDynamicTitle: isDynamic,
      model: getAttr(fullTag, 'v-model') || getBindAttr(fullTag, 'modelValue') || null,
    });
  }

  // ── 3. 表单输入项（扩展识别范围） ──
  const formItems = content.split('<el-form-item');
  formItems.slice(1).forEach(itemBlock => {
    const label = getAttr(itemBlock, 'label') || '未知表单项';
    const prop = getAttr(itemBlock, 'prop') || null;
    const required = itemBlock.includes('required') || false;

    let inputType = 'unknown';
    let placeholder = getAttr(itemBlock, 'placeholder') || '';
    let optionsBinding = null;

    for (const compType of config.formComponentTypes) {
      if (itemBlock.includes(`<${compType}`)) {
        inputType = compType;
        // 尝试提取 :options 绑定
        const optMatch = itemBlock.match(/:options="([^"]+)"/);
        if (optMatch) optionsBinding = optMatch[1];
        break;
      }
    }

    if (label !== '未知表单项' || prop) {
      matrix.formInputs.push({
        source: relativeToSrc,
        label,
        prop,
        type: inputType,
        placeholder,
        required,
        optionsBinding,
      });
    }
  });

  // ── 4. router.push / router.replace 提取 ──
  const routerPushRegex = /router\.(push|replace)\(\s*\{[^}]*name:\s*(?:Pages\.)?([a-zA-Z0-9_.]+)[^}]*\}/g;
  let routerMatch;
  while ((routerMatch = routerPushRegex.exec(content)) !== null) {
    matrix.routerPushCalls.push({
      source: relativeToSrc,
      method: routerMatch[1],
      target: routerMatch[2],
    });
  }

  // ── 5. :rules 绑定提取 ──
  const rulesMatch = content.match(/:rules="([^"]+)"/);
  if (rulesMatch) {
    const rulesVarName = rulesMatch[1];
    // 尝试提取 rules 对象中的 required 字段
    const rulesDefRegex = new RegExp(`(const|let|var)\\s+${rulesVarName}[\\s\\S]*?(?=\\n(?:const|let|var|function|//|/\\*|<))`, 'g');
    const rulesDefMatch = rulesDefRegex.exec(content);
    if (rulesDefMatch) {
      // 找出所有 required: true 的 prop
      const requiredRegex = /(\w+):\s*\[[\s\S]*?required:\s*true[\s\S]*?\]/g;
      let reqMatch;
      while ((reqMatch = requiredRegex.exec(rulesDefMatch[0])) !== null) {
        matrix.formRules.push({
          source: relativeToSrc,
          prop: reqMatch[1],
          required: true,
        });
      }
    }
  }

  // ── 6. 递归 import 的子组件 ──
  const importRegex = /import\s+([a-zA-Z0-9_]+)\s+from\s+['"]([^'"]+\.vue)['"]/g;
  let importMatch;
  while ((importMatch = importRegex.exec(content)) !== null) {
    const importPath = importMatch[2];
    const resolvedPath = resolveAlias(importPath, currentDir);
    if (resolvedPath) {
      analyzeVueFile(resolvedPath);
    }
  }
};

// ── 目录或文件扫描 ──
const scanTarget = (targetPath) => {
  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    const files = fs.readdirSync(targetPath);
    for (const file of files) {
      scanTarget(path.join(targetPath, file));
    }
  } else if (stat.isFile() && targetPath.endsWith('.vue')) {
    analyzeVueFile(targetPath);
  }
};

// ── 主流程 ──
const entryResolved = path.resolve(process.cwd(), entryPath);
if (!fs.existsSync(entryResolved)) {
  console.error(`Entry path not found: ${entryResolved}`);
  process.exit(1);
}

scanTarget(entryResolved);

// 去重按钮
const uniqueButtons = [];
const seenBtns = new Set();
matrix.buttons.forEach(b => {
  const key = `${b.source}-${b.action}`;
  if (!seenBtns.has(key)) {
    seenBtns.add(key);
    uniqueButtons.push(b);
  }
});
matrix.buttons = uniqueButtons;

// 用 formRules 补充 formInputs 的 required 标记
matrix.formRules.forEach(rule => {
  matrix.formInputs.forEach(input => {
    if (input.source === rule.source && input.prop === rule.prop) {
      input.required = true;
    }
  });
});

// ── 输出 ──
const outDir = path.join(__dirname, '../output');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

let moduleName = path.basename(entryPath);
if (moduleName.endsWith('.vue')) moduleName = moduleName.replace('.vue', '');
const outPath = path.join(outDir, `${moduleName}-ui-dictionary.json`);

fs.writeFileSync(outPath, JSON.stringify(matrix, null, 2));

console.log(`\n✅ Extracted FULL MODULE UI Dictionary to ${outPath}`);
console.log(`   Scanned:  ${matrix.routesAndFiles.length} Vue files`);
console.log(`   Filtered: ${matrix.noiseFilesFiltered.length} noise components`);
console.log(`   Found:    ${matrix.buttons.length} clicks, ${matrix.dialogs.length} dialogs, ${matrix.formInputs.length} inputs`);
console.log(`   Routes:   ${matrix.routerPushCalls.length} router.push/replace calls`);
console.log(`   Rules:    ${matrix.formRules.length} required field rules`);
