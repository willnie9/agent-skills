#!/usr/bin/env node
// 扫描所有 TODO(perm) 占位,生成待处理清单
//
// 用法:
//   node scan-perm-todos.mjs [src/]   # 默认 src/
//
// 输出:
//   每个占位的文件:行号 + 上下文 + 推荐替换值
// 退出码: 0=找到,1=未找到

import { execSync } from 'node:child_process';

const dir = process.argv[2] || 'src/';

let raw;
try {
  raw = execSync(`grep -rn "TODO(perm)" ${dir}`, { encoding: 'utf-8' });
} catch (e) {
  // grep 找不到时 exit 1
  if (e.status === 1) {
    console.log(`✅ 没有 TODO(perm) 占位待处理 (${dir})`);
    process.exit(0);
  }
  console.error(`❌ grep 失败: ${e.message}`);
  process.exit(2);
}

const lines = raw.trim().split('\n').filter(Boolean);

console.log(`# TODO(perm) 占位清单 (共 ${lines.length} 处)\n`);

const grouped = {};
for (const line of lines) {
  const m = line.match(/^([^:]+):(\d+):(.*)$/);
  if (!m) continue;
  const [, file, lineNum, content] = m;
  if (!grouped[file]) grouped[file] = [];
  grouped[file].push({ line: parseInt(lineNum), content: content.trim() });
}

for (const file of Object.keys(grouped).sort()) {
  console.log(`## ${file}`);
  for (const { line, content } of grouped[file]) {
    console.log(`  L${line}: ${content}`);
  }
  console.log('');
}

console.log(`\n📝 处理流程:`);
console.log(`  1. 让后端确认每个模块需要的真实权限码常量`);
console.log(`  2. 在项目权限码定义文件添加新常量`);
console.log(`  3. 把上述占位逐个替换`);
console.log(`  4. 删除 TODO(perm) 注释`);
console.log(`  5. 重跑本脚本确认清空: node ${import.meta.url.split('/').pop()} ${dir}`);

process.exit(0);
