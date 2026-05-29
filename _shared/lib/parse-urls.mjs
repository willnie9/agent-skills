#!/usr/bin/env node
// URL 解析工具:mastergo / yapi / 云效
//
// 用法:
//   node parse-urls.mjs mastergo "https://mastergo.com/file/xxx?layer_id=yyy"
//   node parse-urls.mjs yapi     "https://<your-yapi-host>/project/28/interface/api/66"
//   node parse-urls.mjs yunxiao  "https://devops.aliyun.com/projex/.../workitem/<BUG-ID>"
//
// 输出 JSON:
//   mastergo → { fileId, layerId }
//   yapi     → { projectId, apiId, baseUrl }
//   yunxiao  → { workItemCode, host }
//
// 退出码: 0=ok, 1=解析失败, 2=参数错

const [, , kind, url] = process.argv;

if (!kind || !url) {
  console.error('用法: node parse-urls.mjs <kind> <url>');
  console.error('  kind: mastergo | yapi | yunxiao');
  process.exit(2);
}

const parsers = {
  mastergo(u) {
    // 支持 3 种格式:
    //   https://mastergo.com/file/<fileId>?layer_id=<layerId>
    //   https://mastergo.com/prototyping/<fileId>?...&layer_id=<layerId>
    //   https://mastergo.com/design/<fileId>?layer_id=<layerId>
    const m = u.match(/mastergo\.com\/(?:file|prototyping|design)\/(\d+)/);
    if (!m) throw new Error('mastergo URL 格式不对,需含 file/<id>、prototyping/<id> 或 design/<id>');
    const fileId = m[1];
    // layerId 可能是 URL 编码的(629%3A345167) 或原始(629:345167)
    const decoded = decodeURIComponent(u);
    const lm = decoded.match(/[?&]layer_id=([0-9]+:[0-9a-fA-F]+)/);
    if (!lm) throw new Error('找不到 layer_id 参数,URL 应含 ?layer_id=<数字>:<hex>');
    return { fileId, layerId: lm[1] };
  },
  yapi(u) {
    // https://<host>/project/<projectId>/interface/api/<apiId>
    const m = u.match(/^(https?:\/\/[^/]+)\/project\/(\d+)\/interface\/api\/(\d+)/);
    if (!m) throw new Error('yapi URL 格式不对,应是 https://<host>/project/<n>/interface/api/<n>');
    return { baseUrl: m[1], projectId: m[2], apiId: m[3] };
  },
  yunxiao(u) {
    // workitem ID 可能在 path 中或末段
    const m = u.match(/(TXRP-\d+|[A-Z]+-\d+)/);
    if (!m) throw new Error('云效 URL 找不到 workItemCode(如 <BUG-ID>)');
    const hostMatch = u.match(/^(https?:\/\/[^/]+)/);
    return { workItemCode: m[1], host: hostMatch?.[1] || '' };
  },
};

if (!parsers[kind]) {
  console.error(`不支持的 kind: ${kind}`);
  process.exit(2);
}

try {
  const result = parsers[kind](url);
  console.log(JSON.stringify(result));
  process.exit(0);
} catch (e) {
  console.error(`❌ ${e.message}`);
  process.exit(1);
}
