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
 */

import https from 'https';
import http from 'http';
import readline from 'readline';

// ==================== 配置 ====================
const CONFIG = {
  // 本地开发环境地址（通过 vite proxy 代理）
  baseURL: 'http://localhost:5173/proxy_api/gw/portal',
  // 从浏览器 Cookie 中获取 项目 token
  token: 'c87a5e5dc6b64902b9bdcc4832f9532e',
  // 设备ID
  deviceId: '3089ad15-d936-4664-9798-1123fdc85ccc',
  // 完整的 cookie
  cookie: '<your-project-cookie>',
};

// ==================== Mock 数据生成器 ====================

/**
 * 生成免费示例项 mock 数据
 */
function generateFreeServiceItems(count = 5) {
  const categories = ['<category-1>', '<category-2>', '<category-3>'];  // 改成项目实际业务分类
  const names = [
    '日常起居照料',
    '康复训练指导',
    '心理咨询服务',
    '书法绘画活动',
    '<示例数据-1>',
    '营养膳食指导',
    '陪同就医服务',
    '生日庆祝活动',
    '节日文艺演出',
    '户外散步陪伴',
  ];

  const items = [];
  for (let i = 0; i < count; i++) {
    items.push({
      id: 1000 + i,
      name: names[i % names.length],
      category: categories[i % categories.length],
      description: `${names[i % names.length]}的详细说明，包括服务内容、服务标准等信息。`,
      serviceType: 'single',
      billModel: 1,
      price: null,
      priceUnit: null,
      rate: '每周2次',
      isActive: 1,
      createTime: Date.now() - i * 24 * 60 * 60 * 1000,
    });
  }
  return items;
}

/**
 * 生成增值示例项 mock 数据
 */
function generateValueAddServiceItems(count = 5) {
  const categories = ['<category-1>', '<category-2>', '<category-3>'];  // 改成项目实际业务分类
  const names = [
    '专业按摩服务',
    '理发美容服务',
    '洗衣熨烫服务',
    '陪同购物服务',
    '专车接送服务',
    '营养配餐服务',
    '中医理疗服务',
    '足浴保健服务',
    '代购代办服务',
    '家政清洁服务',
  ];
  
  const billModels = [
    { model: 1, price: 50, unit: '次' },
    { model: 2, price: 500, unit: '月' },
    { model: 1, price: 30, unit: '次' },
  ];

  const items = [];
  for (let i = 0; i < count; i++) {
    const billInfo = billModels[i % billModels.length];
    items.push({
      id: 2000 + i,
      name: names[i % names.length],
      category: categories[i % categories.length],
      description: `${names[i % names.length]}的详细说明，包括服务内容、服务标准、收费说明等信息。`,
      serviceType: 'single',
      billModel: billInfo.model,
      price: billInfo.price,
      priceUnit: billInfo.unit,
      rate: billInfo.model === 1 ? '按次计费' : '包月服务',
      isActive: 1,
      createTime: Date.now() - i * 24 * 60 * 60 * 1000,
    });
  }
  return items;
}
function generateElderList(count = 10) {
  const surnames = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴'];
  const names = ['明', '华', '芳', '丽', '强', '军', '敏', '静', '伟', '娟'];
  
  const elders = [];
  for (let i = 0; i < count; i++) {
    const gender = Math.random() > 0.5 ? 1 : 2;
    const age = 65 + Math.floor(Math.random() * 25);
    const buildingNum = Math.floor(i / 4) + 1;
    const roomNum = (i % 4) + 1;
    const bedNum = Math.floor(Math.random() * 2) + 1;
    
    elders.push({
      Id: `elder_${1000 + i}`,
      elderId: 1000 + i,
      elderDepId: 100 + buildingNum,
      elderDepName: `${buildingNum}号楼`,
      roomNo: `${buildingNum}0${roomNum}`,
      headImgUrl: 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png',
      name: surnames[i % surnames.length] + names[i % names.length],
      gender: gender,
      age: age,
      roomNumber: `${buildingNum}0${roomNum}室`,
      vipType: Math.floor(Math.random() * 3) + 1,
      bedNumber: `${buildingNum}0${roomNum}-${bedNum}`,
      caregiverStatus: 3,
      careLevel: Math.floor(Math.random() * 5) + 1,
      abilityLevel: Math.floor(Math.random() * 5) + 1,
      checkInTime: Date.now() - Math.floor(Math.random() * 730) * 24 * 60 * 60 * 1000,
      elderlyType: Math.random() > 0.7 ? 1 : 0,
    });
  }
  return elders;
}

/**
 * 生成免费服务订单 mock 数据
 */
