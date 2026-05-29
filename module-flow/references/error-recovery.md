# 错误恢复策略

> 本文件被 [SKILL.md](../SKILL.md) Step 4 引用。各 Stage 失败时的处理矩阵。

## 总原则

| Stage | 失败处理 |
|---|---|
| Stage A | **立即停**(下游依赖 dom-tree.json,跳过会雪崩) |
| Stage B | **立即停**(下游依赖 define.ts/api.ts) |
| Stage C | **立即停**(没法继续 D 验证) |
| Stage D | **警告不打断**(验证不通过不等于代码错,把日志摆出来继续给 git 建议) |

## Stage A 失败矩阵

| 错误类型 | 症状 | 处理 |
|---|---|---|
| MCP Token 失效 | `mcp__getDsl` 401 | 立即停,告知用户检查 MCP 配置文件的 token,可能要登录 MasterGo 拿新 token |
| layerId 错 | DSL 返回空或 children=[] | 让用户在 MasterGo 浏览器确认 layer 存在,重新提供 URL |
| 画板太大 | 精修上下文不够 | 启用 mastergo-rules.md 的"按区块请求"方案,把大画板拆成多个 layer |
| 图片下载失败 | fetch-and-parse.mjs 报网络错 | 重跑(支持断点续传),已下载的会跳过 |
| dom-tree 校验失败 | `validate-dom-tree.mjs` 退出码非 0 | 看 stderr 具体哪条规则违反,回 Step 2 重新精修 |
| preview 视觉不对 | 用户在检查点说"不一致" | 回 Step 2,可让用户提供截图辅助精修 |

## Stage B 失败矩阵

| 错误类型 | 症状 | 处理 |
|---|---|---|
| YApi Token 失效 | 401/403 | 立即停,提示检查 token |
| 接口找不到 | `yapi_get_api_desc` 返回 null | 用 `yapi_search_apis` 搜,搜不到问用户接口是否被删 |
| 响应字段全 unknown | 推导出 `Record<string, unknown>` | YApi 接口没维护响应,让后端补 OR 让用户贴样例 JSON |
| 命名冲突 | define.ts 已有同名 interface | 给用户三选(覆盖/重命名/跳过),不静默覆盖 |
| `req_body_other` 解析失败 | JSON.parse 报错 | 把原始 YApi 响应贴给用户,让用户确认字段类型 |

## Stage C 失败矩阵

| 错误类型 | 症状 | 处理 |
|---|---|---|
| `vue-tsc` 类型错 | 编译报错 | 简单错(import 路径)自动修,复杂错给用户看报错信息 |
| 响应字段访问错 | `Property 'xxx' does not exist` | 响应壳字段名用错(看 yapi-to-code Step 0 探测结果) |
| 路由命名冲突 | 路由常量重名 | 让用户选重命名 module 或合并到现有路由 |
| 权限码找不到 | 项目权限码常量不存在 | 用项目兜底常量(如 `WORKBENCH`)+ `TODO(perm)` 注释 |
| 公共组件 import 路径错 | `Cannot find module` | 读项目参考页(Step 1 探测得来)看实际 import 路径 |

## Stage D 失败矩阵(警告不打断)

| 错误类型 | 症状 | 处理 |
|---|---|---|
| 登录态过期 | snapshot 显示当前 URL 又命中 loginUrlPatterns | 按 playwright-skill SKILL.md §3.3 重登,然后重做刚才的步骤 |
| dev server 没起 | browser_navigate 报 ERR_CONNECTION_REFUSED | 提示用户启动 dev server,**不重试**(由用户决定下次手动重做) |
| 主元素找不到 | snapshot 里看不到 mainAction 按钮 | 截图保存,继续 Step 5 |
| 表格空 | snapshot 里 tableSelector 元素无行 | 提示用户检查 mock 开关 / API 是否就绪,继续 Step 5 |
| 配置缺失 | 没有 playwright-skill.config.json / credentials.local.json | **这是 skill 体系错误**,立即停先 cp example 改值 |

## Stage D 失败时的报告模板

```markdown
⚠️ Stage D 验证未通过(失败 1/3 个断言),但 Stage A/B/C 产出完整

失败:expect(page.locator('<列表行选择器>')).not.toHaveCount(0)
原因猜测:mock 数据未注入(`VITE_<MODULE>_MOCK=true` 没设),或 dev server 未启动
截图:test-results/<verifyFlow>.png
trace:test-results/<verifyFlow>/trace.zip

你可以选择:
  A. 接受现状,后续手动调试(Step 5 仍会给 git 建议)
  B. 让我回到 Stage C 检查 mock 数据是否注入
  C. 让我重跑 Stage D(如果只是 dev server 没起来)

或直接说"忽略,给我提交建议"。
```
