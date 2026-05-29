---
name: playwright-skill
description: MCP 浏览器操作的项目适配层。skill 不跑测试、不写 spec — 只提供「跑哪个站、怎么登录」的配置(config/playwright-skill.config.json + config/credentials.local.json)和操作 playbook,Claude 在对话里直接用 mcp__playwright__browser_* 工具开浏览器、看 snapshot、点东西、截图。当用户说"打开 X 页面"、"点一下看看"、"截个图"、"验证 bug 修复"、由其它 skill 触发浏览器验证时使用。
version: 8.0.0
---

# Playwright Skill · MCP-first 浏览器操作 playbook

## 0. 设计转向(v8 vs v7)

v7 是个完整的 Playwright test runner(`flows/` `playwright.config.ts` `package.json` `node_modules`),写 spec 文件、跑 `npx playwright test`、拿 exit code。

**v8 砍掉这一切**。skill 只剩两样:

- `config/` — 项目适配层(baseURL / 登录 selector / 凭证)
- `SKILL.md` — 给 Claude 看的操作 playbook

实际开浏览器是用 **MCP playwright 工具**(`mcp__playwright__browser_*`),由对话里的 Claude 边看 `browser_snapshot` 边操作。截图落 `runtime/screenshots/`。

## 1. 铁律(读到必须执行)

1. **不写 spec 文件,不跑 `playwright test`**。需要操作浏览器一律用 MCP `browser_*` 工具。
2. **所有项目相关参数从 `config/playwright-skill.config.json` 读**,不写死 `localhost:5173` / `/login` / `欢迎回来` 等。
3. **登录开关**:`auth.required=true` 才走登录;`false` 时跳过登录直接进站。
4. **登录优先级**:
   - 先 `browser_navigate` 到 `runtime.baseURL + auth.selectors.loginPagePath` 或 `runtime.homePath`,
   - `browser_snapshot` 看当前 URL / DOM,命中 `runtime.loginUrlPatterns` 任一项 → 登录页。
   - 是登录页就读 `config/credentials.local.json` 填账号密码,按 `selectors.submit` 点登录,处理 `orgSelectDialog`,等 `successCheck.text` 出现。
5. **MCP 操作优先用 ref**(snapshot 里的元素引用),而不是 selector。selector 是 fallback。
6. **截图只能写 `runtime/screenshots/`**,通过 `browser_take_screenshot` 的 `filename` 参数指定。
7. **凭证文件 `config/credentials.local.json` 随项目一起提交**,字段 `{username, password}`。
8. **不修改项目根的任何文件**(`tests/` `package.json` 等本 skill 都不碰)。

---

## 2. 目录结构

```
.claude/skills/playwright-skill/
├── SKILL.md                                       本文件
│
├── config/                                        项目适配层
│   ├── playwright-skill.config.schema.json          配置合同
│   ├── playwright-skill.config.example.json         示例(commit)
│   ├── playwright-skill.config.json                 实际生效(随项目 commit,首跑从 example 复制)
│   ├── credentials.local.example.json               凭证示例(commit)
│   └── credentials.local.json                       实际凭证(随项目 commit)
│
└── runtime/                                       ⚠️ gitignore — 临时产物
    └── screenshots/                                 MCP 截图落这
```

无 `lib/`、无 `flows/`、无 `playwright.config.ts`、无 `node_modules`、无 `package.json`。

---

## 3. 工作流(对外接口)

### 3.1 首次安装

```bash
# 复制配置
cp .claude/skills/playwright-skill/config/playwright-skill.config.example.json \
   .claude/skills/playwright-skill/config/playwright-skill.config.json
cp .claude/skills/playwright-skill/config/credentials.local.example.json \
   .claude/skills/playwright-skill/config/credentials.local.json

# 改 config:baseURL / 登录 selector / 成功标识
# 填凭证: { "username": "...", "password": "..." }
chmod 600 .claude/skills/playwright-skill/config/credentials.local.json
```

> 没 `playwright-skill.config.json` 时 Claude 应先复制 example 再操作。
> 没 `credentials.local.json` 时,如果 `auth.required=true`,Claude 应该先问用户账号密码再写盘。

### 3.2 标准 MCP 操作流程(给 Claude 看)

```
1. 读 config/playwright-skill.config.json
2. mcp__playwright__browser_navigate(url = config.runtime.baseURL + 目标路径)
3. mcp__playwright__browser_snapshot()
4. 看 snapshot:
     a) 当前 URL 命中 config.runtime.loginUrlPatterns → 登录页 → 走「登录子流程 §3.3」
     b) 否则 → 已登录,直接进入业务操作
5. 业务操作:browser_click / browser_type / browser_press_key / browser_fill_form ...
6. 需要证据 → browser_take_screenshot(filename = "runtime/screenshots/<scene>.png")
7. 完成后 browser_close
```

