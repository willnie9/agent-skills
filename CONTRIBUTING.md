# Contributing

## 安装到你的项目

这个仓库是 Claude Code skill 体系，不是一个独立运行的工具。使用前需要把它集成到你的业务项目里。

### 前置条件

- [Claude Code](https://docs.anthropic.com/claude-code) 已安装并配置
- Node.js >= 18
- 业务项目使用 Vue 3 + Element Plus（其他栈可替换实现层脚本）

### 安装步骤

```bash
# 1. 克隆本仓库到临时目录
git clone https://github.com/willnie9/agent-skills.git /tmp/agent-skills

# 2. 在你的业务项目根目录执行
cd your-project

# 3. 创建 .claude/ 目录结构
mkdir -p .claude/hooks .claude/skills .claude/state .claude/results

# 4. 复制 skills（全部或按需选择）
cp -r /tmp/agent-skills/module-flow           .claude/skills/
cp -r /tmp/agent-skills/master-go-to-code     .claude/skills/
cp -r /tmp/agent-skills/yapi-to-code          .claude/skills/
cp -r /tmp/agent-skills/frontend-page-design  .claude/skills/
cp -r /tmp/agent-skills/playwright-skill      .claude/skills/
cp -r /tmp/agent-skills/yunxiao-bug-fix       .claude/skills/
cp -r /tmp/agent-skills/auto-ui-explorer      .claude/skills/
cp -r /tmp/agent-skills/_shared               .claude/skills/

# 5. 复制顶层配置
cp /tmp/agent-skills/project.config.json      .claude/skills/project.config.json
cp /tmp/agent-skills/schemas/project-config.schema.json .claude/skills/schemas/

# 6. 复制 hooks
cp /tmp/agent-skills/hooks/*.mjs  .claude/hooks/

# 7. 配置 Claude Code settings（把 settings.sample.json 合并到 .claude/settings.json）
cp /tmp/agent-skills/settings.sample.json .claude/settings.json

# 8. 安装 master-go-to-code 依赖
cd .claude/skills/master-go-to-code && npm install && cd -

# 9. 配置 playwright-skill（复制示例配置后按你的项目修改）
cp .claude/skills/playwright-skill/config/playwright-skill.config.example.json \
   .claude/skills/playwright-skill/config/playwright-skill.config.json
cp .claude/skills/playwright-skill/config/credentials.local.example.json \
   .claude/skills/playwright-skill/config/credentials.local.json
# 编辑上面两个文件，填入你的 baseURL、登录 selector、账号密码

# 10. 按你的项目修改 project.config.json
# 编辑 .claude/skills/project.config.json，填入你的 viewsDir、cacheDir、routerFiles 等
```

### 配置 MCP

根据你用到的 skill，在项目根 `.mcp.json` 配置对应 MCP 服务：

```json
{
  "mcpServers": {
    "mastergo-magic-mcp": { ... },
    "yapi-auto-mcp": { ... },
    "aliyun-yunxiao": { ... },
    "playwright": { ... }
  }
}
```

详见各平台官方文档。

### 验证安装

```bash
# 检查 hooks 语法
for f in .claude/hooks/*.mjs; do node --check "$f" && echo "$f OK"; done

# 检查 master-go-to-code 依赖
node -e "import('.claude/skills/master-go-to-code/node_modules/sharp/lib/index.js').then(() => console.log('sharp OK'))"
```

---

## 新增 Skill

1. 在仓库根建 `<skill-name>/` 目录
2. 创建 `SKILL.md`（必须有 frontmatter）：
   ```yaml
   ---
   name: skill-name
   description: 一句话描述，触发条件写清楚。禁止含 ---
   version: 1.0.0
   ---
   ```
3. 按需添加 `references/`、`schemas/`、`scripts/` 子目录
4. SKILL.md 末尾加 `## Changelog`
5. 同步更新 `docs/STATUS.md` 版本矩阵和触发关键词表

## 修改已有 Skill

- 修改逻辑后同步更新 `version`（遵循 semver：修 bug 升 patch，新功能升 minor）
- 在 `## Changelog` 补一条记录
- 如果改了上下游契约（输入/输出 schema），同步更新 `docs/STATUS.md` 的改进历史

## Hook 规则

- Hook 写错了不应该卡住正常工作流——`_lib.mjs` 里的约定：推断不出目标就 `pass()`，只在命中拦截规则时 `block()`
- 改评论校验规则只动 `yunxiao-bug-fix/config/yunxiao-comment.schema.json`，不需要动 hook 代码
- 新增 hook 需要同步更新 `settings.sample.json` 和 `hooks/README.md`

## 提交规范

```
feat(<skill>): 新增 xxx 功能
fix(<hook>): 修复 xxx bug
docs: 更新 STATUS.md / CONTRIBUTING.md
chore: 升级依赖
```