function generateFreeServiceOrders(count = 8) {
  const elders = generateElderList(5);
  const serviceItems = generateFreeServiceItems(3);
  const statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  
  const orders = [];
  for (let i = 0; i < count; i++) {
    const elder = elders[i % elders.length];
    const serviceItem = serviceItems[i % serviceItems.length];
    
    orders.push({
      orderId: 2000 + i,
      serviceType: 'single',
      elders: [{
        elderId: elder.Id,
        name: elder.name,
        elderDepId: elder.elderDepId,
        elderDepName: elder.elderDepName,
        roomNo: elder.roomNo,
      }],
      serviceItem: {
        serviceItemId: serviceItem.id,
        category: serviceItem.category,
        name: serviceItem.name,
        description: serviceItem.description,
        rat: serviceItem.rate,
      },
      eTime: Date.now() + Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000,
      status: statuses[i % statuses.length],
      createTime: Date.now() - i * 24 * 60 * 60 * 1000,
      createUserId: 'user_001',
      createUserName: '管理员',
      createUserDepId: 'dep_001',
      createUserDepName: '管理部',
    });
  }
  return orders;
}

// ==================== API 测试函数 ====================

/**
 * 发送 HTTP 请求
 */
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'Cookie': CONFIG.cookie,
        '<project-device-id>'  // 改成项目实际请求头: CONFIG.deviceId,
        '<project-device-type>': 'WEB',
        '<project-token-header>': CONFIG.token,
        '<project-version-header>': '1',
        'Origin': 'http://localhost:5173',
        'Referer': 'http://localhost:5173/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        ...options.headers,
      },
    };
    
    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data),
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

/**
 * 添加免费示例项
 */