### 3.3 登录子流程(auth.required=true 时)

```
前提:已通过 browser_snapshot 看到当前在登录页

1. 读 config/credentials.local.json → {username, password}
   - 文件不存在 → 问用户要(写盘到 credentials.local.json)
2. snapshot 里账号输入框的 ref → browser_type(ref, username)
   ref 不可用时 fallback: 用 selectors.username 作 target
3. 同上填密码
4. browser_click 登录按钮(snapshot 里登录按钮的 ref;fallback selectors.submit)
5. 多机构弹窗(config.auth.orgSelectDialog.enabled=true 且 snapshot 出现 dialogSelector):
   a. browser_click 第一个 itemSelector
   b. browser_click confirmSelector
6. browser_wait_for({ text: config.auth.successCheck.text, time: ... })
7. 登录完成,继续业务操作
```

### 3.4 失效自动重登

业务操作中 `browser_snapshot` 显示当前 URL 又命中 `loginUrlPatterns` → 视为登录态失效:**回到 §3.3 重登**,然后**重新执行刚才失败的那一步**。

---

## 4. 配置详解

详见 `config/playwright-skill.config.schema.json`。最关键的字段:

```jsonc
{
  "auth": {
    "required": true,                               // 主开关
    "credentialsFile": "credentials.local.json",    // 相对 config/ 的路径
    "selectors": {
      "loginPagePath": "/#/login",                  // 登录页路径
      "username": "input[placeholder=\"...\"]",
      "password": "input[placeholder=\"...\"]",
      "submit": "button:has-text(\"登录\")"
    },
    "successCheck": { "text": "欢迎回来" },          // browser_wait_for 这个文本
    "orgSelectDialog": {
      "enabled": true,
      "dialogSelector": "...",
      "itemSelector": "...",
      "confirmSelector": "..."
    }
  },
  "runtime": {
    "baseURL": "http://localhost:5173",
    "routingMode": "hash",
    "homePath": "/#/home",
    "loginUrlPatterns": ["/login", "/#/login"]
  }
}
```

---

## 5. 给上游 skill 的契约(yunxiao-bug-fix / module-flow)

v8 不再用 `npx playwright test` 拿 exit code。新契约是**让对话里的 Claude 用 MCP 操作并口头汇报**:

```markdown
**playwright-skill 调用约定**

需要浏览器验证时,在你的产物 / 引导里写明:

> 用 MCP playwright 验证以下流程:
> 1. 打开 <module-path>
> 2. 点击 <button>
> 3. 期望看到 <text>
> 4. 截图保存到 runtime/screenshots/<scene>.png

Claude 会按 SKILL.md §3 的流程操作,完成后:
- 通过 → 截图路径 + "通过" 一句话
- 失败 → 截图路径 + 失败原因(看到了什么、期望什么)
```

旧的 `cd .claude/skills/playwright-skill && npx playwright test --grep=...` **彻底废弃**。

---

## 6. 反模式(❌)

- ❌ 在 skill 里新建 `flows/`、`playwright.config.ts`、`package.json` 装回 test runner
- ❌ 写死 selector / 文案,绕过 config
- ❌ 截图写到项目源码下或仓库根 `/tmp/`(用 `runtime/screenshots/`)
- ❌ 用 `mcp__playwright__browser_run_code_unsafe` 跑大段脚本绕过 snapshot 流程(只在 ref 完全不可用时降级)
- ❌ 凭证写到 `playwright-skill.config.json` 里(会被 commit)

---

## 7. 常见问题

| 症状 | 排查 |
|---|---|
| MCP `browser_navigate` 一直 404 | 项目 dev server 没起,先 `pnpm dev` |
| 登录后没看到 `successCheck.text` | dev server 没编译完,等几秒重 snapshot;或文案改了,改 config |
| 凭证错 | 删 `config/credentials.local.json` 重填 |
| 当前 snapshot 太大 | 加 `depth: 3` 或 `target: <ref>` 局部抓 |

---

## 8. 改造历史

- **v1.0.0(2026-05-21)** — **MCP-first 全面瘦身**:
  - 砍掉 `flows/` `flows-templates/` `playwright.config.ts` `package.json` `node_modules` `run.cjs`
  - 砍掉 `lib/{auth-manager,auth-guard,nav,helpers,credentials}.mjs`(MCP 直接读 config 即可)
  - 砍掉 `runtime/auth/`(MCP 不复用 storageState,session 在对话内)
  - 上游契约从「跑 spec 拿 exit code」改为「让 Claude MCP 操作并汇报」
  - 配置 schema 精简(去掉 maxAgeHours / envUsername / envPassword / interactivePrompt / devServerCheckPorts)
- **v1.0.0** — 完全自包含的 test runner(已废弃)
- **v1.0.0** — agent flow 体系
- **v4-5** — 早期 helpers 精简
