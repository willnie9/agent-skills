# 数据策略 4 选项

> 本文件被 [SKILL.md](../SKILL.md) Step 2 引用。当用户只贴 mastergo URL 没贴 yapi URL 时,**必须**主动展示以下 4 选项,不要默认走 mock。

## 触发条件

- `stages` 含 B 但 `apiLink` 为空
- 且用户没明确说"用 mock" / "我没接口"

## 展示模板

```markdown
🔍 我看到你给了 MasterGo 链接但没给 YApi。接口数据怎么处理?

┌─ A. 🎭 纯静态页面 + Mock 数据 ────────────────────────────────────
│  • Index.vue 里 const tableData = ref([{ /* 静态数据 */ }])
│  • 关键位置加 // TODO: 对接接口 注释
│  • 不生成 src/cache/<module>/
│  • 适合:还没后端、纯设计稿评审、原型 demo
│  • 后续接入:人工把 ref 数据换成 API 调用
├─ B. 🔌 接入 YApi 接口(你现在就给链接) ──────────────────────────
│  • 让我并行跑 yapi-to-code 生成 define.ts + api.ts
│  • 适合:接口已定好、要真正联调
│  • 你回复:贴 YApi URL(可以多个)
├─ C. 🔍 我去 YApi 搜一下相关接口 ───────────────────────────────
│  • 用 module 名(<推断的module>)做关键词模糊搜索
│  • 列出找到的接口让你勾选
│  • 适合:不确定 YApi 里有没有、先查
│  • 搜不到 → 回到 A
├─ D. 📦 axios-mock-adapter 半 mock(推荐) ────────────────────────
│  • 生成 mock.ts + VITE_<MODULE>_MOCK 开关
│  • api.ts 路径占位,函数定义照写
│  • 拦截响应假装真接口
│  • 适合:已知接口契约但后端未就绪
│  • 后端就绪 → .env.development 关 MOCK,代码不动
└────────────────────────────────────────────────────────────────

回复 A / B / C / D,或描述你想要的
```

## 4 选项的字段映射与后续 Stage

| 用户选 | dataStrategy | stages | 后续动作 |
|---|---|---|---|
| A | `mock` | `A,C,D`(跳过 B) | Stage C 用静态 ref 数据 + TODO 注释 |
| B | `api` | `A,B,C,D` | 反问用户"请给 yapi 链接",收到后跑完整 4 阶段 |
| C | — | — | 先调 `yapi_search_apis` 搜,搜到的接口让用户勾选 → 转 B |
| D | `auto` | `A,B,C,D` | Stage B 同时生成 define + api + mock.ts |

## 用户回复的歧义处理

| 用户说 | 当作什么 |
|---|---|
| "A" / "纯静态" / "mock" / "没接口" | A |
| "B" + 贴 yapi URL | B |
| "B" 但没贴 URL | 反问"请给 yapi 链接" |
| "C" / "帮我搜" / "你查一下有没有" | C |
| "D" / "半 mock" / "VITE 开关" | D |
| 含糊不清(如"先看看") | 默认 A,但告诉用户"如果之后想接接口,可以重新跑或手动加" |
