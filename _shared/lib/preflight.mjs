#!/usr/bin/env node
// 通用环境自检脚本(Reconnaissance-Then-Action 模式)
//
// 用法:
//   node preflight.mjs <skill-name>
//   配置在 .claude/skills/<skill-name>/preflight.json:
//   {
//     "mcps": ["mastergo-magic-mcp"],
//     "files": [".claude/skills/master-go-to-code/scripts/fetch-and-parse.mjs"],
//     "env": ["MASTERGO_TOKEN"],
//     "skills": [".claude/skills/frontend-page-design/SKILL.md"]
//   }
//
// 退出码: 0=全部通过, 1=部分失败, 2=参数错

import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const skill = process.argv[2];
if (!skill) { console.error('用法: node preflight.mjs <skill-name>'); process.exit(2); }

const configPath = resolve(`.claude/skills/${skill}/preflight.json`);
if (!existsSync(configPath)) {
  // 无配置文件时跑默认检查
  console.log(`(无 ${configPath},跳过自检)`);
  process.exit(0);
}

let config;
try { config = JSON.parse(readFileSync(configPath, 'utf-8')); }
catch (e) { console.error(`❌ 解析 ${configPath} 失败: ${e.message}`); process.exit(1); }

const failures = [];

// 1. 文件存在
for (const f of config.files || []) {
  if (!existsSync(f)) failures.push(`文件缺失: ${f}`);
  else console.log(`✅ 文件: ${f}`);
}

// 2. 环境变量
for (const v of config.env || []) {
  // 优先读 .env 文件
  let found = false;
  if (existsSync('.env')) {
    const envContent = readFileSync('.env', 'utf-8');
    if (new RegExp(`^${v}=`, 'm').test(envContent)) found = true;
  }
  if (!found && process.env[v]) found = true;
  if (!found) failures.push(`环境变量缺失: ${v}`);
  else console.log(`✅ 环境变量: ${v}`);
}

// 3. 下游 skill
for (const s of config.skills || []) {
  if (!existsSync(s)) failures.push(`下游 skill 缺: ${s}`);
  else console.log(`✅ Skill: ${s}`);
}

// 4. MCP(无法在外部直接检测,只能查 settings.local.json 的 enabledMcpjsonServers)
const settings = '.claude/settings.local.json';
if (existsSync(settings)) {
  try {
    const enabled = JSON.parse(readFileSync(settings, 'utf-8')).enabledMcpjsonServers || [];
    for (const mcp of config.mcps || []) {
      if (enabled.includes(mcp)) console.log(`✅ MCP 已启用: ${mcp}`);
      else failures.push(`MCP 未启用: ${mcp} (检查 ${settings} 的 enabledMcpjsonServers)`);
    }
  } catch (e) {
    failures.push(`无法读 ${settings}: ${e.message}`);
  }
}

if (failures.length > 0) {
  console.error(`\n❌ ${failures.length} 项自检失败:`);
  failures.forEach(f => console.error(`  - ${f}`));
  process.exit(1);
}

console.log(`\n✅ ${skill} 自检全部通过`);
process.exit(0);
