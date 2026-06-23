#!/usr/bin/env node

/**
 * 🔧 独立工具脚本(不集成进 master-go-to-code 主流程)
 * API 测试数据添加脚本 —— 用于向真实接口批量添加测试数据
 * 跟视觉还原流水线无关,放在这里仅因历史原因;联调时用得着
 *
 * 使用方法：
 * 1. 配置下面的 baseURL 和 token
 * 2. 运行: node .claude/skills/master-go-to-code/scripts/seed-test-data.mjs
 * 3. 选择要添加的数据类型
 *
 * ⚠️ 本文件为通用占位模板，所有业务数据均为 <placeholder>。
 *    使用前请替换为你的项目实际业务数据。
 */

import https from 'https';
import http from 'http';
import readline from 'readline';

// ==================== 配置 ====================
const CONFIG = {
  // 本地开发环境地址（通过 vite proxy 代理）
  baseURL: 'http://localhost:5173/proxy_api/<your-api-prefix>',
  // 从浏览器 Cookie 中获取 项目 token
  token: '<your-project-token>',
  // 设备ID
  deviceId: '<your-device-id>',
  // 完整的 cookie
  cookie: '<your-project-cookie>',
};

// ==================== Mock 数据生成器 ====================
// 以下生成函数均为通用占位实现，字段名和结构参考常见 CRUD 接口。
// 使用时请根据你的项目实际接口字段替换。

/**
 * 生成示例列表项 mock 数据
 */
function generateSampleItems(count = 5) {
  const categories = ['<category-1>', '<category-2>', '<category-3>'];
  const names = [
    '<示例项-1>',
    '<示例项-2>',
    '<示例项-3>',
    '<示例项-4>',
    '<示例项-5>',
    '<示例项-6>',
    '<示例项-7>',
    '<示例项-8>',
    '<示例项-9>',
    '<示例项-10>',
  ];

  const items = [];
  for (let i = 0; i < count; i++) {
    items.push({
      id: 1000 + i,
      name: names[i % names.length],
      category: categories[i % categories.length],
      description: `${names[i % names.length]}的详细说明`,
      serviceType: 'single',
      billModel: 1,
      rate: '<计费方式>',
      isActive: 1,
      createTime: Date.now() - i * 24 * 60 * 60 * 1000,
    });
  }
  return items;
}

/**
 * 生成示例增值项 mock 数据
 */
function generateSampleValueAddItems(count = 5) {
  const categories = ['<category-1>', '<category-2>', '<category-3>'];
  const names = [
    '<增值项-1>',
    '<增值项-2>',
    '<增值项-3>',
    '<增值项-4>',
    '<增值项-5>',
    '<增值项-6>',
    '<增值项-7>',
    '<增值项-8>',
    '<增值项-9>',
    '<增值项-10>',
  ];

  const billModels = [
    { model: 1, price: 50, unit: '<unit-1>' },
    { model: 2, price: 500, unit: '<unit-2>' },
    { model: 1, price: 30, unit: '<unit-1>' },
  ];

  const items = [];
  for (let i = 0; i < count; i++) {
    const billInfo = billModels[i % billModels.length];
    items.push({
      id: 2000 + i,
      name: names[i % names.length],
      category: categories[i % categories.length],
      description: `${names[i % names.length]}的详细说明`,
      serviceType: 'single',
      billModel: billInfo.model,
      price: billInfo.price,
      priceUnit: billInfo.unit,
      rate: billInfo.model === 1 ? '<按次计费>' : '<包月服务>',
      isActive: 1,
      createTime: Date.now() - i * 24 * 60 * 60 * 1000,
    });
  }
  return items;
}

/**
 * 生成示例人员列表 mock 数据
 */
