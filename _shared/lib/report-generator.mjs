#!/usr/bin/env node
// 产物清单 + git 建议生成器
//
// 用法:
//   node report-generator.mjs <module> [--new-files=file1,file2] [--modified-files=file3,file4]
//
// 输出 markdown 报告 + git add/commit 建议命令

const args = process.argv.slice(2);
const module = args[0];
if (!module) {
  console.error('用法: node report-generator.mjs <module> [--new-files=...] [--modified-files=...]');
  process.exit(2);
}

const opts = Object.fromEntries(args.slice(1).filter(a => a.startsWith('--')).map(a => {
  const [k, v] = a.slice(2).split('=');
  return [k, v?.split(',').filter(Boolean) ?? []];
}));

const newFiles = opts['new-files'] || [];
const modifiedFiles = opts['modified-files'] || [];

console.log(`# ✅ ${module} 模块产出报告\n`);

if (newFiles.length > 0) {
  console.log(`## 新建文件 (${newFiles.length} 个)`);
  newFiles.forEach(f => console.log(`- ${f}`));
  console.log('');
}

if (modifiedFiles.length > 0) {
  console.log(`## 修改文件 (${modifiedFiles.length} 个)`);
  modifiedFiles.forEach(f => console.log(`- ${f}`));
  console.log('');
}

console.log(`## 已知占位\n`);
console.log(`- 🔐 \`TODO(perm):\` — 权限编码占位,跑 \`node .claude/skills/frontend-page-design/scripts/scan-perm-todos.mjs\` 查看完整清单`);
console.log(`- 🎨 \`TODO(icon):\` — 菜单图标占位,设计出图后替换`);
console.log(`- 📦 \`VITE_${module.toUpperCase()}_MOCK\` — Mock 开关(如适用),后端就绪后改 .env.development 关掉`);
console.log('');

console.log(`## Git 提交建议\n`);
console.log('```bash');
const allFiles = [...newFiles, ...modifiedFiles];
if (allFiles.length > 0) {
  console.log(`git add \\`);
  allFiles.forEach((f, i) => console.log(`  ${f}${i < allFiles.length - 1 ? ' \\' : ''}`));
}
console.log('');
console.log(`git commit -m "feat(${module}): 新增 ${module} 模块 - 设计稿/接口/页面/路由/菜单/E2E 全流程"`);
console.log('```');
console.log('');
console.log(`⚠️ 不自动 commit,请你手动 review 后执行。`);

process.exit(0);