async function addFreeServiceItem(item) {
  console.log(`\n➕ 添加示例项: ${item.name}`);
  
  try {
    const res = await request(`${CONFIG.baseURL}/api/v1/ihs/addFreeServiceItem`, {
      method: 'POST',
      body: {
        category: item.category,
        name: item.name,
        description: item.description,
        rate: item.rate,
        isActive: item.isActive,
      },
    });
    
    if (res.status === 200 && res.data.code === 200) {
      console.log(`✅ 添加成功 - ID: ${res.data.data}`);
      return { success: true, id: res.data.data };
    } else {
      console.log(`❌ 添加失败 - ${res.data.msg || '未知错误'}`);
      return { success: false, error: res.data.msg };
    }
  } catch (error) {
    console.log(`❌ 请求失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 批量添加免费示例项
 */
async function batchAddFreeServiceItems(count = 5) {
  console.log('\n� 批量添加免费示例项');
  console.log('━'.repeat(50));
  
  const items = generateFreeServiceItems(count);
  const results = [];
  
  for (const item of items) {
    const result = await addFreeServiceItem(item);
    results.push(result);
    // 延迟一下，避免请求过快
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\n📊 统计: 成功 ${successCount}/${count} 条`);
  
  return results;
}

/**
 * 添加增值示例项
 */
async function addValueAddServiceItem(item) {
  console.log(`\n➕ 添加增值示例项: ${item.name}`);
  
  try {
    const res = await request(`${CONFIG.baseURL}/api/v1/ihs/addValueAddServiceItem`, {
      method: 'POST',
      body: {
        category: item.category,
        name: item.name,
        description: item.description,
        rate: item.rate,
        billModel: item.billModel,
        price: item.price,
        priceUnit: item.priceUnit,
        isActive: item.isActive,
      },
    });
    
    if (res.status === 200 && res.data.code === 200) {
      console.log(`✅ 添加成功`);
      return { success: true };
    } else {
      console.log(`❌ 添加失败 - ${res.data.msg || '未知错误'}`);
      return { success: false, error: res.data.msg };
    }
  } catch (error) {
    console.log(`❌ 请求失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 批量添加增值示例项
 */
async function batchAddValueAddServiceItems(count = 5) {
  console.log('\n💰 批量添加增值示例项');
  console.log('━'.repeat(50));
  
  const items = generateValueAddServiceItems(count);
  const results = [];
  
  for (const item of items) {
    const result = await addValueAddServiceItem(item);
    results.push(result);
    // 延迟一下，避免请求过快
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\n📊 统计: 成功 ${successCount}/${count} 条`);
  
  return results;
}

/**
 * 添加免费服务订单
 */
async function addFreeServiceOrder(order) {
  console.log(`\n➕ 添加服务订单: ${order.serviceItem.name}`);
  
  try {
    const res = await request(`${CONFIG.baseURL}/api/v1/ihs/addFreeServiceOrder`, {
      method: 'POST',
      body: {
        serviceItemId: order.serviceItem.serviceItemId,
        elders: order.elders.map(e => e.elderId),
        eTime: order.eTime,
        des: `测试订单 - ${order.serviceItem.name}`,
      },
    });
    
    if (res.status === 200 && res.data.code === 200) {
      console.log(`✅ 添加成功`);
      return { success: true };
    } else {
      console.log(`❌ 添加失败 - ${res.data.msg || '未知错误'}`);
      return { success: false, error: res.data.msg };
    }
  } catch (error) {
    console.log(`❌ 请求失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ==================== Mock 数据输出 ====================

/**
 * 输出 mock 数据到文件
 */
function outputMockData() {
  console.log('\n📝 生成 Mock 数据');
  console.log('━'.repeat(50));
  
  const mockData = {
    freeServiceItems: generateFreeServiceItems(10),
    elderList: generateElderList(20),
    freeServiceOrders: generateFreeServiceOrders(15),
  };
  
  console.log('\n免费示例项 Mock 数据 (前3条):');
  console.log(JSON.stringify(mockData.freeServiceItems.slice(0, 3), null, 2));
  
  console.log('\n示例 Mock 数据 (前3条):');
  console.log(JSON.stringify(mockData.elderList.slice(0, 3), null, 2));
  
  console.log('\n免费服务订单 Mock 数据 (前3条):');
  console.log(JSON.stringify(mockData.freeServiceOrders.slice(0, 3), null, 2));
  
  console.log('\n✅ Mock 数据生成完成');
  console.log(`📊 统计: 示例项 ${mockData.freeServiceItems.length} 条, user ${mockData.elderList.length} 条, 订单 ${mockData.freeServiceOrders.length} 条`);
  
  return mockData;
}

// ==================== 主函数 ====================

/**
 * 显示菜单
 */
function showMenu() {
  console.log('\n📋 请选择操作:');
  console.log('━'.repeat(50));
  console.log('1. 批量添加免费示例项 (5条)');
  console.log('2. 批量添加增值示例项 (5条)');
  console.log('3. 批量添加免费示例项 (自定义数量)');
  console.log('4. 批量添加增值示例项 (自定义数量)');
  console.log('5. 查看生成的测试数据示例');
  console.log('6. 测试接口连接');
  console.log('0. 退出');
  console.log('━'.repeat(50));
}

/**
 * 测试接口连接
 */
async function testConnection() {
  console.log('\n🔍 测试接口连接');
  console.log('━'.repeat(50));
  console.log('请求地址:', `${CONFIG.baseURL}/api/v1/ihs/queryFreeItems`);
  console.log('Token:', CONFIG.token.substring(0, 10) + '...');
  
  try {
    const res = await request(`${CONFIG.baseURL}/api/v1/ihs/queryFreeItems`, {
      method: 'POST',
      body: { name: '' },
    });
    
    console.log('状态码:', res.status);
    console.log('返回数据:', JSON.stringify(res.data, null, 2));
    
    if (res.status === 200 && res.data.code === 200) {
      console.log('✅ 接口连接成功');
    } else if (res.data.code === 401 || res.data.msg?.includes('凭证')) {
      console.log('❌ Token 无效或已过期');
      console.log('💡 请从浏览器重新获取 <project-token-cookie-name>');
    } else {
      console.log('❌ 接口返回异常');
    }
  } catch (error) {
    console.log('❌ 连接失败:', error.message);
    console.log('💡 请确保开发服务器正在运行 (npm run dev)');
  }
}

/**
 * 获取用户输入
 */
function getUserInput(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('🚀 API 测试数据添加脚本');
  console.log('━'.repeat(50));
  
  // 检查配置
  if (CONFIG.baseURL === 'https://your-api-domain.com' || CONFIG.token === 'your-token-here') {
    console.log('⚠️  请先配置 baseURL 和 token');
    console.log('📝 编辑文件: .claude/skills/master-go-to-code/scripts/seed-test-data.mjs');
    console.log('\n💡 提示:');
    console.log('1. baseURL: 通常是 http://localhost:5173/proxy_api/gw/portal');
    console.log('2. token: 登录后从浏览器开发者工具 -> Application -> Cookies 中获取 <project-token-cookie-name>');
    console.log('3. 或者从 Network 请求头的 Cookie 中复制完整 cookie');
    return;
  }
  
  while (true) {
    showMenu();
    const choice = await getUserInput('请输入选项 (0-5): ');
    
    switch (choice) {
      case '1':
        await batchAddFreeServiceItems(5);
        break;
        
      case '2':
        await batchAddValueAddServiceItems(5);
        break;
        
      case '3': {
        const count = await getUserInput('请输入要添加的数量: ');
        const num = parseInt(count);
        if (num > 0 && num <= 50) {
          await batchAddFreeServiceItems(num);
        } else {
          console.log('❌ 数量必须在 1-50 之间');
        }
        break;
      }
        
      case '4': {
        const count = await getUserInput('请输入要添加的数量: ');
        const num = parseInt(count);
        if (num > 0 && num <= 50) {
          await batchAddValueAddServiceItems(num);
        } else {
          console.log('❌ 数量必须在 1-50 之间');
        }
        break;
      }
        
      case '5':
        outputMockData();
        break;
        
      case '6':
        await testConnection();
        break;
        
      case '0':
        console.log('\n� 再见！');
        process.exit(0);
        
      default:
        console.log('❌ 无效选项，请重新选择');
    }
    
    // 等待用户按回车继续
    await getUserInput('\n按回车键继续...');
  }
}

// 运行
main().catch(console.error);
