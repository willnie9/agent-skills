#!/usr/bin/env node
// 通用 JSON Schema 校验器
// 用法:
//   node stage-validator.mjs <data-file.json> <schema-file.json>
//   退出码: 0=通过, 1=schema 不符, 2=文件缺失, 3=参数错
//
// 设计: 不依赖 npm 包,纯 Node.js 实现的简易校验器(覆盖 Draft-07 子集)
// 如需完整 ajv 校验,设环境变量 USE_AJV=1 且确保 npm i ajv 已装

import { readFileSync, existsSync } from 'node:fs';

if (process.argv.length < 4) {
  console.error('用法: node stage-validator.mjs <data> <schema>');
  process.exit(3);
}

const [, , dataPath, schemaPath] = process.argv;

if (!existsSync(dataPath)) { console.error(`❌ 数据文件不存在: ${dataPath}`); process.exit(2); }
if (!existsSync(schemaPath)) { console.error(`❌ Schema 不存在: ${schemaPath}`); process.exit(2); }

let data, schema;
try {
  data = JSON.parse(readFileSync(dataPath, 'utf-8'));
  schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
} catch (e) {
  console.error(`❌ JSON 解析失败: ${e.message}`);
  process.exit(1);
}

// 简易 Draft-07 子集校验
function resolveRef(s, root) {
  if (!s || !s.$ref) return s;
  // 仅支持本地引用 #/path/to/def
  if (!s.$ref.startsWith('#/')) return s;
  const parts = s.$ref.slice(2).split('/');
  let target = root;
  for (const p of parts) {
    target = target?.[p];
    if (!target) return s; // 解析失败,返回原值
  }
  return target;
}

function validate(data, schema, path = '$', root = null) {
  root = root || schema;
  const errors = [];

  // $ref 解析(支持 #/definitions/xxx)
  schema = resolveRef(schema, root);

  // type 检查
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actualType = Array.isArray(data) ? 'array' : (data === null ? 'null' : typeof data);
    if (!types.some(t => t === actualType || (t === 'integer' && actualType === 'number' && Number.isInteger(data)))) {
      errors.push(`${path}: 期望 type ${types.join('|')},实际 ${actualType}`);
      return errors;
    }
  }

  // required
  if (schema.required && typeof data === 'object' && data !== null) {
    for (const key of schema.required) {
      if (!(key in data)) errors.push(`${path}: 缺少必填字段 "${key}"`);
    }
  }

  // properties
  if (schema.properties && typeof data === 'object' && data !== null) {
    for (const [key, subSchema] of Object.entries(schema.properties)) {
      if (key in data) {
        errors.push(...validate(data[key], subSchema, `${path}.${key}`, root));
      }
    }
  }

  // pattern (string)
  if (schema.pattern && typeof data === 'string') {
    if (!new RegExp(schema.pattern).test(data)) {
      errors.push(`${path}: "${data}" 不符合 pattern /${schema.pattern}/`);
    }
  }

  // enum
  if (schema.enum && !schema.enum.includes(data)) {
    errors.push(`${path}: 值 "${data}" 不在 enum [${schema.enum.join(', ')}] 中`);
  }

  // items (array)
  if (schema.items && Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      errors.push(...validate(data[i], schema.items, `${path}[${i}]`, root));
    }
  }

  // additionalProperties: false
  if (schema.additionalProperties === false && schema.properties && typeof data === 'object' && data !== null) {
    const allowed = new Set(Object.keys(schema.properties));
    for (const key of Object.keys(data)) {
      if (!allowed.has(key)) errors.push(`${path}: 不允许额外属性 "${key}"`);
    }
  }

  // not
  if (schema.not) {
    if (validate(data, schema.not, path, root).length === 0) {
      errors.push(`${path}: 不应满足 not 分支(冲突字段)`);
    }
  }

  // oneOf
  if (schema.oneOf) {
    const matches = schema.oneOf.filter(s => validate(data, s, path, root).length === 0);
    if (matches.length === 0) errors.push(`${path}: 不符合 oneOf 任一分支`);
    else if (matches.length > 1) errors.push(`${path}: 符合 oneOf 多个分支(应只符合一个)`);
  }

  return errors;
}

// 用 ajv 模式(可选)
if (process.env.USE_AJV === '1') {
  try {
    const { default: Ajv } = await import('ajv');
    const ajv = new Ajv({ allErrors: true });
    const valid = ajv.compile(schema)(data);
    if (!valid) {
      console.error('❌ Ajv 校验失败:');
      for (const e of ajv.errors) {
        console.error(`  ${e.instancePath} ${e.message}`);
      }
      process.exit(1);
    }
    console.log('✅ 校验通过 (Ajv)');
    process.exit(0);
  } catch (e) {
    console.error(`⚠️  Ajv 未装或加载失败,退回简易校验: ${e.message}`);
  }
}

// 简易校验
const errors = validate(data, schema);
if (errors.length > 0) {
  console.error('❌ Schema 校验失败:');
  errors.forEach(e => console.error(`  ${e}`));
  process.exit(1);
}

console.log(`✅ 校验通过 (${dataPath} 符合 ${schemaPath})`);
process.exit(0);
