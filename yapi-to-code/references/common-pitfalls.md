# Yapi-to-Code 常见踩坑

> 本文件被 [SKILL.md](../SKILL.md) 引用。每条含「症状 → 原因 → 修复」。

## 响应壳相关

### 响应字段访问错(`Property 'xxx' does not exist`)
**症状**:TypeScript 编译报错,访问 `.data` / `.result` / `.body` 失败
**原因**:响应壳字段名跟项目实际不符
**修复**:看 define.ts 实际用哪个响应壳,字段名以 **SKILL.md Step 0 探测到的项目主流约定**为准

### `Promise<unknown> 推导失败`
**症状**:`const { data } = await queryXxxPage(...)` 报 unknown
**原因**:`api.ts` 函数体忘了 `as Promise<XxxResponse>` 强制断言
**修复**:如项目 HTTP 客户端返回弱类型,必须断言。是否需要断言 = Step 0 探测结果

### 凭空创造新的响应壳
**症状**:写出项目里不存在的响应壳类型
**原因**:没看 Step 0 探测结果,凭印象造
**修复**:只用项目里实际存在的响应壳类型,在项目接口基础目录的 define 文件确认

## 字段相关

### req_body_other 是字符串
**症状**:解析 req_body_other 时类型不对
**原因**:YApi 的 `req_body_other` 字段是字符串(可能是 JSON Schema 或样例 JSON),不是对象
**修复**:`JSON.parse(api.req_body_other)` 后再递归推导

### YApi 描述有枚举但漏识别
**症状**:`status` 字段被推为 `number`,没产 enum
**原因**:正则没匹配到描述里的枚举语义
**修复**:检查描述是否含 `0-启用,1-停用` / `0:x 1:y` / `(1-x 2-y)` 这类格式,补到 type-inference.md 的"enum 识别"段

### 字段名带 snake_case
**症状**:推导出 `customer_name: string`
**原因**:YApi 接口设计就是 snake_case,直接照搬
**修复**:转 camelCase 后再产出。如果后端真的是 snake_case,在 api.ts 函数里做字段名转换:`{ customerName: data.customer_name }`

## 工具/MCP 相关

### `yapi_get_api_desc` 401/403
**症状**:MCP 调用返回未授权
**原因**:`--yapi-token=` 失效或权限不够
**修复**:检查 MCP 配置文件的 token,登录 YApi 拿新 token

### 接口找不到
**症状**:`yapi_get_api_desc` 返回 null
**原因**:接口被删了或 ID 错了
**修复**:用 `yapi_search_apis` 搜关键字确认存在性

### `res_body` 没填
**症状**:响应类型全是 `unknown`
**原因**:YApi 接口没维护响应数据,只有请求
**修复**:让后端补 YApi 文档,或临时让用户提供样例 JSON 让你手工推导

## 工作流相关

### 覆盖了已有 define.ts
**症状**:之前定义的 interface 没了
**原因**:违反铁律——文件已存在时静默覆盖
**修复**:Step 4 必须先 `existsSync` 检查,有冲突给用户三选(覆盖/重命名/跳过)

### mock 混进 api.ts
**症状**:api.ts 函数体里有假数据
**原因**:用户要 mock,但写法不对
**修复**:用 mock.ts + 项目 mock 开关机制(见 mock-template.md),api.ts 永远只调真实路径

### HTTP 方法靠猜
**症状**:写了 GET,但 YApi 接口实际是 POST
**原因**:没读 YApi 返回的 `method` 字段
**修复**:`method` 是 YApi 接口的硬性字段,必须按它来

---

发现新坑?追加到末尾,定期把高频项升级为铁律。
