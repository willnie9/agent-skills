#!/usr/bin/env node
// 检测 module 已有产物,决定从哪个 Stage 恢复(中途取消恢复用)
//
// 用法:
//   node check-resume-state.mjs <module>
//
// 输出 JSON:
//   {
//     "module": "<module>",
//     "stages": {
//       "A": { "done": true, "files": [...] },
//       "B": { "done": false },
//       ...
//     },
//     "resumeFrom": "B"  // 建议从哪个 Stage 接着跑
//   }

import { existsSync } from 'node:fs';

const module = process.argv[2];
if (!module) {
  console.error('用法: node check-resume-state.mjs <module>');
  process.exit(2);
}

const stages = {
  A: {
    files: [
      '.claude/skills/master-go-to-code/output/dom-tree.json',
      '.claude/skills/master-go-to-code/output/svg-paths.json',
    ],
  },
  B: {
    files: [
      `src/cache/${module}/define.ts`,
      `src/cache/${module}/api.ts`,
    ],
  },
  C: {
    files: [
      `src/views/${module}/Index.vue`,
      `src/router/${module}Router.ts`,
    ],
  },
  D: {
    files: [
      `.claude/results/${module}/stage-d-report.json`,
    ],
  },
};

const result = { module, stages: {}, resumeFrom: null };

for (const [stage, { files }] of Object.entries(stages)) {
  const existing = files.filter(f => existsSync(f));
  result.stages[stage] = {
    done: existing.length === files.length,
    files: existing,
    missing: files.filter(f => !existsSync(f)),
  };
  if (!result.stages[stage].done && !result.resumeFrom) {
    result.resumeFrom = stage;
  }
}

if (!result.resumeFrom) result.resumeFrom = 'COMPLETE';

console.log(JSON.stringify(result, null, 2));
process.exit(0);
