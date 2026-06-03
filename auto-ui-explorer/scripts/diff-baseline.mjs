import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const moduleName = args[0];

if (!moduleName) {
  console.error('Usage: node diff-baseline.mjs <module> [--baseline=<path>] [--module-dir=<path>]');
  process.exit(1);
}

// 解析参数
const getArg = (prefix) => {
  const found = args.find(a => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
};

const baselinePath = getArg('--baseline=')
  || path.join(__dirname, `../output/${moduleName}-baseline.json`);
const moduleDir = getArg('--module-dir=') || null;

// 检查 baseline 是否存在
if (!fs.existsSync(baselinePath)) {
  console.log(JSON.stringify({
    strategy: 'full',
    skip: [],
    retest: [],
    reason: { _global: 'baseline.json 不存在，首次全量执行' },
    stats: { total: 0, skip: 0, retest: 0, savedPercent: 0 }
  }, null, 2));
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));

// 获取 git diff（从 baseline 记录的 commit 到当前 HEAD）
let changedFiles = [];
try {
  const diffOutput = execSync(
    `git diff --name-only ${baseline.gitCommit}..HEAD` + (moduleDir ? ` -- ${moduleDir}` : ''),
    { encoding: 'utf-8', cwd: process.cwd() }
  ).trim();
  changedFiles = diffOutput ? diffOutput.split('\n') : [];
} catch (e) {
  // git diff 失败（比如 commit 不存在）→ 全量重测
  console.log(JSON.stringify({
    strategy: 'full',
    skip: [],
    retest: baseline.results.map(r => r.id),
    reason: { _global: `git diff 失败: ${e.message}，回退全量` },
    stats: { total: baseline.totalSP, skip: 0, retest: baseline.totalSP, savedPercent: 0 }
  }, null, 2));
  process.exit(0);
}

// 将 changedFiles 标准化为相对路径集合（方便匹配）
const changedSet = new Set(changedFiles.map(f => f.replace(/\\/g, '/')));

// 判断每个 SP 的策略
const skip = [];
const retest = [];
const reason = {};

for (const sp of baseline.results) {
  if (sp.status === 'pending') {
    retest.push(sp.id);
    reason[sp.id] = 'status=pending（未执行）';
    continue;
  }

  if (sp.status === 'fail') {
    retest.push(sp.id);
    reason[sp.id] = `status=fail（上次失败: ${sp.failTag || '未知原因'}）`;
    continue;
  }

  if (sp.status === 'pass') {
    // 检查关联文件是否有变更
    const hasChange = sp.relatedFiles.some(relFile => {
      // relatedFiles 可能是相对模块目录的路径，也可能是完整相对路径
      return changedFiles.some(changed => changed.includes(relFile));
    });

    if (hasChange) {
      const changedRelated = sp.relatedFiles.filter(relFile =>
        changedFiles.some(changed => changed.includes(relFile))
      );
      retest.push(sp.id);
      reason[sp.id] = `文件变更: ${changedRelated.join(', ')}`;
    } else {
      skip.push(sp.id);
    }
    continue;
  }

  // status=skip 或其他 → 重测
  retest.push(sp.id);
  reason[sp.id] = `status=${sp.status}`;
}

const total = baseline.results.length;
const savedPercent = total > 0 ? Math.round((skip.length / total) * 100) : 0;

const result = {
  strategy: skip.length === total ? 'all-pass' : retest.length === total ? 'full' : 'incremental',
  baselineCommit: baseline.gitCommit,
  currentChangedFiles: changedFiles.length,
  skip,
  retest,
  reason,
  stats: {
    total,
    skip: skip.length,
    retest: retest.length,
    savedPercent
  }
};

console.log(JSON.stringify(result, null, 2));