function generateSamplePersonList(count = 10) {
  const surnames = ['<surname-1>', '<surname-2>', '<surname-3>', '<surname-4>', '<surname-5>'];
  const names = ['<name-1>', '<name-2>', '<name-3>', '<name-4>', '<name-5>'];

  const persons = [];
  for (let i = 0; i < count; i++) {
    persons.push({
      id: `person_${1000 + i}`,
      personId: 1000 + i,
      depId: 100 + Math.floor(i / 4),
      depName: `<部门-${Math.floor(i / 4) + 1}>`,
      name: surnames[i % surnames.length] + names[i % names.length],
      gender: Math.random() > 0.5 ? 1 : 2,
      age: 25 + Math.floor(Math.random() * 40),
      status: Math.floor(Math.random() * 3) + 1,
      level: Math.floor(Math.random() * 5) + 1,
      createTime: Date.now() - Math.floor(Math.random() * 365) * 24 * 60 * 60 * 1000,
    });
  }
  return persons;
}

/**
 * 生成示例订单 mock 数据
 */
function generateSampleOrders(count = 8) {
  const persons = generateSamplePersonList(5);
  const items = generateSampleItems(3);
  const statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

  const orders = [];
  for (let i = 0; i < count; i++) {
    const person = persons[i % persons.length];
    const item = items[i % items.length];

    orders.push({
      orderId: 2000 + i,
      serviceType: 'single',
      person: {
        personId: person.id,
        name: person.name,
        depId: person.depId,
        depName: person.depName,
      },
      item: {
        itemId: item.id,
        category: item.category,
        name: item.name,
        description: item.description,
      },
      eTime: Date.now() + Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000,
      status: statuses[i % statuses.length],
      createTime: Date.now() - i * 24 * 60 * 60 * 1000,
      createUserId: 'user_001',
      createUserName: '<管理员>',
      createUserDepId: 'dep_001',
      createUserDepName: '<管理部>',
    });
  }
  return orders;
}

// ==================== API 测试函数 ====================

/**
 * 发送 HTTP 请求
 */
function sendRequest(path, method, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(CONFIG.baseURL + path);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': CONFIG.cookie,
        'Authorization': `Bearer ${CONFIG.token}`,
      },
    };

    // 添加项目自定义请求头（按需修改）
    if (CONFIG.deviceId) {
      options.headers['X-Device-Id'] = CONFIG.deviceId;
    }

    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ statusCode: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

/**
 * 添加示例项
 */
async function addItem(item) {
  console.log(`\n➕ 添加示例项: ${item.name}`);
  try {
    const res = await sendRequest('/api/items', 'POST', item);
    if (res.statusCode === 200 && res.data?.code === 0) {
      console.log(`✅ 添加成功 - ID: ${res.data.data}`);
      return true;
    } else {
      console.log(`❌ 添加失败 - ${res.data?.msg || '未知错误'}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ 请求失败: ${error.message}`);
    return false;
  }
}

/**
 * 批量添加示例项
 */
async function batchAddItems(items) {
  console.log('\n📦 批量添加示例项');
  let successCount = 0;
  for (const item of items) {
    const ok = await addItem(item);
    if (ok) successCount++;
    await new Promise(r => setTimeout(r, 300)); // 延迟避免请求过快
  }
  console.log(`\n📊 统计: 成功 ${successCount}/${items.length} 条`);
}

/**
 * 添加增值示例项
 */
async function addValueAddItem(item) {
  console.log(`\n➕ 添加增值示例项: ${item.name}`);
  try {
    const res = await sendRequest('/api/value-add-items', 'POST', item);
    if (res.statusCode === 200 && res.data?.code === 0) {
      console.log(`✅ 添加成功`);
      return true;
    } else {
      console.log(`❌ 添加失败 - ${res.data?.msg || '未知错误'}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ 请求失败: ${error.message}`);
    return false;
  }
}

/**
 * 批量添加增值示例项
 */
async function batchAddValueAddItems(items) {
  console.log('\n💰 批量添加增值示例项');
  let successCount = 0;
  for (const item of items) {
    const ok = await addValueAddItem(item);
    if (ok) successCount++;
    await new Promise(r => setTimeout(r, 300));
  }
  console.log(`\n📊 统计: 成功 ${successCount}/${items.length} 条`);
}

/**
 * 添加示例订单
 */
async function addOrder(order) {
  console.log(`\n➕ 添加订单: ${order.item.name}`);
  try {
    const res = await sendRequest('/api/orders', 'POST', order);
    if (res.statusCode === 200 && res.data?.code === 0) {
      console.log(`✅ 添加成功`);
      return true;
    } else {
      console.log(`❌ 添加失败 - ${res.data?.msg || '未知错误'}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ 请求失败: ${error.message}`);
    return false;
  }
}

// ==================== Mock 数据输出 ====================

/**
 * 输出 mock 数据到文件
 */
function outputMockData() {
  console.log('\n📝 生成 Mock 数据');
  const items = generateSampleItems(3);
  const valueAddItems = generateSampleValueAddItems(3);
  const orders = generateSampleOrders(3);

  console.log('\n示例项 Mock 数据 (前3条):');
  console.log(JSON.stringify(items, null, 2));

  console.log('\n增值示例项 Mock 数据 (前3条):');
  console.log(JSON.stringify(valueAddItems, null, 2));

  console.log('\n示例订单 Mock 数据 (前3条):');
  console.log(JSON.stringify(orders, null, 2));

  console.log('\n💡 提示: 复制以上数据到你的 mock.ts 中使用');
}

// ==================== 交互式菜单 ====================

function showMenu() {
  console.log('\n' + '='.repeat(50));
  console.log('🔧 API 测试数据添加工具');
  console.log('='.repeat(50));
  console.log('\n请选择操作:');
  console.log('1. 批量添加示例项 (5条)');
  console.log('2. 批量添加增值示例项 (5条)');
  console.log('3. 批量添加示例订单 (8条)');
  console.log('4. 仅输出 Mock 数据到控制台');
  console.log('5. 检查配置');
  console.log('0. 退出');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('\n请输入选项: ', async (answer) => {
    rl.close();
    const choice = answer.trim();

    // 检查配置（选项 4 除外）
    if (choice !== '4' && choice !== '0') {
      if (CONFIG.token === '<your-project-token>') {
        console.log('\n⚠️  请先配置 token！编辑本文件顶部的 CONFIG 对象。');
        console.log('   提示: 从浏览器开发者工具 → Application → Cookies 中获取');
        showMenu();
        return;
      }
    }

    switch (choice) {
      case '1':
        await batchAddItems(generateSampleItems(5));
        break;
      case '2':
        await batchAddValueAddItems(generateSampleValueAddItems(5));
        break;
      case '3':
        const orders = generateSampleOrders(8);
        let okCount = 0;
        for (const order of orders) {
          if (await addOrder(order)) okCount++;
          await new Promise(r => setTimeout(r, 300));
        }
        console.log(`\n📊 统计: 成功 ${okCount}/${orders.length} 条`);
        break;
      case '4':
        outputMockData();
        break;
      case '5':
        console.log('\n📋 当前配置:');
        console.log(`1. baseURL: ${CONFIG.baseURL}`);
        console.log(`2. token: ${CONFIG.token === '<your-project-token>' ? '⚠️ 未配置' : '✅ 已配置'}`);
        console.log(`3. deviceId: ${CONFIG.deviceId === '<your-device-id>' ? '⚠️ 未配置' : '✅ 已配置'}`);
        console.log(`4. cookie: ${CONFIG.cookie === '<your-project-cookie>' ? '⚠️ 未配置' : '✅ 已配置'}`);
        break;
      case '0':
        console.log('👋 退出');
        process.exit(0);
      default:
        console.log('❌ 无效选项');
    }

    showMenu();
  });
}

// ==================== 启动 ====================

console.log('🔧 API 测试数据添加工具');
console.log('⚠️  本文件为通用占位模板，使用前请替换 CONFIG 和业务字段');
showMenu();
